import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const locales = ["en", "ja", "es", "zh-CN", "ko", "fr", "de"];
const metaKeys = ["meta.title", "meta.description", "meta.ogTitle", "meta.ogDescription"];
const dynamicKeys = [
  "install.unavailable",
  "install.noReleaseTitle",
  "install.noReleaseBody",
  "install.releaseTitle",
  "install.releaseBody",
  "install.download",
  "install.assetMissing",
  ...["mac", "linux", "windows"].flatMap((platform) =>
    ["Status", "Architecture", "Trust", "VerifyTitle", "VerifyBody", "Steps", "Caution"].map(
      (suffix) => `install.${platform}${suffix}`,
    ),
  ),
];

/** @param {string} html */
function pageKeys(html) {
  return [...html.matchAll(/data-i18n(?:-aria-label|-alt)?="([^"]+)"/g)].map((match) => match[1]);
}

void test("site locale catalogs cover every visible translation key", async () => {
  const html = await readFile(new URL("../site/index.html", import.meta.url), "utf8");
  const expectedKeys = [...new Set([...pageKeys(html), ...metaKeys, ...dynamicKeys])].sort();
  const english = /** @type {Record<string, string>} */ (
    JSON.parse(await readFile(new URL("../site/locales/en.json", import.meta.url), "utf8"))
  );

  for (const locale of locales) {
    const raw = await readFile(new URL(`../site/locales/${locale}.json`, import.meta.url), "utf8");
    const messages = /** @type {Record<string, string>} */ (JSON.parse(raw));
    assert.deepEqual(Object.keys(messages).sort(), expectedKeys, `${locale} keys`);
    for (const key of expectedKeys) {
      assert.equal(typeof messages[key], "string", `${locale}.${key} type`);
      assert.notEqual(messages[key].trim(), "", `${locale}.${key} value`);
      assert.deepEqual(
        [...messages[key].matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort(),
        [...english[key].matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort(),
        `${locale}.${key} placeholders`,
      );
    }
  }
});
