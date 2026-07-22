<script lang="ts">
  import { tick } from "svelte";
  import FileText from "@lucide/svelte/icons/file-text";
  import Folder from "@lucide/svelte/icons/folder";
  import FolderOpen from "@lucide/svelte/icons/folder-open";
  import FolderUp from "@lucide/svelte/icons/folder-up";
  import History from "@lucide/svelte/icons/history";
  import KeyRound from "@lucide/svelte/icons/key-round";
  import RefreshCw from "@lucide/svelte/icons/refresh-cw";
  import Search from "@lucide/svelte/icons/search";
  import Server from "@lucide/svelte/icons/server";
  import X from "@lucide/svelte/icons/x";
  import {
    compactResourceDisplayPath,
    resourceDisplayPath,
    type RecentResource,
  } from "./resource-history";
  import {
    filterRemoteHostOptions,
    remoteParentPath,
    type RemoteHostOption,
  } from "./remote-sources";
  import type { ResourceEntry, ResourceRef } from "./plugins/types";

  interface RemoteOpenLabels {
    title: string;
    host: string;
    path: string;
    open: string;
    openDirectory: string;
    cancel: string;
    refresh: string;
    recent: string;
    discovered: string;
    emptyHosts: string;
    emptyRecent: string;
    busy: string;
    hostPlaceholder: string;
    pathPlaceholder: string;
    sourceRecent: string;
    sourceConfig: string;
    sourceKnown: string;
    filterHosts: string;
    filterHostsPlaceholder: string;
    hostCount: string;
    recentCount: string;
    browser: string;
    browserEmpty: string;
    browserNoEntries: string;
    browserLoading: string;
    browserParent: string;
    authentication: string;
    keyAuthentication: string;
    keyAuthenticationDetail: string;
    passwordAuthentication: string;
    password: string;
    passwordPlaceholder: string;
    passwordDetail: string;
    passwordStored: string;
    usePassword: string;
    changePassword: string;
    connect: string;
    forgetPassword: string;
    backToKey: string;
  }

  type RemoteBrowserEntry = ResourceEntry<Extract<ResourceRef, { scheme: "ssh" }>>;

  export let open = false;
  export let host = "";
  export let path = "";
  export let hosts: RemoteHostOption[] = [];
  export let recentFiles: RecentResource[] = [];
  export let browserEntries: RemoteBrowserEntry[] = [];
  export let browserPath = "";
  export let busy = false;
  export let hostsBusy = false;
  export let browserBusy = false;
  export let error = "";
  export let password = "";
  export let passwordMode = false;
  export let passwordStored = false;
  export let labels: RemoteOpenLabels;
  export let onClose: () => void;
  export let onRefresh: () => void | Promise<void>;
  export let onOpen: (path?: string) => void | Promise<void>;
  export let onOpenDirectory: (path?: string) => void | Promise<void>;
  export let onOpenRecent: (file: RecentResource) => void | Promise<void>;
  export let onBrowsePath: (path: string) => void | Promise<void>;
  export let onSelectBrowserEntry: (entry: RemoteBrowserEntry) => void | Promise<void>;
  export let onHostChange: (value: string) => void;
  export let onHostSelect: (value: string) => void | Promise<void>;
  export let onPathChange: (value: string) => void;
  export let onPasswordChange: (value: string) => void;
  export let onShowPassword: () => void;
  export let onCancelPassword: () => void | Promise<void>;
  export let onAuthenticate: () => void | Promise<void>;
  export let onForgetPassword: () => void | Promise<void>;

  let hostInput: HTMLInputElement;
  let passwordInput: HTMLInputElement;
  let browserListElement: HTMLDivElement;
  let dialogElement: HTMLDivElement;
  let hostFilter = "";
  let previouslyFocused: HTMLElement | null = null;
  let wasOpen = false;
  let wasPasswordMode = false;

  $: selectedBrowserEntry = browserEntries.find((entry) => entry.resource.path === path);
  $: pathTargetsDirectory =
    selectedBrowserEntry?.kind === "directory" ||
    (browserPath.trim().length > 0 && path.trim() === browserPath.trim());
  $: canOpen =
    !passwordMode &&
    host.trim().length > 0 &&
    path.trim().length > 0 &&
    !pathTargetsDirectory &&
    !busy;
  $: canOpenDirectory =
    !passwordMode &&
    host.trim().length > 0 &&
    (browserPath.trim().length > 0 || path.trim().length > 0) &&
    !busy;
  $: filteredHosts = filterRemoteHostOptions(hosts, hostFilter);
  $: hostCountText = labels.hostCount.replace("{visible}", String(filteredHosts.length)).replace("{total}", String(hosts.length));
  $: recentCountText = labels.recentCount.replace("{count}", String(recentFiles.length));
  $: browserDisplayPath = browserBusy
    ? path.trim() || browserPath || "~"
    : browserPath || path || "~";
  $: parentBrowsePath = remoteParentPath(browserPath || path || "~");
  $: canBrowseParent = Boolean(browserPath) && parentBrowsePath !== browserPath;
  $: canAuthenticate = host.trim().length > 0 && password.length > 0 && !busy && !browserBusy;
  $: {
    if (open && !wasOpen) void focusHostInput();
    if (!open && wasOpen) {
      hostFilter = "";
      void restorePreviousFocus();
    }
    wasOpen = open;
  }
  $: {
    if (open && passwordMode && !wasPasswordMode) void focusPasswordInput();
    wasPasswordMode = passwordMode;
  }

  async function focusHostInput() {
    if (!previouslyFocused) previouslyFocused = document.activeElement as HTMLElement | null;
    await tick();
    hostInput?.focus();
  }

  async function focusPasswordInput() {
    await tick();
    passwordInput?.focus();
  }

  function close() {
    if (busy) return;
    onClose();
  }

  async function restorePreviousFocus() {
    await tick();
    previouslyFocused?.focus();
    previouslyFocused = null;
  }

  function submit() {
    if (passwordMode) {
      if (canAuthenticate) void onAuthenticate();
      return;
    }
    if (canOpen) void onOpen();
  }

  function browsePathInput() {
    void onBrowsePath(path.trim() || "~");
  }

  function refreshBrowser() {
    void onBrowsePath(browserPath.trim() || path.trim() || "~");
  }

  function browseParent() {
    if (canBrowseParent) void onBrowsePath(parentBrowsePath);
  }

  function selectBrowserEntry(entry: RemoteBrowserEntry) {
    void onSelectBrowserEntry(entry);
  }

  async function openBrowserEntry(entry: RemoteBrowserEntry) {
    if (entry.kind === "directory") {
      await onBrowsePath(entry.resource.path);
      await tick();
      const firstEntry = browserListElement?.querySelector<HTMLButtonElement>("button");
      (firstEntry ?? browserListElement)?.focus();
      return;
    }
    void onSelectBrowserEntry(entry);
    void onOpen(entry.resource.path);
  }

  function handleBrowserEntryKeydown(event: KeyboardEvent, entry: RemoteBrowserEntry) {
    if (event.key === "Enter" || (event.key === "ArrowRight" && entry.kind === "directory")) {
      event.preventDefault();
      void openBrowserEntry(entry);
      return;
    }
    focusSiblingButton(event);
  }

  function openSelectedDirectory() {
    const targetPath = selectedBrowserEntry?.kind === "directory"
      ? selectedBrowserEntry.resource.path
      : browserPath.trim() || path.trim() || "~";
    void onOpenDirectory(targetPath);
  }

  function selectHost(option: RemoteHostOption) {
    hostFilter = "";
    void onHostSelect(option.host);
  }

  function handleHostInput(event: Event & { currentTarget: HTMLInputElement }) {
    const value = event.currentTarget.value;
    onHostChange(value);
    if (hosts.some((option) => option.host === value.trim())) {
      void onHostSelect(value);
    }
  }

  function handleHostCommit(event: Event & { currentTarget: HTMLInputElement }) {
    void onHostSelect(event.currentTarget.value);
  }

  function handleHostKeydown(event: KeyboardEvent) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    void onHostSelect(hostInput.value);
  }

  function handleHostOptionKeydown(event: KeyboardEvent) {
    focusSiblingButton(event);
  }

  function focusSiblingButton(event: KeyboardEvent) {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    const current = event.currentTarget as HTMLButtonElement;
    const buttons = [...(current.parentElement?.querySelectorAll<HTMLButtonElement>("button") ?? [])];
    const index = buttons.indexOf(current);
    if (index < 0 || buttons.length === 0) return;
    event.preventDefault();
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? buttons.length - 1
        : event.key === "ArrowDown"
          ? Math.min(buttons.length - 1, index + 1)
          : Math.max(0, index - 1);
    buttons[nextIndex]?.focus();
  }

  function handleDialogKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== "Tab" || !dialogElement) return;
    const focusable = [...dialogElement.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )];
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable.at(-1)!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function hostDetail(option: RemoteHostOption) {
    if (option.source === "recent") return labels.sourceRecent;
    if (option.source === "config") return labels.sourceConfig;
    return labels.sourceKnown;
  }

</script>

{#if open}
  <section class="remote-backdrop" role="presentation" on:mousedown={close}>
    <div
      class="remote-dialog"
      bind:this={dialogElement}
      role="dialog"
      aria-modal="true"
      aria-labelledby="remote-dialog-title"
      tabindex="-1"
      on:mousedown|stopPropagation
      on:keydown={handleDialogKeydown}
    >
      <form on:submit|preventDefault={submit}>
        <header>
          <div>
            <span>
              <Server size={17} />
            </span>
            <strong id="remote-dialog-title">{labels.title}</strong>
          </div>
          <button type="button" on:click={close} disabled={busy} aria-label={labels.cancel} title={labels.cancel}>
            <X size={16} />
          </button>
        </header>

        <section class="remote-fields">
          <label>
            <span>{labels.host}</span>
            <input
              bind:this={hostInput}
              value={host}
              list="schematica-ssh-hosts"
              placeholder={labels.hostPlaceholder}
              spellcheck="false"
              autocomplete="off"
              disabled={busy}
              on:input={handleHostInput}
              on:change={handleHostCommit}
              on:keydown={handleHostKeydown}
            />
          </label>
          <label>
            <span>{labels.path}</span>
            <div class="path-control">
              <input
                value={path}
                placeholder={labels.pathPlaceholder}
                spellcheck="false"
                autocomplete="off"
                disabled={busy}
                on:input={(event) => onPathChange(event.currentTarget.value)}
              />
              <button type="button" on:click={browsePathInput} disabled={busy || browserBusy || !host.trim()} title={labels.browser} aria-label={labels.browser}>
                <FolderOpen size={15} />
              </button>
            </div>
          </label>
          <datalist id="schematica-ssh-hosts">
            {#each hosts as option (option.host)}
              <option value={option.host}>{option.label}</option>
            {/each}
          </datalist>
        </section>

        <section class="remote-auth" aria-label={labels.authentication}>
          <span class="auth-icon"><KeyRound size={16} /></span>
          {#if passwordMode}
            <label class="password-field">
              <span>{labels.password}</span>
              <input
                bind:this={passwordInput}
                type="password"
                value={password}
                placeholder={labels.passwordPlaceholder}
                autocomplete="current-password"
                disabled={busy || browserBusy}
                on:input={(event) => onPasswordChange(event.currentTarget.value)}
              />
              <small title={labels.passwordDetail}>{labels.passwordDetail}</small>
            </label>
            <div class="auth-actions">
              <button type="button" on:click={onCancelPassword} disabled={busy || browserBusy}>
                {labels.backToKey}
              </button>
              <button class="primary" type="button" on:click={onAuthenticate} disabled={!canAuthenticate}>
                {browserBusy ? labels.busy : labels.connect}
              </button>
            </div>
          {:else}
            <div class="auth-summary">
              <strong>{passwordStored ? labels.passwordAuthentication : labels.keyAuthentication}</strong>
              <small title={passwordStored ? labels.passwordStored : labels.keyAuthenticationDetail}>
                {passwordStored ? labels.passwordStored : labels.keyAuthenticationDetail}
              </small>
            </div>
            <div class="auth-actions">
              {#if passwordStored}
                <button type="button" on:click={onForgetPassword} disabled={busy || browserBusy}>
                  {labels.forgetPassword}
                </button>
              {/if}
              <button type="button" on:click={onShowPassword} disabled={busy || browserBusy || !host.trim()}>
                {passwordStored ? labels.changePassword : labels.usePassword}
              </button>
            </div>
          {/if}
        </section>

        {#if error}
          <div class="remote-error" role="alert">{error}</div>
        {/if}

        <section class="remote-workspace">
          <aside class="remote-sources">
            <section class="source-panel host-panel" aria-label={labels.discovered}>
              <div class="remote-list-head">
                <span>{labels.discovered}</span>
                <div>
                  <small>{hostCountText}</small>
                  <button type="button" on:click={onRefresh} disabled={busy || hostsBusy} title={labels.refresh} aria-label={labels.refresh}>
                    <RefreshCw size={14} />
                  </button>
                </div>
              </div>
              <label class="host-filter">
                <span class="sr-only">{labels.filterHosts}</span>
                <Search size={14} />
                <input bind:value={hostFilter} placeholder={labels.filterHostsPlaceholder} autocomplete="off" spellcheck="false" disabled={busy || hostsBusy} />
              </label>
              <div class="host-list" role="listbox" aria-label={labels.discovered}>
                {#if hostsBusy}
                  <div class="empty-list" aria-live="polite">{labels.busy}</div>
                {:else if filteredHosts.length > 0}
                  {#each filteredHosts as option (option.host)}
                    <button
                      type="button"
                      role="option"
                      disabled={busy}
                      aria-selected={option.host === host}
                      class:active={option.host === host}
                      on:click={() => selectHost(option)}
                      on:keydown={handleHostOptionKeydown}
                      title={option.sourcePath ? `${hostDetail(option)} · ${option.sourcePath}` : hostDetail(option)}
                    >
                      <Server size={14} />
                      <span>
                        <strong>{option.label}</strong>
                        <small>{hostDetail(option)}</small>
                      </span>
                    </button>
                  {/each}
                {:else}
                  <div class="empty-list">{labels.emptyHosts}</div>
                {/if}
              </div>
            </section>

            <section class="source-panel recent-panel" aria-label={labels.recent}>
              <div class="remote-list-head">
                <span>{labels.recent}</span>
                <small>{recentCountText}</small>
              </div>
              <div class="host-list">
                {#if recentFiles.length > 0}
                  {#each recentFiles as file (resourceDisplayPath(file.resource))}
                    <button type="button" on:click={() => onOpenRecent(file)} title={resourceDisplayPath(file.resource)} disabled={busy}>
                      <History size={14} />
                      <span>
                        <strong>{file.name}</strong>
                        <small>{compactResourceDisplayPath(file.resource)}</small>
                      </span>
                    </button>
                  {/each}
                {:else}
                  <div class="empty-list">{labels.emptyRecent}</div>
                {/if}
              </div>
            </section>
          </aside>

          <section class="remote-browser" aria-label={labels.browser}>
            <div class="remote-list-head">
              <span>{labels.browser}</span>
              <div>
                {#if browserBusy}<small role="status">{labels.browserLoading}</small>{/if}
                <button type="button" on:click={browseParent} disabled={busy || browserBusy || !canBrowseParent} title={labels.browserParent} aria-label={labels.browserParent}>
                  <FolderUp size={14} />
                </button>
                <button type="button" on:click={refreshBrowser} disabled={busy || browserBusy || !host.trim()} title={labels.refresh} aria-label={labels.refresh}>
                  <RefreshCw size={14} />
                </button>
              </div>
            </div>
            <div class="browser-path" title={browserDisplayPath}>{browserDisplayPath}</div>
            <div class="browser-list" bind:this={browserListElement} tabindex="-1" aria-busy={browserBusy}>
              {#if browserEntries.length > 0}
                {#each browserEntries as entry (entry.id)}
                  <button
                    type="button"
                    disabled={busy || browserBusy}
                    class:selected={entry.resource.path === path}
                    on:click={() => selectBrowserEntry(entry)}
                    on:dblclick={() => openBrowserEntry(entry)}
                    on:keydown={(event) => handleBrowserEntryKeydown(event, entry)}
                    title={entry.resource.path}
                  >
                    {#if entry.kind === "directory"}
                      <Folder size={14} />
                    {:else}
                      <FileText size={14} />
                    {/if}
                    <span>{entry.name}</span>
                    <small>{entry.kind === "directory" ? "" : entry.size !== undefined ? `${entry.size} B` : ""}</small>
                  </button>
                {/each}
              {:else if browserBusy}
                <div class="empty-list" aria-live="polite">{labels.browserLoading}</div>
              {:else if browserPath}
                <div class="empty-list">{labels.browserNoEntries}</div>
              {:else}
                <div class="empty-list">{labels.browserEmpty}</div>
              {/if}
            </div>
          </section>
        </section>

        <footer>
          <button type="button" on:click={close} disabled={busy}>{labels.cancel}</button>
          <button type="button" on:click={openSelectedDirectory} disabled={!canOpenDirectory}>
            <Folder size={16} />
            <span>{labels.openDirectory}</span>
          </button>
          <button class="primary" type="submit" disabled={!canOpen}>
            <FolderOpen size={16} />
            <span>{busy ? labels.busy : labels.open}</span>
          </button>
        </footer>
      </form>
    </div>
  </section>
{/if}

<style>
  .remote-backdrop {
    position: fixed;
    inset: 0;
    z-index: 32;
    display: grid;
    place-items: center;
    padding: 16px;
    background: color-mix(in srgb, var(--surface, #101216) 68%, transparent);
    backdrop-filter: blur(10px);
  }

  .remote-dialog {
    width: min(980px, 100%);
    height: min(760px, calc(100dvh - 32px));
    min-height: min(520px, calc(100dvh - 32px));
    overflow: hidden;
    border: 1px solid var(--line);
    border-radius: var(--radius, 8px);
    background: var(--panel);
    box-shadow: 0 28px 90px rgb(0 0 0 / 26%);
    color: var(--text);
  }

  .remote-dialog > form {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }

  header,
  footer {
    display: grid;
    flex: 0 0 auto;
    align-items: center;
    padding: 12px 14px;
  }

  header {
    grid-template-columns: minmax(0, 1fr) max-content;
    border-bottom: 1px solid var(--line);
  }

  header > div {
    display: flex;
    gap: 10px;
    align-items: center;
    min-width: 0;
  }

  header span {
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    border: 1px solid color-mix(in srgb, var(--accent) 26%, var(--line));
    border-radius: var(--radius, 8px);
    background: color-mix(in srgb, var(--accent) 9%, transparent);
    color: var(--accent);
  }

  header strong {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  header button,
  .remote-list-head button {
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    padding: 0;
  }

  .remote-fields {
    display: grid;
    grid-template-columns: minmax(160px, 0.8fr) minmax(260px, 1.2fr);
    flex: 0 0 auto;
    gap: 10px;
    padding: 14px;
    border-bottom: 1px solid var(--line);
  }

  label {
    display: grid;
    gap: 6px;
    min-width: 0;
  }

  label span,
  .remote-list-head span {
    color: var(--muted);
    font-size: 0.78rem;
    font-weight: 760;
    text-transform: uppercase;
  }

  input {
    min-width: 0;
    height: 38px;
    border: 1px solid var(--line);
    border-radius: var(--radius, 8px);
    padding: 0 10px;
    background: var(--control, var(--panel));
    color: var(--text);
    font: inherit;
  }

  .path-control {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 38px;
    gap: 6px;
  }

  .path-control button {
    display: grid;
    place-items: center;
    min-width: 0;
    padding: 0;
  }

  .remote-auth {
    display: grid;
    grid-template-columns: 20px minmax(0, 1fr) max-content;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    border-bottom: 1px solid var(--line);
    background: color-mix(in srgb, var(--accent) 4%, var(--panel));
  }

  .auth-icon {
    display: grid;
    place-items: center;
    color: var(--accent);
  }

  .auth-summary,
  .password-field {
    display: grid;
    gap: 3px;
    min-width: 0;
  }

  .auth-summary small,
  .password-field small {
    overflow: hidden;
    color: var(--muted);
    font-size: 0.76rem;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .auth-summary strong {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .password-field {
    grid-template-columns: minmax(90px, 0.35fr) minmax(180px, 1fr);
    align-items: center;
  }

  .password-field > span {
    color: var(--muted);
    font-size: 0.78rem;
    font-weight: 760;
    text-transform: uppercase;
  }

  .password-field small {
    grid-column: 1 / -1;
  }

  .auth-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    justify-content: flex-end;
  }

  .auth-actions button {
    min-width: 0;
  }

  input:focus {
    border-color: color-mix(in srgb, var(--accent) 48%, var(--line));
    outline: none;
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 16%, transparent);
  }

  button:disabled,
  input:disabled {
    cursor: not-allowed;
    opacity: 0.56;
  }

  .remote-error {
    flex: 0 0 auto;
    max-height: min(112px, 20dvh);
    overflow: auto;
    border-bottom: 1px solid color-mix(in srgb, #d24a4a 42%, var(--line));
    padding: 9px 14px;
    background: color-mix(in srgb, #d24a4a 10%, var(--panel));
    color: #d24a4a;
    overflow-wrap: anywhere;
  }

  .remote-workspace {
    display: grid;
    grid-template-columns: minmax(240px, 0.85fr) minmax(360px, 1.55fr);
    flex: 1 1 auto;
    gap: 14px;
    min-height: 0;
    padding: 14px;
    background: color-mix(in srgb, var(--surface) 38%, var(--panel));
  }

  .remote-sources {
    display: grid;
    grid-template-rows: minmax(180px, 1fr) minmax(120px, 0.58fr);
    gap: 12px;
    min-width: 0;
    min-height: 0;
  }

  .source-panel,
  .remote-browser {
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    border: 1px solid var(--line);
    border-radius: var(--radius, 8px);
    background: var(--panel);
  }

  .source-panel {
    display: grid;
    grid-template-rows: 38px minmax(0, 1fr);
  }

  .source-panel.host-panel {
    grid-template-rows: 38px 40px minmax(0, 1fr);
  }

  .remote-browser {
    display: grid;
    grid-template-rows: 38px 36px minmax(0, 1fr);
  }

  .remote-list-head {
    display: grid;
    grid-template-columns: minmax(0, 1fr) max-content;
    align-items: center;
    min-height: 32px;
    padding: 0 8px 0 10px;
  }

  .remote-list-head > div {
    display: flex;
    gap: 6px;
    align-items: center;
    min-width: 0;
  }

  .remote-list-head small {
    overflow: hidden;
    color: var(--muted);
    font-size: 0.72rem;
    font-variant-numeric: tabular-nums;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .browser-path {
    overflow: hidden;
    border-top: 1px solid var(--line);
    border-bottom: 1px solid var(--line);
    padding: 8px 10px;
    background: color-mix(in srgb, var(--control, var(--panel)) 74%, transparent);
    color: var(--muted);
    font-family: var(--font-mono, ui-monospace, monospace);
    font-size: 0.8rem;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .browser-list,
  .host-list {
    display: grid;
    align-content: start;
    min-height: 0;
    overflow: auto;
    overflow-x: hidden;
    overscroll-behavior: contain;
    scrollbar-gutter: stable;
  }

  .browser-list {
    background: color-mix(in srgb, var(--panel) 78%, var(--surface));
  }

  .browser-list button {
    display: grid;
    grid-template-columns: 16px minmax(0, 1fr) max-content;
    align-items: center;
    gap: 8px;
    min-height: 32px;
    border: 0;
    border-bottom: 1px solid color-mix(in srgb, var(--line) 65%, transparent);
    border-radius: 0;
    padding: 0 9px;
    background: transparent;
    text-align: left;
  }

  .browser-list button:hover,
  .browser-list button.selected {
    background: color-mix(in srgb, var(--accent) 10%, transparent);
  }

  .browser-list button.selected {
    box-shadow: inset 3px 0 0 var(--accent);
  }

  .browser-list span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .browser-list small {
    color: var(--muted);
    font-family: var(--font-mono, ui-monospace, monospace);
    font-size: 0.72rem;
  }

  .host-filter {
    display: grid;
    grid-template-columns: 16px minmax(0, 1fr);
    align-items: center;
    gap: 7px;
    min-width: 0;
    border-top: 1px solid var(--line);
    border-bottom: 1px solid var(--line);
    padding: 0 9px;
    color: var(--muted);
  }

  .host-filter input {
    height: 32px;
    border: 0;
    padding: 0;
    background: transparent;
    box-shadow: none;
  }

  .host-list button {
    display: grid;
    grid-template-columns: 16px minmax(0, 1fr);
    align-items: center;
    gap: 9px;
    min-height: 42px;
    padding: 0 9px;
    border: 0;
    border-bottom: 1px solid color-mix(in srgb, var(--line) 65%, transparent);
    border-radius: 0;
    background: transparent;
    text-align: left;
  }

  .host-list button:hover,
  .host-list button.active {
    background: color-mix(in srgb, var(--accent) 8%, var(--panel));
  }

  .host-list button.active {
    box-shadow: inset 3px 0 0 var(--accent);
  }

  .host-list span {
    display: grid;
    min-width: 0;
  }

  .host-list strong,
  .host-list small {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .host-list small,
  .empty-list {
    color: var(--muted);
  }

  .empty-list {
    display: grid;
    align-items: center;
    min-height: 44px;
    padding: 8px 10px;
  }

  footer {
    grid-template-columns: minmax(0, 1fr) max-content max-content;
    gap: 10px;
    border-top: 1px solid var(--line);
    background: var(--panel);
  }

  footer button {
    display: flex;
    gap: 8px;
    align-items: center;
    min-width: 0;
    min-height: 38px;
  }

  footer button span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  footer .primary {
    border-color: color-mix(in srgb, var(--accent) 42%, var(--line));
    background: color-mix(in srgb, var(--accent) 12%, var(--panel));
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  @media (max-height: 700px) {
    header,
    footer {
      padding: 8px 12px;
    }

    .remote-fields {
      padding: 9px 12px;
    }

    .remote-auth {
      padding: 7px 12px;
    }

    .remote-error {
      max-height: min(72px, 18dvh);
      padding: 7px 12px;
    }

    .remote-workspace {
      gap: 10px;
      padding: 10px 12px;
    }

    .remote-sources {
      grid-template-rows: minmax(110px, 1fr) minmax(76px, 0.52fr);
      gap: 8px;
    }
  }

  @media (max-width: 760px) {
    .remote-fields {
      grid-template-columns: 1fr;
    }

    .remote-auth {
      grid-template-columns: 20px minmax(0, 1fr);
    }

    .remote-auth .auth-actions {
      grid-column: 2;
      justify-content: flex-start;
    }

    .remote-workspace {
      grid-template-columns: minmax(0, 1fr);
      grid-template-rows: minmax(320px, 0.9fr) minmax(240px, 1fr);
      overflow: auto;
    }

    .remote-sources {
      min-height: 320px;
    }
  }

  @media (max-width: 520px) {
    .remote-backdrop {
      padding: 0;
    }

    .remote-dialog {
      width: 100%;
      height: 100dvh;
      min-height: 0;
      border: 0;
      border-radius: 0;
    }

    footer {
      grid-template-columns: 1fr 1fr;
    }

    footer > button:first-child {
      display: none;
    }

    footer button {
      justify-content: center;
      min-width: 0;
    }
  }

  @media (max-width: 420px) {
    .password-field {
      grid-template-columns: minmax(0, 1fr);
    }

    .password-field small {
      grid-column: 1;
    }

    .remote-auth .auth-actions {
      grid-column: 1 / -1;
    }
  }
</style>
