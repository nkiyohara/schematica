<script lang="ts">
  import AlertCircle from "@lucide/svelte/icons/alert-circle";
  import CheckCircle2 from "@lucide/svelte/icons/check-circle-2";
  import CircleMinus from "@lucide/svelte/icons/circle-minus";
  import Diff from "@lucide/svelte/icons/diff";
  import FilePlus2 from "@lucide/svelte/icons/file-plus-2";
  import GitCompare from "@lucide/svelte/icons/git-compare";
  import type { DiffRow, DiffRowKind, DiffSummary, JsonValue } from "@schematica/core";
  import { documentLocationLabel, type DocumentLocation } from "./config-document";

  interface CompareDocument {
    id: string;
    name: string;
    resource?: DocumentLocation;
    path?: string;
  }

  export let rows: DiffRow[];
  export let documents: CompareDocument[];
  export let summary: DiffSummary;
  export let onlyChanges = true;
  export let baselineName = "";
  export let labels: Record<string, string>;
  export let onOnlyChangesChange: (value: boolean) => void;
  export let onBaselineChange: (value: string) => void;
  export let onAddConfig: () => void;

  $: canCompare = documents.length >= 2;
  $: documentColumnCount = Math.max(documents.length, 1);
  $: gridStyle = [
    `--diff-column-count: ${documentColumnCount}`,
    `--diff-grid-min-width: ${220 + documentColumnCount * 180}px`,
    `--diff-grid-narrow-min-width: ${160 + documentColumnCount * 150}px`,
  ].join("; ");

  function label(key: string, fallback: string) {
    return labels[key] ?? fallback;
  }

  function statusLabel(status: DiffRowKind) {
    return label(`status.${status}`, status);
  }

  function valueText(value: JsonValue | undefined) {
    if (value === undefined) return label("missingValue", "Missing");
    if (typeof value === "string") return value;
    return JSON.stringify(value);
  }

  function valueType(value: JsonValue | undefined) {
    if (value === undefined) return "missing";
    if (Array.isArray(value)) return "array";
    if (value === null) return "null";
    return typeof value;
  }

  function pathLeaf(path: string) {
    if (!path) return label("root", "<root>");
    return path.split(".").at(-1) ?? path;
  }

  function pathParent(path: string) {
    if (!path.includes(".")) return "";
    return path.split(".").slice(0, -1).join(".");
  }

  function documentPathLabel(document: CompareDocument) {
    return document.resource ? documentLocationLabel(document.resource) : document.path;
  }
</script>

<section class="compare-workbench">
  <header class="compare-toolbar">
    <div class="compare-title">
      <span class="title-icon">
        <GitCompare size={17} />
      </span>
      <div>
        <h2>{label("title", "Semantic diff")}</h2>
        <p>
          <strong>{summary.total}</strong>
          {onlyChanges ? label("diffRows", "diff rows") : label("rows", "rows")}
        </p>
      </div>
    </div>

    <div class="compare-controls">
      <label class="baseline-select">
        <span>{label("baseline", "Baseline")}</span>
        <select
          value={baselineName}
          disabled={!canCompare}
          on:change={(event) => onBaselineChange(event.currentTarget.value)}
        >
          {#each documents as document (document.id)}
            <option value={document.name}>{document.name}</option>
          {/each}
        </select>
      </label>
      <div class="segmented" aria-label={label("scope", "Scope")}>
        <button
          class:active={onlyChanges}
          type="button"
          aria-pressed={onlyChanges}
          on:click={() => onOnlyChangesChange(true)}
        >
          <Diff size={14} />
          <span>{label("diffs", "Diffs")}</span>
        </button>
        <button
          class:active={!onlyChanges}
          type="button"
          aria-pressed={!onlyChanges}
          on:click={() => onOnlyChangesChange(false)}
        >
          <CheckCircle2 size={14} />
          <span>{label("all", "All")}</span>
        </button>
      </div>
    </div>
  </header>

  <div class="summary-strip" aria-label={label("summary", "Summary")}>
    <span class="metric changed">{label("changed", "{count} changed")}</span>
    <span class="metric missing">{label("missing", "{count} missing")}</span>
    <span class="metric same">{label("same", "{count} same")}</span>
  </div>

  {#if !canCompare}
    <div class="empty-diff">
      <span class="empty-icon">
        <GitCompare size={28} />
      </span>
      <div>
        <h3>{label("emptyTitle", "No comparison")}</h3>
        <p>{label("emptyDetail", "Open or create another config.")}</p>
      </div>
      <button type="button" on:click={onAddConfig}>
        <FilePlus2 size={16} />
        <span>{label("addConfig", "New config")}</span>
      </button>
    </div>
  {:else if rows.length === 0}
    <div class="empty-diff no-rows" role="status">
      <span class="empty-icon">
        <CheckCircle2 size={28} />
      </span>
      <div>
        <h3>{label("changed", "0 changed")}</h3>
        <p>{label("diffRows", "diff rows")}: 0</p>
      </div>
    </div>
  {:else}
    <!-- svelte-ignore a11y_no_noninteractive_tabindex (Scrollable comparison must be keyboard-focusable.) -->
    <div
      class="diff-grid-wrap"
      role="region"
      aria-label={label("title", "Semantic diff")}
      tabindex="0"
    >
      <div
        class="diff-grid"
        style={gridStyle}
        role="table"
        aria-rowcount={rows.length + 1}
        aria-colcount={documents.length + 1}
      >
        <div class="diff-table-row" role="row" aria-rowindex="1">
          <div class="diff-head path-head" role="columnheader">{label("path", "Path")}</div>
          {#each documents as document (document.id)}
            <div class:baseline={document.name === baselineName} class="diff-head" role="columnheader">
              <strong title={document.name}>{document.name}</strong>
              {#if documentPathLabel(document)}
                <span title={documentPathLabel(document)}>{documentPathLabel(document)}</span>
              {/if}
            </div>
          {/each}
        </div>

        {#each rows as row, rowIndex (row.path)}
          <div class="diff-table-row" role="row" aria-rowindex={rowIndex + 2}>
            <div class={`diff-path ${row.kind}`} role="rowheader" title={row.path || label("root", "<root>")}>
              <span>{pathLeaf(row.path)}</span>
              {#if pathParent(row.path)}
                <code>{pathParent(row.path)}</code>
              {/if}
            </div>
            {#each row.cells as cell}
              <div class={`diff-cell ${cell.status}`} role="cell">
                <span class="status-badge">
                  {#if cell.status === "same"}
                    <CheckCircle2 size={13} />
                  {:else if cell.status === "missing"}
                    <CircleMinus size={13} />
                  {:else}
                    <AlertCircle size={13} />
                  {/if}
                  {statusLabel(cell.status)}
                </span>
                <code title={valueText(cell.value)}>{cell.exists ? valueText(cell.value) : label("missingValue", "Missing")}</code>
                <small>{valueType(cell.value)}</small>
              </div>
            {/each}
          </div>
        {/each}
      </div>
    </div>
  {/if}
</section>

<style>
  .compare-workbench {
    display: grid;
    grid-template-rows: auto auto minmax(0, 1fr);
    width: 100%;
    min-width: 0;
    max-width: 100%;
    min-height: 0;
    overflow: hidden;
    background: var(--panel);
  }

  .compare-toolbar {
    display: flex;
    gap: 14px;
    align-items: center;
    justify-content: space-between;
    min-width: 0;
    max-width: 100%;
    padding: 14px 16px;
    border-bottom: 1px solid var(--line);
    background: color-mix(in srgb, var(--panel) 92%, var(--panel-strong));
  }

  .compare-title {
    display: flex;
    gap: 10px;
    align-items: center;
    min-width: 0;
  }

  .compare-title > div {
    min-width: 0;
  }

  .compare-title h2,
  .compare-title p {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .title-icon {
    display: grid;
    flex: 0 0 34px;
    width: 34px;
    height: 34px;
    place-items: center;
    border: 1px solid color-mix(in srgb, var(--accent) 22%, var(--line));
    border-radius: var(--radius, 8px);
    background: color-mix(in srgb, var(--accent) 9%, transparent);
    color: var(--accent);
  }

  h2,
  h3,
  p {
    margin: 0;
  }

  h2 {
    font-size: 0.98rem;
  }

  .compare-title p {
    margin-top: 2px;
    color: var(--muted);
    font-size: 0.84rem;
  }

  .compare-title p strong {
    color: var(--text);
  }

  .compare-controls {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    align-items: center;
    justify-content: flex-end;
    min-width: 0;
  }

  .baseline-select {
    display: flex;
    gap: 8px;
    align-items: center;
    min-width: 0;
    max-width: 100%;
    color: var(--muted);
    font-size: 0.8rem;
    font-weight: 700;
  }

  .baseline-select select {
    width: clamp(150px, 24vw, 280px);
    min-width: 0;
    max-width: 100%;
    height: 34px;
    padding: 0 10px;
    border: 1px solid var(--line);
    border-radius: var(--radius, 8px);
    background: var(--panel);
    color: var(--text);
    font: inherit;
  }

  .segmented {
    display: inline-grid;
    grid-template-columns: 1fr 1fr;
    max-width: 100%;
    padding: 3px;
    border: 1px solid var(--line);
    border-radius: var(--radius, 8px);
    background: var(--panel-strong);
  }

  .segmented button {
    display: inline-flex;
    gap: 6px;
    align-items: center;
    justify-content: center;
    min-width: 74px;
    height: 28px;
    padding: 0 9px;
    color: var(--muted);
    font: inherit;
    font-weight: 700;
  }

  .segmented button.active {
    background: var(--panel);
    color: var(--text);
    box-shadow: 0 1px 3px rgb(16 24 40 / 12%);
  }

  .summary-strip {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    min-width: 0;
    max-width: 100%;
    padding: 10px 16px;
    border-bottom: 1px solid var(--line);
  }

  .metric {
    display: inline-flex;
    align-items: center;
    max-width: 100%;
    min-height: 24px;
    padding: 0 8px;
    border-radius: 999px;
    font-size: 0.78rem;
    font-weight: 800;
    overflow-wrap: anywhere;
  }

  .metric.changed {
    background: color-mix(in srgb, var(--danger, #dc2626) 12%, transparent);
    color: var(--danger, #dc2626);
  }

  .metric.missing {
    background: color-mix(in srgb, #b54708 13%, transparent);
    color: #b54708;
  }

  .metric.same {
    background: color-mix(in srgb, var(--success, #16a34a) 14%, transparent);
    color: var(--success, #16a34a);
  }

  .empty-diff {
    display: grid;
    grid-template-columns: 38px minmax(0, 1fr) auto;
    gap: 14px;
    align-items: center;
    align-self: start;
    margin: 16px;
    padding: 16px;
    border: 1px solid var(--line);
    border-radius: var(--radius, 8px);
    background: color-mix(in srgb, var(--panel) 90%, var(--panel-strong));
  }

  .empty-diff > div {
    min-width: 0;
  }

  .empty-diff h3,
  .empty-diff p {
    overflow-wrap: anywhere;
  }

  .empty-icon {
    display: inline-flex;
    color: var(--accent);
  }

  .empty-diff p {
    margin-top: 3px;
    color: var(--muted);
  }

  .empty-diff button {
    display: inline-flex;
    gap: 8px;
    align-items: center;
    justify-content: center;
    max-width: 100%;
    min-height: 34px;
    padding: 0 12px;
    border: 1px solid color-mix(in srgb, var(--accent) 36%, var(--line));
    border-radius: var(--radius, 8px);
    color: var(--text);
    font: inherit;
    font-weight: 800;
  }

  .empty-diff button span {
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .diff-grid-wrap {
    width: 100%;
    min-width: 0;
    max-width: 100%;
    min-height: 0;
    overflow: auto;
    overscroll-behavior: contain;
    scrollbar-gutter: stable;
  }

  .diff-grid-wrap:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--accent) 70%, white);
    outline-offset: -2px;
  }

  .diff-grid {
    display: grid;
    grid-template-columns:
      minmax(220px, 280px)
      repeat(var(--diff-column-count), minmax(180px, 1fr));
    align-content: start;
    width: 100%;
    min-width: max(100%, var(--diff-grid-min-width));
    box-sizing: border-box;
  }

  .diff-table-row {
    display: contents;
  }

  .no-rows {
    grid-template-columns: 38px minmax(0, 1fr);
  }

  .diff-head,
  .diff-path,
  .diff-cell {
    min-width: 0;
    min-height: 46px;
    border-right: 1px solid var(--line);
    border-bottom: 1px solid var(--line);
  }

  .diff-head {
    position: sticky;
    top: 0;
    z-index: 3;
    display: grid;
    gap: 2px;
    align-content: center;
    padding: 9px 10px;
    background: var(--panel-strong);
  }

  .diff-head.baseline {
    box-shadow: inset 0 -2px 0 var(--accent);
  }

  .diff-head strong {
    overflow: hidden;
    color: var(--text);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .diff-head span {
    overflow: hidden;
    color: var(--muted);
    font-size: 0.76rem;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .path-head {
    left: 0;
    z-index: 4;
    color: var(--muted);
    font-weight: 800;
  }

  .diff-path {
    position: sticky;
    left: 0;
    z-index: 2;
    display: grid;
    gap: 2px;
    align-content: center;
    padding: 9px 10px;
    background: var(--panel);
  }

  .diff-path span {
    overflow: hidden;
    font-weight: 800;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .diff-path code {
    overflow: hidden;
    color: var(--muted);
    font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
    font-size: 0.77rem;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .diff-path.changed {
    box-shadow: inset 3px 0 0 var(--danger, #dc2626);
  }

  .diff-path.missing {
    box-shadow: inset 3px 0 0 #b54708;
  }

  .diff-cell {
    display: grid;
    gap: 5px;
    align-content: center;
    padding: 9px 10px;
    background: color-mix(in srgb, var(--panel) 96%, var(--panel-strong));
  }

  .diff-cell.same {
    background: var(--panel);
  }

  .diff-cell.changed {
    background: color-mix(in srgb, var(--danger, #dc2626) 6%, var(--panel));
  }

  .diff-cell.missing {
    background: color-mix(in srgb, #b54708 6%, var(--panel));
  }

  .status-badge {
    display: inline-flex;
    gap: 5px;
    align-items: center;
    width: fit-content;
    min-height: 20px;
    padding: 0 7px;
    border-radius: 999px;
    font-size: 0.74rem;
    font-weight: 800;
  }

  .diff-cell.same .status-badge {
    background: color-mix(in srgb, var(--success, #16a34a) 12%, transparent);
    color: var(--success, #16a34a);
  }

  .diff-cell.changed .status-badge {
    background: color-mix(in srgb, var(--danger, #dc2626) 12%, transparent);
    color: var(--danger, #dc2626);
  }

  .diff-cell.missing .status-badge {
    background: color-mix(in srgb, #b54708 13%, transparent);
    color: #b54708;
  }

  .diff-cell code {
    overflow: hidden;
    color: var(--text);
    font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
    font-size: 0.86rem;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .diff-cell small {
    color: var(--muted);
    font-size: 0.72rem;
    font-weight: 800;
    text-transform: uppercase;
  }

  button:hover,
  select:hover {
    border-color: color-mix(in srgb, var(--accent) 34%, var(--line));
  }

  button:focus-visible,
  select:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--accent) 70%, white);
    outline-offset: 2px;
  }

  @media (max-width: 720px) {
    .compare-toolbar,
    .compare-controls {
      align-items: stretch;
    }

    .compare-toolbar {
      display: grid;
    }

    .compare-controls {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      justify-content: stretch;
    }

    .baseline-select {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      align-items: stretch;
    }

    .baseline-select select,
    .segmented {
      width: 100%;
    }

    .baseline-select select {
      min-width: 0;
    }

    .segmented button {
      min-width: 0;
    }

    .empty-diff {
      grid-template-columns: minmax(0, 1fr);
    }

    .diff-grid {
      grid-template-columns:
        minmax(160px, 200px)
        repeat(var(--diff-column-count), minmax(150px, 1fr));
      min-width: max(100%, var(--diff-grid-narrow-min-width));
    }
  }
</style>
