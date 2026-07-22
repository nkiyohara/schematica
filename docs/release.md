# Release Policy

Schematica releases are published from GitHub Actions when a `v*` tag is pushed.
The workflow creates a draft prerelease, uploads macOS/Linux desktop artifacts
and the CLI tarball, then publishes the release after all required jobs finish.
Windows builds are smoke-tested in CI, but official Windows binaries are not
published until code signing is ready.

## Artifact Signing

| Platform | Status                            | Notes                                                                                      |
| -------- | --------------------------------- | ------------------------------------------------------------------------------------------ |
| macOS    | Developer ID signed and notarized | Apple silicon (`arm64`) DMG; uses the `macos-signing` GitHub environment.                  |
| Linux    | GPG signed                        | x86-64 artifacts; AppImage, deb, rpm, and `SHA256SUMS` receive detached `.asc` signatures. |
| CLI      | GPG signed                        | The release tarball receives a detached `.asc` signature from the Linux release key.       |
| Windows  | Not published                     | Unsigned Windows builds are smoke-tested only; official binaries wait for code signing.    |

Signing secrets are not stored in the repository. The repository only contains
public workflow wiring, public key material, and user-facing verification
instructions.

Before changing the draft to a public prerelease, the workflow verifies the
macOS code signature and stapled notarization ticket, verifies every generated
GPG signature, checks that each expected artifact and signature pair is
present, and rejects accidental Windows installer assets. A rerun reuses the
same release record instead of creating a second draft.

## Linux Verification

Linux users can verify release artifacts with the public key in
`docs/release-signing/schematica-linux-gpg-public.asc`.

```sh
gpg --import docs/release-signing/schematica-linux-gpg-public.asc
gpg --verify SHA256SUMS.asc SHA256SUMS
sha256sum -c SHA256SUMS
```

Individual detached signatures can be checked with:

```sh
gpg --verify artifact.asc artifact
```

See `docs/release-signing/README.md` for the signing key fingerprint.

## Release Maintainer Boundary

Public repository contents should include:

- GitHub Actions workflow structure.
- GitHub environment names and secret/variable names.
- Public GPG keys and fingerprints.
- Artifact verification instructions.
- Platform signing policy.

Private maintainer storage should include:

- Apple Developer ID `.p12` material and notarization credentials.
- GPG private keys, passphrases, and revocation certificates.
- Secret bootstrap/recovery notes.

Schematica uses 1Password as the source of truth for private signing material,
with GitHub environment secrets populated from 1Password for CI.
