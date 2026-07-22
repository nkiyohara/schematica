# Security Policy

Schematica is beta software, but security reports are handled seriously.

## Supported Versions

Security fixes target the latest beta release and `main`.

## Reporting A Vulnerability

Please do not open a public issue for a vulnerability. Use GitHub private
vulnerability reporting if it is available for the repository. If it is not
available, contact the maintainer privately before sharing exploit details.

Include:

- affected version or commit
- operating system
- reproduction steps
- impact
- whether the issue involves local files, SSH access, release artifacts, or
  signing material

## Signing Material

Do not commit or attach Apple Developer ID certificates, `.p12` files,
app-specific passwords, GPG private keys, passphrases, revocation certificates,
`.env` files, or decoded secret values. Public release verification keys and
fingerprints may be committed.
