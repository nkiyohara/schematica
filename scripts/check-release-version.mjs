#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const rootPackageJson = JSON.parse(readFileSync(resolve(here, "../package.json"), "utf8"));
const packageVersion = rootPackageJson.version;
const tagName = process.argv[2] ?? process.env.GITHUB_REF_NAME ?? "";
const semverPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (typeof packageVersion !== "string" || !semverPattern.test(packageVersion)) {
  fail(
    `package.json version must be a valid semver string, got ${JSON.stringify(packageVersion)}.`,
  );
}

if (!tagName) {
  console.log(`Schematica version: ${packageVersion}`);
  process.exit(0);
}

const tagVersion = tagName.startsWith("v") ? tagName.slice(1) : tagName;

if (tagVersion !== packageVersion) {
  fail(`Release tag ${tagName} does not match package.json version ${packageVersion}.`);
}

console.log(`Release tag ${tagName} matches package.json version ${packageVersion}.`);
