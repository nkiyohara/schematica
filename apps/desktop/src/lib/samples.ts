export const sampleSchema = `{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "Training Config",
  "type": "object",
  "required": ["project", "training"],
  "properties": {
    "project": {
      "type": "string",
      "title": "Project",
      "description": "Experiment or workspace name used in generated run metadata.",
      "default": "demo",
      "x-ui": {
        "order": 1,
        "placeholder": "vision-baseline"
      }
    },
    "backend": {
      "type": "string",
      "title": "Backend",
      "enum": ["local", "slurm"],
      "default": "local",
      "description": "Select the execution target for generated commands.",
      "x-ui": {
        "order": 2
      }
    },
    "training": {
      "type": "object",
      "title": "Training",
      "description": "Core training controls with schema-backed validation and UI hints.",
      "x-ui": {
        "order": 3
      },
      "required": ["batch_size", "learning_rate"],
      "properties": {
        "batch_size": {
          "type": "integer",
          "title": "Batch size",
          "minimum": 1,
          "maximum": 512,
          "default": 64,
          "description": "Samples per optimizer step before gradient accumulation.",
          "x-ui": {
            "order": 1,
            "unit": "samples"
          }
        },
        "learning_rate": {
          "type": "number",
          "title": "Learning rate",
          "minimum": 0.000001,
          "maximum": 0.1,
          "default": 0.0003,
          "description": "Optimizer step size. Log-scale controls make small values editable.",
          "x-ui": {
            "order": 2,
            "scale": "log",
            "note": "Learning rates are shown on a logarithmic slider so 1e-5 and 1e-3 are both easy to reach."
          }
        },
        "mixed_precision": {
          "type": "boolean",
          "title": "Mixed precision",
          "description": "Use lower precision arithmetic where supported.",
          "default": true,
          "x-ui": {
            "order": 3
          }
        }
      }
    }
  }
}
`;

export const sampleConfig = `$schema: ./schema.json
project: demo
backend: local
training:
  batch_size: 32
  learning_rate: 0.0001
  mixed_precision: true
`;

export const sampleAppConfig = `$schema: ../../schemas/schematica.config.schema.json
project:
  name: schematica
interface:
  locale: system
features:
  git: true
  feedback: true
updates:
  policy: auto
  checkOnStartup: true
editor:
  defaultFormat: yaml
  autosave: false
  showRawPreview: true
  preserveComments: best-effort
appearance:
  theme: system
  palette: slate
  accent: "#2563eb"
  density: comfortable
  contrast: standard
  motion: system
  fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
  monoFontFamily: "JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, monospace"
  fontSize: 14
  cornerRadius: 8
providers: {}
`;
