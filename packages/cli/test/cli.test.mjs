import assert from "node:assert/strict";
import {
  chmod,
  copyFile,
  lstat,
  mkdtemp,
  readFile,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import test from "node:test";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const cli = resolve(root, "packages/cli/dist/index.cjs");

/**
 * @typedef {{
 *   summary: { total: number; same: number; changed: number; missing: number };
 *   rows: Array<{ path: string; cells: Array<{ status: string }> }>;
 * }} DiffOutput
 */

/**
 * @param {string[]} args
 * @param {Omit<import("node:child_process").SpawnSyncOptionsWithStringEncoding, "encoding">} [options]
 */
function run(args, options = {}) {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd: root,
    encoding: "utf8",
    ...options,
  });
}

void test("validate reports a valid example config", () => {
  const result = run(["validate", "examples/config.yaml", "--schema", "examples/schema.json"]);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /valid examples\/config\.yaml/);
  assert.equal(result.stderr, "");
});

void test("validate accepts TOML configs", () => {
  const result = run(["validate", "examples/config.toml", "--schema", "examples/schema.json"]);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /valid examples\/config\.toml/);
  assert.equal(result.stderr, "");
});

void test("diff emits machine-readable summaries for multiple configs", () => {
  const result = run([
    "diff",
    "examples/config.yaml",
    "examples/config.slurm.yaml",
    "--baseline",
    "config.slurm.yaml",
    "--json",
  ]);

  assert.equal(result.status, 0);
  /** @type {DiffOutput} */
  const output = JSON.parse(result.stdout);
  assert.deepEqual(output.summary, {
    total: 3,
    same: 0,
    changed: 2,
    missing: 1,
  });
  const backend = output.rows.find((row) => row.path === "backend");
  assert.ok(backend);
  assert.equal(backend.cells[0].status, "changed");
  assert.equal(backend.cells[1].status, "same");
});

void test("diff compares TOML configs with the same engine", () => {
  const result = run(["diff", "examples/config.toml", "examples/config.slurm.toml", "--json"]);

  assert.equal(result.status, 0);
  /** @type {DiffOutput} */
  const output = JSON.parse(result.stdout);
  assert.deepEqual(output.summary, {
    total: 3,
    same: 0,
    changed: 2,
    missing: 1,
  });
});

void test("set dry-run validates without mutating the source file", async () => {
  const before = await readFile(resolve(root, "examples/config.yaml"), "utf8");
  const result = run([
    "set",
    "examples/config.yaml",
    "training.batch_size",
    "48",
    "--schema",
    "examples/schema.json",
    "--dry-run",
  ]);
  const after = await readFile(resolve(root, "examples/config.yaml"), "utf8");

  assert.equal(result.status, 0);
  assert.match(result.stdout, /batch_size: 48/);
  assert.equal(after, before);
});

void test("set preserves TOML when editing TOML files", () => {
  const result = run([
    "set",
    "examples/config.toml",
    "training.batch_size",
    "48",
    "--schema",
    "examples/schema.json",
    "--dry-run",
  ]);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /\[training\]/);
  assert.match(result.stdout, /batch_size = 48/);
});

void test("set preserves YAML comments when project config enables it", async () => {
  const dir = await mkdtemp(resolve(tmpdir(), "schematica-comments-"));
  const configFile = resolve(dir, "config.yaml");
  const projectConfig = resolve(dir, "schematica.config.yaml");
  await writeFile(
    configFile,
    `# owner note
training:
  # keep small locally
  batch_size: 8
`,
  );
  await writeFile(
    projectConfig,
    `$schema: ${resolve(root, "schemas/schematica.config.schema.json")}
project:
  name: comments
  config: ${configFile}
editor:
  preserveComments: best-effort
`,
  );

  const result = run([
    "--config",
    projectConfig,
    "set",
    configFile,
    "training.batch_size",
    "48",
    "--dry-run",
  ]);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /# owner note/);
  assert.match(result.stdout, /# keep small locally/);
  assert.match(result.stdout, /batch_size: 48/);
});

void test("set rejects schema-invalid edits", () => {
  const result = run([
    "set",
    "examples/config.yaml",
    "training.batch_size",
    "0",
    "--schema",
    "examples/schema.json",
    "--dry-run",
  ]);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /edit would make the config invalid/);
});

void test("project config can drive implicit schema and config paths", () => {
  const result = run(["validate"]);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /valid examples\/config\.yaml/);
});

void test("config validate resolves $schema relative to the config file", () => {
  const result = run(["config", "validate", resolve(root, "schematica.config.yaml")], {
    cwd: resolve(root, "packages/cli"),
  });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /valid .*schematica\.config\.yaml/);
});

void test("invalid project config fails before command execution", async () => {
  const dir = await mkdtemp(resolve(tmpdir(), "schematica-cli-"));
  const config = resolve(dir, "schematica.config.yaml");
  await writeFile(
    config,
    `$schema: ${resolve(root, "schemas/schematica.config.schema.json")}\nproject: {}\n`,
  );

  const result = run(["--config", config, "validate"]);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Invalid Schematica config/);
});

void test("the bundled CLI starts without monorepo dependencies", async () => {
  const dir = await mkdtemp(resolve(tmpdir(), "schematica-standalone-"));
  const standalone = resolve(dir, "schematica.cjs");
  await copyFile(cli, standalone);

  const result = spawnSync(process.execPath, [standalone, "--help"], {
    cwd: dir,
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Fast schema-driven config editing/);
});

void test("project paths resolve beside the project config, not the current directory", async () => {
  const project = await mkdtemp(resolve(tmpdir(), "schematica-project-"));
  const elsewhere = await mkdtemp(resolve(tmpdir(), "schematica-cwd-"));
  await writeFile(
    resolve(project, "schema.json"),
    JSON.stringify({
      type: "object",
      required: ["name"],
      properties: { name: { type: "string" } },
    }),
  );
  await writeFile(resolve(project, "config.yaml"), "name: demo\n");
  await writeFile(
    resolve(project, "schematica.config.yaml"),
    "project:\n  name: relative\n  schema: schema.json\n  config: config.yaml\n",
  );

  const result = run(["--config", resolve(project, "schematica.config.yaml"), "validate"], {
    cwd: elsewhere,
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /valid/);
});

void test("get distinguishes a missing path from a null value", async () => {
  const dir = await mkdtemp(resolve(tmpdir(), "schematica-get-"));
  const config = resolve(dir, "config.yaml");
  await writeFile(config, "present: null\n");

  assert.equal(run(["get", config, "present", "--json"]).status, 0);
  const missing = run(["get", config, "missing", "--json"]);
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /No value found/);
});

void test(
  "set atomically updates symlink targets and preserves permissions",
  { skip: process.platform === "win32" },
  async () => {
    const dir = await mkdtemp(resolve(tmpdir(), "schematica-atomic-"));
    const target = resolve(dir, "target.yaml");
    const link = resolve(dir, "config.yaml");
    await writeFile(target, "name: before\n");
    await chmod(target, 0o640);
    await symlink(target, link);

    const result = run([
      "--config",
      resolve(dir, "no-project-config.yaml"),
      "set",
      link,
      "name",
      "after",
    ]);

    assert.equal(result.status, 0, result.stderr);
    assert.equal(await readFile(target, "utf8"), "name: after\n");
    assert.equal((await lstat(link)).isSymbolicLink(), true);
    assert.equal((await stat(target)).mode & 0o777, 0o640);
  },
);
