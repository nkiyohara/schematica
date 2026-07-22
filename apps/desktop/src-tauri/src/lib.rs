use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::Command as ProcessCommand;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::Serialize;
use tauri::menu::{AboutMetadata, Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{AppHandle, Emitter};

mod ssh;

struct InitialFiles(Vec<String>);

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct InstallContext {
    source: String,
    source_label: String,
    update_owner: String,
    update_command: Option<String>,
    direct_updater_eligible: bool,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct GitContext {
    available: bool,
    root: Option<String>,
    branch: Option<String>,
    commit: Option<String>,
    dirty: bool,
    changed_files: usize,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct LocalDirectoryEntry {
    name: String,
    path: String,
    kind: LocalDirectoryEntryKind,
    size: Option<u64>,
}

#[derive(Clone, Debug, Serialize, PartialEq, Eq, PartialOrd, Ord)]
#[serde(rename_all = "lowercase")]
enum LocalDirectoryEntryKind {
    Directory,
    File,
}

#[tauri::command]
fn read_text_file(path: String) -> Result<String, String> {
    fs::read_to_string(PathBuf::from(path)).map_err(|error| error.to_string())
}

#[tauri::command]
fn write_text_file(path: String, contents: String) -> Result<(), String> {
    atomic_write(Path::new(&path), contents.as_bytes()).map_err(|error| error.to_string())
}

fn atomic_write(requested_path: &Path, contents: &[u8]) -> std::io::Result<()> {
    let path = if fs::symlink_metadata(requested_path)
        .is_ok_and(|metadata| metadata.file_type().is_symlink())
    {
        fs::canonicalize(requested_path)?
    } else {
        requested_path.to_path_buf()
    };
    let parent = path
        .parent()
        .filter(|parent| !parent.as_os_str().is_empty())
        .unwrap_or(Path::new("."));
    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("config");
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    let temporary = parent.join(format!(
        ".{file_name}.schematica-{}-{nonce}.tmp",
        std::process::id()
    ));
    let existing_permissions = fs::metadata(&path)
        .ok()
        .map(|metadata| metadata.permissions());
    let mut file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&temporary)?;

    let result = (|| {
        file.write_all(contents)?;
        file.sync_all()?;
        if let Some(permissions) = existing_permissions {
            fs::set_permissions(&temporary, permissions)?;
        }
        drop(file);
        fs::rename(&temporary, &path)?;

        #[cfg(unix)]
        OpenOptions::new().read(true).open(parent)?.sync_all()?;

        Ok(())
    })();

    if result.is_err() {
        let _ = fs::remove_file(&temporary);
    }
    result
}

#[tauri::command]
fn list_local_directory(path: String) -> Result<Vec<LocalDirectoryEntry>, String> {
    let path = PathBuf::from(path.trim());
    if path.as_os_str().is_empty() {
        return Err("Directory path is required.".to_string());
    }
    if !path.is_dir() {
        return Err(format!("Not a directory: {}", path.to_string_lossy()));
    }

    let mut entries = fs::read_dir(&path)
        .map_err(|error| error.to_string())?
        .flatten()
        .filter_map(local_directory_entry)
        .collect::<Vec<_>>();
    entries.sort_by(|left, right| {
        left.kind
            .cmp(&right.kind)
            .then_with(|| left.name.to_lowercase().cmp(&right.name.to_lowercase()))
    });
    Ok(entries)
}

fn local_directory_entry(entry: fs::DirEntry) -> Option<LocalDirectoryEntry> {
    let metadata = entry.metadata().ok()?;
    let kind = if metadata.is_dir() {
        LocalDirectoryEntryKind::Directory
    } else if metadata.is_file() {
        LocalDirectoryEntryKind::File
    } else {
        return None;
    };

    Some(LocalDirectoryEntry {
        name: entry.file_name().to_string_lossy().to_string(),
        path: entry.path().to_string_lossy().to_string(),
        size: (kind == LocalDirectoryEntryKind::File).then_some(metadata.len()),
        kind,
    })
}

#[tauri::command]
fn ssh_hosts() -> Vec<ssh::SshHostCandidate> {
    ssh::discover_hosts()
}

#[tauri::command]
fn set_ssh_password(
    credentials: tauri::State<'_, ssh::SshCredentialStore>,
    host: String,
    password: String,
) -> Result<(), String> {
    credentials.set_password(&host, password)
}

#[tauri::command]
fn clear_ssh_password(
    credentials: tauri::State<'_, ssh::SshCredentialStore>,
    host: String,
) -> Result<(), String> {
    credentials.clear_password(&host)
}

#[tauri::command]
async fn read_ssh_text_file(
    credentials: tauri::State<'_, ssh::SshCredentialStore>,
    request: ssh::RemoteSshFileRequest,
) -> Result<String, String> {
    let password = credentials.password(request.host())?;
    tauri::async_runtime::spawn_blocking(move || ssh::read_text_file(request, password.as_deref()))
        .await
        .map_err(|error| format!("SSH read task failed: {error}"))?
}

#[tauri::command]
async fn list_ssh_directory(
    credentials: tauri::State<'_, ssh::SshCredentialStore>,
    request: ssh::RemoteSshFileRequest,
) -> Result<Vec<ssh::RemoteDirectoryEntry>, String> {
    let password = credentials.password(request.host())?;
    tauri::async_runtime::spawn_blocking(move || ssh::list_directory(request, password.as_deref()))
        .await
        .map_err(|error| format!("SSH directory task failed: {error}"))?
}

#[tauri::command]
async fn write_ssh_text_file(
    credentials: tauri::State<'_, ssh::SshCredentialStore>,
    request: ssh::RemoteSshFileRequest,
    contents: String,
) -> Result<(), String> {
    let password = credentials.password(request.host())?;
    tauri::async_runtime::spawn_blocking(move || {
        ssh::write_text_file(request, contents, password.as_deref())
    })
    .await
    .map_err(|error| format!("SSH write task failed: {error}"))?
}

#[tauri::command]
fn initial_files(files: tauri::State<'_, InitialFiles>) -> Vec<String> {
    files.0.clone()
}

#[tauri::command]
fn install_context() -> InstallContext {
    detect_install_context()
}

#[tauri::command]
fn git_context(anchor_path: Option<String>) -> GitContext {
    detect_git_context(anchor_path)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .manage(InitialFiles(initial_file_args()))
        .manage(ssh::SshCredentialStore::default())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            setup_application_menu(app)?;
            Ok(())
        })
        .on_menu_event(|app, event| {
            let id = event.id().as_ref();
            if id.contains('.') {
                let _ = app.emit("schematica://menu", id);
            }
        })
        .invoke_handler(tauri::generate_handler![
            git_context,
            clear_ssh_password,
            install_context,
            initial_files,
            list_local_directory,
            list_ssh_directory,
            read_ssh_text_file,
            read_text_file,
            ssh_hosts,
            set_ssh_password,
            write_ssh_text_file,
            write_text_file
        ])
        .build(tauri::generate_context!())
        .expect("error while building Schematica");

    app.run(move |app_handle, event| {
        #[cfg(target_os = "macos")]
        if let tauri::RunEvent::Opened { urls } = event {
            emit_opened_file_paths(app_handle, urls);
        }

        #[cfg(not(target_os = "macos"))]
        {
            let _ = app_handle;
            let _ = event;
        }
    });
}

pub fn run_ssh_askpass_if_requested() -> bool {
    ssh::run_askpass_if_requested()
}

fn setup_application_menu(app: &tauri::App) -> tauri::Result<()> {
    let menu = build_application_menu(app.handle())?;
    app.set_menu(menu)?;
    Ok(())
}

fn build_application_menu(app: &AppHandle) -> tauri::Result<Menu<tauri::Wry>> {
    let pkg_info = app.package_info();
    let config = app.config();
    let about_metadata = AboutMetadata {
        name: Some(pkg_info.name.clone()),
        version: Some(pkg_info.version.to_string()),
        copyright: config.bundle.copyright.clone(),
        authors: config
            .bundle
            .publisher
            .clone()
            .map(|publisher| vec![publisher]),
        ..Default::default()
    };

    let file_menu = Submenu::with_items(
        app,
        "File",
        true,
        &[
            &MenuItem::with_id(app, "file.new", "New Config", true, Some("CmdOrCtrl+N"))?,
            &MenuItem::with_id(
                app,
                "file.open",
                "Open Config...",
                true,
                Some("CmdOrCtrl+O"),
            )?,
            &MenuItem::with_id(
                app,
                "file.open-folder",
                "Open Folder...",
                true,
                Some("CmdOrCtrl+Shift+F"),
            )?,
            &MenuItem::with_id(app, "file.open-ssh", "Open via SSH...", true, None::<&str>)?,
            &MenuItem::with_id(
                app,
                "file.open-schema",
                "Open Schema...",
                true,
                Some("CmdOrCtrl+Shift+O"),
            )?,
            &MenuItem::with_id(
                app,
                "file.open-settings",
                "Open Schematica Settings...",
                true,
                None::<&str>,
            )?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(app, "file.save", "Save", true, Some("CmdOrCtrl+S"))?,
            &MenuItem::with_id(
                app,
                "file.save-as",
                "Save As...",
                true,
                Some("CmdOrCtrl+Shift+S"),
            )?,
            &MenuItem::with_id(
                app,
                "file.export-settings",
                "Export Schematica Settings...",
                true,
                None::<&str>,
            )?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(
                app,
                "file.close-document",
                "Close Config",
                true,
                Some("CmdOrCtrl+W"),
            )?,
            #[cfg(not(target_os = "macos"))]
            &PredefinedMenuItem::separator(app)?,
            #[cfg(not(target_os = "macos"))]
            &PredefinedMenuItem::quit(app, None)?,
        ],
    )?;

    let edit_menu = Submenu::with_items(
        app,
        "Edit",
        true,
        &[
            &PredefinedMenuItem::undo(app, None)?,
            &PredefinedMenuItem::redo(app, None)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::cut(app, None)?,
            &PredefinedMenuItem::copy(app, None)?,
            &PredefinedMenuItem::paste(app, None)?,
            &PredefinedMenuItem::select_all(app, None)?,
        ],
    )?;

    let view_menu = Submenu::with_items(
        app,
        "View",
        true,
        &[
            &MenuItem::with_id(
                app,
                "view.command-palette",
                "Command Palette...",
                true,
                Some("CmdOrCtrl+K"),
            )?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(app, "view.editor", "Editor", true, Some("CmdOrCtrl+1"))?,
            &MenuItem::with_id(app, "view.compare", "Compare", true, Some("CmdOrCtrl+2"))?,
            &MenuItem::with_id(app, "view.settings", "Settings", true, Some("CmdOrCtrl+3"))?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(
                app,
                "view.toggle-raw",
                "Toggle Raw Editor",
                true,
                Some("CmdOrCtrl+Shift+R"),
            )?,
            &MenuItem::with_id(
                app,
                "view.toggle-problems",
                "Toggle Problems",
                true,
                Some("CmdOrCtrl+Shift+M"),
            )?,
            #[cfg(target_os = "macos")]
            &PredefinedMenuItem::separator(app)?,
            #[cfg(target_os = "macos")]
            &PredefinedMenuItem::fullscreen(app, None)?,
        ],
    )?;

    let tools_menu = Submenu::with_items(
        app,
        "Tools",
        true,
        &[&MenuItem::with_id(
            app,
            "tools.check-updates",
            "Check for Updates...",
            true,
            None::<&str>,
        )?],
    )?;

    let window_menu = Submenu::with_id_and_items(
        app,
        tauri::menu::WINDOW_SUBMENU_ID,
        "Window",
        true,
        &[
            &PredefinedMenuItem::minimize(app, None)?,
            &PredefinedMenuItem::maximize(app, None)?,
            #[cfg(target_os = "macos")]
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::close_window(app, None)?,
        ],
    )?;

    let help_menu = Submenu::with_id_and_items(
        app,
        tauri::menu::HELP_SUBMENU_ID,
        "Help",
        true,
        &[
            &MenuItem::with_id(app, "help.feedback", "Report Issue...", true, None::<&str>)?,
            #[cfg(not(target_os = "macos"))]
            &PredefinedMenuItem::separator(app)?,
            #[cfg(not(target_os = "macos"))]
            &PredefinedMenuItem::about(app, None, Some(about_metadata.clone()))?,
        ],
    )?;

    Menu::with_items(
        app,
        &[
            #[cfg(target_os = "macos")]
            &Submenu::with_items(
                app,
                pkg_info.name.clone(),
                true,
                &[
                    &PredefinedMenuItem::about(app, None, Some(about_metadata))?,
                    &PredefinedMenuItem::separator(app)?,
                    &PredefinedMenuItem::services(app, None)?,
                    &PredefinedMenuItem::separator(app)?,
                    &PredefinedMenuItem::hide(app, None)?,
                    &PredefinedMenuItem::hide_others(app, None)?,
                    &PredefinedMenuItem::show_all(app, None)?,
                    &PredefinedMenuItem::separator(app)?,
                    &PredefinedMenuItem::quit(app, None)?,
                ],
            )?,
            &file_menu,
            &edit_menu,
            &view_menu,
            &tools_menu,
            &window_menu,
            &help_menu,
        ],
    )
}

#[cfg(target_os = "macos")]
fn emit_opened_file_paths(app: &AppHandle, urls: Vec<tauri::Url>) {
    let paths: Vec<String> = urls
        .into_iter()
        .filter_map(|url| url.to_file_path().ok())
        .filter(|path| path.is_file() && is_config_extension(path))
        .map(|path| path.to_string_lossy().into_owned())
        .collect();

    if !paths.is_empty() {
        let _ = app.emit("schematica://open-files", paths);
    }
}

fn initial_file_args() -> Vec<String> {
    std::env::args_os()
        .skip(1)
        .map(PathBuf::from)
        .filter(|path| path.is_file() && is_config_extension(path))
        .map(|path| path.to_string_lossy().into_owned())
        .collect()
}

fn is_config_extension(path: &std::path::Path) -> bool {
    matches!(
        path.extension()
            .and_then(|extension| extension.to_str())
            .map(str::to_ascii_lowercase)
            .as_deref(),
        Some("json" | "toml" | "yaml" | "yml")
    )
}

fn detect_install_context() -> InstallContext {
    if let Some(channel) = configured_install_channel() {
        return install_context_for_channel(&channel);
    }

    if std::env::var_os("APPIMAGE").is_some() {
        return install_context_for_channel("appimage");
    }

    #[cfg(debug_assertions)]
    return install_context_for_channel("development");

    #[cfg(not(debug_assertions))]
    {
        let executable = std::env::current_exe().ok();
        infer_install_context_from_path(executable.as_ref())
    }
}

fn configured_install_channel() -> Option<String> {
    std::env::var("SCHEMATICA_INSTALL_CHANNEL")
        .ok()
        .filter(|value| !value.trim().is_empty())
        .or_else(|| option_env!("SCHEMATICA_INSTALL_CHANNEL").map(str::to_owned))
}

fn install_context_for_channel(channel: &str) -> InstallContext {
    match normalize_channel(channel).as_str() {
        "homebrew" => managed_context(
            "homebrew",
            "Homebrew Cask",
            "Homebrew",
            "brew upgrade --cask schematica",
        ),
        "winget" => managed_context(
            "winget",
            "WinGet",
            "WinGet",
            "winget upgrade Schematica.Schematica",
        ),
        "apt" => managed_context(
            "apt",
            "APT repository",
            "APT",
            "sudo apt update && sudo apt upgrade schematica",
        ),
        "rpm" => managed_context(
            "rpm",
            "RPM repository",
            "dnf/zypper",
            "sudo dnf upgrade schematica",
        ),
        "appimage" => direct_context("appimage", "AppImage"),
        "direct" => direct_context("direct", "Direct download"),
        "development" => managed_context(
            "development",
            "Development build",
            "developer workflow",
            "git pull && corepack pnpm install",
        ),
        _ => unknown_context(),
    }
}

#[cfg(not(debug_assertions))]
fn infer_install_context_from_path(executable: Option<&PathBuf>) -> InstallContext {
    let Some(path) = executable else {
        return unknown_context();
    };
    let path_text = path.to_string_lossy().replace('\\', "/");

    if path_text.contains("/Cellar/") || path_text.contains("/Caskroom/") {
        return install_context_for_channel("homebrew");
    }

    if path_text.contains("/WindowsApps/") {
        return install_context_for_channel("winget");
    }

    if path_text.starts_with("/usr/bin/")
        || path_text.starts_with("/usr/local/bin/")
        || path_text.starts_with("/opt/")
    {
        return managed_context(
            "os-package",
            "OS package",
            "system package manager",
            "use the package manager that installed Schematica",
        );
    }

    unknown_context()
}

fn normalize_channel(channel: &str) -> String {
    match channel.trim().to_ascii_lowercase().as_str() {
        "brew" | "homebrew-cask" | "cask" => "homebrew".to_owned(),
        "deb" | "debian" | "ubuntu" => "apt".to_owned(),
        "dnf" | "yum" | "zypper" | "suse" | "fedora" => "rpm".to_owned(),
        "github" | "github-release" | "dmg" | "nsis" | "msi" => "direct".to_owned(),
        other => other.to_owned(),
    }
}

fn managed_context(
    source: &str,
    source_label: &str,
    update_owner: &str,
    update_command: &str,
) -> InstallContext {
    InstallContext {
        source: source.to_owned(),
        source_label: source_label.to_owned(),
        update_owner: update_owner.to_owned(),
        update_command: Some(update_command.to_owned()),
        direct_updater_eligible: false,
    }
}

fn direct_context(source: &str, source_label: &str) -> InstallContext {
    InstallContext {
        source: source.to_owned(),
        source_label: source_label.to_owned(),
        update_owner: "Tauri signed updater".to_owned(),
        update_command: None,
        direct_updater_eligible: true,
    }
}

fn unknown_context() -> InstallContext {
    InstallContext {
        source: "unknown".to_owned(),
        source_label: "Unknown install channel".to_owned(),
        update_owner: "external installer or package manager".to_owned(),
        update_command: Some("use the tool that installed Schematica".to_owned()),
        direct_updater_eligible: false,
    }
}

fn detect_git_context(anchor_path: Option<String>) -> GitContext {
    let anchor = anchor_path
        .map(PathBuf::from)
        .and_then(|path| {
            if path.is_file() {
                path.parent().map(PathBuf::from)
            } else if path.is_dir() {
                Some(path)
            } else {
                None
            }
        })
        .or_else(|| std::env::current_dir().ok());

    let Some(anchor) = anchor else {
        return unavailable_git_context();
    };

    let Some(root) = run_git(&anchor, ["rev-parse", "--show-toplevel"]) else {
        return unavailable_git_context();
    };

    let root_path = PathBuf::from(root.trim());
    let status = run_git(&root_path, ["status", "--porcelain"]).unwrap_or_default();
    GitContext {
        available: true,
        root: Some(root_path.to_string_lossy().into_owned()),
        branch: run_git(&root_path, ["branch", "--show-current"])
            .map(|value| value.trim().to_owned()),
        commit: run_git(&root_path, ["rev-parse", "--short", "HEAD"])
            .map(|value| value.trim().to_owned()),
        dirty: !status.trim().is_empty(),
        changed_files: status
            .lines()
            .filter(|line| !line.trim().is_empty())
            .count(),
    }
}

fn run_git<const N: usize>(current_dir: &std::path::Path, args: [&str; N]) -> Option<String> {
    let output = ProcessCommand::new("git")
        .args(args)
        .current_dir(current_dir)
        .output()
        .ok()?;

    if output.status.success() {
        Some(String::from_utf8_lossy(&output.stdout).into_owned())
    } else {
        None
    }
}

fn unavailable_git_context() -> GitContext {
    GitContext {
        available: false,
        root: None,
        branch: None,
        commit: None,
        dirty: false,
        changed_files: 0,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn atomic_write_replaces_contents_without_leaving_temporary_files() {
        let directory = unique_test_directory("atomic-write");
        fs::create_dir_all(&directory).unwrap();
        let path = directory.join("config.yaml");
        fs::write(&path, "before\n").unwrap();

        atomic_write(&path, b"after\n").unwrap();

        assert_eq!(fs::read_to_string(&path).unwrap(), "after\n");
        assert_eq!(fs::read_dir(&directory).unwrap().count(), 1);
        fs::remove_dir_all(directory).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn atomic_write_preserves_permissions() {
        use std::os::unix::fs::PermissionsExt;

        let directory = unique_test_directory("atomic-permissions");
        fs::create_dir_all(&directory).unwrap();
        let path = directory.join("config.yaml");
        fs::write(&path, "before\n").unwrap();
        fs::set_permissions(&path, fs::Permissions::from_mode(0o640)).unwrap();

        atomic_write(&path, b"after\n").unwrap();

        assert_eq!(
            fs::metadata(&path).unwrap().permissions().mode() & 0o777,
            0o640
        );
        fs::remove_dir_all(directory).unwrap();
    }

    fn unique_test_directory(label: &str) -> PathBuf {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos();
        std::env::temp_dir().join(format!("schematica-{label}-{}-{nonce}", std::process::id()))
    }
}
