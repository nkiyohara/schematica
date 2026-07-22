import type { AppearancePreset, AppearancePresetId } from "../../appearance-catalog";
import type { PaletteCommand } from "../../command-palette";
import type { ConfigDocument } from "../../config-document";
import type { MessageKey } from "../../i18n";
import type { RecentResource } from "../../resource-history";
import type { WorkbenchTab } from "../../workbench";
import type { CommandContribution } from "../types";

export interface PaletteAction extends PaletteCommand {
  action: () => void | Promise<void>;
}

export interface WorkbenchCommandState {
  activeDocument?: ConfigDocument;
  selectedTab: WorkbenchTab;
  appConfigCanPersist: boolean;
  updateBusy: boolean;
  feedbackEnabled: boolean;
  recentFiles: RecentResource[];
  recentRemoteFiles: RecentResource[];
  appearancePresets: readonly AppearancePreset[];
}

export interface WorkbenchCommandHelpers {
  recentFileKindLabel(kind: RecentResource["kind"]): string;
  compactResourcePath(file: RecentResource): string;
  resourcePath(file: RecentResource): string;
  appearancePresetTitle(id: AppearancePresetId): string;
}

export interface WorkbenchCommandActions {
  go(tab: WorkbenchTab): void;
  openConfig(): void | Promise<void>;
  openDirectory(): void | Promise<void>;
  openRemote(): void | Promise<void>;
  newConfig(): void;
  openSchema(): void | Promise<void>;
  loadExample(): void;
  buildSchema(): void;
  saveSchema(): void | Promise<void>;
  saveCurrent(): void | Promise<void>;
  saveCurrentAs(): void | Promise<void>;
  openSettings(): void | Promise<void>;
  openRecent(file: RecentResource): void | Promise<void>;
  exportSettings(): void | Promise<void>;
  resetSettings(): void | Promise<void>;
  clearRecentFiles(): void;
  clearRecentRemoteFiles(): void;
  toggleRaw(): void;
  toggleProblems(): void;
  applyAppearancePreset(id: AppearancePresetId): void;
  checkUpdates(): void | Promise<void>;
  sendFeedback(): void | Promise<void>;
}

export interface WorkbenchCommandContext {
  t: (key: MessageKey, params?: Record<string, string | number>) => string;
  shortcutLabel: (key: string) => string;
  state: WorkbenchCommandState;
  helpers: WorkbenchCommandHelpers;
  actions: WorkbenchCommandActions;
}

export function createNavigationCommandContributions(): CommandContribution<WorkbenchCommandContext>[] {
  return [
    command("go.editor", "navigation", "tabs.editor", "commands.goEditor", (context) =>
      context.actions.go("editor"),
    ),
    command("go.compare", "navigation", "tabs.compare", "commands.goCompare", (context) =>
      context.actions.go("compare"),
    ),
    command("go.settings", "navigation", "tabs.settings", "commands.goSettings", (context) =>
      context.actions.go("settings"),
    ),
  ];
}

export function createFileCommandContributions(): CommandContribution<WorkbenchCommandContext>[] {
  return [
    command("file.open", "files", "actions.openConfig", "commands.openConfig", (context) =>
      context.actions.openConfig(),
    ),
    command(
      "file.openFolder",
      "files",
      "actions.openDirectory",
      "commands.openDirectory",
      (context) => context.actions.openDirectory(),
    ),
    command("file.new", "files", "actions.newConfig", "commands.newConfig", (context) =>
      context.actions.newConfig(),
    ),
    {
      id: "file.save",
      category: "files",
      title: activeSaveTitle,
      description: activeSaveDescription,
      shortcut: (context) => context.shortcutLabel("S"),
      disabled: (context) =>
        context.state.selectedTab !== "settings" && !context.state.activeDocument
          ? { reason: context.t("documents.status.missing") }
          : undefined,
      execute: (context) => context.actions.saveCurrent(),
    },
    command(
      "file.saveAs",
      "files",
      "actions.saveAs",
      "commands.saveAs",
      (context) => context.actions.saveCurrentAs(),
      {
        shortcut: (context) => context.shortcutLabel("Shift+S"),
      },
    ),
    command(
      "settings.open",
      "files",
      "actions.openSettings",
      "commands.openSettingsConfig",
      (context) => context.actions.openSettings(),
    ),
    command(
      "settings.export",
      "files",
      "actions.exportSettings",
      "commands.exportSettings",
      (context) => context.actions.exportSettings(),
      {
        disabled: (context) =>
          context.state.appConfigCanPersist
            ? undefined
            : { reason: context.t("settings.persistence.invalid") },
      },
    ),
    command(
      "settings.reset",
      "system",
      "actions.resetSettings",
      "commands.resetSettings",
      (context) => context.actions.resetSettings(),
    ),
    command(
      "recent.clear",
      "system",
      "actions.clearRecent",
      "commands.clearRecent",
      (context) => context.actions.clearRecentFiles(),
      {
        disabled: (context) =>
          context.state.recentFiles.length === 0
            ? { reason: context.t("recent.empty") }
            : undefined,
      },
    ),
  ];
}

export function createSchemaCommandContributions(): CommandContribution<WorkbenchCommandContext>[] {
  return [
    command("file.schema", "files", "actions.openSchema", "commands.openSchema", (context) =>
      context.actions.openSchema(),
    ),
    command("file.example", "files", "actions.loadExample", "commands.loadExample", (context) =>
      context.actions.loadExample(),
    ),
    command("schema.build", "files", "actions.buildSchema", "commands.buildSchema", (context) =>
      context.actions.buildSchema(),
    ),
    command("schema.save", "files", "actions.saveSchema", "commands.saveSchema", (context) =>
      context.actions.saveSchema(),
    ),
  ];
}

export function createLayoutCommandContributions(): CommandContribution<WorkbenchCommandContext>[] {
  return [
    command("layout.raw", "layout", "actions.toggleRawEditor", "commands.toggleRaw", (context) =>
      context.actions.toggleRaw(),
    ),
    command(
      "layout.problems",
      "layout",
      "actions.toggleProblems",
      "commands.toggleProblems",
      (context) => context.actions.toggleProblems(),
    ),
  ];
}

export function createSshCommandContributions(): CommandContribution<WorkbenchCommandContext>[] {
  return [
    command(
      "file.openRemote",
      "files",
      "actions.openRemoteConfig",
      "commands.openRemoteConfig",
      (context) => context.actions.openRemote(),
      {
        keywords: () => ["ssh", "remote"],
      },
    ),
    command(
      "remoteRecent.clear",
      "system",
      "actions.clearRecentRemote",
      "commands.clearRecentRemote",
      (context) => context.actions.clearRecentRemoteFiles(),
      {
        disabled: (context) =>
          context.state.recentRemoteFiles.length === 0
            ? { reason: context.t("remote.recent.empty") }
            : undefined,
      },
    ),
  ];
}

export function createUpdateCommandContributions(): CommandContribution<WorkbenchCommandContext>[] {
  return [
    command(
      "updates.check",
      "system",
      "updates.checkNow",
      "commands.checkUpdates",
      (context) => context.actions.checkUpdates(),
      {
        disabled: (context) =>
          context.state.updateBusy ? { reason: context.t("commands.disabled.busy") } : undefined,
      },
    ),
  ];
}

export function createFeedbackCommandContributions(): CommandContribution<WorkbenchCommandContext>[] {
  return [
    command(
      "feedback.open",
      "system",
      "feedback.openIssue",
      "commands.openFeedback",
      (context) => context.actions.sendFeedback(),
      {
        disabled: (context) =>
          context.state.feedbackEnabled
            ? undefined
            : { reason: context.t("commands.disabled.feedback") },
      },
    ),
  ];
}

export function createRecentResourceCommandContributions(
  context: WorkbenchCommandContext,
): CommandContribution<WorkbenchCommandContext>[] {
  return [
    ...context.state.recentFiles.map((file, index) => recentLocalCommand(file, index)),
    ...context.state.recentRemoteFiles.map((file, index) => recentRemoteCommand(file, index)),
  ];
}

export function createAppearanceCommandContributions(
  context: WorkbenchCommandContext,
): CommandContribution<WorkbenchCommandContext>[] {
  return context.state.appearancePresets.map((preset) => {
    const presetId = preset.id as AppearancePresetId;
    return {
      id: `appearance.${presetId}`,
      category: "system",
      title: (nextContext) => nextContext.helpers.appearancePresetTitle(presetId),
      description: (nextContext) =>
        nextContext.t("commands.applyAppearancePreset", {
          name: nextContext.helpers.appearancePresetTitle(presetId),
        }),
      execute: (nextContext) => nextContext.actions.applyAppearancePreset(presetId),
    };
  });
}

export function commandContributionsToPaletteActions(
  contributions: readonly CommandContribution<WorkbenchCommandContext>[],
  context: WorkbenchCommandContext,
): PaletteAction[] {
  return contributions.map((contribution) => {
    const disabled = contribution.disabled?.(context);
    return {
      id: contribution.id,
      category: contribution.category,
      title: contribution.title(context),
      description: contribution.description(context),
      action: () => contribution.execute(context),
      shortcut: contribution.shortcut?.(context),
      keywords: contribution.keywords?.(context),
      disabled: Boolean(disabled),
      disabledReason: disabled?.reason,
    };
  });
}

function recentLocalCommand(
  file: RecentResource,
  index: number,
): CommandContribution<WorkbenchCommandContext> {
  return {
    id: `recent.${index}.${file.kind}`,
    category: "files",
    title: (context) => context.t("actions.openRecent", { name: file.name }),
    description: (context) =>
      context.t("commands.openRecent", {
        kind: context.helpers.recentFileKindLabel(file.kind),
        path: context.helpers.compactResourcePath(file),
      }),
    keywords: (context) => [file.name, context.helpers.resourcePath(file), file.kind, file.format],
    execute: (context) => context.actions.openRecent(file),
  };
}

function recentRemoteCommand(
  file: RecentResource,
  index: number,
): CommandContribution<WorkbenchCommandContext> {
  return {
    id: `remote.recent.${index}`,
    category: "files",
    title: (context) => context.t("actions.openRecentRemote", { name: file.name }),
    description: (context) =>
      context.t("commands.openRecentRemote", {
        path: context.helpers.compactResourcePath(file),
      }),
    keywords: (context) => [
      file.name,
      context.helpers.resourcePath(file),
      file.format,
      "ssh",
      "remote",
    ],
    execute: (context) => context.actions.openRecent(file),
  };
}

function command(
  id: string,
  category: string,
  titleKey: MessageKey,
  descriptionKey: MessageKey,
  execute: (context: WorkbenchCommandContext) => void | Promise<void>,
  options: Pick<
    CommandContribution<WorkbenchCommandContext>,
    "disabled" | "keywords" | "shortcut"
  > = {},
): CommandContribution<WorkbenchCommandContext> {
  return {
    id,
    category,
    title: (context) => context.t(titleKey),
    description: (context) => context.t(descriptionKey),
    execute,
    ...options,
  };
}

function activeSaveTitle(context: WorkbenchCommandContext) {
  if (context.state.selectedTab === "settings") return context.t("actions.saveSettings");
  return context.t("actions.save");
}

function activeSaveDescription(context: WorkbenchCommandContext) {
  if (context.state.selectedTab === "settings") return context.t("commands.saveSettings");
  return context.t("commands.save");
}
