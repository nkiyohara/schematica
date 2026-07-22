use std::collections::{HashMap, HashSet};
use std::env;
use std::fs;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::process::{Child, Command as ProcessCommand, Output, Stdio};
use std::sync::Mutex;
use std::thread;
use std::time::{Duration, Instant};

#[cfg(unix)]
use std::os::unix::process::CommandExt;

use serde::{Deserialize, Serialize};

const MAX_SSH_STDOUT_BYTES: usize = 64 * 1024 * 1024;
const MAX_SSH_STDERR_BYTES: usize = 1024 * 1024;
const SSH_OUTPUT_TRUNCATED_NOTICE: &[u8] = b"\n[SSH diagnostic output truncated]\n";
const SSH_AUTH_REQUIRED_PREFIX: &str = "SSH_AUTH_REQUIRED:";
const SSH_ASKPASS_MODE: &str = "SCHEMATICA_SSH_ASKPASS";
const SSH_ASKPASS_SECRET: &str = "SCHEMATICA_SSH_ASKPASS_SECRET";

#[derive(Default)]
pub struct SshCredentialStore {
    passwords: Mutex<HashMap<String, String>>,
}

impl SshCredentialStore {
    pub fn set_password(&self, host: &str, password: String) -> Result<(), String> {
        let host = normalize_host(host)?;
        validate_password(&password)?;
        self.passwords
            .lock()
            .map_err(|_| "SSH credential store is unavailable.".to_string())?
            .insert(host, password);
        Ok(())
    }

    pub fn clear_password(&self, host: &str) -> Result<(), String> {
        let host = normalize_host(host)?;
        self.passwords
            .lock()
            .map_err(|_| "SSH credential store is unavailable.".to_string())?
            .remove(&host);
        Ok(())
    }

    pub fn password(&self, host: &str) -> Result<Option<String>, String> {
        let host = normalize_host(host)?;
        Ok(self
            .passwords
            .lock()
            .map_err(|_| "SSH credential store is unavailable.".to_string())?
            .get(&host)
            .cloned())
    }
}

pub fn run_askpass_if_requested() -> bool {
    if env::var_os(SSH_ASKPASS_MODE).is_none() {
        return false;
    }

    if let Some(secret) = env::var_os(SSH_ASKPASS_SECRET) {
        println!("{}", secret.to_string_lossy());
    }
    true
}

struct CapturedStream {
    bytes: Vec<u8>,
    truncated: bool,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SshHostCandidate {
    host: String,
    label: String,
    source: SshHostSource,
    source_path: Option<String>,
    line: Option<usize>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum SshHostSource {
    Config,
    KnownHosts,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteSshFileRequest {
    host: String,
    path: String,
}

impl RemoteSshFileRequest {
    pub fn host(&self) -> &str {
        &self.host
    }
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteDirectoryEntry {
    name: String,
    path: String,
    kind: RemoteDirectoryEntryKind,
    size: Option<u64>,
}

#[derive(Clone, Debug, Serialize, PartialEq, Eq, PartialOrd, Ord)]
#[serde(rename_all = "lowercase")]
pub enum RemoteDirectoryEntryKind {
    Directory,
    File,
}

pub fn discover_hosts() -> Vec<SshHostCandidate> {
    let Some(home) = home_dir() else {
        return Vec::new();
    };

    let mut collector = SshHostCollector::default();
    let mut visited = HashSet::new();
    parse_ssh_config_file(
        &home.join(".ssh/config"),
        &home,
        &mut visited,
        &mut collector,
    );
    parse_known_hosts_file(&home.join(".ssh/known_hosts"), &mut collector);
    parse_known_hosts_file(&home.join(".ssh/known_hosts2"), &mut collector);
    collector.into_sorted_hosts()
}

pub fn read_text_file(
    request: RemoteSshFileRequest,
    password: Option<&str>,
) -> Result<String, String> {
    let host = normalize_host(&request.host)?;
    let path = normalize_remote_path(&request.path)?;
    let mut command = ssh_command(&host, password)?;
    command.arg(remote_shell_command(
        &remote_read_script(),
        "schematica-read",
        &path,
    ));
    let output = run_command_with_timeout(command, None, ssh_command_timeout())
        .map_err(|error| remote_transport_error("read", &host, &path, &error))?;

    if !output.status.success() {
        return Err(remote_command_error("read", &host, &path, &output.stderr));
    }

    String::from_utf8(output.stdout)
        .map_err(|_| format!("Remote file {host}:{path} is not valid UTF-8."))
}

pub fn list_directory(
    request: RemoteSshFileRequest,
    password: Option<&str>,
) -> Result<Vec<RemoteDirectoryEntry>, String> {
    let host = normalize_host(&request.host)?;
    let path = normalize_remote_path(&request.path)?;
    let mut command = ssh_command(&host, password)?;
    command.arg(remote_shell_command(
        &remote_list_script(),
        "schematica-list",
        &path,
    ));
    let output = run_command_with_timeout(command, None, ssh_command_timeout())
        .map_err(|error| remote_transport_error("list", &host, &path, &error))?;

    if !output.status.success() {
        return Err(remote_command_error("list", &host, &path, &output.stderr));
    }

    parse_remote_directory_entries(&output.stdout)
}

pub fn write_text_file(
    request: RemoteSshFileRequest,
    contents: String,
    password: Option<&str>,
) -> Result<(), String> {
    let host = normalize_host(&request.host)?;
    let path = normalize_remote_path(&request.path)?;
    let mut command = ssh_command(&host, password)?;
    command.arg(remote_shell_command(
        &remote_write_script(),
        "schematica-write",
        &path,
    ));
    let output =
        run_command_with_timeout(command, Some(contents.into_bytes()), ssh_command_timeout())
            .map_err(|error| remote_transport_error("write", &host, &path, &error))?;
    if !output.status.success() {
        return Err(remote_command_error("write", &host, &path, &output.stderr));
    }

    Ok(())
}

#[derive(Default)]
struct SshHostCollector {
    hosts: HashMap<String, SshHostCandidate>,
}

impl SshHostCollector {
    fn insert_config_host(&mut self, host: String, source_path: &Path, line: usize) {
        if !is_listable_host_pattern(&host) {
            return;
        }

        self.hosts
            .entry(host.clone())
            .or_insert_with(|| SshHostCandidate {
                host: host.clone(),
                label: host,
                source: SshHostSource::Config,
                source_path: Some(source_path.to_string_lossy().to_string()),
                line: Some(line),
            });
    }

    fn insert_known_host(&mut self, host: String, source_path: &Path, line: usize) {
        if !is_listable_host_pattern(&host) {
            return;
        }

        self.hosts
            .entry(host.clone())
            .or_insert_with(|| SshHostCandidate {
                host: host.clone(),
                label: host,
                source: SshHostSource::KnownHosts,
                source_path: Some(source_path.to_string_lossy().to_string()),
                line: Some(line),
            });
    }

    fn into_sorted_hosts(self) -> Vec<SshHostCandidate> {
        let mut hosts = self.hosts.into_values().collect::<Vec<_>>();
        hosts.sort_by(|left, right| {
            let left_rank = source_rank(&left.source);
            let right_rank = source_rank(&right.source);
            left_rank
                .cmp(&right_rank)
                .then_with(|| left.label.to_lowercase().cmp(&right.label.to_lowercase()))
        });
        hosts
    }
}

fn parse_ssh_config_file(
    path: &Path,
    home: &Path,
    visited: &mut HashSet<PathBuf>,
    collector: &mut SshHostCollector,
) {
    let canonical = path.canonicalize().unwrap_or_else(|_| path.to_path_buf());
    if !visited.insert(canonical) {
        return;
    }

    let Ok(contents) = fs::read_to_string(path) else {
        return;
    };

    let base_dir = path.parent().unwrap_or_else(|| Path::new("."));
    for (index, raw_line) in contents.lines().enumerate() {
        let line_number = index + 1;
        let words = split_ssh_words(raw_line);
        if words.is_empty() {
            continue;
        }

        let keyword = words[0].to_lowercase();
        if keyword == "host" {
            for pattern in words.iter().skip(1) {
                collector.insert_config_host(pattern.to_string(), path, line_number);
            }
            continue;
        }

        if keyword == "include" {
            for pattern in words.iter().skip(1) {
                for include in expand_include_pattern(pattern, base_dir, home) {
                    parse_ssh_config_file(&include, home, visited, collector);
                }
            }
        }
    }
}

fn parse_known_hosts_file(path: &Path, collector: &mut SshHostCollector) {
    let Ok(contents) = fs::read_to_string(path) else {
        return;
    };

    let lines = contents.lines().collect::<Vec<_>>();
    for (index, raw_line) in lines.iter().enumerate().rev() {
        let trimmed = raw_line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') || trimmed.starts_with('|') {
            continue;
        }

        let mut fields = trimmed.split_whitespace();
        let Some(first_field) = fields.next() else {
            continue;
        };
        if first_field.eq_ignore_ascii_case("@revoked") {
            continue;
        }
        let hosts_field = if first_field.starts_with('@') {
            fields.next()
        } else {
            Some(first_field)
        };
        let Some(hosts_field) = hosts_field else {
            continue;
        };
        for host in hosts_field.split(',') {
            if let Some(cleaned) = normalize_known_host_name(host) {
                collector.insert_known_host(cleaned, path, index + 1);
            }
        }
    }
}

fn split_ssh_words(line: &str) -> Vec<String> {
    let mut words = Vec::new();
    let mut current = String::new();
    let mut chars = line.chars().peekable();
    let mut quote: Option<char> = None;
    let mut escaping = false;

    while let Some(ch) = chars.next() {
        if escaping {
            current.push(ch);
            escaping = false;
            continue;
        }

        if ch == '\\' {
            escaping = true;
            continue;
        }

        if quote == Some(ch) {
            quote = None;
            continue;
        }

        if quote.is_none() && (ch == '"' || ch == '\'') {
            quote = Some(ch);
            continue;
        }

        if quote.is_none() && ch == '#' {
            break;
        }

        if quote.is_none() && ch.is_whitespace() {
            if !current.is_empty() {
                words.push(std::mem::take(&mut current));
            }
            while matches!(chars.peek(), Some(next) if next.is_whitespace()) {
                chars.next();
            }
            continue;
        }

        current.push(ch);
    }

    if !current.is_empty() {
        words.push(current);
    }

    words
}

fn expand_include_pattern(pattern: &str, base_dir: &Path, home: &Path) -> Vec<PathBuf> {
    let expanded = expand_path(pattern, base_dir, home);
    if !pattern_has_glob(&expanded) {
        return vec![expanded];
    }

    let parent = expanded.parent().unwrap_or_else(|| Path::new("."));
    let file_pattern = expanded
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or_default();
    let Ok(entries) = fs::read_dir(parent) else {
        return Vec::new();
    };

    let mut paths = entries
        .flatten()
        .map(|entry| entry.path())
        .filter(|path| {
            path.file_name()
                .and_then(|value| value.to_str())
                .is_some_and(|name| wildcard_match(file_pattern, name))
        })
        .collect::<Vec<_>>();
    paths.sort();
    paths
}

fn expand_path(pattern: &str, base_dir: &Path, home: &Path) -> PathBuf {
    let expanded = if pattern == "~" {
        home.to_path_buf()
    } else if let Some(rest) = pattern.strip_prefix("~/") {
        home.join(rest)
    } else {
        PathBuf::from(pattern)
    };

    if expanded.is_absolute() {
        expanded
    } else {
        base_dir.join(expanded)
    }
}

fn wildcard_match(pattern: &str, value: &str) -> bool {
    wildcard_match_bytes(pattern.as_bytes(), value.as_bytes())
}

fn wildcard_match_bytes(pattern: &[u8], value: &[u8]) -> bool {
    if pattern.is_empty() {
        return value.is_empty();
    }

    if pattern[0] == b'*' {
        return wildcard_match_bytes(&pattern[1..], value)
            || (!value.is_empty() && wildcard_match_bytes(pattern, &value[1..]));
    }

    if !value.is_empty() && (pattern[0] == b'?' || pattern[0] == value[0]) {
        return wildcard_match_bytes(&pattern[1..], &value[1..]);
    }

    false
}

fn pattern_has_glob(path: &Path) -> bool {
    path.to_string_lossy().contains('*') || path.to_string_lossy().contains('?')
}

fn normalize_known_host_name(host: &str) -> Option<String> {
    if host.is_empty() || host.starts_with('|') {
        return None;
    }

    if let Some(rest) = host.strip_prefix('[') {
        let (hostname, port) = rest.split_once("]:")?;
        if port == "22" {
            return Some(hostname.to_string());
        }
        port.parse::<u16>().ok().filter(|port| *port > 0)?;
        return Some(if hostname.contains(':') {
            format!("[{hostname}]:{port}")
        } else {
            format!("{hostname}:{port}")
        });
    }

    Some(host.to_string())
}

fn is_listable_host_pattern(host: &str) -> bool {
    !host.is_empty()
        && !host.starts_with('!')
        && !host.starts_with('@')
        && !host.contains('*')
        && !host.contains('?')
        && !host.chars().any(char::is_whitespace)
}

fn normalize_host(host: &str) -> Result<String, String> {
    let host = host.trim();
    if host.is_empty() {
        return Err("SSH host is required.".to_string());
    }
    if host.starts_with('-') || host.chars().any(char::is_whitespace) {
        return Err("SSH host cannot contain whitespace or start with '-'.".to_string());
    }
    if host.chars().any(char::is_control) {
        return Err("SSH host cannot contain control characters.".to_string());
    }
    ssh_destination(host)?;
    Ok(host.to_string())
}

#[derive(Debug, PartialEq, Eq)]
struct SshDestination {
    address: String,
    port: Option<u16>,
}

fn ssh_destination(host: &str) -> Result<SshDestination, String> {
    let (user, target) = if let Some((user, target)) = host.rsplit_once('@') {
        if user.is_empty() || user.contains('@') {
            return Err("SSH user must not be empty or contain '@'.".to_string());
        }
        if target.is_empty() {
            return Err("SSH host is required after '@'.".to_string());
        }
        (Some(user), target)
    } else {
        (None, host)
    };

    if let Some(bracketed) = target.strip_prefix('[') {
        let Some(close) = bracketed.find(']') else {
            return Err("SSH host has an unmatched '['.".to_string());
        };
        let address = &bracketed[..close];
        let suffix = &bracketed[close + 1..];
        let port = if suffix.is_empty() {
            None
        } else if let Some(value) = suffix.strip_prefix(':') {
            Some(parse_ssh_port(value)?)
        } else {
            return Err("Unexpected text after bracketed SSH host.".to_string());
        };
        return Ok(SshDestination {
            address: ssh_destination_address(user, address)?,
            port,
        });
    }

    if target.matches(':').count() == 1 {
        let (address, port) = target.rsplit_once(':').expect("one colon should split");
        return Ok(SshDestination {
            address: ssh_destination_address(user, address)?,
            port: Some(parse_ssh_port(port)?),
        });
    }

    Ok(SshDestination {
        address: ssh_destination_address(user, target)?,
        port: None,
    })
}

fn ssh_destination_address(user: Option<&str>, address: &str) -> Result<String, String> {
    if address.is_empty() {
        return Err("SSH host is required.".to_string());
    }
    if address.starts_with('-') {
        return Err("SSH host cannot start with '-'.".to_string());
    }
    Ok(match user {
        Some(user) => format!("{user}@{address}"),
        None => address.to_string(),
    })
}

fn parse_ssh_port(value: &str) -> Result<u16, String> {
    value
        .parse::<u16>()
        .ok()
        .filter(|port| *port > 0)
        .ok_or_else(|| "SSH port must be between 1 and 65535.".to_string())
}

fn normalize_remote_path(path: &str) -> Result<String, String> {
    let path = path.trim();
    if path.is_empty() {
        return Err("Remote path is required.".to_string());
    }
    if path.chars().any(char::is_control) {
        return Err("Remote path cannot contain control characters.".to_string());
    }
    Ok(path.to_string())
}

fn validate_password(password: &str) -> Result<(), String> {
    if password.is_empty() {
        return Err("SSH password is required.".to_string());
    }
    if password.contains('\0') {
        return Err("SSH password cannot contain a null character.".to_string());
    }
    if password.len() > 4096 {
        return Err("SSH password is too long.".to_string());
    }
    Ok(())
}

fn ssh_command(host: &str, password: Option<&str>) -> Result<ProcessCommand, String> {
    let destination = ssh_destination(host).expect("SSH host should already be normalized");
    let mut command = ProcessCommand::new("ssh");
    command
        .arg("-o")
        .arg("ConnectTimeout=8")
        .arg("-o")
        .arg("ConnectionAttempts=1")
        .arg("-o")
        .arg("ServerAliveInterval=15")
        .arg("-o")
        .arg("ServerAliveCountMax=2")
        .arg("-T");
    if let Some(password) = password {
        validate_password(password)?;
        let executable = env::current_exe()
            .map_err(|error| format!("Could not locate the SSH password helper: {error}"))?;
        command
            .arg("-o")
            .arg("BatchMode=no")
            .arg("-o")
            .arg("PubkeyAuthentication=no")
            .arg("-o")
            .arg("PreferredAuthentications=keyboard-interactive,password")
            .arg("-o")
            .arg("NumberOfPasswordPrompts=1")
            .env("SSH_ASKPASS", executable)
            .env("SSH_ASKPASS_REQUIRE", "force")
            .env(SSH_ASKPASS_MODE, "1")
            .env(SSH_ASKPASS_SECRET, password);
        if env::var_os("DISPLAY").is_none() {
            command.env("DISPLAY", "schematica:0");
        }
    } else {
        command.arg("-o").arg("BatchMode=yes");
    }
    if let Some(port) = destination.port {
        command.arg("-p").arg(port.to_string());
    }
    command.arg(destination.address);
    Ok(command)
}

fn ssh_command_timeout() -> Duration {
    Duration::from_secs(45)
}

fn remote_shell_command(script: &str, command_name: &str, path: &str) -> String {
    format!(
        "sh -c {} {} {}",
        shell_quote(script),
        shell_quote(command_name),
        shell_quote(path)
    )
}

fn shell_quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', "'\"'\"'"))
}

fn run_command_with_timeout(
    mut command: ProcessCommand,
    input: Option<Vec<u8>>,
    timeout: Duration,
) -> Result<Output, String> {
    command
        .stdin(if input.is_some() {
            Stdio::piped()
        } else {
            Stdio::null()
        })
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    #[cfg(unix)]
    command.process_group(0);

    let mut child = command.spawn().map_err(command_start_error)?;
    let Some(mut stdout) = child.stdout.take() else {
        terminate_child(&mut child);
        return Err("Could not capture ssh stdout.".to_string());
    };
    let Some(mut stderr) = child.stderr.take() else {
        terminate_child(&mut child);
        return Err("Could not capture ssh stderr.".to_string());
    };
    let stdout_reader =
        thread::spawn(move || read_stream_limited(&mut stdout, MAX_SSH_STDOUT_BYTES));
    let stderr_reader =
        thread::spawn(move || read_stream_limited(&mut stderr, MAX_SSH_STDERR_BYTES));
    let input_writer = input.map(|bytes| {
        let mut stdin = child.stdin.take();
        thread::spawn(move || -> std::io::Result<()> {
            let mut stdin = stdin
                .take()
                .ok_or_else(|| std::io::Error::other("Could not open stdin for ssh."))?;
            stdin.write_all(&bytes)
        })
    });

    let started = Instant::now();
    let mut status = None;
    let mut wait_error = None;
    let mut timed_out = false;
    loop {
        match child.try_wait() {
            Ok(Some(exit_status)) => {
                status = Some(exit_status);
                break;
            }
            Ok(None) => {}
            Err(error) => {
                wait_error = Some(error.to_string());
                terminate_child(&mut child);
                break;
            }
        }
        if started.elapsed() >= timeout {
            timed_out = true;
            terminate_child(&mut child);
            break;
        }
        thread::sleep(Duration::from_millis(25));
    }

    let stdout_result = stdout_reader
        .join()
        .map_err(|_| "SSH stdout reader stopped unexpectedly.".to_string())?
        .map_err(|error| error.to_string());
    let stderr_result = stderr_reader
        .join()
        .map_err(|_| "SSH stderr reader stopped unexpectedly.".to_string())?
        .map_err(|error| error.to_string());
    let write_result = if let Some(writer) = input_writer {
        Some(
            writer
                .join()
                .map_err(|_| "SSH stdin writer stopped unexpectedly.".to_string())?,
        )
    } else {
        None
    };

    if timed_out {
        return Err(format!(
            "SSH command timed out after {} seconds.",
            timeout.as_secs()
        ));
    }
    if let Some(error) = wait_error {
        return Err(format!("Could not wait for the SSH process: {error}"));
    }

    let stdout = stdout_result?;
    let mut stderr = stderr_result?;
    if stdout.truncated {
        return Err(format!(
            "SSH command returned more than {} MiB of data; refusing to load it into memory.",
            MAX_SSH_STDOUT_BYTES / 1024 / 1024
        ));
    }
    if stderr.truncated {
        stderr.bytes.extend_from_slice(SSH_OUTPUT_TRUNCATED_NOTICE);
    }

    let status = status.ok_or_else(|| "SSH process ended without an exit status.".to_string())?;
    if status.success() {
        if let Some(write_result) = write_result {
            write_result.map_err(|error| error.to_string())?;
        }
    }

    Ok(Output {
        status,
        stdout: stdout.bytes,
        stderr: stderr.bytes,
    })
}

fn read_stream_limited(reader: &mut impl Read, limit: usize) -> std::io::Result<CapturedStream> {
    let mut bytes = Vec::with_capacity(limit.min(64 * 1024));
    let mut truncated = false;
    let mut buffer = [0_u8; 8192];
    loop {
        let count = reader.read(&mut buffer)?;
        if count == 0 {
            break;
        }
        let remaining = limit.saturating_sub(bytes.len());
        let retained = remaining.min(count);
        bytes.extend_from_slice(&buffer[..retained]);
        truncated |= retained < count;
    }
    Ok(CapturedStream { bytes, truncated })
}

fn terminate_child(child: &mut Child) {
    #[cfg(unix)]
    {
        unsafe extern "C" {
            fn kill(pid: i32, signal: i32) -> i32;
        }
        const SIGKILL: i32 = 9;
        let process_group = -(child.id() as i32);
        // SAFETY: the child is started in its own process group above. Sending SIGKILL to the
        // negative group id prevents descendants from retaining our pipe handles after timeout.
        unsafe {
            kill(process_group, SIGKILL);
        }
    }
    let _ = child.kill();
    let _ = child.wait();
}

const REMOTE_EXPAND_PATH_SNIPPET: &str =
    r#"case "$path" in "~") path="$HOME";; "~/"*) path="$HOME/${path#\~/}";; esac"#;

fn remote_read_script() -> String {
    [
        "path=\"$1\"; ",
        REMOTE_EXPAND_PATH_SNIPPET,
        "; cat < \"$path\"",
    ]
    .concat()
}

fn remote_list_script() -> String {
    [
        "path=\"$1\"\n",
        REMOTE_EXPAND_PATH_SNIPPET,
        r#"
[ -d "$path" ] || { printf '%s\n' "Not a directory: $path" >&2; exit 1; }
for entry in "$path"/* "$path"/.[!.]* "$path"/..?*; do
  name=${entry##*/}
  if [ -d "$entry" ]; then
    kind=directory
    size=
  elif [ -f "$entry" ]; then
    kind=file
    size=$(wc -c < "$entry" 2>/dev/null | tr -d " ")
  else
    continue
  fi
  printf "%s\000%s\000%s\000%s\000" "$kind" "$name" "$entry" "$size"
done
"#,
    ]
    .concat()
}

fn remote_write_script() -> String {
    [
        "set -eu\npath=\"$1\"; ",
        REMOTE_EXPAND_PATH_SNIPPET,
        r#"
dir=${path%/*}
[ "$dir" = "$path" ] && dir=.
[ -n "$dir" ] || dir=/
base=${path##*/}
[ -n "$base" ] || { printf '%s\n' "Cannot write a directory path: $path" >&2; exit 1; }
[ ! -d "$path" ] || { printf '%s\n' "Cannot replace a directory: $path" >&2; exit 1; }
[ ! -L "$path" ] || { printf '%s\n' "Refusing to replace symbolic link: $path" >&2; exit 1; }
tmp=$(mktemp "$dir/.${base}.schematica.XXXXXX") || {
  printf '%s\n' "Could not create a temporary file beside: $path" >&2
  exit 1
}
cleanup() { rm -f -- "$tmp" 2>/dev/null || rm -f "$tmp"; }
trap cleanup EXIT HUP INT TERM
if [ -e "$path" ]; then
  mode=$(stat -c %a -- "$path" 2>/dev/null || stat -f %Lp "$path" 2>/dev/null || true)
  [ -z "$mode" ] || chmod "$mode" "$tmp"
fi
cat > "$tmp"
mv -f -- "$tmp" "$path" 2>/dev/null || mv -f "$tmp" "$path"
trap - EXIT HUP INT TERM
"#,
    ]
    .concat()
}

fn parse_remote_directory_entries(stdout: &[u8]) -> Result<Vec<RemoteDirectoryEntry>, String> {
    let mut fields = stdout
        .split(|byte| *byte == b'\0')
        .map(|field| field.to_vec())
        .collect::<Vec<_>>();
    if fields.last().is_some_and(Vec::is_empty) {
        fields.pop();
    }
    if fields.len() % 4 != 0 {
        return Err("Malformed SSH directory listing.".to_string());
    }

    let mut entries = fields
        .chunks(4)
        .map(|chunk| {
            let kind = utf8_field(&chunk[0])?;
            let name = utf8_field(&chunk[1])?;
            let path = utf8_field(&chunk[2])?;
            let size = utf8_field(&chunk[3])?;
            let kind = match kind.as_str() {
                "directory" => RemoteDirectoryEntryKind::Directory,
                "file" => RemoteDirectoryEntryKind::File,
                _ => return Err(format!("Unknown remote entry kind '{kind}'.")),
            };
            let size = if size.is_empty() {
                None
            } else {
                size.parse::<u64>().ok()
            };

            Ok(RemoteDirectoryEntry {
                name,
                path,
                kind,
                size,
            })
        })
        .collect::<Result<Vec<_>, String>>()?;

    entries.sort_by(|left, right| {
        left.kind
            .cmp(&right.kind)
            .then_with(|| left.name.to_lowercase().cmp(&right.name.to_lowercase()))
    });
    Ok(entries)
}

fn utf8_field(field: &[u8]) -> Result<String, String> {
    String::from_utf8(field.to_vec()).map_err(|error| error.to_string())
}

fn command_start_error(error: std::io::Error) -> String {
    if error.kind() == std::io::ErrorKind::NotFound {
        "OpenSSH client 'ssh' was not found on PATH. Install the OpenSSH client and restart Schematica."
            .to_string()
    } else {
        format!("Could not start the OpenSSH client 'ssh': {error}")
    }
}

fn remote_transport_error(action: &str, host: &str, path: &str, error: &str) -> String {
    if error.contains("timed out") {
        return format!(
            "SSH timed out while trying to {action} {host}:{path}. Check the host, network or VPN, and SSH configuration. {error}"
        );
    }
    if error.contains("not found on PATH") {
        return error.to_string();
    }
    format!("Could not {action} {host}:{path}. {error}")
}

fn remote_command_error(action: &str, host: &str, path: &str, stderr: &[u8]) -> String {
    let raw_detail = String::from_utf8_lossy(stderr).trim().to_string();
    if raw_detail.is_empty() {
        return format!("Could not {action} {host}:{path}.");
    }

    let normalized = raw_detail.to_ascii_lowercase();
    let detail = concise_ssh_error_detail(&raw_detail);
    if normalized.contains("permission denied")
        || normalized.contains("no supported authentication methods")
    {
        return format!(
            "{SSH_AUTH_REQUIRED_PREFIX} SSH authentication failed for {host}. Enter the account password or verify the SSH key or agent, then try again. Details: {detail}"
        );
    }
    if normalized.contains("host key verification failed")
        || normalized.contains("remote host identification has changed")
    {
        return format!(
            "SSH host key verification failed for {host}. Verify the host identity and update known_hosts with your SSH client before retrying. Details: {detail}"
        );
    }
    if normalized.contains("could not resolve hostname")
        || normalized.contains("name or service not known")
    {
        return format!(
            "SSH could not resolve {host}. Check the hostname, SSH alias, DNS, and VPN. Details: {detail}"
        );
    }
    if normalized.contains("connection refused") {
        return format!(
            "SSH connection to {host} was refused. Check that the SSH service and port are available. Details: {detail}"
        );
    }
    if normalized.contains("connection timed out") || normalized.contains("operation timed out") {
        return format!(
            "SSH connection to {host} timed out. Check the host, port, network or VPN, and firewall. Details: {detail}"
        );
    }
    if normalized.contains("no route to host") || normalized.contains("network is unreachable") {
        return format!(
            "SSH cannot reach {host}. Check the network, VPN, firewall, and route. Details: {detail}"
        );
    }

    format!("Could not {action} {host}:{path}. Details: {detail}")
}

fn concise_ssh_error_detail(detail: &str) -> String {
    const IMPORTANT_MARKERS: [&str; 9] = [
        "permission denied",
        "no supported authentication methods",
        "host key verification failed",
        "remote host identification has changed",
        "could not resolve hostname",
        "connection refused",
        "connection timed out",
        "no route to host",
        "network is unreachable",
    ];

    let lines = detail
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .collect::<Vec<_>>();
    let important = lines.iter().rev().copied().find(|line| {
        let normalized = line.to_ascii_lowercase();
        IMPORTANT_MARKERS
            .iter()
            .any(|marker| normalized.contains(marker))
    });
    let fallback =
        lines.iter().rev().copied().find(|line| {
            !line.starts_with("**") && !line.to_ascii_lowercase().contains("warning:")
        });
    let selected = important
        .or(fallback)
        .or_else(|| lines.last().copied())
        .unwrap_or(detail);

    const MAX_DETAIL_CHARS: usize = 320;
    if selected.chars().count() <= MAX_DETAIL_CHARS {
        return selected.to_string();
    }

    let mut concise = selected.chars().take(MAX_DETAIL_CHARS).collect::<String>();
    concise.push('…');
    concise
}

fn source_rank(source: &SshHostSource) -> u8 {
    match source {
        SshHostSource::Config => 0,
        SshHostSource::KnownHosts => 1,
    }
}

fn home_dir() -> Option<PathBuf> {
    env::var_os("HOME")
        .map(PathBuf::from)
        .or_else(|| env::var_os("USERPROFILE").map(PathBuf::from))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn splits_ssh_words_with_comments_and_quotes() {
        assert_eq!(
            split_ssh_words(r#"Host "example box" build-host # comment"#),
            vec!["Host", "example box", "build-host"]
        );
        assert_eq!(
            split_ssh_words(r#"Include ~/.ssh/config.d/*.conf"#),
            vec!["Include", "~/.ssh/config.d/*.conf"]
        );
    }

    #[test]
    fn filters_host_patterns_for_listable_aliases() {
        assert!(is_listable_host_pattern("build-host"));
        assert!(is_listable_host_pattern("user@example.com"));
        assert!(!is_listable_host_pattern("*"));
        assert!(!is_listable_host_pattern("gpu-*"));
        assert!(!is_listable_host_pattern("!blocked"));
    }

    #[test]
    fn normalizes_known_hosts_entries() {
        assert_eq!(
            normalize_known_host_name("[build-host.example.test]:22"),
            Some("build-host.example.test".to_string())
        );
        assert_eq!(
            normalize_known_host_name("[build-host.example.test]:2222"),
            Some("build-host.example.test:2222".to_string())
        );
        assert_eq!(
            normalize_known_host_name("[2001:db8::1]:2222"),
            Some("[2001:db8::1]:2222".to_string())
        );
        assert_eq!(normalize_known_host_name("|1|hashed"), None);
    }

    #[test]
    fn ignores_known_hosts_markers_as_hosts() {
        let marker = split_ssh_words("@cert-authority *.example.test ssh-ed25519 AAAA");
        assert_eq!(marker[0], "@cert-authority");
        assert!(!is_listable_host_pattern(&marker[0]));
    }

    #[cfg(unix)]
    #[test]
    fn revoked_known_hosts_entries_are_not_offered_as_targets() {
        let root = temporary_test_directory("known-hosts");
        fs::create_dir_all(&root).unwrap();
        let path = root.join("known_hosts");
        fs::write(
            &path,
            "@revoked revoked.example ssh-ed25519 AAAA\n@cert-authority trusted.example ssh-ed25519 BBBB\n",
        )
        .unwrap();
        let mut collector = SshHostCollector::default();
        parse_known_hosts_file(&path, &mut collector);

        assert!(!collector.hosts.contains_key("revoked.example"));
        assert!(collector.hosts.contains_key("trusted.example"));
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn matches_simple_include_wildcards() {
        assert!(wildcard_match("*.conf", "cluster.conf"));
        assert!(wildcard_match("config?", "config1"));
        assert!(!wildcard_match("config?", "config12"));
    }

    #[test]
    fn validates_hosts_and_paths_before_spawning_ssh() {
        assert_eq!(normalize_host(" build-host ").unwrap(), "build-host");
        assert_eq!(
            normalize_host("build-host:2222").unwrap(),
            "build-host:2222"
        );
        assert_eq!(
            ssh_destination("build-host:2222").unwrap(),
            SshDestination {
                address: "build-host".to_string(),
                port: Some(2222),
            }
        );
        assert_eq!(
            ssh_destination("[2001:db8::1]:2200").unwrap(),
            SshDestination {
                address: "2001:db8::1".to_string(),
                port: Some(2200),
            }
        );
        assert_eq!(
            ssh_destination("deploy@build-host:2200").unwrap(),
            SshDestination {
                address: "deploy@build-host".to_string(),
                port: Some(2200),
            }
        );
        assert_eq!(
            ssh_destination("deploy@[2001:db8::1]:2200").unwrap(),
            SshDestination {
                address: "deploy@2001:db8::1".to_string(),
                port: Some(2200),
            }
        );
        assert_eq!(
            ssh_destination("2001:db8::1").unwrap(),
            SshDestination {
                address: "2001:db8::1".to_string(),
                port: None,
            }
        );
        assert!(normalize_host("-oProxyCommand=bad").is_err());
        assert!(normalize_host("[-oProxyCommand=bad]").is_err());
        assert!(normalize_host("deploy@[-oProxyCommand=bad]:22").is_err());
        assert!(normalize_host("build-host:not-a-port").is_err());
        assert!(normalize_host("bad host").is_err());
        assert!(normalize_host("build-host:0").is_err());
        assert_eq!(
            normalize_remote_path(" ~/config.yaml ").unwrap(),
            "~/config.yaml"
        );
        assert!(normalize_remote_path("").is_err());
    }

    #[test]
    fn configures_key_and_password_authentication_without_putting_secrets_in_arguments() {
        let key_command = ssh_command("build-host", None).unwrap();
        let key_args = key_command
            .get_args()
            .map(|argument| argument.to_string_lossy().to_string())
            .collect::<Vec<_>>();
        assert!(key_args.contains(&"BatchMode=yes".to_string()));

        let password_command =
            ssh_command("build-host", Some("correct horse battery staple")).unwrap();
        let password_args = password_command
            .get_args()
            .map(|argument| argument.to_string_lossy().to_string())
            .collect::<Vec<_>>();
        assert!(password_args.contains(&"BatchMode=no".to_string()));
        assert!(password_args.contains(&"PubkeyAuthentication=no".to_string()));
        assert!(!password_args
            .iter()
            .any(|argument| argument.contains("correct horse")));
        assert!(password_command.get_envs().any(|(key, value)| {
            key == SSH_ASKPASS_SECRET
                && value.is_some_and(|value| value == "correct horse battery staple")
        }));
    }

    #[test]
    fn keeps_passwords_in_the_process_only_until_explicitly_cleared() {
        let credentials = SshCredentialStore::default();
        credentials
            .set_password(" build-host ", "secret".to_string())
            .unwrap();
        assert_eq!(
            credentials.password("build-host").unwrap().as_deref(),
            Some("secret")
        );

        credentials.clear_password("build-host").unwrap();
        assert_eq!(credentials.password("build-host").unwrap(), None);
        assert!(credentials
            .set_password("build-host", String::new())
            .is_err());
    }

    #[test]
    fn remote_writes_use_a_temporary_file_and_atomic_rename() {
        let script = remote_write_script();
        assert!(script.contains("mktemp"));
        assert!(script.contains("cat > \"$tmp\""));
        assert!(script.contains("mv -f"));
        assert!(script.contains("Refusing to replace symbolic link"));
        assert!(script.contains("Cannot replace a directory"));
        assert!(!script.contains("cat > \"$path\""));
    }

    #[test]
    fn remote_reads_use_portable_redirection_instead_of_non_posix_cat_options() {
        let script = remote_read_script();
        assert!(script.contains("cat < \"$path\""));
        assert!(!script.contains("cat --"));
    }

    #[test]
    fn remote_commands_preserve_paths_as_literal_arguments() {
        let path = "~/project with spaces/config 'safe'; still-one-argument.yaml";
        let command = remote_shell_command("printf '%s' \"$1\"", "schematica-test", path);
        let output = ProcessCommand::new("sh")
            .arg("-c")
            .arg(command)
            .output()
            .unwrap();

        assert!(output.status.success());
        assert_eq!(String::from_utf8(output.stdout).unwrap(), path);
    }

    #[cfg(unix)]
    #[test]
    fn command_runner_enforces_a_hard_timeout() {
        let mut command = ProcessCommand::new("sh");
        command.arg("-c").arg("sleep 1");
        let error = run_command_with_timeout(command, None, Duration::from_millis(20)).unwrap_err();
        assert!(error.contains("timed out"));
    }

    #[cfg(unix)]
    #[test]
    fn timeout_terminates_descendants_that_inherit_output_pipes() {
        let mut command = ProcessCommand::new("sh");
        command.arg("-c").arg("sleep 5 & wait");
        let started = Instant::now();
        let error = run_command_with_timeout(command, None, Duration::from_millis(20)).unwrap_err();

        assert!(error.contains("timed out"));
        assert!(started.elapsed() < Duration::from_secs(1));
    }

    #[test]
    fn command_output_capture_is_bounded_while_the_stream_is_drained() {
        let mut input = std::io::Cursor::new(b"0123456789".to_vec());
        let captured = read_stream_limited(&mut input, 4).unwrap();

        assert_eq!(captured.bytes, b"0123");
        assert!(captured.truncated);
        assert_eq!(input.position(), 10);
    }

    #[test]
    fn ssh_failures_include_actionable_guidance() {
        let authentication = remote_command_error(
            "read",
            "build-host",
            "~/config.yaml",
            b"Permission denied (publickey).",
        );
        assert!(authentication.contains("authentication failed"));
        assert!(authentication.contains("SSH key or agent"));

        let authentication_with_warning = remote_command_error(
            "read",
            "build-host",
            "~/config.yaml",
            b"** WARNING: connection is not using a post-quantum key exchange algorithm. **\n** See https://www.openssh.com/pq.html **\nbuild@build-host: Permission denied (publickey).",
        );
        assert!(authentication_with_warning.contains("Permission denied (publickey)"));
        assert!(!authentication_with_warning.contains("post-quantum"));
        assert!(!authentication_with_warning.contains("openssh.com"));

        let host_key =
            remote_command_error("list", "build-host", "~", b"Host key verification failed.");
        assert!(host_key.contains("host key verification failed"));
        assert!(host_key.contains("known_hosts"));

        let missing = command_start_error(std::io::Error::from(std::io::ErrorKind::NotFound));
        assert!(missing.contains("Install the OpenSSH client"));

        let timeout = remote_command_error(
            "list",
            "build-host:2200",
            "~",
            b"ssh: connect to host build-host port 2200: Connection timed out",
        );
        assert!(timeout.contains("network or VPN"));
        assert!(timeout.contains("port"));
    }

    #[cfg(unix)]
    #[test]
    fn atomic_remote_write_preserves_mode_and_refuses_symlinks_and_directories() {
        use std::os::unix::fs::{symlink, PermissionsExt};

        let root = temporary_test_directory("write");
        fs::create_dir_all(&root).unwrap();
        let file = root.join("config.yaml");
        fs::write(&file, b"old").unwrap();
        fs::set_permissions(&file, fs::Permissions::from_mode(0o640)).unwrap();

        let mut write = ProcessCommand::new("sh");
        write
            .arg("-c")
            .arg(remote_write_script())
            .arg("schematica-write")
            .arg(&file);
        let output = run_command_with_timeout(
            write,
            Some(b"new contents".to_vec()),
            Duration::from_secs(2),
        )
        .unwrap();
        assert!(
            output.status.success(),
            "{}",
            String::from_utf8_lossy(&output.stderr)
        );
        assert_eq!(fs::read(&file).unwrap(), b"new contents");
        assert_eq!(
            fs::metadata(&file).unwrap().permissions().mode() & 0o777,
            0o640
        );

        let link_target = root.join("target.yaml");
        let link = root.join("linked.yaml");
        fs::write(&link_target, b"target remains").unwrap();
        symlink(&link_target, &link).unwrap();
        let link_output = run_write_script_for_test(&link, b"replacement");
        assert!(!link_output.status.success());
        assert!(String::from_utf8_lossy(&link_output.stderr).contains("symbolic link"));
        assert_eq!(fs::read(&link_target).unwrap(), b"target remains");

        let directory_output = run_write_script_for_test(&root, b"replacement");
        assert!(!directory_output.status.success());
        assert!(String::from_utf8_lossy(&directory_output.stderr).contains("directory"));

        let trailing_directory = format!("{}/missing/", root.display());
        let trailing_output = run_write_script_for_test(Path::new(&trailing_directory), b"data");
        assert!(!trailing_output.status.success());
        assert!(String::from_utf8_lossy(&trailing_output.stderr).contains("directory path"));

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn remote_path_expansion_keeps_tilde_literal_until_the_remote_shell() {
        assert_eq!(expand_remote_test_path("~"), "/home/schematica");
        assert_eq!(expand_remote_test_path("~/"), "/home/schematica/");
        assert_eq!(
            expand_remote_test_path("~/configs/run.yaml"),
            "/home/schematica/configs/run.yaml"
        );
        assert_eq!(
            expand_remote_test_path("/tmp/config.yaml"),
            "/tmp/config.yaml"
        );
    }

    #[test]
    fn parses_structured_remote_directory_entries() {
        let stdout = [
            b"file\0config.yaml\0/home/me/config.yaml\0".as_slice(),
            b"123\0directory\0configs\0/home/me/configs\0\0".as_slice(),
        ]
        .concat();
        let entries = parse_remote_directory_entries(&stdout).unwrap();

        assert_eq!(entries.len(), 2);
        assert_eq!(entries[0].name, "configs");
        assert_eq!(entries[0].kind, RemoteDirectoryEntryKind::Directory);
        assert_eq!(entries[1].name, "config.yaml");
        assert_eq!(entries[1].size, Some(123));
    }

    #[cfg(unix)]
    #[test]
    fn portable_remote_listing_handles_hidden_and_spaced_names() {
        let root = temporary_test_directory("list");
        fs::create_dir_all(root.join("folder with spaces")).unwrap();
        fs::write(root.join(".hidden.yaml"), b"hello").unwrap();

        let output = ProcessCommand::new("sh")
            .arg("-c")
            .arg(remote_list_script())
            .arg("schematica-list")
            .arg(&root)
            .output()
            .unwrap();
        let cleanup_result = fs::remove_dir_all(&root);

        assert!(
            output.status.success(),
            "{}",
            String::from_utf8_lossy(&output.stderr)
        );
        let entries = parse_remote_directory_entries(&output.stdout).unwrap();
        assert!(entries.iter().any(|entry| {
            entry.name == "folder with spaces" && entry.kind == RemoteDirectoryEntryKind::Directory
        }));
        assert!(entries.iter().any(|entry| {
            entry.name == ".hidden.yaml"
                && entry.kind == RemoteDirectoryEntryKind::File
                && entry.size == Some(5)
        }));
        cleanup_result.unwrap();
    }

    #[cfg(unix)]
    fn run_write_script_for_test(path: &Path, contents: &[u8]) -> Output {
        let mut command = ProcessCommand::new("sh");
        command
            .arg("-c")
            .arg(remote_write_script())
            .arg("schematica-write")
            .arg(path);
        run_command_with_timeout(command, Some(contents.to_vec()), Duration::from_secs(2)).unwrap()
    }

    #[cfg(unix)]
    fn temporary_test_directory(label: &str) -> PathBuf {
        env::temp_dir().join(format!(
            "schematica-ssh-{label}-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ))
    }

    fn expand_remote_test_path(input: &str) -> String {
        let script = [
            "path=\"$1\"\n",
            REMOTE_EXPAND_PATH_SNIPPET,
            "\nprintf '%s' \"$path\"",
        ]
        .concat();
        let output = ProcessCommand::new("sh")
            .arg("-c")
            .arg(script)
            .arg("schematica-expand")
            .arg(input)
            .env("HOME", "/home/schematica")
            .output()
            .expect("remote path expansion test shell should run");
        assert!(
            output.status.success(),
            "{}",
            String::from_utf8_lossy(&output.stderr)
        );
        String::from_utf8(output.stdout).expect("test output should be utf-8")
    }
}
