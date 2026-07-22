# Schematica Agent Notes

## Quality Gate

Before publishing changes, run the checks that match the edited surfaces:

```sh
corepack pnpm format:check
corepack pnpm lint
corepack pnpm check
cargo test --workspace --locked
cargo clippy --workspace --all-targets --locked -- -D warnings
```

Keep generated build output, local credentials, editor state, and temporary
signing files out of version control.

## Release Signing

Schematica is distributed outside the Mac App Store through GitHub Releases.
Release-quality macOS artifacts use an Apple `Developer ID Application`
certificate with notarization. The modern `G2 Sub-CA (Xcode 11.4.1 or later)`
profile is the default.

Linux release artifacts use the public OpenPGP key documented in
`docs/release-signing/README.md`. Committing the public key and fingerprint is
intentional so users can verify downloads.

Never commit any of the following:

- Apple certificates, `.p12` files, or decoded certificate material
- Apple app-specific passwords or signing-key passwords
- OpenPGP private keys, passphrases, or revocation certificates
- `.env` files, access tokens, or temporary keychain/keyring contents

Signing credentials belong in the scoped GitHub environments used by the
release workflow:

- `macos-signing` for Apple signing and notarization
- `linux-signing` for OpenPGP artifact signing

Do not expose signing environments to pull-request workflows. Keep smoke builds
unsigned, and use Tauri's official macOS signing guidance as the source of
truth: <https://v2.tauri.app/distribute/sign/macos/>.
