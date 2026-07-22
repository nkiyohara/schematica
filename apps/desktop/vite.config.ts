import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const host = process.env.TAURI_DEV_HOST;
const here = dirname(fileURLToPath(import.meta.url));
const rootPackageJson = JSON.parse(readFileSync(resolve(here, "../../package.json"), "utf8")) as {
  version?: string;
};
const schematicaVersion = process.env.SCHEMATICA_VERSION ?? rootPackageJson.version ?? "0.0.0-dev";

export default defineConfig({
  base: "./",
  plugins: [svelte()],
  define: {
    __SCHEMATICA_VERSION__: JSON.stringify(schematicaVersion),
  },
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: "editor",
              test: /node_modules[\\/](?:@codemirror|codemirror|@lezer)[\\/]/,
              priority: 20,
            },
            {
              name: "config-formats",
              test: /node_modules[\\/](?:ajv|yaml|smol-toml)[\\/]/,
              priority: 10,
            },
          ],
        },
      },
    },
  },
  resolve: {
    alias: {
      "@schematica/core": resolve(here, "../../packages/core/src/index.ts"),
    },
  },
  clearScreen: false,
  server: {
    host: host ?? false,
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
});
