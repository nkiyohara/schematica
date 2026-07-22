<script lang="ts">
  import { invoke } from "@tauri-apps/api/core";
  import { listen } from "@tauri-apps/api/event";
  import { confirm, open, save } from "@tauri-apps/plugin-dialog";
  import { openUrl } from "@tauri-apps/plugin-opener";
  import { relaunch } from "@tauri-apps/plugin-process";
  import { check } from "@tauri-apps/plugin-updater";
  import { onMount, tick } from "svelte";
  import {
    compareConfigs,
    appendPath,
    deletePath,
    formatFromPath,
    parseData,
    setPath,
    stringifyData,
    summarizeDiffRows,
    updateDataText,
    validateConfig,
    type DataFormat,
    type FieldModel,
    type JsonSchema,
    type JsonValue,
    type ValidationIssue,
  } from "@schematica/core";
  import schematicaConfigSchemaJson from "../../../schemas/schematica.config.schema.json";
  import AlertTriangle from "@lucide/svelte/icons/alert-triangle";
  import Bug from "@lucide/svelte/icons/bug";
  import CheckCircle2 from "@lucide/svelte/icons/check-circle-2";
  import Columns3 from "@lucide/svelte/icons/columns-3";
  import Download from "@lucide/svelte/icons/download";
  import FileInput from "@lucide/svelte/icons/file-input";
  import FileJson from "@lucide/svelte/icons/file-json";
  import FileText from "@lucide/svelte/icons/file-text";
  import Folder from "@lucide/svelte/icons/folder";
  import FolderOpen from "@lucide/svelte/icons/folder-open";
  import FolderTree from "@lucide/svelte/icons/folder-tree";
  import FolderUp from "@lucide/svelte/icons/folder-up";
  import GitBranch from "@lucide/svelte/icons/git-branch";
  import Monitor from "@lucide/svelte/icons/monitor";
  import Moon from "@lucide/svelte/icons/moon";
  import Plus from "@lucide/svelte/icons/plus";
  import RefreshCw from "@lucide/svelte/icons/refresh-cw";
  import RotateCcw from "@lucide/svelte/icons/rotate-ccw";
  import Save from "@lucide/svelte/icons/save";
  import Search from "@lucide/svelte/icons/search";
  import Server from "@lucide/svelte/icons/server";
  import Settings2 from "@lucide/svelte/icons/settings-2";
  import ShieldCheck from "@lucide/svelte/icons/shield-check";
  import SlidersHorizontal from "@lucide/svelte/icons/sliders-horizontal";
  import Sun from "@lucide/svelte/icons/sun";
  import X from "@lucide/svelte/icons/x";
  import {
    localeFieldOptionLabels,
    parseAppConfig,
    themeStyle,
    updateAppConfigText,
    type AppConfig,
  } from "./lib/app-config";
  import {
    appearancePresetById,
    appearancePresetFor,
    appearancePresets,
    countAppearancePresetChanges,
    type AppearancePresetId,
    type AppearanceProfile,
  } from "./lib/appearance-catalog";
  import { readStoredAppConfig, writeStoredAppConfig } from "./lib/app-config-storage";
  import AppearancePanel from "./lib/AppearancePanel.svelte";
  import BrandMark from "./lib/BrandMark.svelte";
  import CommandPalette from "./lib/CommandPalette.svelte";
  import CodeEditor from "./lib/CodeEditor.svelte";
  import CompareMatrix from "./lib/CompareMatrix.svelte";
  import {
    createConfigDocument,
    documentLocationKey,
    documentLocationLabel,
    formatPathForDocument,
    isDocumentDirty,
    localDocumentPath,
    markDocumentSaved,
    sshDocumentLocation,
    type ConfigDocument,
    type DocumentSaveState,
  } from "./lib/config-document";
  import { defaultConfigText, draftConfigName } from "./lib/config-template";
  import {
    dataWithoutDocumentMetadata,
    documentSchemaReference,
  } from "./lib/document-metadata";
  import FieldEditor from "./lib/FieldEditor.svelte";
  import { hasMessageKey, resolveLocale, translate, type Locale, type MessageKey } from "./lib/i18n";
  import RemoteOpenDialog from "./lib/RemoteOpenDialog.svelte";
  import { parentResource, resolveSiblingResource } from "./lib/resource-paths";
  import { createBuiltInPlugins } from "./lib/plugins/builtin";
  import {
    commandContributionsToPaletteActions,
    type PaletteAction,
    type WorkbenchCommandContext,
  } from "./lib/plugins/builtin/commands";
  import { codecForFormat } from "./lib/plugins/builtin/codecs";
  import { fieldRendererFor } from "./lib/plugins/builtin/fields";
  import { providerForResource } from "./lib/plugins/builtin/resources";
  import { parseSchemaWithProvider } from "./lib/plugins/builtin/schema";
  import { createPluginRegistry } from "./lib/plugins/registry";
  import type {
    ResourceEntry,
    ResourceProvider,
    ResourceRef,
    ResourceTarget,
  } from "./lib/plugins/types";
  import SchemaDesigner from "./lib/SchemaDesigner.svelte";
  import SchemaFreeNotice from "./lib/SchemaFreeNotice.svelte";
  import {
    createSchemaDesignerDraft,
    schemaDesignerDraftFromSchema,
    schemaTextFromDesignerDraft,
    type SchemaDesignerDraft,
  } from "./lib/schema-designer";
  import {
    analyzeSchemaFreeDocument,
    defaultValueForSettingType,
    inferSchemaFromData,
    type SchemaFreeSettingType,
  } from "./lib/schema-inference";
  import type { RecentFileKind } from "./lib/recent-files";
  import WorkbenchOverview from "./lib/WorkbenchOverview.svelte";
  import { sampleAppConfig, sampleConfig, sampleSchema } from "./lib/samples";
  import StartScreen from "./lib/StartScreen.svelte";
  import {
    isPrimaryShortcut as matchesPrimaryShortcut,
    primaryNumberShortcut as matchingPrimaryNumberShortcut,
    shortcutLabel as formatShortcutLabel,
    shortcutPlatform,
    type ShortcutPlatform,
  } from "./lib/shortcuts";
  import { appVersion } from "./lib/app-version";
  import {
    createLatestRemoteBrowseGate,
    initialRemoteBrowsePath,
    mergeSshHostOptions,
    remoteParentPath,
    type RemoteFileRef,
    type SshHostCandidate,
  } from "./lib/remote-sources";
  import {
    compactResourceDisplayPath,
    forgetRecentResource,
    readRecentResources,
    rememberRecentResource,
    resourceDisplayPath,
    resourceKey as recentResourceKey,
    writeRecentResources,
    type RecentResource,
    type RecentResourceKind,
  } from "./lib/resource-history";
  import {
    defaultWorkspacePreferences,
    readWorkspacePreferences,
    writeWorkspacePreferences,
    type WorkspacePreferences,
  } from "./lib/workspace-preferences";
  import {
    readWorkspaceSession,
    writeWorkspaceSession,
    type WorkspaceSession,
  } from "./lib/workspace-session";
  import type { WorkbenchTab } from "./lib/workbench";

  interface InstallContext {
    source: string;
    sourceLabel: string;
    updateOwner: string;
    updateCommand?: string;
    directUpdaterEligible: boolean;
  }

  interface GitContext {
    available: boolean;
    root?: string;
    branch?: string;
    commit?: string;
    dirty: boolean;
    changedFiles: number;
  }

  type AppConfigOrigin = "sample" | "local" | "file";
  type SchemaOrigin = "none" | "draft" | "manual" | "document" | "sample";
  type SshResourceRef = Extract<ResourceRef, { scheme: "ssh" }>;
  type SshBrowserEntry = ResourceEntry<SshResourceRef>;
  type WorkspaceEntry = ResourceEntry<ResourceRef>;

  let schemaText = "";
  let schemaFileSavedText = "";
  let schemaDesignerDraft = createSchemaDesignerDraft();
  let schemaEditorMode: "designer" | "json" = "designer";
  let schemaResource: ResourceRef | undefined;
  let schemaOrigin: SchemaOrigin = "none";
  let appConfigText = sampleAppConfig;
  let appConfigFormat: DataFormat = "yaml";
  let appConfigOrigin: AppConfigOrigin = "sample";
  let appConfigPath: string | undefined;
  let appConfigFileSavedText = "";
  let appConfigStatus = "";
  let recentResources: RecentResource[] = [];
  let sshHostCandidates: SshHostCandidate[] = [];
  let documents: ConfigDocument[] = [];
  let activeDocumentId = "";
  let schemaPath: string | undefined;
  let workspaceRoot: ResourceRef | undefined;
  let workspaceEntries: WorkspaceEntry[] = [];
  let workspaceBusy = false;
  let workspaceStatus = "";
  let schemaToolsOpen = false;
  let selectedTab: WorkbenchTab = defaultWorkspacePreferences.selectedTab;
  let explorerOpen = defaultWorkspacePreferences.explorerOpen;
  let explorerWidth = defaultWorkspacePreferences.explorerWidth;
  let compareOnlyChanges = defaultWorkspacePreferences.compareOnlyChanges;
  let compareBaselineName = defaultWorkspacePreferences.compareBaselineName;
  let primaryPanePercent = defaultWorkspacePreferences.primaryPanePercent;
  let schemaInspectorPercent = defaultWorkspacePreferences.schemaInspectorPercent;
  let problemsPanelHeight = defaultWorkspacePreferences.problemsPanelHeight;
  let problemsOpen = defaultWorkspacePreferences.problemsOpen;
  let settingsRawPreviewOpen = false;
  let preferencesReady = false;
  let workspaceSessionReady = false;
  let installContext: InstallContext = {
    source: "web-preview",
    sourceLabel: "Web preview",
    updateOwner: "developer workflow",
    updateCommand: "corepack pnpm --filter @schematica/desktop dev:web",
    directUpdaterEligible: false,
  };
  let gitContext: GitContext = {
    available: false,
    dirty: false,
    changedFiles: 0,
  };
  let commandPaletteOpen = false;
  let remoteOpenDialogOpen = false;
  let remoteHostInput = "";
  let remotePathInput = "";
  let remoteBrowserHost = "";
  let remoteBrowserPath = "";
  let remoteBrowserEntries: SshBrowserEntry[] = [];
  let remoteBusy = false;
  let remoteHostsBusy = false;
  let remoteBrowserBusy = false;
  let remoteStatus = "";
  let remotePassword = "";
  let remotePasswordMode = false;
  let remotePasswordHosts = new Set<string>();
  let sshHostsReady = false;
  const remoteBrowseGate = createLatestRemoteBrowseGate();
  const pendingDocumentReads = new Map<string, Promise<ConfigDocument>>();
  let shortcutMode: ShortcutPlatform = "other";
  let systemPrefersDark = false;
  let systemPrefersReducedMotion = false;
  let startupUpdateChecked = false;
  let updateStatus = "";
  let updateBusy = false;
  let lastError = "";
  let pendingAutosaveSignature = "";
  let autosaveTimer: ReturnType<typeof setTimeout> | undefined;
  let workspaceSessionTimer: ReturnType<typeof setTimeout> | undefined;
  let schemaLoadSequence = 0;
  let workspaceBrowseSequence = 0;
  let lastDocumentSchemaSignature = "";
  let contentGridElement: HTMLElement;
  let workspaceElement: HTMLElement;
  let schemaModalElement: HTMLElement;
  let schemaPaneElement: HTMLElement;
  let schemaModalPreviousFocus: HTMLElement | null = null;
  let schemaToolsWasOpen = false;
  let viewportWidth = 1200;
  let workspaceWidth = 900;
  let schemaFreeFormOverrides = new Set<string>();

  const schematicaConfigSchema = schematicaConfigSchemaJson as JsonSchema;
  const signedUpdaterConfigured = import.meta.env.VITE_SCHEMATICA_UPDATER_CONFIGURED === "true";
  const pluginRegistry = createPluginRegistry(createBuiltInPlugins());
  const resourceProviders = pluginRegistry.resources();
  const configCodecs = pluginRegistry.codecs();
  const schemaProviders = pluginRegistry.schemas();
  const fieldRendererProviders = pluginRegistry.fields();
  const appearanceProfileKeys = [
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

  onMount(() => {
    let unlistenNativeMenu: (() => void) | undefined;
    let unlistenOpenFiles: (() => void) | undefined;

    void listen<string>("schematica://menu", (event) => {
      void handleNativeMenuCommand(event.payload);
    })
      .then((unlisten) => {
        unlistenNativeMenu = unlisten;
      })
      .catch(() => {
        // The browser preview does not expose Tauri menu events.
      });

    void listen<string[]>("schematica://open-files", (event) => {
      void openAssociatedFilePaths(event.payload);
    })
      .then((unlisten) => {
        unlistenOpenFiles = unlisten;
      })
      .catch(() => {
        // The browser preview does not expose OS file-open events.
      });

    const storedAppConfig = readStoredAppConfig(window.localStorage);
    if (storedAppConfig) {
      appConfigText = storedAppConfig.text;
      appConfigFormat = storedAppConfig.format;
      appConfigOrigin = "local";
    }

    applyWorkspacePreferences(readWorkspacePreferences(window.localStorage));
    recentResources = readRecentResources(window.localStorage);
    void initializeWorkspaceSession();
    void loadInstallContext();
    void loadSshHosts();
    shortcutMode = shortcutPlatform(navigator.platform);
    preferencesReady = true;

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const motionMedia = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateSystemTheme = () => {
      systemPrefersDark = media.matches;
    };
    const updateSystemMotion = () => {
      systemPrefersReducedMotion = motionMedia.matches;
    };
    updateSystemTheme();
    updateSystemMotion();
    media.addEventListener("change", updateSystemTheme);
    motionMedia.addEventListener("change", updateSystemMotion);

    return () => {
      unlistenNativeMenu?.();
      unlistenOpenFiles?.();
      media.removeEventListener("change", updateSystemTheme);
      motionMedia.removeEventListener("change", updateSystemMotion);
      clearAutosaveTimer();
      if (workspaceSessionTimer) clearTimeout(workspaceSessionTimer);
    };
  });

  $: activeDocument = documents.find((document) => document.id === activeDocumentId) ?? documents[0];
  $: configText = activeDocument?.text ?? "";
  $: activeFormat = activeDocument
    ? documentFormatHint(activeDocument, appConfig.editor.defaultFormat)
    : appConfig.editor.defaultFormat;
  $: schemaFormat = schemaResource
    ? resourceProvider(schemaResource).formatHint(schemaResource)
    : schemaPath
      ? formatFromPath(schemaPath, "json")
      : "json";
  $: appConfig = safeParseAppConfig(appConfigText);
  $: locale = resolveLocale(appConfig.interface.locale);
  $: if (typeof document !== "undefined") {
    document.documentElement.lang = locale;
  }
  $: t = (key: MessageKey, params?: Record<string, string | number>) =>
    translate(locale, key, params);
  $: activeDocumentDirty = Boolean(activeDocument && isDocumentDirty(activeDocument));
  $: activeDocumentSaveLabel = activeDocument
    ? documentSaveLabel(activeDocument)
    : t("documents.status.missing");
  $: schemaDirty =
    schemaResource || schemaPath ? schemaText !== schemaFileSavedText : Boolean(schemaText.trim());
  $: schemaNeedsSave = !(schemaResource || schemaPath) || schemaDirty;
  $: appConfigParse = parseDataResult(appConfigText, appConfigFormat);
  $: appConfigData = appConfigParse.data ?? {};
  $: schemaProvider = schemaProviders[0];
  $: appConfigFields = schemaProvider ? schemaProvider.fields(schematicaConfigSchema) : [];
  $: localizedAppConfigFields = localizeSettingsFields(appConfigFields, locale);
  $: settingsFormFields = localizedAppConfigFields.filter((field) => field.path !== "appearance");
  $: appConfigValidation =
    appConfigParse.data !== undefined
      ? validateConfig(schematicaConfigSchema, dataWithoutDocumentMetadata(appConfigParse.data))
      : undefined;
  $: hasSchema = schemaText.trim().length > 0;
  $: schemaParse =
    hasSchema && schemaProvider ? parseSchemaResult(schemaText, schemaFormat) : { schema: undefined };
  $: schema = schemaParse.schema;
  $: schemaCoverage = schema && schemaProvider ? schemaProvider.coverage(schema) : undefined;
  $: configParse = activeDocument
    ? parseDataResult(configText, activeFormat)
    : { data: undefined, error: undefined };
  $: data = configParse.data;
  $: dataForSchema = dataWithoutDocumentMetadata(data);
  $: activeDocumentSchemaReference = documentSchemaReference(data);
  $: dataForFields = dataForSchema ?? {};
  $: schemaFreeAnalysis = analyzeSchemaFreeDocument(dataForSchema, configText, activeFormat);
  $: schemaFreeCanTryForm =
    schemaFreeAnalysis.reason === "large" ||
    schemaFreeAnalysis.reason === "collection" ||
    schemaFreeAnalysis.reason === "complex";
  $: schemaFreeRawView = Boolean(
    activeDocument &&
    !schema &&
    schemaFreeAnalysis.preferredView === "raw" &&
    (!schemaFreeCanTryForm || !schemaFreeFormOverrides.has(activeDocument.id)),
  );
  $: inferredSchema =
    !schema && !schemaFreeRawView && dataForSchema !== undefined
      ? inferSchemaFromData(dataForSchema, activeDocument?.name ?? t("schemaFree.inferredTitle"))
      : undefined;
  $: formSchema = schema ?? inferredSchema;
  $: fields = formSchema && schemaProvider ? schemaProvider.fields(formSchema) : [];
  $: schemaFreeRootKeys =
    dataForSchema && typeof dataForSchema === "object" && !Array.isArray(dataForSchema)
      ? Object.keys(dataForSchema)
      : [];
  $: canAddSchemaFreeSetting =
    Boolean(dataForSchema) && typeof dataForSchema === "object" && !Array.isArray(dataForSchema);
  $: validation = schema && dataForSchema !== undefined ? validateConfig(schema, dataForSchema) : undefined;
  $: autosaveTrigger = [
    preferencesReady,
    activeDocument?.id,
    activeDocument?.text,
    activeDocument?.savedText,
    activeDocument?.saveState,
    appConfig.editor.autosave,
    configParse.error,
    validation?.valid,
  ].join("\u0000");
  $: if (preferencesReady) {
    autosaveTrigger;
    scheduleAutosave();
  }
  $: documentSchemaSignature = `${activeDocument?.id ?? ""}\u0000${activeDocumentSchemaReference ?? ""}`;
  $: if (
    workspaceSessionReady &&
    activeDocument &&
    activeDocumentSchemaReference &&
    documentSchemaSignature !== lastDocumentSchemaSignature
  ) {
    lastDocumentSchemaSignature = documentSchemaSignature;
    void loadDocumentSchema(activeDocument);
  }
  $: compareSnapshots = validSnapshots(documents);
  $: if (
    compareSnapshots.length > 0 &&
    !compareSnapshots.some((snapshot) => snapshot.name === compareBaselineName)
  ) {
    compareBaselineName = compareSnapshots[0]?.name ?? "";
  }
  $: diffRows = compareConfigs(compareSnapshots, {
    onlyChanges: compareOnlyChanges,
    baseline: compareBaselineName,
  });
  $: diffSummary = summarizeDiffRows(diffRows);
  $: effectiveDark =
    appConfig.appearance.theme === "dark" ||
    (appConfig.appearance.theme === "system" && systemPrefersDark);
  $: effectiveReducedMotion =
    appConfig.appearance.motion === "reduced" ||
    (appConfig.appearance.motion === "system" && systemPrefersReducedMotion);
  $: styleText = themeStyle(appConfig, effectiveDark ? "dark" : "light", effectiveReducedMotion);
  $: themeClass = effectiveDark ? "dark" : "";
  $: activeAppearancePreset = appearancePresetFor(appConfig.appearance);
  $: appearancePresetChanges = Object.fromEntries(
    appearancePresets.map((preset) => [
      preset.id,
      countAppearancePresetChanges(appConfig.appearance, preset),
    ]),
  );
  $: themeIcon =
    appConfig.appearance.theme === "system"
      ? Monitor
      : appConfig.appearance.theme === "dark"
        ? Moon
        : Sun;
  $: dualPane =
    (Boolean(activeDocument) &&
      selectedTab !== "settings" &&
      !(selectedTab === "editor" && schemaFreeRawView) &&
      appConfig.editor.showRawPreview) ||
    (selectedTab === "settings" && settingsRawPreviewOpen);
  $: rawPreviewActive =
    selectedTab === "settings"
      ? settingsRawPreviewOpen
      : appConfig.editor.showRawPreview || (selectedTab === "editor" && schemaFreeRawView);
  $: narrowPaneLayout = workspaceWidth <= 720;
  $: contentGridStyle = dualPane
    ? narrowPaneLayout
      ? `grid-template-columns: minmax(0, 1fr); grid-template-rows: minmax(120px, ${primaryPanePercent}%) 10px minmax(120px, 1fr);`
      : `grid-template-columns: minmax(240px, ${primaryPanePercent}%) 10px minmax(240px, 1fr);`
    : "grid-template-columns: minmax(0, 1fr);";
  $: schemaPaneStyle = narrowPaneLayout
    ? `grid-template-columns: minmax(0, 1fr); grid-template-rows: minmax(140px, ${schemaInspectorPercent}%) 10px minmax(180px, 1fr);`
    : `grid-template-columns: minmax(220px, ${schemaInspectorPercent}%) 10px minmax(280px, 1fr);`;
  $: rawPaneTitle = selectedTab === "settings" ? t("panes.schematicaConfig") : t("panes.activeConfig");
  $: rawPaneText = selectedTab === "settings" ? appConfigText : configText;
  $: rawPaneFormat = selectedTab === "settings" ? appConfigFormat : activeFormat;
  $: schemaDisplayLabel = schemaResource
    ? resourceProvider(schemaResource).displayPath(schemaResource)
    : schemaPath
      ? schemaPath
      : schemaOrigin === "sample"
        ? t("app.schemaExample")
      : hasSchema
        ? t("app.schemaEditor")
        : t("app.noSchema");
  $: directUpdaterEnabled = shouldUseDirectUpdater(appConfig.updates.policy, installContext);
  $: updateMethod = directUpdaterEnabled
    ? t("updates.directMethod")
    : installContext.updateCommand
      ? installContext.updateCommand
      : t("updates.externalMethod");
  $: feedbackContext = [
    installContext.sourceLabel,
    installContext.updateOwner,
    locale,
    appConfig.appearance.theme,
    appConfig.appearance.palette,
    appConfig.appearance.contrast,
    appConfig.appearance.motion,
    activeFormat,
    schemaDisplayLabel,
    gitContext.branch,
    gitContext.commit,
    gitContext.dirty,
  ].join("\u0000");
  $: feedbackUrl = buildFeedbackUrl(feedbackContext);
  $: if (appConfig.updates.checkOnStartup && directUpdaterEnabled && !startupUpdateChecked) {
    startupUpdateChecked = true;
    void checkForUpdates();
  }
  $: problemsAvailable =
    Boolean(activeDocument) || selectedTab === "settings" || Boolean(lastError);
  $: showProblemsPanel = problemsOpen && problemsAvailable;
  $: workspaceStyle = `${styleText}; --explorer-width: ${explorerWidth}px; --problems-height: ${
    showProblemsPanel ? `${problemsPanelHeight}px` : "0px"
  };`;
  $: {
    if (schemaToolsOpen && !schemaToolsWasOpen) {
      schemaModalPreviousFocus = document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
      void focusSchemaModal();
    }
    if (!schemaToolsOpen && schemaToolsWasOpen) void restoreSchemaModalFocus();
    schemaToolsWasOpen = schemaToolsOpen;
  }
  $: if (activeDocumentId) {
    explorerOpen;
    void revealActiveDocument(activeDocumentId);
  }
  $: fieldEditorLabels = {
    required: t("fields.required"),
    default: t("fields.default"),
    minimum: t("fields.minimum"),
    maximum: t("fields.maximum"),
    readOnly: t("fields.readOnly"),
    unit: t("fields.unit"),
    notSet: t("fields.notSet"),
    enabled: t("fields.enabled"),
    disabled: t("fields.disabled"),
    ...localeFieldOptionLabels(locale),
  };
  $: compareLabels = {
    title: t("compare.title"),
    baseline: t("compare.baseline"),
    scope: t("compare.scope"),
    summary: t("compare.summary"),
    diffRows: t("compare.diffRows"),
    rows: t("compare.rows"),
    changed: t("compare.changed", { count: diffSummary.changed }),
    missing: t("compare.missing", { count: diffSummary.missing }),
    same: t("compare.same", { count: diffSummary.same }),
    path: t("compare.path"),
    diffs: t("compare.diffs"),
    all: t("compare.all"),
    "status.changed": t("compare.status.changed"),
    "status.missing": t("compare.status.missing"),
    "status.same": t("compare.status.same"),
    missingValue: t("compare.missingValue"),
    emptyTitle: t("compare.emptyTitle"),
    emptyDetail: t("compare.emptyDetail"),
    addConfig: t("actions.newConfig"),
    root: t("compare.root"),
  };
  $: activeValidationIssues = validation?.issues ?? ([] as ValidationIssue[]);
  $: settingsValidationIssues = appConfigValidation?.issues ?? ([] as ValidationIssue[]);
  $: schemaCoverageValidatedOnly = schemaCoverage?.form.validatedOnlyKeywords ?? [];
  $: schemaCoverageUnsupported = schemaCoverage?.form.unsupportedKeywords ?? [];
  $: schemaCoverageLabel = schemaCoverage
    ? schemaCoverage.totals.unsupported > 0
      ? t("schemaCoverage.unsupportedCount", { count: schemaCoverage.totals.unsupported })
      : schemaCoverage.totals.validatedOnly > 0
        ? t("schemaCoverage.validatedOnlyCount", { count: schemaCoverage.totals.validatedOnly })
        : t("schemaCoverage.formReady")
    : t("app.noSchema");
  $: editableFieldCount = countEditableFields(fields);
  $: requiredFieldCount = countRequiredFields(fields);
  $: appConfigCanPersist = appConfigParse.data !== undefined && (appConfigValidation?.valid ?? false);
  $: appConfigFileDirty = Boolean(appConfigPath && appConfigText !== appConfigFileSavedText);
  $: overviewValidationLabel = activeDocument
    ? configParse.error
      ? t("status.issues", { count: 1 })
      : !schema
        ? t("schemaFree.status")
        : validation?.valid
          ? t("status.valid")
          : t("status.issues", { count: validation?.issues.length ?? 0 })
    : t("documents.status.missing");
  $: overviewGitLabel = appConfig.features.git
    ? gitContext.available
      ? gitContext.dirty
        ? t("meta.gitDirty", { count: gitContext.changedFiles })
        : (gitContext.branch ?? t("meta.detached"))
      : t("meta.unavailable")
    : t("meta.disabled");
  $: overviewMetrics = [
    {
      id: "fields",
      label: t("overview.fields"),
      value: editableFieldCount,
      detail: t("overview.required", { count: requiredFieldCount }),
      tone: "neutral" as const,
    },
    {
      id: "validation",
      label: t("meta.validation"),
      value: !schema
        ? t("schemaFree.status")
        : validation?.valid
          ? t("status.valid")
          : (validation?.issues.length ?? 0),
      detail: !schema
        ? t("schemaFree.validationDetail")
        : validation?.valid
          ? t("problems.noIssues")
          : t("status.issues", { count: validation?.issues.length ?? 0 }),
      tone: !configParse.error && (!schema || validation?.valid) ? ("ok" as const) : ("warn" as const),
    },
    {
      id: "diff",
      label: t("meta.diff"),
      value: diffSummary.changed,
      detail: t("compare.missing", { count: diffSummary.missing }),
      tone: diffSummary.changed > 0 ? ("accent" as const) : ("neutral" as const),
    },
    {
      id: "save",
      label: t("overview.save"),
      value: activeDocumentSaveLabel,
      detail: appConfig.editor.autosave ? t("documents.autosave.on") : t("documents.autosave.off"),
      tone: activeDocument ? documentSaveTone(activeDocument) : ("neutral" as const),
    },
    {
      id: "format",
      label: t("overview.format"),
      value: activeFormat.toUpperCase(),
      detail: t("tabs.editor"),
      tone: "neutral" as const,
    },
  ];
  $: overviewActions = [
    {
      id: "open",
      label: t("actions.openConfig"),
      icon: FileInput,
      action: openConfig,
    },
    {
      id: "open-remote",
      label: t("actions.openRemoteConfig"),
      icon: Server,
      action: openRemoteDialog,
    },
    {
      id: "compare",
      label: t("tabs.compare"),
      icon: Columns3,
      action: () => goToWorkbenchTab("compare"),
    },
    {
      id: "settings",
      label: t("tabs.settings"),
      icon: Settings2,
      action: () => goToWorkbenchTab("settings"),
    },
  ];
  $: recentVisibleFiles = recentResources.filter(
    (resource) => resource.resource.scheme === "file",
  );
  $: recentVisibleRemoteFiles = recentResources.filter(isSshRecentResource);
  $: workspaceParent = workspaceRoot ? parentResource(workspaceRoot) : undefined;
  $: workspaceCanBrowseParent = Boolean(
    workspaceRoot &&
      workspaceParent &&
      documentLocationKey(workspaceParent) !== documentLocationKey(workspaceRoot),
  );
  $: pluginContext =
    {
      t,
      shortcutLabel,
      state: {
        activeDocument,
        selectedTab,
        appConfigCanPersist,
        updateBusy,
        feedbackEnabled: appConfig.features.feedback,
        recentFiles: recentVisibleFiles,
        recentRemoteFiles: recentVisibleRemoteFiles,
        appearancePresets,
      },
      helpers: {
        recentFileKindLabel,
        compactResourcePath: (file) => compactResourceDisplayPath(file.resource),
        resourcePath: (file) => resourceDisplayPath(file.resource),
        appearancePresetTitle,
      },
      actions: {
        go: goToWorkbenchTab,
        openConfig,
        openDirectory,
        openRemote: openRemoteDialog,
        newConfig: () => addDocument(),
        openSchema,
        loadExample: loadExampleWorkspace,
        buildSchema: startSchemaDesigner,
        saveSchema,
        saveCurrent,
        saveCurrentAs,
        openSettings: openAppConfig,
        openRecent: openRecentResource,
        exportSettings: exportAppConfig,
        resetSettings: resetAppConfig,
        clearRecentFiles,
        clearRecentRemoteFiles,
        toggleRaw: toggleRawPreview,
        toggleProblems: () => {
          problemsOpen = !problemsOpen;
        },
        applyAppearancePreset,
        checkUpdates: checkForUpdates,
        sendFeedback,
      },
    } satisfies WorkbenchCommandContext;
  $: workbenchTabs = [
    { id: "editor" as const, label: t("tabs.editor"), icon: SlidersHorizontal },
    { id: "compare" as const, label: t("tabs.compare"), icon: Columns3 },
    { id: "settings" as const, label: t("tabs.settings"), icon: Settings2 },
  ];
  $: if (!workbenchTabs.some((tab) => tab.id === selectedTab)) {
    selectedTab = "editor";
  }
  $: paletteActions = commandPaletteOpen
    ? commandContributionsToPaletteActions(pluginRegistry.commands(pluginContext), pluginContext)
    : [];
  $: commandCategories = pluginRegistry.commandCategories();
  $: commandCategoryOrder = commandCategories.map((category) => category.id);
  $: commandCategoryLabels = commandPaletteOpen
    ? Object.fromEntries(commandCategories.map((category) => [category.id, commandCategoryTitle(category)]))
    : {};
  $: remoteHostOptions = mergeSshHostOptions(
    sshHostCandidates,
    recentVisibleRemoteFiles.map(recentResourceToRemoteFile),
  );
  $: workspacePreferences = {
    selectedTab,
    explorerOpen,
    explorerWidth,
    compareOnlyChanges,
    compareBaselineName,
    primaryPanePercent,
    schemaInspectorPercent,
    problemsPanelHeight,
    problemsOpen,
  };
  $: if (preferencesReady) {
    writeWorkspacePreferences(window.localStorage, workspacePreferences);
  }
  $: if (preferencesReady && appConfigCanPersist) {
    writeStoredAppConfig(window.localStorage, appConfigText, appConfigFormat);
  }
  $: if (workspaceSessionReady) {
    scheduleWorkspaceSessionPersistence({
      activeDocumentId,
      documents,
      schemaPath,
      schemaResource,
      schemaText,
      schemaSavedText: schemaFileSavedText,
    });
  }
  $: appConfigSourceLabel =
    appConfigOrigin === "file"
      ? t("settings.persistence.origin.file")
      : appConfigOrigin === "local"
        ? t("settings.persistence.origin.local")
        : t("settings.persistence.origin.sample");
  $: appConfigLocalStatus = appConfigCanPersist
    ? t("settings.persistence.localSaved")
    : t("settings.persistence.invalid");
  $: appConfigDisplayStatus = !appConfigCanPersist
    ? appConfigLocalStatus
    : appConfigFileDirty
      ? t("settings.persistence.fileDirty")
      : appConfigStatus || appConfigLocalStatus;
  $: startScreenLabels = {
    title: t("start.title"),
    subtitle: t("start.subtitle"),
    openConfig: t("actions.openConfig"),
    openDirectory: t("actions.openDirectory"),
    openRemote: t("actions.openRemoteConfig"),
    newConfig: t("actions.newConfig"),
    example: t("actions.loadExample"),
    buildSchema: t("actions.buildSchema"),
    recent: t("start.recent"),
    remoteRecent: t("remote.recent.title"),
  };
  $: remoteOpenLabels = {
    title: t("remote.open.title"),
    host: t("remote.open.host"),
    path: t("remote.open.path"),
    open: t("remote.open.action"),
    openDirectory: t("remote.open.directoryAction"),
    cancel: t("remote.open.cancel"),
    refresh: t("remote.open.refresh"),
    recent: t("remote.recent.title"),
    discovered: t("remote.hosts.discovered"),
    emptyHosts: t("remote.hosts.empty"),
    emptyRecent: t("remote.recent.empty"),
    busy: t("remote.open.busy"),
    hostPlaceholder: t("remote.open.hostPlaceholder"),
    pathPlaceholder: t("remote.open.pathPlaceholder"),
    sourceRecent: t("remote.hosts.source.recent"),
    sourceConfig: t("remote.hosts.source.config"),
    sourceKnown: t("remote.hosts.source.known"),
    filterHosts: t("remote.hosts.filter"),
    filterHostsPlaceholder: t("remote.hosts.filterPlaceholder"),
    hostCount: t("remote.hosts.count", { visible: "{visible}", total: "{total}" }),
    recentCount: t("remote.recent.count", { count: "{count}" }),
    browser: t("remote.browser.title"),
    browserEmpty: t("remote.browser.empty"),
    browserNoEntries: t("remote.browser.noEntries"),
    browserLoading: t("remote.browser.loading"),
    browserParent: t("remote.browser.parent"),
    authentication: t("remote.auth.title"),
    keyAuthentication: t("remote.auth.key"),
    keyAuthenticationDetail: t("remote.auth.keyDetail"),
    passwordAuthentication: t("remote.auth.passwordMode"),
    password: t("remote.auth.password"),
    passwordPlaceholder: t("remote.auth.passwordPlaceholder"),
    passwordDetail: t("remote.auth.passwordDetail"),
    passwordStored: t("remote.auth.passwordStored"),
    usePassword: t("remote.auth.usePassword"),
    changePassword: t("remote.auth.changePassword"),
    connect: t("remote.auth.connect"),
    forgetPassword: t("remote.auth.forgetPassword"),
    backToKey: t("remote.auth.backToKey"),
  };
  $: schemaDesignerLabels = {
    eyebrow: t("schemaDesigner.eyebrow"),
    untitled: t("schemaDesigner.untitled"),
    useJson: t("schemaDesigner.useJson"),
    useDesigner: t("schemaDesigner.useDesigner"),
    save: t("schemaDesigner.save"),
    saved: t("schemaDesigner.saved"),
    newConfig: t("schemaDesigner.newConfig"),
    title: t("schemaDesigner.title"),
    description: t("schemaDesigner.description"),
    fields: t("schemaDesigner.fields"),
    fieldCount: t("schemaDesigner.fieldCount", { count: "{count}" }),
    addField: t("schemaDesigner.addField"),
    conditions: t("schemaDesigner.conditions"),
    "condition.if": t("schemaDesigner.condition.if"),
    "condition.equals": t("schemaDesigner.condition.equals"),
    "condition.require": t("schemaDesigner.condition.require"),
    remove: t("schemaDesigner.remove"),
    addCondition: t("schemaDesigner.addCondition"),
    "field.key": t("schemaDesigner.field.key"),
    "field.title": t("schemaDesigner.field.title"),
    "field.type": t("schemaDesigner.field.type"),
    "field.required": t("schemaDesigner.field.required"),
    "field.remove": t("schemaDesigner.field.remove"),
    "field.details": t("schemaDesigner.field.details"),
    "field.description": t("schemaDesigner.field.description"),
    "field.default": t("schemaDesigner.field.default"),
    "field.enum": t("schemaDesigner.field.enum"),
    "field.minimum": t("schemaDesigner.field.minimum"),
    "field.maximum": t("schemaDesigner.field.maximum"),
    "field.new": t("schemaDesigner.field.new"),
    "field.addNested": t("schemaDesigner.field.addNested"),
  };
  $: schemaFreeLabels = {
    title: t("schemaFree.title"),
    detail: t("schemaFree.detail"),
    fieldCount: t("schemaFree.fieldCount", { count: "{count}" }),
    create: t("schemaFree.create"),
    open: t("actions.openSchema"),
    raw: t("schemaFree.raw"),
    key: t("schemaFree.key"),
    keyPlaceholder: t("schemaFree.keyPlaceholder"),
    type: t("schemaFree.type"),
    "type.string": t("schemaFree.type.string"),
    "type.number": t("schemaFree.type.number"),
    "type.integer": t("schemaFree.type.integer"),
    "type.boolean": t("schemaFree.type.boolean"),
    "type.object": t("schemaFree.type.object"),
    "type.array": t("schemaFree.type.array"),
    add: t("schemaFree.add"),
    duplicate: t("schemaFree.duplicate"),
    invalid: t("schemaFree.invalid"),
    nonObject: t("schemaFree.nonObject"),
  };
  function goToWorkbenchTab(tab: WorkbenchTab) {
    selectedTab = tab;
  }

  function fieldComponent(field: FieldModel) {
    return (fieldRendererFor(fieldRendererProviders, field)?.component ?? FieldEditor) as typeof FieldEditor;
  }

  function setValue(path: string, value: JsonValue) {
    const currentDocument = documents.find((document) => document.id === activeDocumentId);
    if (!currentDocument) return;

    const codec = codecForFormat(configCodecs, activeFormat);
    let currentData: JsonValue;
    try {
      currentData = codec?.parse(currentDocument.text) ?? parseData(currentDocument.text, { format: activeFormat });
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      problemsOpen = true;
      return;
    }

    const next = setPath(currentData, path, value);
    try {
      updateActiveText(
        codec?.updateText?.(currentDocument.text, path, value, {
          preserveComments: appConfig.editor.preserveComments,
        }) ??
          updateDataText(currentDocument.text, path, value, {
            format: activeFormat,
            preserveComments: appConfig.editor.preserveComments,
          }),
      );
    } catch {
      updateActiveText(codec?.stringify(next) ?? stringifyData(next, { format: activeFormat }));
    }
  }

  function unsetValue(path: string) {
    const currentDocument = documents.find((document) => document.id === activeDocumentId);
    if (!currentDocument) return;
    try {
      const current = parseData(currentDocument.text, { format: activeFormat });
      updateActiveText(stringifyData(deletePath(current, path), { format: activeFormat }));
      lastError = "";
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      problemsOpen = true;
    }
  }

  function setAppConfigValue(path: string, value: JsonValue) {
    try {
      replaceAppConfigText(
        updateAppConfigText(
          appConfigText,
          path,
          value,
          appConfig.editor.preserveComments,
          appConfigFormat,
        ),
      );
    } catch {
      if (appConfigParse.data === undefined) return;
      replaceAppConfigText(
        stringifyData(setPath(appConfigParse.data, path, value), { format: appConfigFormat }),
      );
    }
  }

  function unsetAppConfigValue(path: string) {
    if (appConfigParse.data === undefined) return;
    try {
      replaceAppConfigText(
        stringifyData(deletePath(appConfigParse.data, path), { format: appConfigFormat }),
      );
      lastError = "";
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      problemsOpen = true;
    }
  }

  function applyAppearancePreset(id: AppearancePresetId) {
    const preset = appearancePresetById(id);
    replaceAppearanceProfile(preset);
    appConfigStatus = t("appearance.profileApplied", {
      name: appearancePresetTitle(id),
    });
  }

  function appearancePresetTitle(id: AppearancePresetId) {
    const labelKey = `appearance.preset.${id}.title`;
    return hasMessageKey(labelKey) ? t(labelKey) : id;
  }

  function replaceAppearanceProfile(profile: AppearanceProfile) {
    try {
      let nextText = appConfigText;
      for (const key of appearanceProfileKeys) {
        nextText = updateAppConfigText(
          nextText,
          `appearance.${key}`,
          profile[key] as JsonValue,
          appConfig.editor.preserveComments,
          appConfigFormat,
        );
      }
      replaceAppConfigText(nextText);
      return;
    } catch {
      let next = appConfigParse.data ?? parseData(sampleAppConfig);
      for (const key of appearanceProfileKeys) {
        next = setPath(next, `appearance.${key}`, profile[key] as JsonValue);
      }
      replaceAppConfigText(stringifyData(next, { format: appConfigFormat }));
    }
  }

  function replaceAppConfigText(text: string) {
    appConfigText = text;
    appConfigStatus = "";
  }

  function updateRawPaneText(text: string) {
    if (selectedTab === "settings") {
      replaceAppConfigText(text);
      return;
    }

    updateActiveText(text);
  }

  function toggleRawPreview() {
    if (selectedTab === "settings") {
      settingsRawPreviewOpen = !settingsRawPreviewOpen;
      return;
    }

    if (selectedTab === "editor" && schemaFreeRawView) return;
    setAppConfigValue("editor.showRawPreview", !appConfig.editor.showRawPreview);
  }

  function handleGlobalKeydown(event: KeyboardEvent) {
    if (event.defaultPrevented || event.isComposing) return;
    if (commandPaletteOpen || remoteOpenDialogOpen || schemaToolsOpen) return;

    if (matchesPrimaryShortcut(event, "o", { shift: true, platform: shortcutMode })) {
      event.preventDefault();
      void openSchema();
      return;
    }

    if (matchesPrimaryShortcut(event, "s", { shift: true, platform: shortcutMode })) {
      event.preventDefault();
      void saveCurrentAs();
      return;
    }

    if (matchesPrimaryShortcut(event, "r", { shift: true, platform: shortcutMode })) {
      event.preventDefault();
      toggleRawPreview();
      return;
    }

    if (matchesPrimaryShortcut(event, "m", { shift: true, platform: shortcutMode })) {
      event.preventDefault();
      problemsOpen = !problemsOpen;
      return;
    }

    if (matchesPrimaryShortcut(event, "k", { platform: shortcutMode })) {
      event.preventDefault();
      commandPaletteOpen = true;
      return;
    }

    if (matchesPrimaryShortcut(event, "o", { platform: shortcutMode })) {
      event.preventDefault();
      void openConfig();
      return;
    }

    if (matchesPrimaryShortcut(event, "n", { platform: shortcutMode })) {
      event.preventDefault();
      addDocument();
      return;
    }

    if (matchesPrimaryShortcut(event, "s", { platform: shortcutMode })) {
      event.preventDefault();
      void saveCurrent();
      return;
    }

    if (matchesPrimaryShortcut(event, "w", { platform: shortcutMode })) {
      event.preventDefault();
      if (activeDocument) void closeDocument(activeDocument.id);
      return;
    }

    const tabShortcut = matchingPrimaryNumberShortcut(event, { platform: shortcutMode });
    if (tabShortcut) {
      event.preventDefault();
      selectedTab = tabShortcut;
    }
  }

  function handleBeforeUnload(event: BeforeUnloadEvent) {
    persistWorkspaceSessionNow();
    if (!documents.some(isDocumentDirty) && !schemaDirty && !appConfigFileDirty) return;
    event.preventDefault();
    event.returnValue = "";
  }

  function updateActiveText(text: string) {
    documents = documents.map((document) =>
      document.id === activeDocumentId
        ? {
            ...document,
            text,
            saveState: text === document.savedText ? "saved" : "idle",
            saveMessage: undefined,
          }
        : document,
    );
  }

  function addDocument(text?: string, name?: string) {
    const format = appConfig.editor.defaultFormat;
    const draftText = text ?? createDraftText(format);
    const draftName =
      name ?? draftConfigName(documents.map((document) => document.name), format);
    const id = crypto.randomUUID();
    documents = [...documents, createConfigDocument({ id, name: draftName, text: draftText })];
    activeDocumentId = id;
    selectedTab = "editor";
  }

  function createDraftText(format: DataFormat) {
    try {
      return defaultConfigText(schema, format);
    } catch {
      return stringifyData({}, { format });
    }
  }

  async function closeDocument(id: string) {
    const index = documents.findIndex((document) => document.id === id);
    if (index === -1) return;
    const document = documents[index];
    if (
      isDocumentDirty(document) &&
      !(await confirm(t("dialogs.discardDocument", { name: document.name }), {
        kind: "warning",
      }))
    ) {
      return;
    }

    if (documents.length === 1) {
      clearAutosaveTimer();
      if (!schemaResource && !schemaPath && schemaText.trim() === sampleSchema.trim()) {
        schemaText = "";
        schemaFileSavedText = "";
        schemaOrigin = "none";
        schemaDesignerDraft = createSchemaDesignerDraft();
      }
      documents = [];
      activeDocumentId = "";
      selectedTab = "editor";
      return;
    }

    const nextDocuments = documents.filter((document) => document.id !== id);
    if (activeDocumentId === id) {
      activeDocumentId =
        nextDocuments[Math.min(index, nextDocuments.length - 1)]?.id ?? nextDocuments[0].id;
    }
    documents = nextDocuments;
  }

  async function revealActiveDocument(id: string) {
    await tick();
    const escapedId = CSS.escape(id);
    document
      .querySelector<HTMLElement>(`[role="tab"][data-document-id="${escapedId}"]`)
      ?.scrollIntoView({ block: "nearest", inline: "nearest" });
    if (explorerOpen) {
      document
        .querySelector<HTMLElement>(`[data-explorer-document-id="${escapedId}"]`)
        ?.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  }

  function confirmDiscardWorkspace() {
    const hasUnsavedChanges =
      documents.some(isDocumentDirty) || schemaDirty || appConfigFileDirty;
    return !hasUnsavedChanges || confirm(t("dialogs.discardWorkspace"));
  }

  function startExplorerResize(event: PointerEvent) {
    event.preventDefault();
    const maxWidth = Math.max(240, Math.min(480, viewportWidth - 420));
    trackPointerResize("column", (moveEvent) => {
      explorerWidth = clamp(moveEvent.clientX - 48, 200, maxWidth);
    });
  }

  function resizeExplorerWithKeyboard(event: KeyboardEvent) {
    if (event.key === "Home") {
      event.preventDefault();
      explorerWidth = defaultWorkspacePreferences.explorerWidth;
      return;
    }
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    explorerWidth = clamp(
      explorerWidth + (event.key === "ArrowLeft" ? -16 : 16),
      200,
      Math.max(240, Math.min(480, viewportWidth - 420)),
    );
  }

  function startPaneResize(event: PointerEvent) {
    if (!contentGridElement) return;
    event.preventDefault();
    const bounds = contentGridElement.getBoundingClientRect();
    trackPointerResize(narrowPaneLayout ? "row" : "column", (moveEvent) => {
      const next = narrowPaneLayout
        ? ((moveEvent.clientY - bounds.top) / bounds.height) * 100
        : ((moveEvent.clientX - bounds.left) / bounds.width) * 100;
      primaryPanePercent = clamp(next, 20, 80);
    });
  }

  function resizePaneWithKeyboard(event: KeyboardEvent) {
    if (event.key === "Home") {
      event.preventDefault();
      primaryPanePercent = defaultWorkspacePreferences.primaryPanePercent;
      return;
    }
    const decreaseKey = narrowPaneLayout ? "ArrowUp" : "ArrowLeft";
    const increaseKey = narrowPaneLayout ? "ArrowDown" : "ArrowRight";
    if (event.key !== decreaseKey && event.key !== increaseKey) return;
    event.preventDefault();
    primaryPanePercent = clamp(
      primaryPanePercent + (event.key === decreaseKey ? -2 : 2),
      20,
      80,
    );
  }

  function startSchemaPaneResize(event: PointerEvent) {
    if (!schemaPaneElement) return;
    event.preventDefault();
    const bounds = schemaPaneElement.getBoundingClientRect();
    trackPointerResize(narrowPaneLayout ? "row" : "column", (moveEvent) => {
      const next = narrowPaneLayout
        ? ((moveEvent.clientY - bounds.top) / bounds.height) * 100
        : ((moveEvent.clientX - bounds.left) / bounds.width) * 100;
      schemaInspectorPercent = clamp(next, 20, 65);
    });
  }

  function resizeSchemaPaneWithKeyboard(event: KeyboardEvent) {
    if (event.key === "Home") {
      event.preventDefault();
      schemaInspectorPercent = defaultWorkspacePreferences.schemaInspectorPercent;
      return;
    }
    const decreaseKey = narrowPaneLayout ? "ArrowUp" : "ArrowLeft";
    const increaseKey = narrowPaneLayout ? "ArrowDown" : "ArrowRight";
    if (event.key !== decreaseKey && event.key !== increaseKey) return;
    event.preventDefault();
    schemaInspectorPercent = clamp(
      schemaInspectorPercent + (event.key === decreaseKey ? -2 : 2),
      20,
      65,
    );
  }

  function startProblemsResize(event: PointerEvent) {
    if (!workspaceElement) return;
    event.preventDefault();
    const bounds = workspaceElement.getBoundingClientRect();
    const maxHeight = Math.max(132, Math.min(420, bounds.height - 220));
    trackPointerResize("row", (moveEvent) => {
      problemsPanelHeight = clamp(bounds.bottom - 28 - moveEvent.clientY, 72, maxHeight);
    });
  }

  function resizeProblemsWithKeyboard(event: KeyboardEvent) {
    if (event.key === "Home") {
      event.preventDefault();
      problemsPanelHeight = defaultWorkspacePreferences.problemsPanelHeight;
      return;
    }
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    event.preventDefault();
    problemsPanelHeight = clamp(
      problemsPanelHeight + (event.key === "ArrowUp" ? 16 : -16),
      72,
      Math.max(
        132,
        Math.min(420, (workspaceElement?.getBoundingClientRect().height ?? 600) - 220),
      ),
    );
  }

  function trackPointerResize(
    orientation: "column" | "row",
    move: (event: PointerEvent) => void,
  ) {
    document.documentElement.classList.add(`resizing-${orientation}`);
    const stop = () => {
      document.documentElement.classList.remove(`resizing-${orientation}`);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
      window.removeEventListener("blur", stop);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop, { once: true });
    window.addEventListener("pointercancel", stop, { once: true });
    window.addEventListener("blur", stop, { once: true });
  }

  async function focusSchemaModal() {
    await tick();
    schemaModalElement?.focus();
  }

  async function restoreSchemaModalFocus() {
    await tick();
    schemaModalPreviousFocus?.focus();
    schemaModalPreviousFocus = null;
  }

  function handleSchemaModalKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      schemaToolsOpen = false;
      return;
    }
    if (event.key !== "Tab" || !schemaModalElement) return;
    const focusable = [...schemaModalElement.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )];
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable.at(-1)!;
    if (
      event.shiftKey &&
      (document.activeElement === first || document.activeElement === schemaModalElement)
    ) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  async function openConfig() {
    const path = await pickFile(t("dialogs.config"), ["yaml", "yml", "json", "toml"]);
    if (!path) return;
    try {
      await openConfigPath(path);
      lastError = "";
    } catch (error) {
      lastError = nativeBridgeErrorMessage(error, t("remote.open.desktopOnly"));
    }
  }

  async function openDirectory() {
    const path = await pickDirectory(t("dialogs.directory"));
    if (!path) return;
    try {
      await openWorkspaceDirectory({ scheme: "file", path });
    } catch {
      problemsOpen = true;
    }
  }

  async function initializeWorkspaceSession() {
    restoreWorkspaceSession();
    await openInitialFiles();

    workspaceSessionReady = true;
    void loadGitContext();
  }

  function restoreWorkspaceSession() {
    const session = readWorkspaceSession(window.localStorage);
    if (!session) return;

    if (isBundledSampleSession(session)) {
      documents = [];
      activeDocumentId = "";
      schemaPath = undefined;
      schemaResource = undefined;
      schemaOrigin = "none";
      schemaText = "";
      schemaFileSavedText = "";
      schemaDesignerDraft = createSchemaDesignerDraft();
      return;
    }

    documents = session.documents;
    activeDocumentId = session.activeDocumentId;
    schemaPath = session.schemaPath;
    schemaResource = session.schemaResource;
    schemaOrigin = session.schemaResource || session.schemaPath ? "manual" : "draft";
    schemaText = session.schemaText;
    schemaFileSavedText = session.schemaSavedText ?? "";
    syncSchemaDesignerFromText(
      session.schemaText,
      session.schemaResource
        ? resourceProvider(session.schemaResource).formatHint(session.schemaResource)
        : session.schemaPath
          ? formatFromPath(session.schemaPath, "json")
          : "json",
    );
  }

  function isBundledSampleSession(session: {
    activeDocumentId: string;
    documents: ConfigDocument[];
    schemaPath?: string;
    schemaResource?: ResourceRef;
    schemaText: string;
  }) {
    const onlyDocument = session.documents[0];
    return (
      session.documents.length === 1 &&
      onlyDocument?.id === "sample" &&
      !onlyDocument.path &&
      onlyDocument.text.trim() === sampleConfig.trim() &&
      !session.schemaPath &&
      !session.schemaResource &&
      session.schemaText.trim() === sampleSchema.trim()
    );
  }

  async function openInitialFiles() {
    try {
      const paths = await invoke<string[]>("initial_files");
      if (paths.length === 0) return false;

      await openAssociatedFilePaths(paths);
      void loadGitContext(paths[0]);
      return true;
    } catch {
      // The web preview does not expose native startup arguments.
      return false;
    }
  }

  async function loadInstallContext() {
    try {
      installContext = await invoke<InstallContext>("install_context");
    } catch {
      // The web preview is intentionally package-manager agnostic.
    }
  }

  async function loadGitContext(
    anchorPath =
      (activeDocument ? localDocumentPath(activeDocument) : undefined) ??
      (schemaResource?.scheme === "file" ? schemaResource.path : schemaPath),
  ) {
    if (!appConfig.features.git) {
      gitContext = {
        available: false,
        dirty: false,
        changedFiles: 0,
      };
      return;
    }

    try {
      gitContext = await invoke<GitContext>("git_context", {
        anchorPath,
      });
    } catch {
      gitContext = {
        available: false,
        dirty: false,
        changedFiles: 0,
      };
    }
  }

  async function loadSshHosts() {
    remoteHostsBusy = true;
    try {
      const targets = (await resourceProviderForScheme("ssh").discoverTargets?.()) ?? [];
      const hosts = targets.flatMap((target) => sshHostCandidateFromTarget(target));
      sshHostCandidates = hosts;
      sshHostsReady = true;
      const options = mergeSshHostOptions(
        hosts,
        recentVisibleRemoteFiles.map(recentResourceToRemoteFile),
      );
      if (!remoteHostInput && options[0]) {
        remoteHostInput = options[0].host;
      }
      remoteStatus = "";
    } catch (error) {
      sshHostsReady = false;
      remoteStatus = nativeBridgeErrorMessage(error, t("remote.hosts.desktopOnly"));
    } finally {
      remoteHostsBusy = false;
    }
  }

  async function openRemoteDialog() {
    remoteOpenDialogOpen = true;
    remoteStatus = "";
    if (!sshHostsReady) await loadSshHosts();
    if (!remoteHostInput && remoteHostOptions[0]) {
      remoteHostInput = remoteHostOptions[0].host;
    }
    if (!remotePathInput.trim()) {
      remotePathInput = "~";
    }
    const selectedHost = remoteHostInput.trim();
    if (selectedHost && remoteBrowserHost === selectedHost && remoteBrowserPath) {
      await browseRemotePath(remoteBrowserPath, selectedHost);
    } else {
      await selectRemoteHost(selectedHost);
    }
  }

  async function refreshSshHosts() {
    await loadSshHosts();
    if (remoteOpenDialogOpen && remoteHostInput && !remoteBrowserPath) {
      await selectRemoteHost(remoteHostInput);
    }
  }

  async function browseRemotePath(path: string, selectedHost = remoteHostInput) {
    const host = selectedHost.trim();
    const directoryPath = path.trim() || "~";
    if (!host) return;

    const requestId = remoteBrowseGate.begin();
    const switchedHost = remoteBrowserHost !== host;
    remoteBrowserHost = host;
    remotePathInput = directoryPath;
    if (switchedHost) {
      remoteBrowserPath = "";
      remoteBrowserEntries = [];
    }
    remoteBrowserBusy = true;
    remoteStatus = "";
    try {
      const provider = resourceProviderForScheme("ssh");
      const entries = await provider.list?.({ scheme: "ssh", host, path: directoryPath });
      if (!entries) {
        throw new Error(t("remote.error.browseUnsupported"));
      }
      if (!remoteBrowseGate.isCurrent(requestId) || remoteHostInput.trim() !== host) return;
      remoteBrowserPath = directoryPath;
      remoteBrowserEntries = entries as SshBrowserEntry[];
      remotePathInput = directoryPath;
      lastError = "";
    } catch (error) {
      if (!remoteBrowseGate.isCurrent(requestId) || remoteHostInput.trim() !== host) return;
      remoteStatus = remoteErrorMessage(error, t("remote.open.desktopOnly"), host);
      lastError = remoteStatus;
    } finally {
      if (remoteBrowseGate.isCurrent(requestId)) remoteBrowserBusy = false;
    }
  }

  function selectRemoteBrowserEntry(entry: SshBrowserEntry) {
    remotePathInput = entry.resource.path;
  }

  function updateRemoteHost(value: string) {
    if (remoteHostInput === value) return;
    remoteBrowseGate.invalidate();
    remoteHostInput = value;
    if (!remotePathInput.trim()) {
      remotePathInput = "~";
    }
    remotePassword = "";
    remotePasswordMode = false;
    remoteBrowserHost = "";
    remoteBrowserPath = "";
    remoteBrowserEntries = [];
    remoteBrowserBusy = false;
    remoteStatus = "";
  }

  async function selectRemoteHost(value: string) {
    const host = value.trim();
    const alreadyBrowsing =
      remoteHostInput.trim() === host &&
      remoteBrowserHost === host &&
      (remoteBrowserBusy || Boolean(remoteBrowserPath));
    updateRemoteHost(host);
    if (!host || alreadyBrowsing) return;

    const initialPath = initialRemoteBrowsePath(
      host,
      recentVisibleRemoteFiles.map(recentResourceToRemoteFile),
    );
    await browseRemotePath(initialPath, host);
  }

  function closeRemoteDialog() {
    remoteBrowseGate.invalidate();
    remoteBrowserBusy = false;
    remotePassword = "";
    remotePasswordMode = false;
    remoteOpenDialogOpen = false;
  }

  function showRemotePassword() {
    if (!remoteHostInput.trim()) return;
    remotePassword = "";
    remotePasswordMode = true;
    remoteStatus = "";
  }

  async function cancelRemotePassword() {
    const host = remoteHostInput.trim();
    if (host && remotePasswordHosts.has(host)) {
      try {
        await invoke("clear_ssh_password", { host });
        remotePasswordHosts = new Set([...remotePasswordHosts].filter((candidate) => candidate !== host));
      } catch (error) {
        remoteStatus = nativeBridgeErrorMessage(error, t("remote.open.desktopOnly"));
        return;
      }
    }
    remotePassword = "";
    remotePasswordMode = false;
    remoteStatus = "";
  }

  async function authenticateRemoteHost() {
    const host = remoteHostInput.trim();
    if (!host || !remotePassword) return;
    remoteStatus = "";
    try {
      await invoke("set_ssh_password", { host, password: remotePassword });
      remotePasswordHosts = new Set([...remotePasswordHosts, host]);
      remotePasswordMode = false;
      await browseRemotePath(remoteBrowserPath || remotePathInput || "~", host);
      if (!remotePasswordMode) remotePassword = "";
    } catch (error) {
      remoteStatus = remoteErrorMessage(error, t("remote.open.desktopOnly"), host);
    }
  }

  async function forgetRemotePassword() {
    const host = remoteHostInput.trim();
    if (!host) return;
    try {
      await invoke("clear_ssh_password", { host });
      remotePasswordHosts = new Set([...remotePasswordHosts].filter((candidate) => candidate !== host));
      remotePassword = "";
      remotePasswordMode = false;
      remoteStatus = "";
    } catch (error) {
      remoteStatus = nativeBridgeErrorMessage(error, t("remote.open.desktopOnly"));
    }
  }

  async function checkForUpdates() {
    if (!directUpdaterEnabled) {
      updateStatus = t("updates.packageManagedStatus");
      return;
    }

    updateBusy = true;
    updateStatus = t("updates.checking");
    try {
      const update = await check();
      if (!update) {
        updateStatus = t("updates.current");
        return;
      }

      updateStatus = t("updates.installing", { version: update.version });
      await update.downloadAndInstall();
      updateStatus = t("updates.restart");
      await relaunch();
    } catch (error) {
      updateStatus = error instanceof Error ? error.message : String(error);
    } finally {
      updateBusy = false;
    }
  }

  async function openConfigPath(path: string, remember = true) {
    await openConfigResource({ scheme: "file", path }, remember);
  }

  async function openConfigResource(resource: ResourceRef, remember = true) {
    const locationKey = documentLocationKey(resource);
    const existing = documents.find(
      (document) => document.resource && documentLocationKey(document.resource) === locationKey,
    );
    if (existing) {
      activeDocumentId = existing.id;
      selectedTab = "editor";
      if (remember) rememberRecentResourceRef(resource, "config");
      void loadDocumentSchema(existing);
      void loadGitContext(resource.scheme === "file" ? resource.path : undefined);
      return;
    }

    let pendingRead = pendingDocumentReads.get(locationKey);
    if (!pendingRead) {
      pendingRead = readResourceDocument(resource);
      pendingDocumentReads.set(locationKey, pendingRead);
    }

    let document: ConfigDocument;
    try {
      document = await pendingRead;
    } finally {
      if (pendingDocumentReads.get(locationKey) === pendingRead) {
        pendingDocumentReads.delete(locationKey);
      }
    }

    const openedWhileReading = documents.find(
      (candidate) =>
        candidate.resource && documentLocationKey(candidate.resource) === locationKey,
    );
    if (openedWhileReading) {
      activeDocumentId = openedWhileReading.id;
      selectedTab = "editor";
      if (remember) rememberRecentResourceRef(resource, "config");
      return;
    }

    documents = shouldReplaceInitialDocument() ? [document] : [...documents, document];
    activeDocumentId = document.id;
    selectedTab = "editor";
    if (remember) rememberRecentResourceRef(resource, "config");
    await loadDocumentSchema(document);
    void loadGitContext(resource.scheme === "file" ? resource.path : undefined);
  }

  async function openRemotePathFromInputs(selectedPath?: string) {
    const host = remoteHostInput.trim();
    const path = (selectedPath || remotePathInput || remoteBrowserPath || "~").trim();
    if (!host || !path) return;

    remoteBusy = true;
    remoteStatus = "";
    try {
      if (shouldTryRemoteDirectoryFirst(path)) {
        try {
          await openWorkspaceDirectory({ scheme: "ssh", host, path });
          closeRemoteDialog();
          return;
        } catch (error) {
          if (!isNotDirectoryError(error)) throw error;
          workspaceStatus = "";
          lastError = "";
        }
      }

      await openConfigResource(sshDocumentLocation(host, path));
      closeRemoteDialog();
      void loadGitContext();
    } catch (error) {
      remoteStatus = remoteErrorMessage(error, t("remote.open.desktopOnly"), host);
      lastError = remoteStatus;
    } finally {
      remoteBusy = false;
    }
  }

  async function openRemoteConfigFile(ref: RemoteFileRef) {
    const host = ref.host.trim();
    const path = ref.path.trim();
    if (!host || !path) return;

    remoteBusy = true;
    remoteStatus = "";

    try {
      await openConfigResource(sshDocumentLocation(host, path));
      closeRemoteDialog();
      void loadGitContext();
    } catch (error) {
      remoteStatus = remoteErrorMessage(error, t("remote.open.desktopOnly"), host);
      lastError = remoteStatus;
    } finally {
      remoteBusy = false;
    }
  }

  async function openRemoteDirectoryFromInputs(selectedPath?: string) {
    const host = remoteHostInput.trim();
    const path = (selectedPath || remoteBrowserPath || remotePathInput || "~").trim();
    if (!host || !path) return;

    remoteBusy = true;
    remoteStatus = "";
    try {
      await openWorkspaceDirectory({ scheme: "ssh", host, path });
      closeRemoteDialog();
    } catch (error) {
      remoteStatus = remoteErrorMessage(error, t("remote.open.desktopOnly"), host);
      lastError = remoteStatus;
    } finally {
      remoteBusy = false;
    }
  }

  async function openRemoteRecentFromDialog(file: RecentResource) {
    if (file.resource.scheme !== "ssh") return;
    if (file.kind !== "schema") {
      await openRemoteConfigFile({
        provider: "ssh",
        host: file.resource.host,
        path: file.resource.path,
      });
      selectedTab = "editor";
      return;
    }

    try {
      await openSchemaResource(file.resource);
      closeRemoteDialog();
      schemaToolsOpen = true;
    } catch (error) {
      remoteStatus = remoteErrorMessage(error, t("remote.open.desktopOnly"), file.resource.host);
      lastError = remoteStatus;
    }
  }

  async function readResourceDocument(resource: ResourceRef): Promise<ConfigDocument> {
    const provider = resourceProvider(resource);
    const result = await provider.read(resource);
    return createConfigDocument({
      id: crypto.randomUUID(),
      name: provider.displayName(resource),
      resource,
      text: result.text,
      savedText: result.savedText,
    });
  }

  async function openWorkspaceDirectory(resource: ResourceRef) {
    const provider = resourceProvider(resource);
    if (!provider.list) {
      throw new Error(`Resource provider '${provider.id}' cannot browse directories.`);
    }

    const sequence = ++workspaceBrowseSequence;
    workspaceBusy = true;
    workspaceStatus = "";
    try {
      const entries = await provider.list(resource);
      if (sequence !== workspaceBrowseSequence) return;
      workspaceRoot = resource;
      workspaceEntries = entries;
      explorerOpen = true;
      selectedTab = "editor";
      lastError = "";
    } catch (error) {
      if (sequence !== workspaceBrowseSequence) return;
      workspaceStatus = nativeBridgeErrorMessage(error, t("remote.open.desktopOnly"));
      lastError = workspaceStatus;
      throw error;
    } finally {
      if (sequence === workspaceBrowseSequence) workspaceBusy = false;
    }
  }

  async function openWorkspaceParent() {
    if (!workspaceCanBrowseParent || !workspaceParent) return;
    try {
      await openWorkspaceDirectory(workspaceParent);
    } catch {
      // openWorkspaceDirectory already exposes the actionable error in the explorer.
    }
  }

  async function refreshWorkspaceDirectory() {
    if (!workspaceRoot) return;
    try {
      await openWorkspaceDirectory(workspaceRoot);
    } catch {
      // openWorkspaceDirectory already exposes the actionable error in the explorer.
    }
  }

  async function selectWorkspaceEntry(entry: WorkspaceEntry) {
    try {
      if (entry.kind === "directory") {
        await openWorkspaceDirectory(entry.resource);
        return;
      }

      await openWorkspaceFile(entry.resource);
    } catch (error) {
      lastError = nativeBridgeErrorMessage(error, t("remote.open.desktopOnly"));
      problemsOpen = true;
    }
  }

  async function openWorkspaceFile(resource: ResourceRef) {
    const kind = associatedFileKind(resource.path);
    if (kind === "schema") {
      await openSchemaResource(resource);
      schemaToolsOpen = true;
      return;
    }

    if (kind === "settings" && resource.scheme === "file") {
      await openAppConfigPath(resource.path);
      selectedTab = "settings";
      return;
    }

    await openConfigResource(resource);
    selectedTab = "editor";
  }

  async function openSchema() {
    const path = await pickFile(t("dialogs.schema"), ["json", "yaml", "yml", "toml"]);
    if (!path) return;
    try {
      await openSchemaPath(path);
      lastError = "";
    } catch (error) {
      lastError = nativeBridgeErrorMessage(error, t("remote.open.desktopOnly"));
    }
  }

  async function openSchemaPath(path: string, remember = true) {
    await openSchemaResource({ scheme: "file", path }, remember, {
      origin: "manual",
      openTools: true,
    });
  }

  async function openSchemaResource(
    resource: ResourceRef,
    remember = true,
    options: {
      origin?: SchemaOrigin;
      openTools?: boolean;
      automatic?: boolean;
      expectedDocumentId?: string;
    } = {},
  ) {
    const sameResource =
      schemaResource && documentLocationKey(schemaResource) === documentLocationKey(resource);
    if (schemaDirty) {
      if (options.automatic) {
        if (sameResource) return true;
        lastError = t("dialogs.schemaAutoLoadBlocked");
        return false;
      }
      if (!confirm(t("dialogs.discardSchema"))) return false;
    }

    const requestId = ++schemaLoadSequence;
    const provider = resourceProvider(resource);
    const result = await provider.read(resource);
    if (requestId !== schemaLoadSequence) return false;
    if (options.expectedDocumentId && activeDocumentId !== options.expectedDocumentId) return false;
    schemaResource = resource;
    schemaPath = resource.scheme === "file" ? resource.path : undefined;
    schemaText = result.text;
    schemaFileSavedText = result.savedText ?? result.text;
    schemaOrigin = options.origin ?? "manual";
    syncSchemaDesignerFromText(schemaText, provider.formatHint(resource));
    schemaToolsOpen = options.openTools ?? true;
    if (remember) rememberRecentResourceRef(resource, "schema");
    void loadGitContext(resource.scheme === "file" ? resource.path : undefined);
    return true;
  }

  async function loadDocumentSchema(document: ConfigDocument) {
    let parsed: JsonValue | undefined;
    try {
      parsed = parseData(document.text, {
        format: documentFormatHint(document, appConfig.editor.defaultFormat),
      });
    } catch {
      return;
    }

    const schemaReference = documentSchemaReference(parsed);
    if (!schemaReference) return;

    const schemaRef = resolveSiblingResource(document.resource, schemaReference);
    if (!schemaRef) {
      lastError = `Unsupported schema reference: ${schemaReference}`;
      return;
    }

    if (
      schemaResource &&
      documentLocationKey(schemaResource) === documentLocationKey(schemaRef) &&
      schemaText.trim()
    ) {
      schemaOrigin = "document";
      return;
    }

    try {
      await openSchemaResource(schemaRef, false, {
        origin: "document",
        openTools: false,
        automatic: true,
        expectedDocumentId: document.id,
      });
      lastError = "";
    } catch (error) {
      lastError = nativeBridgeErrorMessage(error, `Could not open schema ${schemaReference}.`);
    }
  }

  function loadExampleWorkspace() {
    if (!confirmDiscardWorkspace()) return;
    clearAutosaveTimer();
    const document = createConfigDocument({
      id: crypto.randomUUID(),
      name: "config.yaml",
      text: sampleConfig,
    });
    documents = [document];
    activeDocumentId = document.id;
    schemaPath = undefined;
    schemaResource = undefined;
    schemaText = sampleSchema;
    schemaFileSavedText = "";
    schemaOrigin = "sample";
    schemaDesignerDraft = schemaDesignerDraftFromSchema(safeParseSchema(sampleSchema, "json"));
    schemaEditorMode = "designer";
    selectedTab = "editor";
    lastError = "";
  }

  function startSchemaDesigner() {
    try {
      if (schema) {
        schemaDesignerDraft = schemaDesignerDraftFromSchema(schema);
      } else {
        schemaDesignerDraft = createSchemaDesignerDraft();
        schemaText = schemaTextFromDesignerDraft(schemaDesignerDraft);
        schemaPath = undefined;
        schemaResource = undefined;
        schemaFileSavedText = "";
        schemaOrigin = "draft";
      }
      schemaEditorMode = "designer";
      schemaToolsOpen = true;
      lastError = "";
    } catch (error) {
      schemaEditorMode = "json";
      lastError = error instanceof Error ? error.message : String(error);
      problemsOpen = true;
    }
  }

  function createSchemaFromActiveConfig() {
    if (!inferredSchema) {
      startSchemaDesigner();
      return;
    }
    try {
      schemaDesignerDraft = schemaDesignerDraftFromSchema(inferredSchema);
      schemaText = schemaTextFromDesignerDraft(schemaDesignerDraft);
      schemaPath = undefined;
      schemaResource = undefined;
      schemaFileSavedText = "";
      schemaOrigin = "draft";
      schemaEditorMode = "designer";
      schemaToolsOpen = true;
      lastError = "";
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      problemsOpen = true;
    }
  }

  function addSchemaFreeSetting(key: string, type: SchemaFreeSettingType) {
    if (!canAddSchemaFreeSetting || schemaFreeRootKeys.includes(key)) return;
    setValue(appendPath("", key), defaultValueForSettingType(type));
  }

  function showRawEditor() {
    if (!appConfig.editor.showRawPreview) {
      setAppConfigValue("editor.showRawPreview", true);
    }
  }

  function showSchemaFreeForm() {
    if (!activeDocument || !schemaFreeCanTryForm) return;
    schemaFreeFormOverrides = new Set([...schemaFreeFormOverrides, activeDocument.id]);
  }

  function schemaFreeRawReasonLabel() {
    switch (schemaFreeAnalysis.reason) {
      case "invalid":
        return t("schemaFree.rawReason.invalid");
      case "root":
        return t("schemaFree.rawReason.root");
      case "large":
        return t("schemaFree.rawReason.large");
      case "collection":
        return t("schemaFree.rawReason.collection");
      case "complex":
        return t("schemaFree.rawReason.complex");
      case "unsafeInteger":
        return t("schemaFree.rawReason.unsafeInteger");
      default:
        return t("schemaFree.rawReason.default");
    }
  }

  function compactCount(value: number) {
    return new Intl.NumberFormat(locale, {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  }

  function applySchemaDesignerDraft(draft: SchemaDesignerDraft) {
    try {
      const nextText = schemaTextFromDesignerDraft(draft);
      schemaDesignerDraft = draft;
      schemaText = nextText;
      lastError = "";
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      problemsOpen = true;
    }
  }

  function useSchemaDesignerFromJson() {
    if (!schema) {
      lastError = t("app.noSchema");
      return;
    }

    try {
      schemaDesignerDraft = schemaDesignerDraftFromSchema(schema);
      schemaEditorMode = "designer";
      lastError = "";
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      problemsOpen = true;
    }
  }

  function syncSchemaDesignerFromText(text: string, format: DataFormat) {
    if (!text.trim()) {
      schemaDesignerDraft = createSchemaDesignerDraft();
      return;
    }

    const parsed = parseSchemaResult(text, format);
    if (!parsed.schema) {
      lastError = parsed.error ?? t("app.noSchema");
      return;
    }
    try {
      schemaDesignerDraft = schemaDesignerDraftFromSchema(parsed.schema);
      lastError = "";
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      problemsOpen = true;
    }
  }

  async function saveConfig(options: { forceDialog?: boolean } = {}) {
    if (!activeDocument) return;
    if (activeDocument.saveState === "saving") return;
    if (!ensureDocumentCanSave(activeDocument)) return;
    if (activeDocument.resource && !options.forceDialog) {
      await saveResourceConfig(activeDocument);
      return;
    }

    let path: string | null = options.forceDialog ? null : (localDocumentPath(activeDocument) ?? null);
    if (!path) {
      try {
        path = (await save({
          title: t("dialogs.saveConfig"),
          filters: [{ name: t("dialogs.config"), extensions: ["yaml", "yml", "json", "toml"] }],
        })) as string | null;
      } catch {
        lastError = t("errors.nativeDialogs");
        return;
      }
    }
    if (!path) return;

    clearAutosaveTimer();
    const documentId = activeDocumentId;
    const contents = configText;
    setDocumentSaveState(documentId, "saving", t("documents.status.saving"));
    try {
      await writeResource({ scheme: "file", path }, contents);
    } catch (error) {
      const message = nativeBridgeErrorMessage(error, t("remote.open.desktopOnly"));
      lastError = message;
      setDocumentSaveState(documentId, "error", message);
      return;
    }

    const savedAt = Date.now();
    documents = documents.map((document) => {
      if (document.id !== documentId) return document;

      if (document.text === contents) {
        return markDocumentSaved(document, {
          path,
          text: contents,
          savedAt,
          message: t("documents.status.saved"),
        });
      }

      return {
        ...document,
        path,
        name: fileName(path),
        savedText: contents,
        saveState: "idle",
        saveMessage: t("documents.status.saved"),
        lastSavedAt: savedAt,
      };
    });
    rememberRecentPath(path, "config");
    void loadGitContext(path);
  }

  async function saveResourceConfig(document: ConfigDocument) {
    if (!document.resource) return;
    if (!ensureDocumentCanSave(document)) return;

    clearAutosaveTimer();
    const documentId = document.id;
    const resource = document.resource;
    const contents = document.text;
    setDocumentSaveState(documentId, "saving", t("documents.status.saving"));

    try {
      await writeResource(resource, contents);
    } catch (error) {
      const message = resource.scheme === "ssh"
        ? remoteErrorMessage(error, t("remote.open.desktopOnly"), resource.host)
        : error instanceof Error
          ? error.message
          : String(error);
      if (resource.scheme === "ssh" && remotePasswordMode) {
        prepareRemoteAuthentication(resource, message);
      }
      lastError = message;
      setDocumentSaveState(documentId, "error", message);
      return;
    }

    const savedAt = Date.now();
    documents = documents.map((current) => {
      if (current.id !== documentId) return current;

      if (current.text === contents) {
        return markDocumentSaved(current, {
          resource,
          text: contents,
          savedAt,
          message: t("documents.status.saved"),
        });
      }

      return {
        ...current,
        resource,
        path: resource.scheme === "file" ? resource.path : undefined,
        name: resourceProvider(resource).displayName(resource),
        savedText: contents,
        saveState: "idle",
        saveMessage: t("documents.status.saved"),
        lastSavedAt: savedAt,
      };
    });
    rememberRecentResourceRef(resource, "config");
    void loadGitContext(resource.scheme === "file" ? resource.path : undefined);
  }

  async function saveSchema(options: { forceDialog?: boolean } = {}) {
    if (!schemaText.trim()) {
      startSchemaDesigner();
    }

    const parsedSchema = parseSchemaResult(schemaText, schemaFormat);
    if (!parsedSchema.schema) {
      lastError = parsedSchema.error ?? t("app.noSchema");
      problemsOpen = true;
      return;
    }

    const contents = schemaText.endsWith("\n") ? schemaText : `${schemaText}\n`;
    if (schemaResource && !options.forceDialog) {
      try {
        await writeResource(schemaResource, contents);
      } catch (error) {
        lastError = schemaResource.scheme === "ssh"
          ? remoteErrorMessage(error, t("remote.open.desktopOnly"), schemaResource.host)
          : error instanceof Error
            ? error.message
            : String(error);
        if (schemaResource.scheme === "ssh" && remotePasswordMode) {
          prepareRemoteAuthentication(schemaResource, lastError);
        }
        return;
      }

      schemaText = contents;
      schemaFileSavedText = contents;
      schemaPath = schemaResource.scheme === "file" ? schemaResource.path : undefined;
      schemaOrigin = "manual";
      rememberRecentResourceRef(schemaResource, "schema");
      syncSchemaDesignerFromText(contents, resourceProvider(schemaResource).formatHint(schemaResource));
      void loadGitContext(schemaResource.scheme === "file" ? schemaResource.path : undefined);
      return;
    }

    let path: string | null = options.forceDialog ? null : (schemaPath ?? null);
    if (!path) {
      try {
        path = (await save({
          title: t("actions.saveSchema"),
          defaultPath: schemaPath ?? "schema.json",
          filters: [{ name: t("dialogs.schema"), extensions: ["json", "yaml", "yml", "toml"] }],
        })) as string | null;
      } catch {
        lastError = t("errors.nativeDialogs");
        return;
      }
    }
    if (!path) return;

    try {
      await invoke("write_text_file", { path, contents });
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      return;
    }

    schemaPath = path;
    schemaResource = { scheme: "file", path };
    schemaText = contents;
    schemaFileSavedText = contents;
    schemaOrigin = "manual";
    rememberRecentResourceRef(schemaResource, "schema");
    syncSchemaDesignerFromText(contents, formatFromPath(path, "json"));
    void loadGitContext(path);
  }

  async function saveAppConfig(options: { forceDialog?: boolean } = {}) {
    if (!appConfigCanPersist) {
      appConfigStatus = t("settings.persistence.invalid");
      return;
    }

    let path: string | null = options.forceDialog ? null : (appConfigPath ?? null);
    if (!path) {
      try {
        path = (await save({
          title: t("dialogs.saveSettings"),
          defaultPath: "schematica.config.yaml",
          filters: [{ name: t("dialogs.config"), extensions: ["yaml", "yml", "json", "toml"] }],
        })) as string | null;
      } catch {
        lastError = t("errors.nativeDialogs");
        return;
      }
    }
    if (!path) return;

    try {
      const format = formatFromPath(path, "yaml");
      const contents = stringifyData(appConfigParse.data, { format });
      await invoke("write_text_file", { path, contents });
      appConfigText = contents;
      appConfigFormat = format;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      return;
    }

    appConfigPath = path;
    appConfigFileSavedText = appConfigText;
    appConfigOrigin = "file";
    writeStoredAppConfig(window.localStorage, appConfigText, appConfigFormat);
    appConfigStatus = t("settings.persistence.savedTo", { path: fileName(path) });
    rememberRecentPath(path, "settings");
    try {
      await openConfiguredProjectResources(path, parseAppConfig(appConfigText, appConfigFormat));
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    void loadGitContext(path);
  }

  async function openAppConfig() {
    const path = await pickFile(t("dialogs.settings"), ["yaml", "yml", "json", "toml"]);
    if (!path) return;
    await openAppConfigPath(path);
  }

  async function openAppConfigPath(path: string, remember = true) {
    if (appConfigFileDirty && path !== appConfigPath && !confirm(t("dialogs.discardSettings"))) {
      return;
    }
    try {
      const text = await invoke<string>("read_text_file", { path });
      const format = formatFromPath(path, "yaml");
      const loadedConfig = parseAppConfig(text, format);
      appConfigText = text;
      appConfigFormat = format;
      appConfigPath = path;
      appConfigFileSavedText = text;
      appConfigOrigin = "file";
      appConfigStatus = t("settings.persistence.loadedFrom", { path: fileName(path) });
      if (remember) rememberRecentPath(path, "settings");
      await openConfiguredProjectResources(path, loadedConfig);
      lastError = "";
      void loadGitContext(path);
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }

  async function openConfiguredProjectResources(configPath: string, config: AppConfig) {
    const owner: ResourceRef = { scheme: "file", path: configPath };
    if (config.project.schema) {
      const resource = resolveSiblingResource(owner, config.project.schema);
      if (!resource) throw new Error(`Unsupported project schema: ${config.project.schema}`);
      await openSchemaResource(resource, true, { origin: "manual", openTools: false });
    }
    if (config.project.config) {
      const resource = resolveSiblingResource(owner, config.project.config);
      if (!resource) throw new Error(`Unsupported project config: ${config.project.config}`);
      await openConfigResource(resource);
    }
  }

  async function exportAppConfig() {
    if (!appConfigCanPersist || appConfigParse.data === undefined) {
      appConfigStatus = t("settings.persistence.invalid");
      return;
    }

    let path: string | null = null;
    try {
      path = (await save({
        title: t("dialogs.exportSettings"),
        defaultPath: "schematica.config.yaml",
        filters: [{ name: t("dialogs.config"), extensions: ["yaml", "yml", "json", "toml"] }],
      })) as string | null;
    } catch {
      lastError = t("errors.nativeDialogs");
      return;
    }
    if (!path) return;

    try {
      const format = formatFromPath(path, "yaml");
      const contents = stringifyData(appConfigParse.data, { format });
      await invoke("write_text_file", { path, contents });
      appConfigStatus = t("settings.persistence.exportedTo", { path: fileName(path) });
      rememberRecentPath(path, "settings");
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }

  async function resetAppConfig() {
    if (
      !(await confirm(t("dialogs.resetSettings"), {
        kind: "warning",
      }))
    ) {
      return;
    }

    appConfigText = sampleAppConfig;
    appConfigFormat = "yaml";
    appConfigOrigin = "local";
    appConfigPath = undefined;
    appConfigFileSavedText = "";
    appConfigStatus = t("settings.persistence.reset");
    writeStoredAppConfig(window.localStorage, appConfigText, appConfigFormat);
    void loadGitContext();
  }

  async function saveCurrent() {
    if (selectedTab === "settings") {
      await saveAppConfig();
      return;
    }

    await saveConfig();
  }

  async function saveCurrentAs() {
    if (selectedTab === "settings") {
      await saveAppConfig({ forceDialog: true });
      return;
    }

    await saveConfig({ forceDialog: true });
  }

  function clearAutosaveTimer() {
    if (autosaveTimer) {
      clearTimeout(autosaveTimer);
      autosaveTimer = undefined;
    }
    pendingAutosaveSignature = "";
  }

  function scheduleWorkspaceSessionPersistence(session: WorkspaceSession) {
    if (workspaceSessionTimer) clearTimeout(workspaceSessionTimer);
    workspaceSessionTimer = setTimeout(() => {
      writeWorkspaceSession(window.localStorage, session);
      workspaceSessionTimer = undefined;
    }, 400);
  }

  function persistWorkspaceSessionNow() {
    if (!workspaceSessionReady) return;
    if (workspaceSessionTimer) {
      clearTimeout(workspaceSessionTimer);
      workspaceSessionTimer = undefined;
    }
    writeWorkspaceSession(window.localStorage, {
      activeDocumentId,
      documents,
      schemaPath,
      schemaResource,
      schemaText,
      schemaSavedText: schemaFileSavedText,
    });
  }

  function setDocumentSaveState(id: string, saveState: DocumentSaveState, saveMessage?: string) {
    documents = documents.map((document) =>
      document.id === id && (document.saveState !== saveState || document.saveMessage !== saveMessage)
        ? { ...document, saveState, saveMessage }
        : document,
    );
  }

  function scheduleAutosave() {
    const autosavePath = activeDocument ? localDocumentPath(activeDocument) : undefined;
    if (
      !appConfig.editor.autosave ||
      !autosavePath ||
      !activeDocumentDirty ||
      activeDocument.saveState === "saving"
    ) {
      clearAutosaveTimer();
      return;
    }

    if (
      data === undefined ||
      (hasSchema && schema === undefined) ||
      (validation !== undefined && !validation.valid)
    ) {
      clearAutosaveTimer();
      setDocumentSaveState(activeDocument.id, "paused", t("documents.status.autosavePaused"));
      return;
    }

    const signature = `${activeDocument.id}:${activeDocument.text}`;
    if (pendingAutosaveSignature === signature) return;

    if (autosaveTimer) {
      clearTimeout(autosaveTimer);
    }
    pendingAutosaveSignature = signature;
    setDocumentSaveState(activeDocument.id, "queued", t("documents.status.autosaveQueued"));
    autosaveTimer = setTimeout(() => {
      void autosaveDocument(activeDocument.id, signature);
    }, 850);
  }

  async function autosaveDocument(id: string, signature: string) {
    const document = documents.find((candidate) => candidate.id === id);
    const path = document ? localDocumentPath(document) : undefined;
    if (!document || !path || !isDocumentDirty(document)) return;
    if (`${document.id}:${document.text}` !== signature) return;
    if (!ensureDocumentCanSave(document, { quiet: true })) return;

    const contents = document.text;
    setDocumentSaveState(id, "saving", t("documents.status.autosaving"));

    try {
      await writeResource({ scheme: "file", path }, contents);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      lastError = message;
      pendingAutosaveSignature = "";
      setDocumentSaveState(id, "error", message);
      return;
    }

    pendingAutosaveSignature = "";
    autosaveTimer = undefined;
    const savedAt = Date.now();
    documents = documents.map((current) => {
      if (current.id !== id) return current;

      if (current.text === contents) {
        return markDocumentSaved(current, {
          path,
          text: contents,
          savedAt,
          message: t("documents.status.autosaved"),
        });
      }

      return {
        ...current,
        savedText: contents,
        saveState: "idle",
        saveMessage: t("documents.status.autosaved"),
        lastSavedAt: savedAt,
      };
    });
    void loadGitContext(path);
  }

  function selectDocument(document: ConfigDocument) {
    activeDocumentId = document.id;
    void loadDocumentSchema(document);
    void loadGitContext(localDocumentPath(document));
  }

  function handleDocumentTabKeydown(event: KeyboardEvent, index: number) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? documents.length - 1
          : (index + (event.key === "ArrowLeft" ? -1 : 1) + documents.length) % documents.length;
    const next = documents[nextIndex];
    if (!next) return;
    selectDocument(next);
    void tick().then(() => {
      document.querySelector<HTMLElement>(`[role="tab"][data-document-id="${CSS.escape(next.id)}"]`)?.focus();
    });
  }

  async function openRecentResource(file: RecentResource) {
    try {
      if (file.kind === "config" && file.resource.scheme === "ssh") {
        await openRemoteConfigFile({
          provider: "ssh",
          host: file.resource.host,
          path: file.resource.path,
        });
        selectedTab = "editor";
      } else if (file.kind === "config" && file.resource.scheme === "file") {
        await openConfigPath(file.resource.path);
        selectedTab = "editor";
      } else if (file.kind === "schema") {
        await openSchemaResource(file.resource);
        schemaToolsOpen = true;
      } else if (file.kind === "settings" && file.resource.scheme === "file") {
        await openAppConfigPath(file.resource.path);
        selectedTab = "settings";
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }

  async function openAssociatedFilePaths(paths: string[]) {
    for (const path of paths.filter((value) => typeof value === "string" && value.trim())) {
      try {
        await openAssociatedFilePath(path);
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
      }
    }
  }

  async function openAssociatedFilePath(path: string) {
    const kind = associatedFileKind(path);
    if (kind === "schema") {
      await openSchemaPath(path);
      schemaToolsOpen = true;
      return;
    }

    if (kind === "settings") {
      await openAppConfigPath(path);
      selectedTab = "settings";
      return;
    }

    await openConfigPath(path);
    selectedTab = "editor";
  }

  function associatedFileKind(path: string): RecentFileKind {
    const name = fileName(path).toLowerCase();
    if (
      name === "schematica.config.yaml" ||
      name === "schematica.config.yml" ||
      name === "schematica.config.json" ||
      name === "schematica.config.toml"
    ) {
      return "settings";
    }
    if (
      name.endsWith(".schema.json") ||
      name.endsWith(".schema.yaml") ||
      name.endsWith(".schema.yml") ||
      name.endsWith(".schema.toml")
    ) {
      return "schema";
    }
    return "config";
  }

  function shouldTryRemoteDirectoryFirst(path: string) {
    const name = fileName(path).toLowerCase();
    return !(
      name.endsWith(".yaml") ||
      name.endsWith(".yml") ||
      name.endsWith(".json") ||
      name.endsWith(".toml")
    );
  }

  function isNotDirectoryError(error: unknown) {
    return String(error instanceof Error ? error.message : error).includes("Not a directory");
  }

  function shouldReplaceInitialDocument() {
    return (
      documents.length === 0 ||
      (documents.length === 1 &&
        activeDocumentId === "sample" &&
        documents[0]?.id === "sample" &&
        !documents[0].path &&
        !isDocumentDirty(documents[0]))
    );
  }

  function rememberRecentPath(path: string, kind: RecentResourceKind) {
    rememberRecentResourceRef({ scheme: "file", path }, kind);
  }

  function rememberRecentResourceRef(resource: ResourceRef, kind: RecentResourceKind) {
    persistRecentResources(rememberRecentResource(recentResources, { resource, kind }));
  }

  function forgetRecentResourceRef(resource: ResourceRef, event?: MouseEvent) {
    event?.stopPropagation();
    persistRecentResources(forgetRecentResource(recentResources, resource));
  }

  function clearRecentFiles() {
    persistRecentResources(recentResources.filter((item) => item.resource.scheme !== "file"));
  }

  function clearRecentRemoteFiles() {
    persistRecentResources(recentResources.filter((item) => item.resource.scheme !== "ssh"));
  }

  function persistRecentResources(nextResources: RecentResource[]) {
    recentResources = nextResources;
    writeRecentResources(window.localStorage, recentResources);
  }

  async function sendFeedback() {
    try {
      await openUrl(feedbackUrl);
    } catch {
      window.open(feedbackUrl, "_blank", "noopener,noreferrer");
    }
  }

  async function handleNativeMenuCommand(command: string) {
    const registeredCommandId = nativeMenuCommandId(command);
    if (registeredCommandId) {
      await executeRegisteredCommand(registeredCommandId);
      return;
    }

    switch (command) {
      case "file.close-document":
        if (activeDocument) await closeDocument(activeDocument.id);
        break;
      case "view.command-palette":
        commandPaletteOpen = true;
        break;
    }
  }

  function executePaletteAction(commandId: string) {
    void executeRegisteredCommand(commandId, { closePalette: true });
  }

  async function executeRegisteredCommand(
    commandId: string,
    options: { closePalette?: boolean } = {},
  ) {
    const command = paletteActions.find((action) => action.id === commandId);
    if (!command || command.disabled) return false;
    if (options.closePalette) commandPaletteOpen = false;
    await command.action();
    return true;
  }

  function nativeMenuCommandId(command: string) {
    const commandIds: Record<string, string> = {
      "file.new": "file.new",
      "file.open": "file.open",
      "file.open-folder": "file.openFolder",
      "file.open-ssh": "file.openRemote",
      "file.open-schema": "file.schema",
      "file.open-settings": "settings.open",
      "file.save": "file.save",
      "file.save-as": "file.saveAs",
      "file.export-settings": "settings.export",
      "view.editor": "go.editor",
      "view.compare": "go.compare",
      "view.settings": "go.settings",
      "view.toggle-raw": "layout.raw",
      "view.toggle-problems": "layout.problems",
      "tools.check-updates": "updates.check",
      "help.feedback": "feedback.open",
    };
    return commandIds[command];
  }

  function activeSaveLabel() {
    if (selectedTab === "settings") return t("actions.saveSettings");
    return t("actions.save");
  }

  async function pickFile(name: string, extensions: string[]) {
    try {
      return (await open({
        multiple: false,
        filters: [{ name, extensions }],
      })) as string | null;
    } catch {
      lastError = t("errors.nativeDialogs");
      return null;
    }
  }

  async function pickDirectory(title: string) {
    try {
      return (await open({
        title,
        directory: true,
        multiple: false,
      })) as string | null;
    } catch {
      lastError = t("errors.nativeDialogs");
      return null;
    }
  }

  function safeParseSchema(source: string, format: DataFormat = "json"): JsonSchema | undefined {
    const result = parseSchemaResult(source, format);
    if (result.schema) return result.schema;
    lastError = result.error ?? t("app.noSchema");
    return undefined;
  }

  function parseSchemaResult(
    source: string,
    format: DataFormat,
  ): { schema?: JsonSchema; error?: string } {
    if (!schemaProvider) return { error: t("app.noSchema") };
    try {
      return { schema: parseSchemaWithProvider(schemaProvider, source, format) };
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) };
    }
  }

  function ensureDocumentCanSave(
    document: ConfigDocument,
    options: { quiet?: boolean } = {},
  ) {
    let parsed: JsonValue;
    try {
      parsed = parseData(document.text, {
        format: documentFormatHint(document, appConfig.editor.defaultFormat),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!options.quiet) lastError = message;
      setDocumentSaveState(document.id, "paused", message);
      problemsOpen = true;
      return false;
    }

    if (document.id === activeDocumentId && hasSchema && !schema) {
      const message = schemaParse.error ?? "The active schema is invalid.";
      if (!options.quiet) lastError = message;
      setDocumentSaveState(document.id, "paused", message);
      problemsOpen = true;
      return false;
    }

    if (document.id === activeDocumentId && schema) {
      const result = validateConfig(schema, dataWithoutDocumentMetadata(parsed));
      if (!result.valid) {
        const message = `${result.issues.length} schema validation issue${result.issues.length === 1 ? "" : "s"} must be fixed before saving.`;
        if (!options.quiet) lastError = message;
        setDocumentSaveState(document.id, "paused", message);
        problemsOpen = true;
        return false;
      }
    }

    return true;
  }

  function safeParseAppConfig(source: string) {
    try {
      return parseAppConfig(source, appConfigFormat);
    } catch {
      return parseAppConfig(sampleAppConfig);
    }
  }

  function parseDataResult(source: string, format: DataFormat): { data?: JsonValue; error?: string } {
    try {
      return { data: parseData(source, { format }) };
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) };
    }
  }

  function localizeSettingsFields(fields: FieldModel[], currentLocale: Locale): FieldModel[] {
    return fields.map((field) => {
      const titleKey = `settings.field.${field.path}`;
      const descriptionKey = `settings.description.${field.path}`;

      return {
        ...field,
        title: hasMessageKey(titleKey) ? translate(currentLocale, titleKey) : field.title,
        description: hasMessageKey(descriptionKey)
          ? translate(currentLocale, descriptionKey)
          : field.description,
        children: field.children ? localizeSettingsFields(field.children, currentLocale) : undefined,
      };
    });
  }

  function validSnapshots(configs: ConfigDocument[]) {
    return configs.flatMap((document) => {
      try {
        return [
          {
            name: document.name,
            data:
              dataWithoutDocumentMetadata(
                parseData(document.text, {
                  format: formatFromPath(formatPathForDocument(document), appConfig.editor.defaultFormat),
                }),
              ) ?? {},
          },
        ];
      } catch {
        return [];
      }
    });
  }

  function countEditableFields(nextFields: FieldModel[]): number {
    return nextFields.reduce((total, field) => {
      if (field.type === "object") {
        return total + countEditableFields(field.children ?? []);
      }

      return total + 1;
    }, 0);
  }

  function countRequiredFields(nextFields: FieldModel[]): number {
    return nextFields.reduce((total, field) => {
      const childTotal = field.type === "object" ? countRequiredFields(field.children ?? []) : 0;
      return total + childTotal + (field.required && field.type !== "object" ? 1 : 0);
    }, 0);
  }

  function shouldUseDirectUpdater(policy: AppConfig["updates"]["policy"], context: InstallContext) {
    if (!signedUpdaterConfigured) return false;
    if (policy === "manual" || policy === "package-manager") return false;
    if (policy === "signed-updater") return true;
    return context.directUpdaterEligible;
  }

  function buildFeedbackUrl(_context: string) {
    const title = encodeURIComponent("Schematica feedback");
    const body = encodeURIComponent(
      [
        "## Feedback",
        "",
        "Describe what felt rough or what should improve:",
        "",
        "## Context",
        `- version: ${appVersion}`,
        `- install source: ${installContext.sourceLabel}`,
        `- update owner: ${installContext.updateOwner}`,
        `- locale: ${locale}`,
        `- theme: ${appConfig.appearance.theme}`,
        `- palette: ${appConfig.appearance.palette}`,
        `- contrast: ${appConfig.appearance.contrast}`,
        `- motion: ${appConfig.appearance.motion}`,
        `- active format: ${activeFormat}`,
        `- schema: ${schemaDisplayLabel}`,
        `- git: ${
          gitContext.available
            ? `${gitContext.branch ?? "detached"}@${gitContext.commit ?? "unknown"} dirty=${gitContext.dirty}`
            : "unavailable"
        }`,
      ].join("\n"),
    );
    return `https://github.com/nkiyohara/schematica/issues/new?title=${title}&body=${body}`;
  }

  function fileName(path: string) {
    return path.split(/[\\/]/).at(-1) ?? path;
  }

  function compactPath(path: string) {
    const parts = path.split(/[\\/]/).filter(Boolean);
    if (parts.length <= 3) return path;
    return `.../${parts.slice(-3).join("/")}`;
  }

  function recentFileIcon(kind: RecentFileKind) {
    if (kind === "schema") return FileJson;
    if (kind === "settings") return Settings2;
    return FileInput;
  }

  function recentFileKindLabel(kind: RecentResourceKind) {
    if (kind === "schema") return t("recent.kind.schema");
    if (kind === "settings") return t("recent.kind.settings");
    return t("recent.kind.config");
  }

  function recentFileDetail(file: RecentResource) {
    return `${recentFileKindLabel(file.kind)} · ${file.format.toUpperCase()}`;
  }

  function isSshRecentResource(
    file: RecentResource,
  ): file is RecentResource & { resource: Extract<ResourceRef, { scheme: "ssh" }> } {
    return file.resource.scheme === "ssh";
  }

  function recentResourceToRemoteFile(file: RecentResource & { resource: Extract<ResourceRef, { scheme: "ssh" }> }) {
    return {
      provider: "ssh" as const,
      host: file.resource.host,
      path: file.resource.path,
      name: file.name,
      format: file.format,
      lastOpenedAt: file.lastOpenedAt,
    };
  }

  function documentSaveLabel(document: ConfigDocument) {
    if (document.saveState === "saving") return t("documents.status.saving");
    if (document.saveState === "queued") return t("documents.status.autosaveQueued");
    if (document.saveState === "paused") return t("documents.status.autosavePaused");
    if (document.saveState === "error") return t("documents.status.error");
    if (isDocumentDirty(document)) return t("documents.status.unsaved");
    if (!document.resource) return t("documents.status.draft");
    return t("documents.status.saved");
  }

  function documentSaveTone(document: ConfigDocument) {
    if (document.saveState === "error" || document.saveState === "paused") return "warn" as const;
    if (document.saveState === "queued" || document.saveState === "saving") return "accent" as const;
    if (isDocumentDirty(document)) return "warn" as const;
    if (document.resource) return "ok" as const;
    return "neutral" as const;
  }

  function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
  }

  function applyWorkspacePreferences(preferences: WorkspacePreferences) {
    selectedTab = preferences.selectedTab;
    explorerOpen = preferences.explorerOpen;
    explorerWidth = preferences.explorerWidth;
    compareOnlyChanges = preferences.compareOnlyChanges;
    compareBaselineName = preferences.compareBaselineName;
    primaryPanePercent = preferences.primaryPanePercent;
    schemaInspectorPercent = preferences.schemaInspectorPercent;
    problemsPanelHeight = preferences.problemsPanelHeight;
    problemsOpen = preferences.problemsOpen;
  }

  function shortcutLabel(key: string) {
    return formatShortcutLabel(key, shortcutMode);
  }

  function commandCategoryTitle(category: { id: string; title: string }) {
    const key = `commands.category.${category.id}`;
    return hasMessageKey(key) ? t(key) : category.title;
  }

  function resourceProvider(resource: ResourceRef): ResourceProvider {
    const provider = providerForResource(resourceProviders, resource);
    if (!provider) {
      throw new Error(`No resource provider registered for '${resource.scheme}'.`);
    }
    return provider;
  }

  function resourceProviderForScheme(scheme: ResourceRef["scheme"]): ResourceProvider {
    const provider = resourceProviders.find((candidate) => candidate.scheme === scheme);
    if (!provider) {
      throw new Error(`No resource provider registered for '${scheme}'.`);
    }
    return provider;
  }

  async function writeResource(resource: ResourceRef, contents: string) {
    const provider = resourceProvider(resource);
    if (!provider.write) {
      throw new Error(`Resource provider '${provider.id}' cannot write.`);
    }
    await provider.write(resource, contents);
  }

  function documentFormatHint(document: ConfigDocument, fallback: DataFormat) {
    if (!document.resource) return formatFromPath(document.path ?? document.name, fallback);
    return resourceProvider(document.resource).formatHint(document.resource);
  }

  function sshHostCandidateFromTarget(target: ResourceTarget): SshHostCandidate[] {
    const host = typeof target.metadata?.host === "string" ? target.metadata.host : "";
    if (!host.trim()) return [];

    return [
      {
        host,
        label: target.label,
        source: target.source === "knownHosts" ? "knownHosts" : "config",
        sourcePath:
          typeof target.metadata?.sourcePath === "string" ? target.metadata.sourcePath : undefined,
        line: typeof target.metadata?.line === "number" ? target.metadata.line : undefined,
      },
    ];
  }

  function nativeBridgeErrorMessage(error: unknown, fallback: string) {
    const message = error instanceof Error ? error.message : String(error);
    return message.includes("invoke") || message.includes("__TAURI__") ? fallback : message;
  }

  function remoteErrorMessage(error: unknown, fallback: string, resourceHost?: string) {
    const message = nativeBridgeErrorMessage(error, fallback);
    const normalized = message.toLocaleLowerCase();
    const host = resourceHost?.trim() || remoteHostInput.trim() || remoteBrowserHost || "SSH";
    const authenticationRequired =
      message.includes("SSH_AUTH_REQUIRED:") ||
      normalized.includes("ssh authentication failed") ||
      normalized.includes("permission denied");
    if (authenticationRequired) {
      remotePasswordMode = true;
      return t("remote.error.authentication", { host });
    }
    if (
      normalized.includes("host key verification failed") ||
      normalized.includes("remote host identification has changed")
    ) {
      return t("remote.error.hostKey", { host });
    }
    if (
      normalized.includes("could not resolve hostname") ||
      normalized.includes("name or service not known")
    ) {
      return t("remote.error.resolve", { host });
    }
    if (normalized.includes("connection refused")) {
      return t("remote.error.refused", { host });
    }
    if (normalized.includes("timed out") || normalized.includes("operation timed out")) {
      return t("remote.error.timeout", { host });
    }
    if (normalized.includes("no route to host") || normalized.includes("network is unreachable")) {
      return t("remote.error.unreachable", { host });
    }
    return message.replaceAll("SSH_AUTH_REQUIRED:", "").trim();
  }

  function prepareRemoteAuthentication(resource: SshResourceRef, message: string) {
    remoteHostInput = resource.host;
    remoteBrowserHost = resource.host;
    remoteBrowserPath = remoteParentPath(resource.path);
    remotePathInput = resource.path;
    remoteBrowserEntries = [];
    remoteStatus = message;
    remoteOpenDialogOpen = true;
  }
</script>

<svelte:window
  bind:innerWidth={viewportWidth}
  on:keydown={handleGlobalKeydown}
  on:beforeunload={handleBeforeUnload}
/>

<main
  class={`app-shell ${themeClass} ${explorerOpen ? "" : "explorer-collapsed"}`}
  style={workspaceStyle}
  inert={commandPaletteOpen || remoteOpenDialogOpen || schemaToolsOpen ? true : undefined}
>
  <aside class="activity-rail" aria-label={t("nav.workbench")}>
    <button
      class="activity-brand"
      on:click={() => (explorerOpen = !explorerOpen)}
      title={explorerOpen ? t("actions.closeExplorer") : t("nav.files")}
      aria-label={explorerOpen ? t("actions.closeExplorer") : t("nav.files")}
      aria-expanded={explorerOpen}
    >
      <BrandMark />
    </button>
    <nav>
      <button
        class:active={explorerOpen}
        on:click={() => (explorerOpen = !explorerOpen)}
        title={t("nav.files")}
        aria-label={t("nav.files")}
        aria-expanded={explorerOpen}
      >
        <FolderOpen size={18} />
      </button>
      {#each workbenchTabs as tab (tab.id)}
        <button
          class:active={selectedTab === tab.id}
          on:click={() => goToWorkbenchTab(tab.id)}
          title={tab.label}
          aria-label={tab.label}
          aria-pressed={selectedTab === tab.id}
        >
          <svelte:component this={tab.icon} size={18} />
        </button>
      {/each}
      <button
        class:active={showProblemsPanel}
        on:click={() => (problemsOpen = !problemsOpen)}
        title={t("actions.toggleProblems")}
        aria-label={t("actions.toggleProblems")}
        aria-pressed={showProblemsPanel}
        disabled={!problemsAvailable}
      >
        <CheckCircle2 size={18} />
      </button>
    </nav>
    <div>
      <button on:click={() => (commandPaletteOpen = true)} title={t("commands.openPalette")} aria-label={t("commands.openPalette")}>
        <Search size={18} />
      </button>
    </div>
  </aside>

  {#if explorerOpen}
    <aside class="explorer-panel">
      <header class="explorer-title">
        <div>
          <strong>Schematica</strong>
          <span>{activeFormat.toUpperCase()}</span>
        </div>
        <button on:click={() => (explorerOpen = false)} title={t("actions.closeExplorer")} aria-label={t("actions.closeExplorer")}>
          <X size={14} />
        </button>
      </header>

      <div class="explorer-toolbar" aria-label={t("nav.files")}>
        <button on:click={openConfig} title={t("actions.openConfig")} aria-label={t("actions.openConfig")}>
          <FileInput size={15} />
        </button>
        <button on:click={openDirectory} title={t("actions.openDirectory")} aria-label={t("actions.openDirectory")}>
          <FolderTree size={15} />
        </button>
        <button on:click={openRemoteDialog} title={t("actions.openRemoteConfig")} aria-label={t("actions.openRemoteConfig")}>
          <Server size={15} />
        </button>
        <button on:click={() => addDocument()} title={t("actions.newConfig")} aria-label={t("actions.newConfig")}>
          <Plus size={15} />
        </button>
        <button on:click={openSchema} title={t("actions.openSchema")} aria-label={t("actions.openSchema")}>
          <FileJson size={15} />
        </button>
      </div>

      {#if workspaceRoot}
        <section class="explorer-section">
          <div class="explorer-section-head">
            <span>{t("nav.workspace")}</span>
            <div>
              <button
                on:click={openWorkspaceParent}
                title={t("actions.parentDirectory")}
                aria-label={t("actions.parentDirectory")}
                disabled={workspaceBusy || !workspaceCanBrowseParent}
              >
                <FolderUp size={12} />
              </button>
              <button
                on:click={refreshWorkspaceDirectory}
                title={t("remote.open.refresh")}
                aria-label={t("remote.open.refresh")}
                disabled={workspaceBusy}
              >
                <RefreshCw size={12} />
              </button>
            </div>
          </div>
          <div class="workspace-root" title={resourceDisplayPath(workspaceRoot)}>
            {compactResourceDisplayPath(workspaceRoot)}
          </div>
          <div class="explorer-list">
            {#if workspaceBusy}
              <div class="explorer-empty">{t("remote.open.busy")}</div>
            {:else if workspaceStatus}
              <div class="explorer-empty warn">{workspaceStatus}</div>
            {:else if workspaceEntries.length === 0}
              <div class="explorer-empty">{t("workspace.empty")}</div>
            {:else}
              {#each workspaceEntries as entry (entry.id)}
                <div class="explorer-row">
                  <button on:click={() => selectWorkspaceEntry(entry)} title={resourceDisplayPath(entry.resource)}>
                    {#if entry.kind === "directory"}
                      <Folder size={14} />
                    {:else}
                      <FileText size={14} />
                    {/if}
                    <span>{entry.name}</span>
                    {#if entry.kind === "file"}
                      <small>{entry.size !== undefined ? `${entry.size} B` : ""}</small>
                    {/if}
                  </button>
                </div>
              {/each}
            {/if}
          </div>
        </section>
      {/if}

      <section class="explorer-section">
        <div class="explorer-section-head">
          <span>{t("meta.configs")}</span>
          <strong>{documents.length}</strong>
        </div>
        <div class="explorer-list">
          {#if documents.length === 0}
            <div class="explorer-empty">{t("app.noConfig")}</div>
          {:else}
            {#each documents as document (document.id)}
              <div class="explorer-row" class:active={document.id === activeDocumentId}>
                <button
                  data-explorer-document-id={document.id}
                  on:click={() => selectDocument(document)}
                  title={document.resource ? documentLocationLabel(document.resource) : document.name}
                >
                  <Columns3 size={14} />
                  <span>{document.name}</span>
                  {#if isDocumentDirty(document)}
                    <i aria-hidden="true"></i>
                  {/if}
                </button>
                <button
                  class="explorer-row-close"
                  on:click={() => void closeDocument(document.id)}
                  title={t("actions.closeDocument", { name: document.name })}
                  aria-label={t("actions.closeDocument", { name: document.name })}
                >
                  <X size={13} />
                </button>
              </div>
            {/each}
          {/if}
        </div>
      </section>

      {#if recentVisibleFiles.length > 0}
        <section class="explorer-section" aria-label={t("nav.recent")}>
          <div class="explorer-section-head">
            <span>{t("nav.recent")}</span>
            <button on:click={clearRecentFiles} title={t("actions.clearRecent")} aria-label={t("actions.clearRecent")}>
              <X size={12} />
            </button>
          </div>
          <div class="explorer-list">
            {#each recentVisibleFiles as file (recentResourceKey(file.resource))}
              <div class="explorer-row">
                <button on:click={() => openRecentResource(file)} title={resourceDisplayPath(file.resource)}>
                  <svelte:component this={recentFileIcon(file.kind)} size={14} />
                  <span>{file.name}</span>
                  <small>{compactResourceDisplayPath(file.resource)}</small>
                </button>
                <button
                  class="explorer-row-close"
                  on:click={(event) => forgetRecentResourceRef(file.resource, event)}
                  title={t("actions.forgetRecent", { name: file.name })}
                  aria-label={t("actions.forgetRecent", { name: file.name })}
                >
                  <X size={13} />
                </button>
              </div>
            {/each}
          </div>
        </section>
      {/if}

      {#if recentVisibleRemoteFiles.length > 0}
        <section class="explorer-section" aria-label={t("remote.recent.title")}>
          <div class="explorer-section-head">
            <span>{t("remote.recent.title")}</span>
            <button on:click={clearRecentRemoteFiles} title={t("actions.clearRecentRemote")} aria-label={t("actions.clearRecentRemote")}>
              <X size={12} />
            </button>
          </div>
          <div class="explorer-list">
            {#each recentVisibleRemoteFiles as file (recentResourceKey(file.resource))}
              <div class="explorer-row">
                <button on:click={() => openRecentResource(file)} title={resourceDisplayPath(file.resource)}>
                  <Server size={14} />
                  <span>{file.name}</span>
                  <small>{compactResourceDisplayPath(file.resource)}</small>
                </button>
                <button
                  class="explorer-row-close"
                  on:click={(event) => forgetRecentResourceRef(file.resource, event)}
                  title={t("actions.forgetRecentRemote", { name: file.name })}
                  aria-label={t("actions.forgetRecentRemote", { name: file.name })}
                >
                  <X size={13} />
                </button>
              </div>
            {/each}
          </div>
        </section>
      {/if}
    </aside>
    <!-- svelte-ignore a11y_no_interactive_element_to_noninteractive_role (focusable ARIA separator is keyboard-operable) -->
    <button
      type="button"
      class="explorer-resizer"
      role="separator"
      aria-orientation="vertical"
      aria-valuemin="200"
      aria-valuemax="480"
      aria-valuenow={Math.round(explorerWidth)}
      aria-label={t("actions.resizeExplorer")}
      title={`${t("actions.resizeExplorer")} · ${Math.round(explorerWidth)}px`}
      on:pointerdown={startExplorerResize}
      on:keydown={resizeExplorerWithKeyboard}
      on:dblclick={() => (explorerWidth = defaultWorkspacePreferences.explorerWidth)}
    ></button>
  {/if}

  <section
    class="workspace"
    class:has-problems={showProblemsPanel}
    bind:this={workspaceElement}
    bind:clientWidth={workspaceWidth}
  >
    <header class="topbar">
      <div>
        <strong>
          {activeDocument?.resource
            ? documentLocationLabel(activeDocument.resource)
            : (activeDocument?.name ?? t("app.noConfig"))}
        </strong>
        <span aria-live="polite">
          {activeDocumentSaveLabel} · {t("meta.schema")}: {schema?.title ?? schemaDisplayLabel}
        </span>
      </div>
      <div class="topbar-actions">
        <button
          class="icon-action"
          on:click={openDirectory}
          title={t("actions.openDirectory")}
          aria-label={t("actions.openDirectory")}
        >
          <FolderTree size={16} />
        </button>
        <button
          class="icon-action"
          on:click={openRemoteDialog}
          title={t("actions.openRemoteConfig")}
          aria-label={t("actions.openRemoteConfig")}
        >
          <Server size={16} />
        </button>
        <button
          class="icon-action"
          on:click={() => (commandPaletteOpen = true)}
          title={`${t("commands.openPalette")} (${shortcutLabel("K")})`}
          aria-label={t("commands.openPalette")}
        >
          <Search size={16} />
        </button>
        <button
          class="icon-action"
          class:active={rawPreviewActive}
          on:click={toggleRawPreview}
          title={t("actions.toggleRawEditor")}
          aria-label={t("actions.toggleRawEditor")}
          aria-pressed={rawPreviewActive}
          disabled={selectedTab === "editor" && schemaFreeRawView}
        >
          <Columns3 size={16} />
        </button>
        <button
          class="icon-action"
          on:click={() => (schemaToolsOpen = true)}
          title={t("actions.buildSchema")}
          aria-label={t("actions.buildSchema")}
        >
          <FileJson size={16} />
        </button>
        <button
          class="icon-action"
          on:click={saveCurrent}
          title={activeSaveLabel()}
          aria-label={activeSaveLabel()}
          disabled={selectedTab !== "settings" && (!activeDocument || activeDocument.saveState === "saving")}
        >
          <Save size={16} />
        </button>
      </div>
    </header>

    <div class:empty={documents.length === 0} class="document-tabs" role="tablist" aria-label={t("documents.openTabs")}>
      {#if documents.length === 0}
        <span>{t("app.noConfig")}</span>
      {:else}
        {#each documents as document, index (document.id)}
          <div
            class="document-tab"
            class:active={document.id === activeDocumentId}
            class:dirty={isDocumentDirty(document)}
          >
            <button
              class="document-tab-main"
              role="tab"
              aria-selected={document.id === activeDocumentId}
              tabindex={document.id === activeDocumentId ? 0 : -1}
              data-document-id={document.id}
              aria-label={`${document.name} · ${documentSaveLabel(document)}`}
              on:click={() => selectDocument(document)}
              on:keydown={(event) => handleDocumentTabKeydown(event, index)}
              title={`${document.resource ? documentLocationLabel(document.resource) : document.name} - ${documentSaveLabel(document)}`}
            >
              <Columns3 size={15} />
              <span>{document.name}</span>
              {#if isDocumentDirty(document)}
                <i aria-hidden="true"></i>
              {/if}
            </button>
            <button
              class="document-tab-close"
              on:click={() => void closeDocument(document.id)}
              title={t("actions.closeDocument", { name: document.name })}
              aria-label={t("actions.closeDocument", { name: document.name })}
            >
              <X size={14} />
            </button>
          </div>
        {/each}
      {/if}
    </div>

    <div class="content-grid" class:dual-pane={dualPane} bind:this={contentGridElement} style={contentGridStyle}>
      {#if selectedTab === "editor"}
        <section
          class:empty-workspace={!activeDocument}
          class:raw-document={schemaFreeRawView}
          class="form-pane"
        >
          {#if !activeDocument}
            <StartScreen
              title={startScreenLabels.title}
              subtitle={startScreenLabels.subtitle}
              openConfigLabel={startScreenLabels.openConfig}
              openDirectoryLabel={startScreenLabels.openDirectory}
              openRemoteLabel={startScreenLabels.openRemote}
              newConfigLabel={startScreenLabels.newConfig}
              exampleLabel={startScreenLabels.example}
              buildSchemaLabel={startScreenLabels.buildSchema}
              recentLabel={startScreenLabels.recent}
              remoteRecentLabel={startScreenLabels.remoteRecent}
              recentFiles={recentVisibleFiles}
              recentRemoteFiles={recentVisibleRemoteFiles}
              onOpenConfig={openConfig}
              onOpenDirectory={openDirectory}
              onOpenRemote={openRemoteDialog}
              onNewConfig={() => addDocument()}
              onLoadExample={loadExampleWorkspace}
              onBuildSchema={startSchemaDesigner}
              onOpenRecent={openRecentResource}
              onOpenRemoteRecent={openRecentResource}
            />
          {:else if schemaFreeRawView}
            <header class="raw-document-head">
              <div class="raw-document-title">
                <span aria-hidden="true"><FileJson size={19} /></span>
                <div>
                  <strong>{activeDocument.name}</strong>
                  <p>{schemaFreeRawReasonLabel()}</p>
                </div>
              </div>
              <div class="raw-document-meta">
                <span>{compactCount(schemaFreeAnalysis.characters)} {t("schemaFree.characters")}</span>
                {#if schemaFreeAnalysis.maxArrayLength > 0}
                  <span>{compactCount(schemaFreeAnalysis.maxArrayLength)} {t("schemaFree.arrayItems")}</span>
                {/if}
                {#if schemaFreeCanTryForm}
                  <button type="button" on:click={showSchemaFreeForm}>{t("schemaFree.tryForm")}</button>
                {/if}
              </div>
            </header>
            <div class="raw-document-editor">
              <CodeEditor
                value={configText}
                format={activeFormat}
                label={`${activeDocument.name} · ${t("schemaFree.rawDocument")}`}
                onChange={updateActiveText}
              />
            </div>
          {:else}
            <WorkbenchOverview
              title={t("overview.title")}
              documentName={activeDocument.name}
              documentPath={activeDocument.resource ? documentLocationLabel(activeDocument.resource) : t("overview.unsaved")}
              schemaLabel={schema?.title ? `${schema.title} · ${schemaDisplayLabel}` : schemaDisplayLabel}
              validationLabel={overviewValidationLabel}
              validationOk={validation?.valid ?? (!schema && configParse.data !== undefined)}
              saveLabel={activeDocumentSaveLabel}
              saveDirty={activeDocumentDirty}
              gitLabel={overviewGitLabel}
              gitDirty={gitContext.dirty}
              formatLabel={activeFormat.toUpperCase()}
              modeLabel={t("tabs.editor")}
              metrics={overviewMetrics}
              actions={overviewActions}
            />
            {#if !schema}
              <SchemaFreeNotice
                labels={schemaFreeLabels}
                existingKeys={schemaFreeRootKeys}
                inferredFieldCount={editableFieldCount}
                canAddSetting={canAddSchemaFreeSetting}
                onAddSetting={addSchemaFreeSetting}
                onCreateSchema={createSchemaFromActiveConfig}
                onOpenSchema={openSchema}
                onEditRaw={showRawEditor}
              />
            {/if}
            {#each fields as field (field.path)}
              <svelte:component
                this={fieldComponent(field)}
                {field}
                data={dataForFields}
                issues={activeValidationIssues}
                labels={fieldEditorLabels}
                onChange={setValue}
                onUnset={unsetValue}
              />
            {/each}
          {/if}
        </section>
      {:else if selectedTab === "compare"}
        <CompareMatrix
          rows={diffRows}
          {documents}
          summary={diffSummary}
          onlyChanges={compareOnlyChanges}
          baselineName={compareBaselineName}
          labels={compareLabels}
          onOnlyChangesChange={(value) => (compareOnlyChanges = value)}
          onBaselineChange={(value) => (compareBaselineName = value)}
          onAddConfig={() => addDocument()}
        />
      {:else}
        <section class="settings-pane">
          <AppearancePanel
            appearance={appConfig.appearance}
            {effectiveDark}
            presets={appearancePresets}
            activePresetId={activeAppearancePreset}
            presetChanges={appearancePresetChanges}
            labels={{
              eyebrow: t("appearance.eyebrow"),
              title: t("settings.field.appearance"),
              profile: t("appearance.profile"),
              "profile.custom": t("appearance.profile.custom"),
              "profile.active": t("appearance.profile.active"),
              "profile.changes": t("appearance.profile.changes"),
              "preset.balanced.title": t("appearance.preset.balanced.title"),
              "preset.balanced.detail": t("appearance.preset.balanced.detail"),
              "preset.focus.title": t("appearance.preset.focus.title"),
              "preset.focus.detail": t("appearance.preset.focus.detail"),
              "preset.studio.title": t("appearance.preset.studio.title"),
              "preset.studio.detail": t("appearance.preset.studio.detail"),
              "preset.research.title": t("appearance.preset.research.title"),
              "preset.research.detail": t("appearance.preset.research.detail"),
              "preset.review.title": t("appearance.preset.review.title"),
              "preset.review.detail": t("appearance.preset.review.detail"),
              theme: t("settings.field.appearance.theme"),
              "theme.system.title": t("appearance.theme.system.title"),
              "theme.system.detail": t("appearance.theme.system.detail"),
              "theme.light.title": t("appearance.theme.light.title"),
              "theme.light.detail": t("appearance.theme.light.detail"),
              "theme.dark.title": t("appearance.theme.dark.title"),
              "theme.dark.detail": t("appearance.theme.dark.detail"),
              currentMode: t("appearance.currentMode"),
              light: t("appearance.light"),
              dark: t("appearance.dark"),
              preview: t("appearance.preview"),
              previewTitle: t("appearance.previewTitle"),
              sampleKey: t("appearance.sampleKey"),
              sampleValue: t("appearance.sampleValue"),
              palette: t("settings.field.appearance.palette"),
              accent: t("settings.field.appearance.accent"),
              customAccent: t("appearance.customAccent"),
              invalidAccent: t("appearance.invalidAccent"),
              density: t("settings.field.appearance.density"),
              contrast: t("settings.field.appearance.contrast"),
              "contrast.standard": t("appearance.contrast.standard"),
              "contrast.high": t("appearance.contrast.high"),
              motion: t("settings.field.appearance.motion"),
              "motion.system": t("appearance.motion.system"),
              "motion.reduced": t("appearance.motion.reduced"),
              "motion.full": t("appearance.motion.full"),
              accessibility: t("appearance.accessibility"),
              typography: t("appearance.typography"),
              fontFamily: t("settings.field.appearance.fontFamily"),
              monoFontFamily: t("settings.field.appearance.monoFontFamily"),
              customFont: t("appearance.customFont"),
              invalidFont: t("appearance.invalidFont"),
              fontSize: t("settings.field.appearance.fontSize"),
              fontSizeValue: t("appearance.fontSizeValue"),
              cornerRadius: t("settings.field.appearance.cornerRadius"),
              radiusValue: t("appearance.radiusValue"),
            }}
            onChange={setAppConfigValue}
            onPreset={applyAppearancePreset}
          />
          <section class="settings-state-card">
            <div>
              <h2>{t("settings.persistence.title")}</h2>
              <p>{t("settings.persistence.subtitle")}</p>
            </div>
            <div class="settings-state-grid">
              <span>{t("settings.persistence.origin")}</span>
              <strong>{appConfigSourceLabel}</strong>
              <span>{t("settings.persistence.file")}</span>
              <code>{appConfigPath ?? t("settings.persistence.unsavedFile")}</code>
              <span>{t("settings.persistence.local")}</span>
              <strong class:ok={appConfigCanPersist} class:warn={!appConfigCanPersist}>
                {appConfigDisplayStatus}
              </strong>
            </div>
            <div class="settings-state-actions">
              <button on:click={openAppConfig}>
                <FolderOpen size={16} />
                <span>{t("actions.openSettings")}</span>
              </button>
              <button on:click={() => saveAppConfig()} disabled={!appConfigCanPersist}>
                <Save size={16} />
                <span>{t("actions.saveSettings")}</span>
              </button>
              <button on:click={exportAppConfig} disabled={!appConfigCanPersist}>
                <Download size={16} />
                <span>{t("actions.exportSettings")}</span>
              </button>
              <button on:click={() => void resetAppConfig()}>
                <RotateCcw size={16} />
                <span>{t("actions.resetSettings")}</span>
              </button>
            </div>
          </section>
          <section class="update-card">
            <div>
              <h2>{t("updates.title")}</h2>
              <p>{t("updates.subtitle")}</p>
            </div>
            <div class="update-grid">
              <span>{t("updates.installSource")}</span>
              <strong>{installContext.sourceLabel}</strong>
              <span>{t("updates.updateOwner")}</span>
              <strong>{installContext.updateOwner}</strong>
              <span>{t("updates.updateMethod")}</span>
              <code>{updateMethod}</code>
            </div>
            <div class="update-actions">
              <button on:click={checkForUpdates} disabled={updateBusy}>
                <RefreshCw size={16} />
                <span>{updateBusy ? t("updates.checking") : t("updates.checkNow")}</span>
              </button>
              {#if updateStatus}
                <span>{updateStatus}</span>
              {:else if directUpdaterEnabled}
                <span>{t("updates.directStatus")}</span>
              {:else}
                <span>{t("updates.packageManagedStatus")}</span>
              {/if}
            </div>
          </section>
          {#if appConfig.features.feedback}
            <section class="feedback-card">
              <div>
                <h2>{t("feedback.title")}</h2>
                <p>{t("feedback.subtitle")}</p>
              </div>
              <button on:click={sendFeedback}>
                <Bug size={16} />
                <span>{t("feedback.openIssue")}</span>
              </button>
            </section>
          {/if}
          {#each settingsFormFields as field (field.path)}
            <svelte:component
              this={fieldComponent(field)}
              {field}
              data={appConfigData}
              issues={settingsValidationIssues}
              labels={fieldEditorLabels}
              onChange={setAppConfigValue}
              onUnset={unsetAppConfigValue}
            />
          {/each}
        </section>
      {/if}

      {#if dualPane}
        <!-- svelte-ignore a11y_no_interactive_element_to_noninteractive_role (focusable ARIA separator is keyboard-operable) -->
        <button
          type="button"
          class="pane-resizer"
          class:horizontal={narrowPaneLayout}
          class:vertical={!narrowPaneLayout}
          role="separator"
          aria-orientation={narrowPaneLayout ? "horizontal" : "vertical"}
          aria-valuemin="20"
          aria-valuemax="80"
          aria-valuenow={Math.round(primaryPanePercent)}
          aria-label={t("actions.resizeEditorPanes")}
          title={`${t("actions.resizeEditorPanes")} · ${Math.round(primaryPanePercent)}%`}
          on:pointerdown={startPaneResize}
          on:keydown={resizePaneWithKeyboard}
          on:dblclick={() => (primaryPanePercent = defaultWorkspacePreferences.primaryPanePercent)}
        ></button>
        <section class="editor-pane">
          <div class="pane-head">
            <strong>{rawPaneTitle}</strong>
            <button on:click={toggleRawPreview} title={t("actions.closeRawEditor")} aria-label={t("actions.closeRawEditor")}>
              <X size={15} />
            </button>
          </div>
          <CodeEditor
            value={rawPaneText}
            format={rawPaneFormat}
            label={rawPaneTitle}
            onChange={updateRawPaneText}
          />
        </section>
      {/if}
    </div>

    {#if showProblemsPanel}
      <!-- svelte-ignore a11y_no_interactive_element_to_noninteractive_role (focusable ARIA separator is keyboard-operable) -->
      <button
        type="button"
        class="problems-resizer"
        role="separator"
        aria-orientation="horizontal"
        aria-valuemin="72"
        aria-valuemax="420"
        aria-valuenow={Math.round(problemsPanelHeight)}
        aria-label={t("actions.resizeProblems")}
        title={`${t("actions.resizeProblems")} · ${Math.round(problemsPanelHeight)}px`}
        on:pointerdown={startProblemsResize}
        on:keydown={resizeProblemsWithKeyboard}
        on:dblclick={() =>
          (problemsPanelHeight = defaultWorkspacePreferences.problemsPanelHeight)}
      ></button>
      <footer class="problems">
        {#if selectedTab === "settings" && appConfigParse.error}
          <div class="problem error">{appConfigParse.error}</div>
        {:else if selectedTab === "settings" && appConfigValidation && !appConfigValidation.valid}
          {#each appConfigValidation.issues as issue}
            <div class="problem">
              <span>{issue.keyword}</span>
              <code>{issue.path}</code>
              <strong>{issue.message}</strong>
            </div>
          {/each}
        {:else if selectedTab === "settings"}
          <div class="problem ok">{t("problems.noIssues")}</div>
        {:else if lastError}
          <div class="problem error">{lastError}</div>
        {:else if configParse.error}
          <div class="problem error">{configParse.error}</div>
        {:else if schemaParse.error}
          <div class="problem error">{schemaParse.error}</div>
        {:else if !schema}
          <div class="problem ok">
            {schemaFreeRawView ? schemaFreeRawReasonLabel() : t("schemaFree.validationDetail")}
          </div>
        {:else if validation && !validation.valid}
          {#each validation.issues as issue}
            <div class="problem">
              <span>{issue.keyword}</span>
              <code>{issue.path}</code>
              <strong>{issue.message}</strong>
            </div>
          {/each}
        {:else}
          <div class="problem ok">{t("problems.noIssues")}</div>
        {/if}
      </footer>
    {/if}

    <footer class="status-bar">
      <span
        class="status-item status-location"
        title={activeDocument?.resource ? resourceDisplayPath(activeDocument.resource) : activeDocument?.name}
      >
        <strong>{t("meta.config")}</strong>
        <span class="status-value">
          {activeDocument?.resource
            ? compactResourceDisplayPath(activeDocument.resource)
            : (activeDocument?.name ?? t("app.noConfig"))}
        </span>
      </span>
      {#if activeDocument}
        <span class="status-item status-format" class:warn={activeDocumentDirty}>
          {activeFormat.toUpperCase()} · {activeDocumentSaveLabel}
        </span>
      {/if}
      {#if activeDocumentSchemaReference}
        <span
          class="status-item status-schema-reference"
          title={activeDocumentSchemaReference}
        >
          <strong>$schema</strong>
          <span class="status-value">{activeDocumentSchemaReference}</span>
        </span>
      {/if}
      <button
        class="status-item status-schema"
        on:click={() => (schemaToolsOpen = true)}
        title={schemaDisplayLabel}
      >
        <strong>{t("meta.schema")}</strong>
        <span class="status-value">
          {schema?.title ? `${schema.title} · ${schemaDisplayLabel}` : schemaDisplayLabel}
        </span>
      </button>
      {#if activeDocument}
        <button
          class="status-item status-validation"
          class:warn={Boolean(configParse.error || (validation && !validation.valid))}
          on:click={() => (problemsOpen = true)}
        >
          <strong>{t("meta.validation")}</strong>
          <span class="status-value">
            {configParse.error
              ? t("status.issues", { count: 1 })
              : !schema
                ? schemaFreeRawView
                  ? t("schemaFree.rawDocument")
                  : t("schemaFree.status")
                : validation?.valid
                  ? t("status.valid")
                  : t("status.issues", { count: validation?.issues.length ?? 0 })}
          </span>
        </button>
      {/if}
      <span class="status-item status-git" class:warn={gitContext.dirty}>
        <strong>{t("meta.git")}</strong>
        <span class="status-value">
          {appConfig.features.git
            ? gitContext.available
              ? gitContext.dirty
                ? t("meta.gitDirty", { count: gitContext.changedFiles })
                : (gitContext.branch ?? t("meta.detached"))
              : t("meta.unavailable")
            : t("meta.disabled")}
        </span>
      </span>
    </footer>
  </section>
</main>

<div class={`palette-root ${themeClass}`} style={workspaceStyle}>
  {#if schemaToolsOpen}
    <section class="schema-modal-backdrop" role="presentation" on:mousedown={() => (schemaToolsOpen = false)}>
      <div
        class="schema-modal"
        bind:this={schemaModalElement}
        role="dialog"
        aria-modal="true"
        aria-label={t("actions.buildSchema")}
        tabindex="-1"
        on:mousedown|stopPropagation
        on:keydown={handleSchemaModalKeydown}
      >
        <header class="schema-modal-head">
          <div>
            <strong>{t("actions.buildSchema")}</strong>
            <span>{schemaDisplayLabel}</span>
          </div>
          <button on:click={() => (schemaToolsOpen = false)} title={t("remote.open.cancel")} aria-label={t("remote.open.cancel")}>
            <X size={16} />
          </button>
        </header>
        <section
          class="schema-pane"
          bind:this={schemaPaneElement}
          style={schemaPaneStyle}
        >
          <section class="schema-inspector">
            <div class="schema-inspector-head">
              <div>
                <span>{t("schemaCoverage.eyebrow")}</span>
                <h2>{t("schemaCoverage.title")}</h2>
              </div>
              {#if schemaCoverage?.totals.unsupported}
                <AlertTriangle size={18} />
              {:else}
                <ShieldCheck size={18} />
              {/if}
            </div>
            {#if schemaCoverage}
              <div class="coverage-summary">
                <div>
                  <span>{t("schemaCoverage.dialect")}</span>
                  <strong>{schemaCoverage.dialectLabel}</strong>
                </div>
                <div>
                  <span>{t("schemaCoverage.validation")}</span>
                  <strong>{schemaCoverage.validation.engine}</strong>
                </div>
                <div>
                  <span>{t("schemaCoverage.form")}</span>
                  <strong class:ok={schemaCoverage.totals.unsupported === 0} class:warn={schemaCoverage.totals.unsupported > 0}>
                    {schemaCoverageLabel}
                  </strong>
                </div>
              </div>
              <p>{schemaCoverage.validation.detail}</p>
              <div class="coverage-lists">
                <section>
                  <h3>{t("schemaCoverage.validatedOnlyKeywords")}</h3>
                  <p>{t("schemaCoverage.validatedOnlyDetail")}</p>
                  {#if schemaCoverageValidatedOnly.length > 0}
                    <div class="coverage-list">
                      {#each schemaCoverageValidatedOnly as item (item.keyword)}
                        <div class="coverage-item">
                          <code>{item.keyword}</code>
                          <span>{t("schemaCoverage.keywordCount", { count: item.count })}</span>
                          <p>{item.detail}</p>
                        </div>
                      {/each}
                    </div>
                  {:else}
                    <div class="coverage-empty">{t("schemaCoverage.none")}</div>
                  {/if}
                </section>
                <section>
                  <h3>{t("schemaCoverage.unsupportedKeywords")}</h3>
                  <p>{t("schemaCoverage.unsupportedDetail")}</p>
                  {#if schemaCoverageUnsupported.length > 0}
                    <div class="coverage-list">
                      {#each schemaCoverageUnsupported as item (item.keyword)}
                        <div class="coverage-item warn">
                          <code>{item.keyword}</code>
                          <span>{t("schemaCoverage.keywordCount", { count: item.count })}</span>
                          <p>{item.detail}</p>
                        </div>
                      {/each}
                    </div>
                  {:else}
                    <div class="coverage-empty">{t("schemaCoverage.none")}</div>
                  {/if}
                </section>
              </div>
            {:else}
              <p>{t("app.noSchema")}</p>
            {/if}
          </section>
          <!-- svelte-ignore a11y_no_interactive_element_to_noninteractive_role (focusable ARIA separator is keyboard-operable) -->
          <button
            type="button"
            class="schema-resizer"
            class:horizontal={narrowPaneLayout}
            class:vertical={!narrowPaneLayout}
            role="separator"
            aria-orientation={narrowPaneLayout ? "horizontal" : "vertical"}
            aria-valuemin="20"
            aria-valuemax="65"
            aria-valuenow={Math.round(schemaInspectorPercent)}
            aria-label={t("actions.resizeSchemaPanes")}
            title={`${t("actions.resizeSchemaPanes")} · ${Math.round(schemaInspectorPercent)}%`}
            on:pointerdown={startSchemaPaneResize}
            on:keydown={resizeSchemaPaneWithKeyboard}
            on:dblclick={() =>
              (schemaInspectorPercent = defaultWorkspacePreferences.schemaInspectorPercent)}
          ></button>
          <section class="editor-pane schema-editor-pane">
            <div class="pane-head">
              <strong>{schemaEditorMode === "designer" ? t("schemaDesigner.eyebrow") : t("panes.schema")}</strong>
              <div class="segmented compact">
                <button
                  class:active={schemaEditorMode === "designer"}
                  on:click={useSchemaDesignerFromJson}
                >
                  {t("schemaDesigner.useDesigner")}
                </button>
                <button
                  class:active={schemaEditorMode === "json"}
                  on:click={() => (schemaEditorMode = "json")}
                >
                  JSON
                </button>
              </div>
            </div>
            {#if schemaEditorMode === "designer"}
              <div class="schema-designer-scroll">
                <SchemaDesigner
                  draft={schemaDesignerDraft}
                  schemaDirty={schemaNeedsSave}
                  labels={schemaDesignerLabels}
                  onChange={applySchemaDesignerDraft}
                  onUseJson={() => (schemaEditorMode = "json")}
                  onNewConfig={() => addDocument()}
                  onSaveSchema={() => saveSchema()}
                />
              </div>
            {:else}
              <CodeEditor
                value={schemaText}
                format={schemaFormat}
                label={t("panes.schema")}
                onChange={(value) => {
                  schemaText = value;
                  syncSchemaDesignerFromText(value, schemaFormat);
                }}
              />
            {/if}
          </section>
        </section>
      </div>
    </section>
  {/if}
  <RemoteOpenDialog
    open={remoteOpenDialogOpen}
    host={remoteHostInput}
    path={remotePathInput}
    hosts={remoteHostOptions}
    recentFiles={recentVisibleRemoteFiles}
    browserEntries={remoteBrowserEntries}
    browserPath={remoteBrowserPath}
    busy={remoteBusy}
    hostsBusy={remoteHostsBusy}
    browserBusy={remoteBrowserBusy}
    error={remoteStatus}
    password={remotePassword}
    passwordMode={remotePasswordMode}
    passwordStored={remotePasswordHosts.has(remoteHostInput.trim())}
    labels={remoteOpenLabels}
    onClose={closeRemoteDialog}
    onRefresh={refreshSshHosts}
    onOpen={openRemotePathFromInputs}
    onOpenDirectory={openRemoteDirectoryFromInputs}
    onOpenRecent={openRemoteRecentFromDialog}
    onBrowsePath={browseRemotePath}
    onSelectBrowserEntry={selectRemoteBrowserEntry}
    onHostChange={updateRemoteHost}
    onHostSelect={selectRemoteHost}
    onPathChange={(value) => (remotePathInput = value)}
    onPasswordChange={(value) => (remotePassword = value)}
    onShowPassword={showRemotePassword}
    onCancelPassword={cancelRemotePassword}
    onAuthenticate={authenticateRemoteHost}
    onForgetPassword={forgetRemotePassword}
  />
  <CommandPalette
    open={commandPaletteOpen}
    commands={paletteActions}
    label={t("commands.paletteTitle")}
    placeholder={t("commands.palettePlaceholder")}
    emptyText={t("commands.paletteEmpty")}
    resultsLabel={t("commands.paletteResults")}
    commandListLabel={t("commands.paletteList")}
    categoryLabels={commandCategoryLabels}
    categoryOrder={commandCategoryOrder}
    onClose={() => (commandPaletteOpen = false)}
    onExecute={executePaletteAction}
  />
</div>
