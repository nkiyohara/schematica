import { describe, expect, it } from "vitest";
import { createPluginRegistry } from "../registry";
import { commandContributionsToPaletteActions, type WorkbenchCommandContext } from "./commands";
import { createBuiltInPlugins } from ".";

describe("built-in plugin contributions", () => {
  it("contributes the compact workbench command surface", () => {
    const registry = createPluginRegistry(createBuiltInPlugins());
    const context = pluginContext();
    const actions = commandContributionsToPaletteActions(registry.commands(context), context);

    expect(actions.map((command) => command.id)).toEqual(
      expect.arrayContaining([
        "go.editor",
        "go.compare",
        "go.settings",
        "file.open",
        "file.openRemote",
        "schema.build",
        "layout.raw",
        "layout.problems",
        "updates.check",
      ]),
    );
    expect(actions.map((command) => command.id)).not.toContain("go.execution");
  });

  it("contributes recent local and SSH resources through command providers", () => {
    const registry = createPluginRegistry(createBuiltInPlugins());
    const context = pluginContext({
      recentFiles: [
        {
          resource: { scheme: "file", path: "/tmp/schematica/config.yaml" },
          name: "config.yaml",
          kind: "config",
          format: "yaml",
          lastOpenedAt: 2,
        },
      ],
      recentRemoteFiles: [
        {
          resource: {
            scheme: "ssh",
            host: "example-host",
            path: "/srv/project/config.yaml",
          },
          name: "config.yaml",
          kind: "config",
          format: "yaml",
          lastOpenedAt: 1,
        },
      ],
    });
    const paletteActions = commandContributionsToPaletteActions(
      registry.commands(context),
      context,
    );

    expect(paletteActions.map((command) => command.id)).toContain("recent.0.config");
    expect(paletteActions.map((command) => command.id)).toContain("remote.recent.0");
    expect(paletteActions.find((command) => command.id === "file.openRemote")).toMatchObject({
      keywords: ["ssh", "remote"],
    });
  });

  it("keeps command categories minimal and ordered", () => {
    const registry = createPluginRegistry(createBuiltInPlugins());

    expect(registry.commandCategories().map((category) => category.id)).toEqual([
      "navigation",
      "files",
      "layout",
      "system",
    ]);
  });
});

function pluginContext(
  overrides: {
    recentFiles?: WorkbenchCommandContext["state"]["recentFiles"];
    recentRemoteFiles?: WorkbenchCommandContext["state"]["recentRemoteFiles"];
  } = {},
): WorkbenchCommandContext {
  const noop = () => undefined;
  return {
    t: (key) => key,
    shortcutLabel: (key) => `Ctrl+${key}`,
    state: {
      selectedTab: "editor",
      appConfigCanPersist: true,
      updateBusy: false,
      feedbackEnabled: true,
      recentFiles: overrides.recentFiles ?? [],
      recentRemoteFiles: overrides.recentRemoteFiles ?? [],
      appearancePresets: [],
    },
    helpers: {
      recentFileKindLabel: (kind) => kind,
      compactResourcePath: (file) => file.name,
      resourcePath: (file) => file.name,
      appearancePresetTitle: (id) => id,
    },
    actions: {
      go: noop,
      openConfig: noop,
      openDirectory: noop,
      openRemote: noop,
      newConfig: noop,
      openSchema: noop,
      loadExample: noop,
      buildSchema: noop,
      saveSchema: noop,
      saveCurrent: noop,
      saveCurrentAs: noop,
      openSettings: noop,
      openRecent: noop,
      exportSettings: noop,
      resetSettings: noop,
      clearRecentFiles: noop,
      clearRecentRemoteFiles: noop,
      toggleRaw: noop,
      toggleProblems: noop,
      applyAppearancePreset: noop,
      checkUpdates: noop,
      sendFeedback: noop,
    },
  };
}
