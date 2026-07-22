# Packaging Notes

Schematica is prepared for package-manager and direct-download distribution paths.

## Versioning

The release version has one committed source of truth: the root `package.json`
`version` field. Do not duplicate the release version in workspace
`package.json` files, `Cargo.toml`, or `tauri.conf.json`.

- Tauri reads the app version from the root `package.json` path configured in
  `apps/desktop/src-tauri/tauri.conf.json`.
- The desktop renderer and CLI embed the same root version at build time.
- The Rust crate uses workspace package metadata with a stable internal
  `0.0.0` crate version because it is not the release artifact.
- The release workflow verifies that a pushed tag such as `v0.1.0-beta.8`
  matches the root `package.json` version before building artifacts.

## CLI

The CLI release tarball is built from `packages/cli` and exposes the `schematica`
binary. For Homebrew, prefer a small tarball containing the bundled CLI output
plus a `node` runtime strategy, or publish a native wrapper later if the CLI
core moves to Rust.

## Desktop

The desktop app uses Tauri v2. GitHub Actions publish draft release artifacts
for:

- macOS: signed and notarized `.dmg`
- Linux: `.deb`, AppImage, and rpm where supported by the runner, with GPG
  signatures for Linux release artifacts

Windows bundles are still built in CI as an unsigned smoke check, but they are
not uploaded to GitHub Releases or submitted to WinGet until code signing is
ready.

The bundle declares file associations for YAML, JSON, and TOML config files. At
startup the app loads associated files passed by the OS as initial arguments.

Release builds can use self-hosted runners for tag and manual release workflows.
PR workflows intentionally stay on GitHub-hosted runners. See
`docs/self-hosted-runners.md` for runner labels, modes, and signing-key
expectations.

## Updates

The first public beta uses manual GitHub Release downloads. The signed updater
is fail-closed: desktop builds only call it when
`VITE_SCHEMATICA_UPDATER_CONFIGURED=true` is present at build time and the
Tauri updater endpoint and public key have been configured. Until then, update
checks stay with the manual GitHub Releases flow. Package-manager commands below
apply only after their corresponding tap or repository has been published.

Update ownership follows the install path:

- Homebrew Cask: `brew upgrade --cask schematica`
- WinGet: deferred until official Windows binaries are signed
- APT/RPM repositories: OS package manager upgrades
- Direct DMG/AppImage downloads: manual GitHub Release download until the signed
  Tauri updater and `latest.json` are published

Do not enable the in-app updater for package-manager-owned installs. Schematica
detects `SCHEMATICA_INSTALL_CHANNEL` plus AppImage/path hints and only runs the
signed updater for `direct` or `appimage` channels. Package-manager channels show
their update command inside Settings.

Direct-download builds should use the updater overlay:

```sh
SCHEMATICA_INSTALL_CHANNEL=direct \
  corepack pnpm --filter @schematica/desktop tauri build \
  --config ../../packaging/tauri/updater-overlay.example.json
```

The overlay is kept out of the default developer build because Tauri updater
artifacts require signing keys.

## Homebrew

Prefer a project-owned tap while Schematica is in beta. Public Homebrew core/cask
submissions can wait until the release cadence and artifact URLs are stable.

Formula outline:

```ruby
class Schematica < Formula
  desc "Fast schema-driven config editor for YAML, JSON, and TOML"
  homepage "https://github.com/nkiyohara/schematica"
  url "https://github.com/nkiyohara/schematica/archive/refs/tags/v0.1.0.tar.gz"
  sha256 "..."
  license "MIT"

  depends_on "node@24"

  def install
    system "corepack", "enable"
    system "corepack", "pnpm", "install", "--frozen-lockfile"
    system "corepack", "pnpm", "--filter", "@schematica/cli", "build"
    libexec.install Dir["packages/cli/dist/*"], "packages/cli/package.json"
    bin.write_exec_script libexec/"index.js"
  end
end
```

## Manifests

Prepared templates live under `packaging/`:

- `homebrew/` for CLI formula and desktop cask
- `winget/` for future Windows package submission after code signing
- `apt/` for a signed Debian-style repository
- `linux/` for AppStream metadata
- `tauri/` and `updater/` for signed direct-download updates
