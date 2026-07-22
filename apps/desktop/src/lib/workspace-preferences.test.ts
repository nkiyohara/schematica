import { describe, expect, it } from "vitest";
import {
  defaultWorkspacePreferences,
  normalizeWorkspacePreferences,
  readWorkspacePreferences,
  workspacePreferenceKey,
  writeWorkspacePreferences,
} from "./workspace-preferences";

describe("workspace preferences", () => {
  it("normalizes invalid persisted values", () => {
    expect(
      normalizeWorkspacePreferences({
        selectedTab: "unknown",
        explorerOpen: "yes",
        explorerWidth: 999,
        compareOnlyChanges: "yes",
        compareBaselineName: "",
        primaryPanePercent: 999,
        schemaInspectorPercent: -10,
        problemsPanelHeight: -1,
        problemsOpen: true,
      }),
    ).toEqual({
      ...defaultWorkspacePreferences,
      explorerWidth: 480,
      primaryPanePercent: 80,
      schemaInspectorPercent: 20,
      problemsPanelHeight: 72,
      problemsOpen: true,
    });
  });

  it("round-trips through local storage", () => {
    const storage = new MemoryStorage();
    writeWorkspacePreferences(storage, {
      selectedTab: "compare",
      explorerOpen: false,
      explorerWidth: 340,
      compareOnlyChanges: false,
      compareBaselineName: "large.yaml",
      primaryPanePercent: 64,
      schemaInspectorPercent: 42,
      problemsPanelHeight: 180,
      problemsOpen: false,
    });

    expect(JSON.parse(storage.getItem(workspacePreferenceKey) ?? "{}")).toMatchObject({
      selectedTab: "compare",
      explorerOpen: false,
      explorerWidth: 340,
      compareOnlyChanges: false,
      compareBaselineName: "large.yaml",
      primaryPanePercent: 64,
      schemaInspectorPercent: 42,
      problemsPanelHeight: 180,
      problemsOpen: false,
    });
    expect(readWorkspacePreferences(storage)).toEqual({
      selectedTab: "compare",
      explorerOpen: false,
      explorerWidth: 340,
      compareOnlyChanges: false,
      compareBaselineName: "large.yaml",
      primaryPanePercent: 64,
      schemaInspectorPercent: 42,
      problemsPanelHeight: 180,
      problemsOpen: false,
    });
  });
});

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}
