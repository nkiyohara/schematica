import type { WorkbenchTab } from "./workbench";

export interface WorkspacePreferences {
  selectedTab: WorkbenchTab;
  explorerOpen: boolean;
  explorerWidth: number;
  compareOnlyChanges: boolean;
  compareBaselineName: string;
  primaryPanePercent: number;
  schemaInspectorPercent: number;
  problemsPanelHeight: number;
  problemsOpen: boolean;
}

export const workspacePreferenceKey = "schematica.workspace.v1";

export const defaultWorkspacePreferences: WorkspacePreferences = {
  selectedTab: "editor",
  explorerOpen: true,
  explorerWidth: 276,
  compareOnlyChanges: true,
  compareBaselineName: "config.yaml",
  primaryPanePercent: 58,
  schemaInspectorPercent: 35,
  problemsPanelHeight: 132,
  problemsOpen: true,
};

const tabs = ["editor", "compare", "settings"] as const satisfies readonly WorkbenchTab[];

export function readWorkspacePreferences(storage: Storage | undefined): WorkspacePreferences {
  if (!storage) return defaultWorkspacePreferences;

  try {
    return normalizeWorkspacePreferences(
      JSON.parse(storage.getItem(workspacePreferenceKey) ?? "{}"),
    );
  } catch {
    return defaultWorkspacePreferences;
  }
}

export function writeWorkspacePreferences(
  storage: Storage | undefined,
  preferences: WorkspacePreferences,
) {
  if (!storage) return;
  storage.setItem(
    workspacePreferenceKey,
    JSON.stringify(normalizeWorkspacePreferences(preferences)),
  );
}

export function normalizeWorkspacePreferences(value: unknown): WorkspacePreferences {
  const record =
    typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  return {
    selectedTab: tabs.includes(record.selectedTab as WorkbenchTab)
      ? (record.selectedTab as WorkbenchTab)
      : defaultWorkspacePreferences.selectedTab,
    explorerOpen:
      typeof record.explorerOpen === "boolean"
        ? record.explorerOpen
        : defaultWorkspacePreferences.explorerOpen,
    explorerWidth: clampNumber(
      record.explorerWidth,
      200,
      480,
      defaultWorkspacePreferences.explorerWidth,
    ),
    compareOnlyChanges:
      typeof record.compareOnlyChanges === "boolean"
        ? record.compareOnlyChanges
        : defaultWorkspacePreferences.compareOnlyChanges,
    compareBaselineName:
      typeof record.compareBaselineName === "string" && record.compareBaselineName.length > 0
        ? record.compareBaselineName
        : defaultWorkspacePreferences.compareBaselineName,
    primaryPanePercent: clampNumber(
      record.primaryPanePercent,
      20,
      80,
      defaultWorkspacePreferences.primaryPanePercent,
    ),
    schemaInspectorPercent: clampNumber(
      record.schemaInspectorPercent,
      20,
      65,
      defaultWorkspacePreferences.schemaInspectorPercent,
    ),
    problemsPanelHeight: clampNumber(
      record.problemsPanelHeight,
      72,
      420,
      defaultWorkspacePreferences.problemsPanelHeight,
    ),
    problemsOpen:
      typeof record.problemsOpen === "boolean"
        ? record.problemsOpen
        : defaultWorkspacePreferences.problemsOpen,
  };
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
}
