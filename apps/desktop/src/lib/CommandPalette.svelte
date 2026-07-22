<script lang="ts">
  import { tick } from "svelte";
  import Command from "@lucide/svelte/icons/command";
  import Compass from "@lucide/svelte/icons/compass";
  import FileText from "@lucide/svelte/icons/file-text";
  import PanelLeft from "@lucide/svelte/icons/panel-left";
  import Search from "@lucide/svelte/icons/search";
  import Settings2 from "@lucide/svelte/icons/settings-2";
  import {
    filterPaletteCommands,
    firstEnabledCommandIndex,
    groupPaletteCommands,
    lastEnabledCommandIndex,
    moveEnabledCommandIndex,
    type CommandCategory,
    type PaletteCommand,
  } from "./command-palette";

  export let open = false;
  export let commands: PaletteCommand[] = [];
  export let label = "Command palette";
  export let placeholder = "Search commands";
  export let emptyText = "No matching commands";
  export let resultsLabel = "{count} commands";
  export let commandListLabel = "Commands";
  export let categoryLabels: Record<CommandCategory, string>;
  export let categoryOrder: CommandCategory[] = [];
  export let onClose: () => void;
  export let onExecute: (commandId: string) => void;

  let query = "";
  let selectedIndex = -1;
  let searchInput: HTMLInputElement;
  let panelElement: HTMLDivElement;
  let previouslyFocusedElement: HTMLElement | null = null;
  let wasOpen = false;

  $: filteredCommands = filterPaletteCommands(commands, query);
  $: groupedCommands = groupPaletteCommands(filteredCommands, categoryOrder);
  $: selectedCommand = selectedIndex >= 0 ? filteredCommands[selectedIndex] : undefined;
  $: resultText = resultsLabel.replace("{count}", String(filteredCommands.length));
  $: if (!filteredCommands[selectedIndex] || filteredCommands[selectedIndex]?.disabled) {
    selectedIndex = firstEnabledCommandIndex(filteredCommands);
  }
  $: if (open && !wasOpen) {
    previouslyFocusedElement = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    selectedIndex = firstEnabledCommandIndex(filteredCommands);
    void focusSearch();
  }
  $: if (!open && wasOpen) {
    void restoreFocus();
  }
  $: wasOpen = open;
  $: if (open && selectedCommand) {
    void revealSelected(selectedCommand);
  }

  async function focusSearch() {
    await tick();
    searchInput?.focus();
  }

  async function restoreFocus() {
    await tick();
    previouslyFocusedElement?.focus();
    previouslyFocusedElement = null;
  }

  async function revealSelected(command: PaletteCommand) {
    await tick();
    document.getElementById(optionId(command))?.scrollIntoView({ block: "nearest" });
  }

  function close() {
    query = "";
    selectedIndex = -1;
    onClose();
  }

  function execute(command: PaletteCommand) {
    if (command.disabled) return;
    query = "";
    selectedIndex = -1;
    onExecute(command.id);
  }

  function commandIndex(command: PaletteCommand) {
    return filteredCommands.findIndex((candidate) => candidate.id === command.id);
  }

  function optionId(command: PaletteCommand) {
    return `command-option-${encodeURIComponent(command.id)}`;
  }

  async function handleQueryInput() {
    await tick();
    selectedIndex = firstEnabledCommandIndex(filteredCommands);
  }

  function trapFocus(event: KeyboardEvent) {
    if (event.key !== "Tab") return false;
    const focusable = Array.from(
      panelElement?.querySelectorAll<HTMLElement>(
        'button:not([disabled]):not([tabindex="-1"]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ) ?? [],
    );
    if (focusable.length === 0) return false;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!focusable.includes(document.activeElement as HTMLElement)) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
      return true;
    }
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
      return true;
    }
    if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
      return true;
    }
    return false;
  }

  function categoryIcon(category: CommandCategory) {
    if (category === "navigation") return Compass;
    if (category === "files") return FileText;
    if (category === "layout") return PanelLeft;
    if (category === "system") return Settings2;
    return Command;
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.isComposing || event.keyCode === 229) return;
    if (trapFocus(event)) return;

    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      selectedIndex = moveEnabledCommandIndex(filteredCommands, selectedIndex, 1);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      selectedIndex = moveEnabledCommandIndex(filteredCommands, selectedIndex, -1);
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      selectedIndex = firstEnabledCommandIndex(filteredCommands);
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      selectedIndex = lastEnabledCommandIndex(filteredCommands);
      return;
    }

    if (event.key === "PageDown" || event.key === "PageUp") {
      event.preventDefault();
      selectedIndex = moveEnabledCommandIndex(
        filteredCommands,
        selectedIndex,
        event.key === "PageDown" ? 1 : -1,
        8,
      );
      return;
    }

    if (event.key === "Enter" && selectedCommand) {
      event.preventDefault();
      execute(selectedCommand);
    }
  }
</script>

{#if open}
  <section class="command-backdrop" role="presentation" on:mousedown={close}>
    <div
      bind:this={panelElement}
      class="command-panel"
      role="dialog"
      aria-modal="true"
      aria-label={label}
      tabindex="-1"
      on:mousedown|stopPropagation
      on:keydown={handleKeydown}
    >
      <header class="command-header">
        <div class="command-title">
          <span>
            <Command size={17} aria-hidden="true" />
          </span>
          <strong>{label}</strong>
        </div>
        <kbd>Esc</kbd>
      </header>

      <label class="command-search">
        <Search size={17} aria-hidden="true" />
        <input
          bind:this={searchInput}
          bind:value={query}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded="true"
          aria-label={placeholder}
          placeholder={placeholder}
          aria-controls="command-list"
          aria-describedby="command-results"
          aria-activedescendant={selectedCommand ? optionId(selectedCommand) : undefined}
          autocomplete="off"
          spellcheck="false"
          on:input={handleQueryInput}
        />
        <small id="command-results" role="status" aria-live="polite" aria-atomic="true">
          {resultText}
        </small>
      </label>

      <div id="command-list" class="command-list" role="listbox" aria-label={commandListLabel}>
        {#if groupedCommands.length > 0}
          {#each groupedCommands as group (group.category)}
            <section
              class="command-group"
              role="group"
              aria-label={categoryLabels[group.category] ?? group.category}
            >
              <div class="command-group-head" aria-hidden="true">
                <span>{categoryLabels[group.category] ?? group.category}</span>
                <small>{group.commands.length}</small>
              </div>
              {#each group.commands as command (command.id)}
                <button
                  id={optionId(command)}
                  class:active={command.id === selectedCommand?.id}
                  class:disabled={command.disabled}
                  disabled={command.disabled}
                  role="option"
                  tabindex="-1"
                  aria-disabled={command.disabled ?? false}
                  aria-selected={command.id === selectedCommand?.id}
                  on:mouseenter={() => {
                    if (!command.disabled) selectedIndex = commandIndex(command);
                  }}
                  on:click={() => execute(command)}
                >
                  <span class="command-mark">
                    <svelte:component
                      this={categoryIcon(group.category)}
                      size={15}
                      aria-hidden="true"
                    />
                  </span>
                  <span class="command-copy">
                    <strong>{command.title}</strong>
                    <small>{command.disabledReason ?? command.description}</small>
                  </span>
                  {#if command.shortcut}
                    <kbd>{command.shortcut}</kbd>
                  {/if}
                </button>
              {/each}
            </section>
          {/each}
        {:else}
          <div class="command-empty" role="status">
            <Search size={20} aria-hidden="true" />
            <span>{emptyText}</span>
          </div>
        {/if}
      </div>
    </div>
  </section>
{/if}

<style>
  .command-backdrop {
    position: fixed;
    inset: 0;
    z-index: 30;
    display: grid;
    align-items: start;
    justify-items: center;
    padding: min(12vh, 96px) 18px 18px;
    background: color-mix(in srgb, var(--surface, #101216) 68%, transparent);
    backdrop-filter: blur(10px);
  }

  .command-panel {
    display: grid;
    grid-template-rows: auto auto minmax(0, 1fr);
    width: min(720px, 100%);
    max-height: min(660px, 80dvh);
    overflow: hidden;
    border: 1px solid color-mix(in srgb, var(--line) 92%, transparent);
    border-radius: var(--radius, 8px);
    background:
      linear-gradient(
        145deg,
        color-mix(in srgb, var(--accent) 7%, transparent),
        transparent 34%
      ),
      var(--panel);
    box-shadow: 0 28px 90px rgb(0 0 0 / 26%);
    color: var(--text);
  }

  .command-header,
  .command-search {
    display: grid;
    align-items: center;
    border-bottom: 1px solid var(--line);
  }

  .command-header {
    grid-template-columns: minmax(0, 1fr) max-content;
    gap: 12px;
    min-height: 52px;
    padding: 0 14px;
  }

  .command-title {
    display: flex;
    gap: 10px;
    align-items: center;
    min-width: 0;
  }

  .command-title > span,
  .command-mark {
    display: grid;
    place-items: center;
    border: 1px solid color-mix(in srgb, var(--accent) 26%, var(--line));
    border-radius: var(--radius, 8px);
    background: color-mix(in srgb, var(--accent) 9%, transparent);
    color: var(--accent);
  }

  .command-title > span {
    width: 32px;
    height: 32px;
  }

  .command-title strong {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .command-search {
    grid-template-columns: 18px minmax(0, 1fr) max-content;
    gap: 10px;
    min-height: 50px;
    padding: 0 14px;
    color: var(--muted);
  }

  .command-search input {
    min-width: 0;
    border: 0;
    outline: 0;
    background: transparent;
    color: var(--text);
  }

  .command-search small {
    min-width: max-content;
    color: var(--muted);
    font-size: 0.78rem;
  }

  kbd {
    min-width: 26px;
    padding: 3px 7px;
    border: 1px solid var(--line);
    border-radius: calc(var(--radius, 8px) - 3px);
    background: color-mix(in srgb, var(--panel-strong) 84%, var(--panel));
    color: var(--muted);
    font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
    font-size: 0.74rem;
    text-align: center;
  }

  .command-list {
    display: grid;
    align-content: start;
    gap: 12px;
    min-height: 0;
    overflow: auto;
    overscroll-behavior: contain;
    padding: 12px;
    scrollbar-gutter: stable;
  }

  .command-group {
    display: grid;
    gap: 5px;
    min-width: 0;
  }

  .command-group-head {
    display: flex;
    gap: 8px;
    align-items: center;
    justify-content: space-between;
    min-height: 24px;
    padding: 0 6px;
    color: var(--muted);
    font-size: 0.72rem;
    font-weight: 800;
    letter-spacing: 0;
    text-transform: uppercase;
  }

  .command-group-head small {
    font-size: 0.72rem;
    font-variant-numeric: tabular-nums;
  }

  .command-group button {
    display: grid;
    grid-template-columns: 34px minmax(0, 1fr) max-content;
    gap: 11px;
    align-items: center;
    min-height: 62px;
    padding: 9px 10px;
    border: 1px solid transparent;
    background: color-mix(in srgb, var(--panel) 90%, var(--panel-strong));
    text-align: left;
  }

  .command-group button.active {
    border-color: color-mix(in srgb, var(--accent) 38%, var(--line));
    background: color-mix(in srgb, var(--accent) 11%, var(--panel));
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 13%, transparent);
  }

  .command-group button.disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  .command-mark {
    width: 34px;
    height: 34px;
  }

  .command-copy {
    display: grid;
    gap: 3px;
    min-width: 0;
  }

  .command-copy strong,
  .command-copy small {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .command-copy strong {
    font-weight: 750;
  }

  .command-copy small {
    color: var(--muted);
  }

  .command-empty {
    display: grid;
    gap: 8px;
    place-items: center;
    min-height: 180px;
    color: var(--muted);
    text-align: center;
  }

  .command-empty :global(svg) {
    color: var(--accent);
  }

  @media (max-width: 640px) {
    .command-backdrop {
      padding: 12px;
    }

    .command-panel {
      max-height: calc(100dvh - 24px);
    }

    .command-group button {
      grid-template-columns: 34px minmax(0, 1fr);
    }

    .command-group button kbd {
      display: none;
    }
  }
</style>
