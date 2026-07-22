export const appearanceThemes = ["system", "light", "dark"] as const;
export type AppearanceTheme = (typeof appearanceThemes)[number];

export const appearanceContrastModes = ["standard", "high"] as const;
export type AppearanceContrast = (typeof appearanceContrastModes)[number];

export const appearanceMotionModes = ["system", "reduced", "full"] as const;
export type AppearanceMotion = (typeof appearanceMotionModes)[number];

export interface PaletteTokens {
  surface: string;
  panel: string;
  panelStrong: string;
  line: string;
  muted: string;
  text: string;
  sidebar: string;
}

export interface AppearancePaletteDefinition {
  id: string;
  swatches: readonly [string, string, string];
  light: PaletteTokens;
  dark: PaletteTokens;
}

export const appearancePalettes = {
  slate: {
    id: "slate",
    swatches: ["#f6f7f9", "#d9dee7", "#171a1f"],
    light: {
      surface: "#f6f7f9",
      panel: "#ffffff",
      panelStrong: "#f0f2f5",
      line: "#d9dee7",
      muted: "#667085",
      text: "#171a1f",
      sidebar: "#ffffff",
    },
    dark: {
      surface: "#101216",
      panel: "#171a1f",
      panelStrong: "#20242b",
      line: "#333946",
      muted: "#a4acb9",
      text: "#f7f8fa",
      sidebar: "#14171c",
    },
  },
  graphite: {
    id: "graphite",
    swatches: ["#f4f4f5", "#d4d4d8", "#18181b"],
    light: {
      surface: "#f4f4f5",
      panel: "#ffffff",
      panelStrong: "#efeff1",
      line: "#d4d4d8",
      muted: "#6b7280",
      text: "#18181b",
      sidebar: "#fafafa",
    },
    dark: {
      surface: "#101010",
      panel: "#18181b",
      panelStrong: "#222225",
      line: "#34343a",
      muted: "#a9a9b2",
      text: "#f4f4f5",
      sidebar: "#141416",
    },
  },
  cobalt: {
    id: "cobalt",
    swatches: ["#f4f7fb", "#d4deea", "#2563eb"],
    light: {
      surface: "#f4f7fb",
      panel: "#ffffff",
      panelStrong: "#edf2f8",
      line: "#d4deea",
      muted: "#5f6f84",
      text: "#172033",
      sidebar: "#fbfdff",
    },
    dark: {
      surface: "#0d111a",
      panel: "#151b27",
      panelStrong: "#1d2635",
      line: "#303b4e",
      muted: "#a8b3c4",
      text: "#f6f8fb",
      sidebar: "#111722",
    },
  },
  emerald: {
    id: "emerald",
    swatches: ["#f5f8f6", "#d4e4da", "#0f766e"],
    light: {
      surface: "#f5f8f6",
      panel: "#ffffff",
      panelStrong: "#edf4ef",
      line: "#d4e4da",
      muted: "#5f7167",
      text: "#132018",
      sidebar: "#fbfdfb",
    },
    dark: {
      surface: "#0d1411",
      panel: "#151d19",
      panelStrong: "#1d2922",
      line: "#304238",
      muted: "#a4b8ae",
      text: "#f5faf7",
      sidebar: "#101914",
    },
  },
  rose: {
    id: "rose",
    swatches: ["#f9f6f7", "#e5d5dc", "#be123c"],
    light: {
      surface: "#f9f6f7",
      panel: "#ffffff",
      panelStrong: "#f4edf0",
      line: "#e5d5dc",
      muted: "#735d66",
      text: "#24161b",
      sidebar: "#fffafb",
    },
    dark: {
      surface: "#160f12",
      panel: "#21171c",
      panelStrong: "#2c2026",
      line: "#46323c",
      muted: "#c1a7b2",
      text: "#fbf7f9",
      sidebar: "#1b1216",
    },
  },
} as const satisfies Record<string, AppearancePaletteDefinition>;

export type AppearancePalette = keyof typeof appearancePalettes;

export const appearancePaletteIds = Object.keys(appearancePalettes) as AppearancePalette[];

export const accentPresets = [
  "#2563eb",
  "#0f766e",
  "#7c3aed",
  "#be123c",
  "#b45309",
  "#334155",
] as const;

export const densityOptions = {
  compact: {
    id: "compact",
    scale: 0.8,
    bars: [46, 58, 42],
  },
  comfortable: {
    id: "comfortable",
    scale: 1,
    bars: [58, 72, 50],
  },
  spacious: {
    id: "spacious",
    scale: 1.18,
    bars: [72, 86, 62],
  },
} as const;

export type AppearanceDensity = keyof typeof densityOptions;
export const appearanceDensityIds = Object.keys(densityOptions) as AppearanceDensity[];

export interface FontPreset {
  label: string;
  value: string;
}

export const fontPresets: FontPreset[] = [
  {
    label: "Inter",
    value: "Inter, ui-sans-serif, system-ui, sans-serif",
  },
  {
    label: "System",
    value: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
  },
  {
    label: "Geist",
    value: "Geist, Inter, ui-sans-serif, system-ui, sans-serif",
  },
  {
    label: "IBM Plex Sans",
    value: "IBM Plex Sans, Inter, ui-sans-serif, system-ui, sans-serif",
  },
];

export const monoFontPresets: FontPreset[] = [
  {
    label: "JetBrains Mono",
    value: "JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, monospace",
  },
  {
    label: "System Mono",
    value: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  },
  {
    label: "IBM Plex Mono",
    value: "IBM Plex Mono, JetBrains Mono, ui-monospace, monospace",
  },
  {
    label: "Fira Code",
    value: "Fira Code, JetBrains Mono, ui-monospace, monospace",
  },
];

export interface AppearanceProfile {
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

export interface AppearancePreset extends AppearanceProfile {
  id: string;
}

export const appearancePresets = [
  {
    id: "balanced",
    theme: "system",
    palette: "slate",
    accent: "#2563eb",
    density: "comfortable",
    contrast: "standard",
    motion: "system",
    fontFamily: fontPresets[0].value,
    monoFontFamily: monoFontPresets[0].value,
    fontSize: 14,
    cornerRadius: 8,
  },
  {
    id: "focus",
    theme: "system",
    palette: "graphite",
    accent: "#334155",
    density: "compact",
    contrast: "high",
    motion: "reduced",
    fontFamily: fontPresets[1].value,
    monoFontFamily: monoFontPresets[1].value,
    fontSize: 13,
    cornerRadius: 6,
  },
  {
    id: "studio",
    theme: "dark",
    palette: "cobalt",
    accent: "#60a5fa",
    density: "comfortable",
    contrast: "standard",
    motion: "system",
    fontFamily: fontPresets[2].value,
    monoFontFamily: monoFontPresets[0].value,
    fontSize: 14,
    cornerRadius: 10,
  },
  {
    id: "research",
    theme: "system",
    palette: "emerald",
    accent: "#0f766e",
    density: "compact",
    contrast: "standard",
    motion: "system",
    fontFamily: fontPresets[3].value,
    monoFontFamily: monoFontPresets[2].value,
    fontSize: 13,
    cornerRadius: 6,
  },
  {
    id: "review",
    theme: "light",
    palette: "rose",
    accent: "#be123c",
    density: "spacious",
    contrast: "high",
    motion: "reduced",
    fontFamily: fontPresets[0].value,
    monoFontFamily: monoFontPresets[0].value,
    fontSize: 15,
    cornerRadius: 10,
  },
] as const satisfies readonly AppearancePreset[];

export type AppearancePresetId = (typeof appearancePresets)[number]["id"];

export const appearancePresetIds = appearancePresets.map((preset) => preset.id);

const appearanceKeys = [
  "theme",
  "palette",
  "accent",
  "density",
  "contrast",
  "motion",
  "fontFamily",
  "monoFontFamily",
  "fontSize",
  "cornerRadius",
] as const satisfies readonly (keyof AppearanceProfile)[];

export function paletteTokens(palette: AppearancePalette, mode: "light" | "dark") {
  return appearancePalettes[palette][mode];
}

export function appearancePresetById(id: AppearancePresetId): AppearancePreset {
  return appearancePresets.find((preset) => preset.id === id) ?? appearancePresets[0];
}

export function appearancePresetFor(profile: AppearanceProfile): AppearancePresetId | "custom" {
  return (
    appearancePresets.find((preset) => countAppearancePresetChanges(profile, preset) === 0)?.id ??
    "custom"
  );
}

export function countAppearancePresetChanges(
  profile: AppearanceProfile,
  preset: AppearanceProfile,
): number {
  return appearanceKeys.filter((key) => !appearanceValueMatches(profile[key], preset[key])).length;
}

function appearanceValueMatches(left: string | number, right: string | number): boolean {
  if (
    typeof left === "string" &&
    typeof right === "string" &&
    left.startsWith("#") &&
    right.startsWith("#")
  ) {
    return left.toLowerCase() === right.toLowerCase();
  }

  return left === right;
}
