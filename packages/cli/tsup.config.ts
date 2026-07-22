import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "tsup";

const here = dirname(fileURLToPath(import.meta.url));
const rootPackageJson = JSON.parse(readFileSync(resolve(here, "../../package.json"), "utf8")) as {
  version?: string;
};
const schematicaVersion = process.env.SCHEMATICA_VERSION ?? rootPackageJson.version ?? "0.0.0-dev";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs"],
  platform: "node",
  target: "node24",
  noExternal: [/.*/],
  dts: true,
  sourcemap: true,
  clean: true,
  outExtension: () => ({ js: ".cjs" }),
  define: {
    __SCHEMATICA_VERSION__: JSON.stringify(schematicaVersion),
  },
});
