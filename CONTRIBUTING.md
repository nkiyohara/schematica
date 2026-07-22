# Contributing

Schematica is beta software. Focused bug reports, small fixes, documentation
improvements, and reproducible workflow feedback are the most useful
contributions right now.

## Local Setup

Requirements:

- Node.js 24+
- Corepack
- Rust 1.96+

```bash
corepack pnpm install
corepack pnpm check
```

Run the desktop app in development:

```bash
corepack pnpm dev
```

Build the desktop app:

```bash
corepack pnpm desktop:build
```

Linux desktop builds require the Tauri WebKit/GTK system dependencies listed in
`README.md`.

## Before Opening A Pull Request

Run the checks that match the change:

```bash
corepack pnpm format:check
corepack pnpm lint
corepack pnpm check
cargo check --workspace --locked
```

For desktop behavior changes, also run:

```bash
corepack pnpm desktop:build
```

## Pull Request Scope

Prefer small, reviewable PRs with one behavioral purpose. Include:

- what changed
- why it changed
- what was tested
- screenshots or short recordings for visible UI changes

Do not include signing certificates, app-specific passwords, `.p12` files,
private GPG material, `.env` files, or decoded secret values.

## Distribution Notes

The monorepo root intentionally keeps `"private": true` to prevent accidental
npm publishing. That setting is not a request to keep the GitHub repository
private.

Windows installers are not published while code signing is pending. Windows
build changes should still keep the smoke build passing.
