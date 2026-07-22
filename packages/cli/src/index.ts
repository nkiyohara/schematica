#!/usr/bin/env node
import { randomUUID } from "node:crypto";
import { lstat, open, readFile, realpath, rename, stat, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import { basename, dirname, relative, resolve } from "node:path";
import { Command, Option } from "commander";
import pc from "picocolors";
import {
  applySchemaDefaults,
  compareConfigs,
  describeSchemaPath,
  formatFromPath,
  getPath,
  parseData,
  parseSchema,
  setPath,
  stringifyData,
  summarizeDiffRows,
  updateDataText,
  validateConfig,
  type CommentPreservation,
  type DataFormat,
  type JsonSchema,
  type JsonValue,
} from "@schematica/core";
import { cliVersion } from "./version.js";

interface ProjectConfig {
  project?: {
    name?: string;
    schema?: string;
    config?: string;
  };
  editor?: {
    defaultFormat?: DataFormat;
    preserveComments?: CommentPreservation;
  };
}

interface GlobalOptions {
  json?: boolean;
  config?: string;
}

interface ProjectContext {
  config: ProjectConfig;
  directory: string;
}

const program = new Command();

program
  .name("schematica")
  .description("Fast schema-driven config editing for YAML, JSON, and TOML.")
  .version(cliVersion)
  .option("-c, --config <file>", "Schematica project config", "schematica.config.yaml");

program
  .command("validate")
  .description("Validate a YAML, JSON, or TOML config file against a JSON Schema.")
  .argument("[file]", "YAML, JSON, or TOML config file")
  .option("-s, --schema <file>", "JSON Schema file")
  .option("--json", "Print machine-readable JSON")
  .action(async (file: string | undefined, options: { schema?: string; json?: boolean }) => {
    await withErrors(async () => {
      const context = await loadContext(program.opts<GlobalOptions>().config);
      const configFile = resolveInput(file, context.config.project?.config, "config file", context);
      const schemaFile = resolveInput(
        options.schema,
        context.config.project?.schema,
        "schema file",
        context,
      );
      const schema = await readSchema(schemaFile);
      const data = await readData(configFile);
      const result = validateConfig(schema, data);

      if (options.json) {
        printJson(result);
      } else if (result.valid) {
        printOk(`valid ${relativeLabel(configFile)}`);
      } else {
        printError(`invalid ${relativeLabel(configFile)}`);
        printIssues(result.issues);
      }

      process.exitCode = result.valid ? 0 : 1;
    });
  });

program
  .command("defaults")
  .description("Render a default config from a JSON Schema.")
  .requiredOption("-s, --schema <file>", "JSON Schema file")
  .addOption(
    new Option("-f, --format <format>", "Output format")
      .choices(["yaml", "json", "toml"])
      .default("yaml"),
  )
  .action(async (options: { schema: string; format: DataFormat }) => {
    await withErrors(async () => {
      const schema = await readSchema(options.schema);
      const defaults = applySchemaDefaults(schema, undefined);
      if (defaults === undefined) {
        throw new Error("The schema does not define any defaults.");
      }
      process.stdout.write(stringifyData(defaults, options));
    });
  });

program
  .command("get")
  .description("Read a dotted path from a YAML, JSON, or TOML config.")
  .argument("[file]", "YAML, JSON, or TOML config file")
  .argument("<path>", "Dotted path, for example training.batch_size")
  .option("--json", "Print machine-readable JSON")
  .action(async (file: string | undefined, path: string, options: { json?: boolean }) => {
    await withErrors(async () => {
      const context = await loadContext(program.opts<GlobalOptions>().config);
      const configFile = resolveInput(file, context.config.project?.config, "config file", context);
      const value = getPath(await readData(configFile), path);

      if (value === undefined) {
        throw new Error(`No value found at ${path} in ${relativeLabel(configFile)}.`);
      }

      if (options.json) {
        printJson({ path, value });
      } else {
        process.stdout.write(stringifyData(value, { format: "yaml" }));
      }
    });
  });

program
  .command("set")
  .description("Set a dotted path in a YAML, JSON, or TOML config.")
  .argument("[file]", "YAML, JSON, or TOML config file")
  .argument("<path>", "Dotted path, for example training.batch_size")
  .argument("<value>", "Value parsed as YAML")
  .option("-s, --schema <file>", "Validate against this schema after editing")
  .addOption(new Option("-f, --format <format>", "Write format").choices(["yaml", "json", "toml"]))
  .option("--dry-run", "Print the edited document without writing it")
  .action(
    async (
      file: string | undefined,
      path: string,
      rawValue: string,
      options: { schema?: string; format?: DataFormat; dryRun?: boolean },
    ) => {
      await withErrors(async () => {
        const context = await loadContext(program.opts<GlobalOptions>().config);
        const configFile = resolveInput(
          file,
          context.config.project?.config,
          "config file",
          context,
        );
        const schemaFile = resolveOptionalInput(
          options.schema,
          context.config.project?.schema,
          context,
        );
        const format =
          options.format ?? formatFromPath(configFile, context.config.editor?.defaultFormat);
        const source = await readFile(configFile, "utf8");
        const data = parseData(source, { format });
        const value = parseData(rawValue);
        const next = setPath(data, path, value);

        if (schemaFile) {
          const schema = await readSchema(schemaFile);
          const result = validateConfig(schema, next);
          if (!result.valid) {
            printError("edit would make the config invalid");
            printIssues(result.issues);
            process.exitCode = 1;
            return;
          }
        }

        const output = updateDataText(source, path, value, {
          format,
          preserveComments: context.config.editor?.preserveComments,
        });
        if (options.dryRun) {
          process.stdout.write(output);
        } else {
          await atomicWriteFile(configFile, output);
          printOk(`updated ${relativeLabel(configFile)}:${path}`);
        }
      });
    },
  );

program
  .command("explain")
  .description("Explain a schema path.")
  .argument("<path>", "Dotted schema path")
  .option("-s, --schema <file>", "JSON Schema file")
  .option("--json", "Print machine-readable JSON")
  .action(async (path: string, options: { schema?: string; json?: boolean }) => {
    await withErrors(async () => {
      const context = await loadContext(program.opts<GlobalOptions>().config);
      const schemaFile = resolveInput(
        options.schema,
        context.config.project?.schema,
        "schema file",
        context,
      );
      const field = describeSchemaPath(await readSchema(schemaFile), path);

      if (!field) {
        throw new Error(`No schema field found for ${path}`);
      }

      if (options.json) {
        printJson(field);
        return;
      }

      printHeader(field.title);
      line("path", field.path);
      line("type", field.type);
      line("required", String(field.required));
      if (field.description) line("description", field.description);
      if (field.enum) line("enum", field.enum.map(String).join(", "));
      if (field.defaultValue !== undefined) line("default", JSON.stringify(field.defaultValue));
    });
  });

program
  .command("diff")
  .description("Compare two or more YAML, JSON, or TOML config files.")
  .argument("<files...>", "Config files to compare")
  .option("--all", "Include equal rows")
  .option("--baseline <name>", "Baseline file name or path")
  .option("--json", "Print machine-readable JSON")
  .action(
    async (files: string[], options: { all?: boolean; baseline?: string; json?: boolean }) => {
      await withErrors(async () => {
        if (files.length < 2) {
          throw new Error("diff requires at least two config files");
        }

        const snapshots = await Promise.all(
          files.map(async (file) => {
            const resolved = resolve(file);
            return {
              name: relativeLabel(resolved),
              data: await readData(resolved),
            };
          }),
        );
        const rows = compareConfigs(snapshots, {
          onlyChanges: !options.all,
          baseline: resolveBaselineLabel(
            options.baseline,
            snapshots.map((snapshot) => snapshot.name),
          ),
        });
        const summary = summarizeDiffRows(rows);

        if (options.json) {
          printJson({ files: snapshots.map((snapshot) => snapshot.name), summary, rows });
          return;
        }

        if (rows.length === 0) {
          printOk("no differences");
          return;
        }

        printHeader(
          `${summary.total} diff rows (${summary.changed} changed, ${summary.missing} missing, ${summary.same} same)`,
        );
        for (const row of rows) {
          const marker =
            row.kind === "missing"
              ? pc.yellow("[missing]")
              : row.kind === "changed"
                ? pc.red("[changed]")
                : pc.dim("[same]");
          process.stdout.write(`\n${marker} ${pc.bold(row.path || "<root>")}\n`);
          for (const cell of row.cells) {
            const status =
              cell.status === "missing"
                ? pc.yellow("missing")
                : cell.status === "changed"
                  ? pc.red("changed")
                  : pc.green("same");
            const value = cell.exists ? JSON.stringify(cell.value) : "-";
            process.stdout.write(`  ${cell.name.padEnd(28)} ${status.padEnd(16)} ${value}\n`);
          }
        }
      });
    },
  );

const configCommand = program.command("config").description("Inspect Schematica project config.");

configCommand
  .command("show")
  .description("Print the active Schematica project config.")
  .option("--json", "Print machine-readable JSON")
  .action(async (options: { json?: boolean }) => {
    await withErrors(async () => {
      const { config } = await loadContext(program.opts<GlobalOptions>().config);
      if (options.json) {
        printJson(config);
      } else {
        process.stdout.write(stringifyData(config, { format: "yaml" }));
      }
    });
  });

configCommand
  .command("validate")
  .description("Validate Schematica's own config file.")
  .argument("[file]", "Config file", "schematica.config.yaml")
  .option("--json", "Print machine-readable JSON")
  .action(async (file: string, options: { json?: boolean }) => {
    await withErrors(async () => {
      const configPath = resolve(file);
      const config = await readData(configPath);
      const schemaPath = resolveProjectConfigSchemaPath(config, configPath);
      if (!schemaPath) {
        throw new Error(
          `Missing $schema in ${relativeLabel(configPath)} and no local Schematica schema was found.`,
        );
      }
      const result = validateConfig(await readSchema(schemaPath), config);

      if (options.json) {
        printJson(result);
      } else if (result.valid) {
        printOk(`valid ${relativeLabel(configPath)}`);
      } else {
        printError(`invalid ${relativeLabel(configPath)}`);
        printIssues(result.issues);
      }

      process.exitCode = result.valid ? 0 : 1;
    });
  });

async function loadContext(configFile = "schematica.config.yaml"): Promise<ProjectContext> {
  const configPath = resolve(configFile);
  if (!existsSync(configPath)) {
    return { config: {}, directory: dirname(configPath) };
  }

  const config = await readData(configPath);
  const schemaPath = resolveProjectConfigSchemaPath(config, configPath);
  if (schemaPath) {
    if (!existsSync(schemaPath)) {
      throw new Error(`Schematica config schema not found: ${schemaPath}`);
    }
    const result = validateConfig(await readSchema(schemaPath), config);
    if (!result.valid) {
      throw new Error(
        `Invalid Schematica config ${relativeLabel(configPath)}\n${result.issues
          .map((issue) => `  ${issue.path}: ${issue.message}`)
          .join("\n")}`,
      );
    }
  }

  return {
    config: config as ProjectConfig,
    directory: dirname(configPath),
  };
}

function resolveProjectConfigSchemaPath(config: JsonValue, configPath: string): string | undefined {
  const schemaReference =
    config && typeof config === "object" && !Array.isArray(config)
      ? (config as Record<string, unknown>).$schema
      : undefined;
  if (typeof schemaReference === "string") {
    return resolve(dirname(configPath), schemaReference);
  }

  const localSchema = resolve("schemas/schematica.config.schema.json");
  return existsSync(localSchema) ? localSchema : undefined;
}

async function readSchema(file: string): Promise<JsonSchema> {
  return parseSchema(await readFile(resolve(file), "utf8"), {
    format: formatFromPath(file, "json"),
  });
}

async function readData(file: string): Promise<JsonValue> {
  return parseData(await readFile(resolve(file), "utf8"), { format: formatFromPath(file) });
}

function resolveInput(
  explicit: string | undefined,
  configured: string | undefined,
  label: string,
  context: ProjectContext,
): string {
  const value = explicit ?? configured;
  if (!value) {
    throw new Error(`Missing ${label}. Pass it explicitly or configure schematica.config.yaml.`);
  }

  return explicit ? resolve(explicit) : resolve(context.directory, value);
}

function resolveOptionalInput(
  explicit: string | undefined,
  configured: string | undefined,
  context: ProjectContext,
) {
  if (!explicit && !configured) return undefined;
  return explicit ? resolve(explicit) : resolve(context.directory, configured!);
}

async function atomicWriteFile(file: string, contents: string) {
  const requestedTarget = resolve(file);
  const target = await lstat(requestedTarget)
    .then((metadata) => (metadata.isSymbolicLink() ? realpath(requestedTarget) : requestedTarget))
    .catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return requestedTarget;
      throw error;
    });
  const temporary = resolve(dirname(target), `.${basename(target)}.schematica-${randomUUID()}.tmp`);
  const mode = await stat(target)
    .then((metadata) => metadata.mode & 0o7777)
    .catch(() => 0o600);
  const handle = await open(temporary, "wx", mode);

  try {
    await handle.writeFile(contents, "utf8");
    await handle.chmod(mode);
    await handle.sync();
    await handle.close();
    await rename(temporary, target);
    const directoryHandle = await open(dirname(target), "r").catch(() => undefined);
    if (directoryHandle) {
      await directoryHandle.sync().catch(() => undefined);
      await directoryHandle.close().catch(() => undefined);
    }
  } catch (error) {
    await handle.close().catch(() => undefined);
    await unlink(temporary).catch(() => undefined);
    throw error;
  }
}

async function withErrors(task: () => Promise<void>) {
  try {
    await task();
  } catch (error) {
    printError(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

function printJson(value: unknown) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function printOk(message: string) {
  process.stdout.write(`${pc.green("[ok]")} ${message}\n`);
}

function printError(message: string) {
  process.stderr.write(`${pc.red("[error]")} ${message}\n`);
}

function printHeader(message: string) {
  process.stdout.write(`${pc.bold(message)}\n`);
}

function printIssues(issues: Array<{ path: string; message: string; keyword: string }>) {
  for (const issue of issues) {
    process.stderr.write(
      `  ${pc.dim(issue.keyword.padEnd(18))} ${pc.cyan(issue.path.padEnd(24))} ${issue.message}\n`,
    );
  }
}

function line(label: string, value: string) {
  process.stdout.write(`${pc.dim(label.padEnd(12))} ${value}\n`);
}

function relativeLabel(file: string) {
  const label = relative(process.cwd(), file);
  return label.startsWith("..") ? file : label;
}

function resolveBaselineLabel(value: string | undefined, labels: string[]): string | undefined {
  if (!value) {
    return undefined;
  }

  const candidates = new Set([value, relativeLabel(resolve(value)), basename(value)]);
  return labels.find((label) => candidates.has(label) || candidates.has(basename(label))) ?? value;
}

void program.parseAsync();
