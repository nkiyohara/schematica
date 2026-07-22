import { describe, expect, it } from "vitest";
import { locales, messageCatalogs, normalizeLocale, translate, type MessageKey } from "./i18n";

function placeholders(message: string) {
  return [...new Set([...message.matchAll(/\{(\w+)\}/g)].map((match) => match[1]))].sort();
}

describe("message catalogs", () => {
  it("exposes the complete supported locale list", () => {
    expect(locales).toEqual(["en", "ja", "es", "zh-CN", "ko", "fr", "de"]);
  });

  it("provides every English message in every locale", () => {
    const referenceKeys = Object.keys(messageCatalogs.en).sort();
    expect(referenceKeys).toHaveLength(404);

    for (const locale of locales) {
      expect(Object.keys(messageCatalogs[locale]).sort()).toEqual(referenceKeys);
      for (const key of referenceKeys as MessageKey[]) {
        expect(messageCatalogs[locale][key].trim(), `${locale}.${key}`).not.toBe("");
      }
    }
  });

  it("keeps each locale's placeholder set aligned with English", () => {
    for (const key of Object.keys(messageCatalogs.en) as MessageKey[]) {
      const expected = placeholders(messageCatalogs.en[key]);
      for (const locale of locales) {
        expect(placeholders(messageCatalogs[locale][key]), `${locale}.${key}`).toEqual(expected);
      }
    }
  });

  it("interpolates provided values and preserves omitted placeholders", () => {
    expect(translate("ja", "commands.paletteResults", { count: 12 })).toBe("12件のコマンド");
    expect(translate("ja", "actions.closeDocument")).toContain("{name}");
  });

  it("contains no generated-translation or merge-conflict contamination", () => {
    for (const locale of locales) {
      for (const [key, message] of Object.entries(messageCatalogs[locale])) {
        expect(message, `${locale}.${key}`).not.toMatch(/translate=|<<<<<<<|=======|>>>>>>>/);
      }
    }
  });
});

describe("normalizeLocale", () => {
  it.each([
    ["es-MX", "es"],
    ["de-AT", "de"],
    ["fr-CA", "fr"],
    ["ko-KR", "ko"],
    ["zh", "zh-CN"],
    [" zh_CN ", "zh-CN"],
    ["zh-CN-u-nu-hanidec", "zh-CN"],
    ["zh-SG", "zh-CN"],
    ["zh-Hans-CN", "zh-CN"],
  ] as const)("maps %s to %s", (language, expected) => {
    expect(normalizeLocale(language)).toBe(expected);
  });

  it.each(["zh-TW", "zh-HK", "zh-MO", "zh-Hant", "zh-Hant-TW"])(
    "falls back to English for unsupported Traditional Chinese locale %s",
    (language) => {
      expect(normalizeLocale(language)).toBe("en");
    },
  );
});
