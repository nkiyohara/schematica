# Architecture

Schematica is built around one rule: behavior belongs in the shared core before it appears in a UI.

## Layers

```text
@schematica/core
  JSON/YAML parsing
  JSON Schema validation
  defaults
  dotted path access
  field models
  multi-config diff models
  diff summaries

@schematica/cli
  validate
  defaults
  get/set
  explain
  diff
  project config inspection

@schematica/desktop
  Tauri shell
  Svelte workbench
  compact Explorer, editor, compare, settings, problems, and status bar surfaces
  tabs for multiple config documents
  form editor
  raw YAML/JSON editor
  local and SSH resource providers
  SSH directory browser
  persisted workspace preferences
  command palette for keyboard-first actions
  read-only Git context
  first-run feature onboarding
  visual diff table
  schema-validated appearance settings
  appearance profile presets that expand to explicit config values
  project settings import/export/reset flows
  theme tokens for light/dark mode, contrast, motion, focus, and surface depth
```

## Design Rules

- JSON Schema remains the portable data contract.
- Schematica-specific display behavior lives under project config or `x-ui`, not random schema keywords.
- Field models preserve `x-ui` hints so CLI, GUI, tests, and future plugins can reason about the same widget metadata.
- CLI, GUI, tests, and agents use the same core functions.
- Diff output must be both visual and machine-readable.
- File writes go through validation before replacing the user config.
- Git integration is read-only by default: surface branch, commit, and dirty state without mutating the repository.
- Workspace chrome state, such as selected view and split pane sizes, is a local preference layer rather than project config.
- Visual identity is config-backed: theme, palette, contrast, motion, density, typography, and radius all resolve through one token pipeline.
- Appearance presets are convenience profiles only; applying one writes ordinary `appearance.*` config values so files remain transparent and diffable.
- Common actions should be reachable from both visible controls and the command palette.
- Extension points stay narrow: resources, codecs, schemas, field renderers, and commands.
- The desktop app should feel like a quiet workbench, not a marketing page.

## Test Strategy

Core tests cover parsing, validation, defaults, path mutation, field model generation, and multi-config diff classification.

CLI and desktop checks run type checking plus production builds. Desktop also has focused unit coverage for workspace preference persistence. Tauri is verified with `cargo check` and local Linux bundle generation.

CLI tests are integration tests: they build the actual CLI bundle and spawn it with real example files. This catches package-boundary issues that pure unit tests miss.
