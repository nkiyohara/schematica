# Schematica Linux Release Signing

Schematica Linux release artifacts are signed with this OpenPGP key:

```text
6867D3C6FCBFBD1E9E5A5B5C5FEB561673716233
```

UID:

```text
Schematica Release Signing (Linux release artifacts) <n.kiyohara23@gmail.com>
```

Import the public key:

```sh
gpg --import docs/release-signing/schematica-linux-gpg-public.asc
```

Verify Linux release checksums:

```sh
gpg --verify SHA256SUMS.asc SHA256SUMS
sha256sum -c SHA256SUMS
```

Verify an individual detached signature:

```sh
gpg --verify artifact.asc artifact
```

The private key, passphrase, and revocation certificate are not stored in this
repository. They are kept in maintainer-controlled 1Password storage and exposed
to CI only through the `linux-signing` GitHub environment.
