# APT Repository Template

Recommended user-facing install once a repository is published:

```bash
curl -fsSL https://packages.schematica.dev/apt/gpg.key \
  | sudo gpg --dearmor -o /usr/share/keyrings/schematica-archive-keyring.gpg
sudo install -m 0644 schematica.sources /etc/apt/sources.list.d/schematica.sources
sudo apt update
sudo apt install schematica
```

Updates are intentionally handled by `apt`:

```bash
sudo apt update
sudo apt upgrade schematica
```

For direct `.deb` downloads from GitHub Releases, users can install with:

```bash
sudo apt install ./Schematica_0.1.0_amd64.deb
```
