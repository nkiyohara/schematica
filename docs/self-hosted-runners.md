# Self-hosted Release Runners

Schematica can use self-hosted runners for release builds, but only in release
workflows. Pull request workflows intentionally stay on GitHub-hosted runners so
untrusted PR code cannot run on local machines that may hold signing material or
developer credentials.

## Runner modes

The release workflow supports three runner modes:

- `auto`: default for tag pushes and manual runs. Prefer an idle online
  self-hosted runner for each release job, and use GitHub-hosted runners when no
  matching self-hosted runner is available.
- `hosted`: force GitHub-hosted runners.
- `self-hosted`: force self-hosted runners. This is useful when billing blocks
  GitHub-hosted runners, but all required platform runners must be online.

`auto` inspects repository self-hosted runners through the GitHub API. If the
workflow token cannot read runner inventory, `auto` falls back to GitHub-hosted
runners. For reliable automatic selection, create a fine-grained personal access
token scoped to this repository with read-only repository Administration
permission, then store it as the repository secret
`RELEASE_RUNNER_ADMIN_TOKEN`.

## Labels

Register release runners with these labels:

| Platform            | Required labels                                               |
| ------------------- | ------------------------------------------------------------- |
| Linux x64           | `self-hosted`, `schematica-release`, `schematica-linux-x64`   |
| macOS Apple Silicon | `self-hosted`, `schematica-release`, `schematica-macos-arm64` |
| Windows x64         | `self-hosted`, `schematica-release`, `schematica-windows-x64` |

The Linux runner is also used for release QA and CLI packaging when it is
available.

## Linux runner setup

Docker is not required. Install the Linux Tauri dependencies once on the runner
machine:

```sh
sudo apt-get update
sudo apt-get install -y \
  build-essential \
  curl \
  file \
  libwebkit2gtk-4.1-dev \
  libssl-dev \
  libgtk-3-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev \
  pkg-config \
  xvfb
```

Register the repository runner:

```sh
mkdir -p ~/actions-runner/schematica-linux
cd ~/actions-runner/schematica-linux

RUNNER_VERSION="$(gh release view --repo actions/runner --json tagName --jq '.tagName | ltrimstr("v")')"
curl -L -o actions-runner.tar.gz \
  "https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz"
tar xzf actions-runner.tar.gz

RUNNER_TOKEN="$(gh api -X POST \
  repos/nkiyohara/schematica/actions/runners/registration-token \
  --jq .token)"

./config.sh \
  --unattended \
  --url https://github.com/nkiyohara/schematica \
  --token "$RUNNER_TOKEN" \
  --name "schematica-linux-$(hostname)" \
  --labels "schematica-release,schematica-linux-x64" \
  --work "_work"
```

Run it on demand:

```sh
cd ~/actions-runner/schematica-linux
./run.sh
```

Or install it as a service:

```sh
cd ~/actions-runner/schematica-linux
sudo ./svc.sh install "$USER"
sudo ./svc.sh start
```

Linux release jobs import `GPG_PRIVATE_KEY` from the protected `linux-signing`
environment into a temporary keyring on both hosted and self-hosted runners.
The workflow removes that keyring after signing, so do not install the release
key permanently on a runner.

## macOS runner setup

Register the macOS runner from the repository Settings > Actions > Runners page
and add the `schematica-release` and `schematica-macos-arm64` labels.

For self-hosted macOS release signing, install the Developer ID Application
certificate in the runner user's Keychain and make sure `codesign` can access
the private key from a non-interactive runner session. GitHub-hosted macOS builds
still import `APPLE_CERTIFICATE` from repository secrets.

Manual releases can be started with:

```sh
gh workflow run release.yml --ref v0.1.0-beta.11 -f runner_mode=auto
```

Use `runner_mode=self-hosted` only when every required platform runner is online.
