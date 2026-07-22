import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(root, "assets/brand/schematica-icon.svg");
const output = resolve(root, "apps/desktop/src-tauri/icons");
const appIcon = resolve(root, "apps/desktop/src-tauri/app-icon.png");

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    shell: process.platform === "win32",
    stdio: "inherit",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (!existsSync(source)) {
  throw new Error(`Missing icon source: ${source}`);
}

run("corepack", [
  "pnpm",
  "--filter",
  "@schematica/desktop",
  "exec",
  "tauri",
  "icon",
  source,
  "-o",
  output,
]);
run("magick", [source, "-resize", "1024x1024", appIcon]);
