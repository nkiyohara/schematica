import {
  parseData,
  updateDataText,
  type CommentPreservation,
  type DataFormat,
  type JsonObject,
  type JsonValue,
} from "@schematica/core";
import {
  appearanceContrastModes,
  appearanceDensityIds,
  appearanceMotionModes,
  appearancePaletteIds,
  appearanceThemes,
  densityOptions,
  paletteTokens,
  type AppearanceContrast,
  type AppearanceDensity,
  type AppearanceMotion,
  type AppearancePalette,
  type AppearanceTheme,
} from "./appearance-catalog";
import { locales, type Locale, type LocalePreference } from "./i18n";
import { sampleAppConfig } from "./samples";

export const supportedLocalePreferences = [
  "system",
  ...locales,
] as const satisfies readonly LocalePreference[];

const localeAutonyms: Record<string, string> = {
  en: "English",
  ja: "日本語",
  es: "Español",
  "zh-CN": "简体中文",
  ko: "한국어",
  fr: "Français",
  de: "Deutsch",
};

const systemPreferenceLabels: Record<string, string> = {
  en: "System",
  ja: "システム設定",
  es: "Sistema",
  "zh-CN": "跟随系统",
  ko: "시스템 설정",
  fr: "Système",
  de: "System",
};

export function localePreferenceLabels(locale: Locale): Record<LocalePreference, string> {
  return Object.fromEntries(
    supportedLocalePreferences.map((preference) => [
      preference,
      preference === "system"
        ? (systemPreferenceLabels[locale] ?? systemPreferenceLabels.en)
        : (localeAutonyms[preference] ?? preference),
    ]),
  ) as Record<LocalePreference, string>;
}

export function localeFieldOptionLabels(locale: Locale): Record<string, string> {
  return Object.fromEntries(
    Object.entries(localePreferenceLabels(locale)).map(([preference, label]) => [
      `option.interface.locale.${preference}`,
      label,
    ]),
  );
}

export interface AppAppearance {
  theme: AppearanceTheme;
  palette: AppearancePalette;
  accent: string;
  density: AppearanceDensity;
  contrast: AppearanceContrast;
  motion: AppearanceMotion;
  fontFamily: string;
  monoFontFamily: string;
  fontSize: number;
  cornerRadius: number;
}

export interface AppConfig {
  project: {
    name: string;
    schema?: string;
    config?: string;
  };
  interface: {
    locale: LocalePreference;
  };
  features: {
    git: boolean;
    feedback: boolean;
  };
  updates: {
    policy: "auto" | "package-manager" | "signed-updater" | "manual";
    checkOnStartup: boolean;
  };
  editor: {
    defaultFormat: DataFormat;
    autosave: boolean;
    showRawPreview: boolean;
    preserveComments: CommentPreservation;
  };
  appearance: AppAppearance;
}

export const fallbackConfig: AppConfig = {
  project: {
    name: "schematica-project",
  },
  interface: {
    locale: "system",
  },
  features: {
    git: true,
    feedback: true,
  },
  updates: {
    policy: "auto",
    checkOnStartup: true,
  },
  editor: {
    defaultFormat: "yaml",
    autosave: false,
    showRawPreview: true,
    preserveComments: "best-effort",
  },
  appearance: {
    theme: "system",
    palette: "slate",
    accent: "#2563eb",
    density: "comfortable",
    contrast: "standard",
    motion: "system",
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
    monoFontFamily: "JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, monospace",
    fontSize: 14,
    cornerRadius: 8,
  },
};

export function parseAppConfig(source = sampleAppConfig, format: DataFormat = "yaml"): AppConfig {
  const parsed = parseData(source, { format }) as JsonObject;
  const project = asObject(parsed.project);
  const interfaceConfig = asObject(parsed.interface);
  const features = asObject(parsed.features);
  const updates = asObject(parsed.updates);
  const editor = asObject(parsed.editor);
  const appearance = asObject(parsed.appearance);

  return {
    project: {
      name: nonEmptyString(project.name, fallbackConfig.project.name),
      schema: optionalString(project.schema),
      config: optionalString(project.config),
    },
    interface: {
      locale: appearanceString(interfaceConfig.locale, supportedLocalePreferences, "system"),
    },
    features: {
      git: typeof features.git === "boolean" ? features.git : true,
      feedback: typeof features.feedback === "boolean" ? features.feedback : true,
    },
    updates: {
      policy: appearanceString(
        updates.policy,
        ["auto", "package-manager", "signed-updater", "manual"],
        "auto",
      ),
      checkOnStartup: typeof updates.checkOnStartup === "boolean" ? updates.checkOnStartup : true,
    },
    editor: {
      defaultFormat: appearanceString(editor.defaultFormat, ["yaml", "json", "toml"], "yaml"),
      autosave: typeof editor.autosave === "boolean" ? editor.autosave : false,
      showRawPreview: typeof editor.showRawPreview === "boolean" ? editor.showRawPreview : true,
      preserveComments: appearanceString(
        editor.preserveComments,
        ["off", "best-effort"],
        "best-effort",
      ),
    },
    appearance: {
      theme: appearanceString(appearance.theme, appearanceThemes, "system"),
      palette: appearanceString(appearance.palette, appearancePaletteIds, "slate"),
      accent: hexColor(appearance.accent, fallbackConfig.appearance.accent),
      density: appearanceString(appearance.density, appearanceDensityIds, "comfortable"),
      contrast: appearanceString(appearance.contrast, appearanceContrastModes, "standard"),
      motion: appearanceString(appearance.motion, appearanceMotionModes, "system"),
      fontFamily: nonEmptyString(appearance.fontFamily, fallbackConfig.appearance.fontFamily),
      monoFontFamily: nonEmptyString(
        appearance.monoFontFamily,
        fallbackConfig.appearance.monoFontFamily,
      ),
      fontSize: boundedInteger(appearance.fontSize, 12, 20, fallbackConfig.appearance.fontSize),
      cornerRadius: boundedInteger(
        appearance.cornerRadius,
        2,
        12,
        fallbackConfig.appearance.cornerRadius,
      ),
    },
  };
}

export function updateAppConfigText(
  source: string,
  path: string,
  value: JsonValue,
  preserveComments: CommentPreservation = "best-effort",
  format: DataFormat = "yaml",
): string {
  return updateDataText(source, path, value, {
    format,
    preserveComments,
  });
}

export function themeStyle(
  config: AppConfig,
  mode: "light" | "dark" = "light",
  systemReducedMotion = false,
): string {
  const density = densityOptions[config.appearance.density].scale;
  const palette = paletteTokens(config.appearance.palette, mode);
  const highContrast = config.appearance.contrast === "high";
  const reducedMotion =
    config.appearance.motion === "reduced" ||
    (config.appearance.motion === "system" && systemReducedMotion);
  const accentContrast = readableTextFor(config.appearance.accent);
  const shadowColor = mode === "dark" ? "rgb(0 0 0 / 34%)" : "rgb(15 23 42 / 10%)";
  const syntaxColors =
    mode === "dark"
      ? { string: "#6ee7b7", number: "#c4b5fd", constant: "#fbbf24", metadata: "#7dd3fc" }
      : { string: "#047857", number: "#6d28d9", constant: "#b45309", metadata: "#0369a1" };

  return [
    `--surface: ${palette.surface}`,
    `--surface-raised: color-mix(in srgb, ${palette.panel} 88%, ${palette.panelStrong})`,
    `--panel: ${palette.panel}`,
    `--panel-strong: ${palette.panelStrong}`,
    `--line: ${palette.line}`,
    `--line-strong: ${
      highContrast ? `color-mix(in srgb, ${palette.text} 34%, ${palette.line})` : palette.line
    }`,
    `--muted: ${
      highContrast ? `color-mix(in srgb, ${palette.text} 76%, ${palette.muted})` : palette.muted
    }`,
    `--text: ${palette.text}`,
    `--sidebar: ${palette.sidebar}`,
    `--accent: ${config.appearance.accent}`,
    `--accent-soft: color-mix(in srgb, ${config.appearance.accent} 12%, transparent)`,
    `--accent-contrast: ${accentContrast}`,
    `--control: color-mix(in srgb, ${palette.panel} 88%, ${palette.panelStrong})`,
    `--control-hover: color-mix(in srgb, ${config.appearance.accent} 10%, ${palette.panel})`,
    `--selection: color-mix(in srgb, ${config.appearance.accent} 24%, transparent)`,
    `--focus-ring: color-mix(in srgb, ${config.appearance.accent} 72%, white)`,
    `--syntax-key: color-mix(in srgb, ${config.appearance.accent} ${highContrast ? 58 : 78}%, ${palette.text})`,
    `--syntax-string: ${syntaxColors.string}`,
    `--syntax-number: ${syntaxColors.number}`,
    `--syntax-constant: ${syntaxColors.constant}`,
    `--syntax-metadata: ${syntaxColors.metadata}`,
    `--shadow-sm: 0 1px 2px ${shadowColor}`,
    `--shadow-md: 0 12px 28px ${shadowColor}`,
    `--shadow-lg: 0 24px 64px ${shadowColor}`,
    `--font-ui: ${config.appearance.fontFamily}`,
    `--font-mono: ${config.appearance.monoFontFamily}`,
    `--font-size: ${config.appearance.fontSize}px`,
    `--radius: ${config.appearance.cornerRadius}px`,
    `--density: ${density}`,
    `--motion-fast: ${reducedMotion ? "0ms" : "120ms"}`,
    `--motion-base: ${reducedMotion ? "0ms" : "180ms"}`,
  ].join(";");
}

function asObject(value: unknown): JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}

function appearanceString<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && allowed.includes(value as T) ? (value as T) : fallback;
}

function nonEmptyString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0 ? value : fallback;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function hexColor(value: unknown, fallback: string): string {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback;
}

function boundedInteger(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.round(value)));
}

function readableTextFor(hex: string): "#ffffff" | "#0f172a" {
  const red = Number.parseInt(hex.slice(1, 3), 16);
  const green = Number.parseInt(hex.slice(3, 5), 16);
  const blue = Number.parseInt(hex.slice(5, 7), 16);
  const luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
  return luminance > 0.58 ? "#0f172a" : "#ffffff";
}
