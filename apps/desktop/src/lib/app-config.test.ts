import { describe, expect, it } from "vitest";
import schematicaConfigSchema from "../../../../schemas/schematica.config.schema.json";
import {
  appearanceContrastModes,
  appearanceDensityIds,
  appearanceMotionModes,
  appearancePaletteIds,
  appearancePresetById,
  appearancePresetFor,
  appearancePresets,
  countAppearancePresetChanges,
} from "./appearance-catalog";
import {
  localeFieldOptionLabels,
  localePreferenceLabels,
  parseAppConfig,
  supportedLocalePreferences,
  updateAppConfigText,
} from "./app-config";
import { sampleAppConfig } from "./samples";

describe("app config text updates", () => {
  it("parses project schema and config paths", () => {
    expect(
      parseAppConfig("project:\n  name: demo\n  schema: ./schema.json\n  config: ./config.yaml\n"),
    ).toMatchObject({
      project: { name: "demo", schema: "./schema.json", config: "./config.yaml" },
    });
  });

  it("accumulates rapid appearance changes against the latest YAML text", () => {
    const withTheme = updateAppConfigText(sampleAppConfig, "appearance.theme", "dark");
    const withPalette = updateAppConfigText(withTheme, "appearance.palette", "emerald");
    const withDensity = updateAppConfigText(withPalette, "appearance.density", "compact");

    expect(parseAppConfig(withDensity).appearance).toMatchObject({
      theme: "dark",
      palette: "emerald",
      density: "compact",
    });
  });

  it("normalizes unsafe appearance values before producing theme tokens", () => {
    const parsed = parseAppConfig(`
appearance:
  theme: neon
  palette: unknown
  accent: tomato
  density: huge
  contrast: maximum
  motion: animated
  fontFamily: ""
  monoFontFamily: "   "
  fontSize: 999
  cornerRadius: -4
`);

    expect(parsed.appearance).toMatchObject({
      theme: "system",
      palette: "slate",
      accent: "#2563eb",
      density: "comfortable",
      contrast: "standard",
      motion: "system",
      fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
      monoFontFamily: "JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, monospace",
      fontSize: 20,
      cornerRadius: 2,
    });
    expect(parsed.editor.preserveComments).toBe("best-effort");
  });

  it("parses and preserves the comment preservation mode", () => {
    const parsed = parseAppConfig(`
editor:
  preserveComments: off
`);

    expect(parsed.editor.preserveComments).toBe("off");
    expect(parseAppConfig(sampleAppConfig).editor.preserveComments).toBe("best-effort");
  });

  it("keeps every supported UI locale aligned with the project config schema", () => {
    const expected = ["system", "en", "ja", "es", "zh-CN", "ko", "fr", "de"];
    const localeSchema = schematicaConfigSchema.properties.interface.properties.locale;

    expect([...supportedLocalePreferences]).toEqual(expected);
    expect(localeSchema.enum).toEqual(expected);
    expect(localeSchema.default).toBe("system");

    for (const locale of expected) {
      expect(parseAppConfig(`interface:\n  locale: ${locale}\n`).interface.locale).toBe(locale);
    }
    expect(parseAppConfig("interface:\n  locale: unsupported\n").interface.locale).toBe("system");
  });

  it("provides recognizable labels for every locale preference", () => {
    const germanLabels = localePreferenceLabels("de");
    const chineseLabels = localePreferenceLabels("zh-CN");

    expect(germanLabels).toMatchObject({
      system: "System",
      en: "English",
      ja: "日本語",
      es: "Español",
      "zh-CN": "简体中文",
      ko: "한국어",
      fr: "Français",
      de: "Deutsch",
    });
    expect(chineseLabels.system).toBe("跟随系统");
    expect(localeFieldOptionLabels("fr")).toMatchObject({
      "option.interface.locale.system": "Système",
      "option.interface.locale.de": "Deutsch",
    });
  });

  it("parses and updates TOML app config text when a format is provided", () => {
    const source = `[appearance]
theme = "system"
palette = "slate"

[editor]
preserveComments = "best-effort"
`;

    const updated = updateAppConfigText(source, "appearance.theme", "dark", "best-effort", "toml");

    expect(parseAppConfig(updated, "toml").appearance.theme).toBe("dark");
    expect(updated).toContain('theme = "dark"');
  });

  it("keeps comments when updating app config text in best-effort mode", () => {
    const source = `editor:
  # Keep notes from project owners
  preserveComments: best-effort
appearance:
  theme: system
`;

    const updated = updateAppConfigText(source, "appearance.theme", "dark", "best-effort");

    expect(updated).toContain("# Keep notes from project owners");
    expect(updated).toContain("theme: dark");
  });

  it("can produce theme tokens for every supported palette in light and dark modes", async () => {
    const { fallbackConfig, themeStyle } = await import("./app-config");

    for (const palette of appearancePaletteIds) {
      const config = {
        ...fallbackConfig,
        appearance: {
          ...fallbackConfig.appearance,
          palette,
        },
      };

      expect(themeStyle(config, "light")).toContain("--surface:");
      expect(themeStyle(config, "light")).toContain("--sidebar:");
      expect(themeStyle(config, "light")).toContain("--accent-contrast:");
      expect(themeStyle(config, "light")).toContain("--syntax-string: #047857");
      expect(themeStyle(config, "light", true)).toContain("--motion-base: 0ms");
      expect(themeStyle(config, "dark")).toContain("--surface:");
      expect(themeStyle(config, "dark")).toContain("--sidebar:");
      expect(themeStyle(config, "dark")).toContain("--syntax-string: #6ee7b7");
    }
  });

  it("keeps the appearance catalog aligned with the project config schema", () => {
    const appearance = schematicaConfigSchema.properties.appearance.properties;
    const editor = schematicaConfigSchema.properties.editor.properties;

    expect(appearance.palette.enum).toEqual(appearancePaletteIds);
    expect(appearance.density.enum).toEqual(appearanceDensityIds);
    expect(appearance.contrast.enum).toEqual(appearanceContrastModes);
    expect(appearance.motion.enum).toEqual(appearanceMotionModes);
    expect(editor.preserveComments.default).toBe("best-effort");
  });

  it("matches and compares appearance presets", () => {
    const balanced = appearancePresetById("balanced");

    expect(appearancePresetFor(parseAppConfig(sampleAppConfig).appearance)).toBe("balanced");
    expect(new Set(appearancePresets.map((preset) => preset.id)).size).toBe(
      appearancePresets.length,
    );
    expect(countAppearancePresetChanges(balanced, balanced)).toBe(0);
    expect(
      countAppearancePresetChanges(
        {
          ...balanced,
          accent: balanced.accent.toUpperCase(),
          density: "compact",
        },
        balanced,
      ),
    ).toBe(1);
  });
});
