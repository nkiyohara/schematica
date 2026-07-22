# Distribution and Updates

Schematica is preparing its first public beta. The initial distribution channel
is direct download from GitHub Releases; the package-manager files in this
repository are publication templates, not live repositories or taps.

## Desktop Install Paths

| Platform             | First-beta install      | Update path            | Notes                                                           |
| -------------------- | ----------------------- | ---------------------- | --------------------------------------------------------------- |
| macOS                | GitHub Release DMG      | Download a new release | Published DMGs must be Developer ID signed and notarized.       |
| Windows              | Source build only       | Not available yet      | Official binaries and WinGet publication wait for code signing. |
| Debian/Ubuntu        | GitHub Release `.deb`   | Download a new release | The APT repository is not published yet.                        |
| Fedora/RHEL/openSUSE | GitHub Release RPM      | Download a new release | The RPM repository is not published yet.                        |
| Linux portable       | GitHub Release AppImage | Download a new release | Linux releases include signatures and signed checksums.         |

## CLI Install Paths

| Platform             | First-beta install     | Update path             |
| -------------------- | ---------------------- | ----------------------- |
| Node 24 environments | GitHub Release tarball | Download a new release  |
| CI/agents            | GitHub Release tarball | Pinned artifact refresh |

Homebrew and npm publication can be added after the release cadence and package
names are stable.

## File Associations

The Tauri bundle declares Schematica as an editor for:

- `yaml`, `yml` with `application/yaml`
- `json` with `application/json`
- `toml` with `application/toml`

Package managers may expose those associations differently, but Tauri writes the standard macOS, Windows, and Linux bundle metadata for supported targets.

## Update Ownership

Once additional channels are published, use exactly one updater per install
path:

- Homebrew installs update through Homebrew.
- APT/RPM installs update through OS package repositories.
- Future WinGet installs update through WinGet after Windows signing is ready.
- Direct GitHub Release desktop installs can use Tauri's signed updater after
  `latest.json`, its endpoint, and the updater public key are configured.

This avoids double-update bugs where an app replaces files owned by a package manager.

## Release Signing Policy

GitHub Releases use platform-specific signing:

- macOS artifacts are signed with Apple Developer ID and submitted for
  notarization.
- Linux artifacts are signed with Schematica's OpenPGP release key. See
  `docs/release-signing/README.md`.
- Windows artifacts are not published until code signing is ready; Windows
  builds remain covered by CI smoke builds.

The desktop app exposes this as runtime state. It reads `SCHEMATICA_INSTALL_CHANNEL`
from the build or process environment, then falls back to AppImage/path heuristics.
Supported channel values are:

- `homebrew`
- `winget` (reserved for future signed Windows distribution)
- `apt`
- `rpm`
- `appimage`
- `direct`
- `development`

Package-manager channels show the package-manager command in the Settings tab and
do not run the in-app updater. `appimage` and `direct` are eligible for the signed
Tauri updater.

## Tauri Signed Updater

The updater plugin is available in the app, but the first public beta uses
manual GitHub Release downloads. The normal and initial release builds have no
updater endpoint or public key, so checks fail closed instead of replacing
files owned by a package manager. Enable direct updates only after the complete
signed-update metadata below is published.

Prepared files:

- `packaging/tauri/updater-overlay.example.json`
- `packaging/updater/latest.example.json`

Release builds should provide:

- `SCHEMATICA_INSTALL_CHANNEL=direct` or `SCHEMATICA_INSTALL_CHANNEL=appimage`
- `TAURI_SIGNING_PRIVATE_KEY`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
- the public key copied into the updater overlay
- `latest.json` uploaded to GitHub Releases or a static update endpoint

Build direct-download artifacts with the updater overlay:

```sh
SCHEMATICA_INSTALL_CHANNEL=direct \
  corepack pnpm --filter @schematica/desktop tauri build \
  --config ../../packaging/tauri/updater-overlay.example.json
```

Tauri updater endpoints support static JSON files and dynamic servers. The static JSON form is the right initial path for GitHub Releases; a dynamic server can be added later for staged rollouts.

## Repository Templates

- Homebrew formula: `packaging/homebrew/schematica.rb`
- Homebrew cask: `packaging/homebrew/schematica-desktop.rb`
- WinGet manifest templates: `packaging/winget/` (not published while Windows
  signing is pending)
- APT source template: `packaging/apt/schematica.sources.template`
- Linux AppStream metadata: `packaging/linux/dev.schematica.editor.metainfo.xml`
- Distribution matrix: `packaging/distribution-matrix.yaml`
