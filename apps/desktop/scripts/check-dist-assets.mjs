import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const indexPath = resolve(import.meta.dirname, "../dist/index.html");
const assetsDir = resolve(import.meta.dirname, "../dist/assets");
const tauriConfigPath = resolve(import.meta.dirname, "../src-tauri/tauri.conf.json");
const html = readFileSync(indexPath, "utf8");
const tauriConfig = JSON.parse(readFileSync(tauriConfigPath, "utf8"));

const absoluteAssetReferences = [...html.matchAll(/\b(?:src|href)=["']\/assets\//g)].map(
  (match) => match[0],
);

if (absoluteAssetReferences.length > 0) {
  throw new Error(
    `Packaged desktop builds must use relative asset URLs. Found: ${absoluteAssetReferences.join(", ")}`,
  );
}

if (!html.includes("./assets/")) {
  throw new Error("Packaged desktop build did not contain relative ./assets/ references.");
}

const csp = tauriConfig?.app?.security?.csp;
if (typeof csp !== "string") {
  throw new Error("Tauri production CSP is missing from app.security.csp.");
}

const scriptSrc = csp
  .split(";")
  .map((directive) => directive.trim())
  .find((directive) => directive.startsWith("script-src "));
const allowsDynamicCode = scriptSrc?.split(/\s+/).includes("'unsafe-eval'") ?? false;
const javascriptAssets = readdirSync(assetsDir)
  .filter((name) => name.endsWith(".js"))
  .map((name) => readFileSync(resolve(assetsDir, name), "utf8"));
const usesDynamicFunction = javascriptAssets.some(
  (source) =>
    source.includes("Function(`") || source.includes('Function("') || source.includes("Function('"),
);

if (usesDynamicFunction && !allowsDynamicCode) {
  throw new Error(
    "Packaged desktop bundle uses dynamic Function() code generation, but Tauri CSP script-src does not allow 'unsafe-eval'.",
  );
}
