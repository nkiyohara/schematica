<script lang="ts">
  import AlertTriangle from "@lucide/svelte/icons/alert-triangle";
  import CheckCircle2 from "@lucide/svelte/icons/check-circle-2";
  import FileJson from "@lucide/svelte/icons/file-json";
  import GitBranch from "@lucide/svelte/icons/git-branch";
  import Layers3 from "@lucide/svelte/icons/layers-3";
  import LoaderCircle from "@lucide/svelte/icons/loader-circle";
  import Save from "@lucide/svelte/icons/save";
  import type { Component } from "svelte";

  type OverviewMetricTone = "neutral" | "accent" | "ok" | "warn";

  interface OverviewMetric {
    id: string;
    label: string;
    value: string | number;
    detail?: string;
    tone?: OverviewMetricTone;
  }

  interface OverviewAction {
    id: string;
    label: string;
    icon: Component;
    title?: string;
    disabled?: boolean;
    action: () => void | Promise<void>;
  }

  export let title: string;
  export let documentName: string;
  export let documentPath: string;
  export let schemaLabel: string;
  export let validationLabel: string;
  export let validationOk = false;
  export let saveLabel: string;
  export let saveDirty = false;
  export let gitLabel: string;
  export let gitDirty = false;
  export let formatLabel: string;
  export let modeLabel: string;
  export let metrics: OverviewMetric[] = [];
  export let actions: OverviewAction[] = [];

  $: validationIcon = validationOk ? CheckCircle2 : AlertTriangle;
  let pendingActionIds = new Set<string>();

  async function runAction(action: OverviewAction) {
    if (action.disabled || pendingActionIds.has(action.id)) return;
    pendingActionIds = new Set([...pendingActionIds, action.id]);
    try {
      await action.action();
    } finally {
      const next = new Set(pendingActionIds);
      next.delete(action.id);
      pendingActionIds = next;
    }
  }
</script>

<section class="workbench-overview" aria-label={title}>
  <div class="overview-copy">
    <span class="overview-eyebrow">{title}</span>
    <div class="overview-title-line">
      <h2>{documentName}</h2>
      <span>{formatLabel}</span>
    </div>
    <p title={documentPath}>{documentPath}</p>

    <div class="overview-status">
      <span class:ok={validationOk} class:warn={!validationOk} title={validationLabel}>
        <svelte:component this={validationIcon} size={15} />
        {validationLabel}
      </span>
      <span title={schemaLabel}>
        <FileJson size={15} />
        {schemaLabel}
      </span>
      <span class:warn={saveDirty} title={saveLabel}>
        <Save size={15} />
        {saveLabel}
      </span>
      <span class:warn={gitDirty} title={gitLabel}>
        <GitBranch size={15} />
        {gitLabel}
      </span>
      <span title={modeLabel}>
        <Layers3 size={15} />
        {modeLabel}
      </span>
    </div>

    <div class="overview-actions">
      {#each actions as action (action.id)}
        <button
          type="button"
          disabled={action.disabled || pendingActionIds.has(action.id)}
          aria-busy={pendingActionIds.has(action.id)}
          title={action.title ?? action.label}
          on:click={() => void runAction(action)}
        >
          {#if pendingActionIds.has(action.id)}
            <LoaderCircle class="pending-icon" size={16} />
          {:else}
            <svelte:component this={action.icon} size={16} />
          {/if}
          <span>{action.label}</span>
        </button>
      {/each}
    </div>
  </div>

  {#if metrics.length > 0}
    <div class="overview-metrics">
      {#each metrics as metric (metric.id)}
        <div class={`metric ${metric.tone ?? "neutral"}`}>
          <span title={metric.label}>{metric.label}</span>
          <strong title={String(metric.value)}>{metric.value}</strong>
          {#if metric.detail}
            <small title={metric.detail}>{metric.detail}</small>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</section>

<style>
  .workbench-overview {
    container-type: inline-size;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr));
    gap: 16px;
    min-width: 0;
    padding: 16px;
    border: 1px solid var(--line);
    border-radius: var(--radius, 8px);
    background:
      linear-gradient(
        135deg,
        color-mix(in srgb, var(--accent) 9%, transparent),
        transparent 42%
      ),
      color-mix(in srgb, var(--panel) 94%, var(--panel-strong));
  }

  .overview-copy {
    display: grid;
    align-content: start;
    gap: 11px;
    min-width: 0;
  }

  .overview-eyebrow {
    color: var(--muted);
    font-size: 0.74rem;
    font-weight: 800;
    letter-spacing: 0;
    text-transform: uppercase;
  }

  .overview-title-line {
    display: flex;
    gap: 10px;
    align-items: center;
    min-width: 0;
  }

  .overview-title-line h2 {
    min-width: 0;
    margin: 0;
    overflow: hidden;
    font-size: 1.16rem;
    line-height: 1.15;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .overview-title-line > span {
    flex: 0 0 auto;
    padding: 4px 8px;
    border: 1px solid color-mix(in srgb, var(--accent) 28%, var(--line));
    border-radius: 999px;
    background: color-mix(in srgb, var(--accent) 9%, transparent);
    color: var(--accent);
    font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
    font-size: 0.72rem;
    font-weight: 800;
  }

  p {
    min-width: 0;
    margin: 0;
    overflow: hidden;
    color: var(--muted);
    font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
    font-size: 0.82rem;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .overview-status {
    display: flex;
    flex-wrap: wrap;
    gap: 7px;
    min-width: 0;
  }

  .overview-status span {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    max-width: 100%;
    min-height: 28px;
    min-width: 0;
    padding: 0 9px;
    overflow: hidden;
    border: 1px solid var(--line);
    border-radius: 999px;
    background: color-mix(in srgb, var(--panel) 78%, var(--panel-strong));
    color: var(--muted);
    font-size: 0.8rem;
    font-weight: 650;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .overview-status span.ok {
    border-color: color-mix(in srgb, var(--success) 30%, var(--line));
    color: var(--success);
  }

  .overview-status span.warn {
    border-color: color-mix(in srgb, var(--danger) 34%, var(--line));
    color: var(--danger);
  }

  .overview-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    min-width: 0;
  }

  .overview-actions button {
    display: inline-grid;
    grid-template-columns: 16px minmax(0, max-content);
    align-items: center;
    gap: 8px;
    min-height: 34px;
    max-width: 100%;
    padding: 0 11px;
    border: 1px solid var(--line);
    background: var(--panel);
    color: var(--text);
  }

  .overview-actions button:hover:not(:disabled) {
    border-color: color-mix(in srgb, var(--accent) 34%, var(--line));
    background: color-mix(in srgb, var(--accent) 10%, var(--panel));
  }

  .overview-actions button:disabled {
    cursor: not-allowed;
    opacity: 0.62;
  }

  .overview-actions :global(.pending-icon) {
    animation: overview-spin 0.9s linear infinite;
  }

  @keyframes overview-spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .overview-actions :global(.pending-icon) {
      animation: none;
    }
  }

  .overview-actions span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .overview-metrics {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
    min-width: 0;
  }

  .metric {
    display: grid;
    align-content: start;
    gap: 5px;
    min-width: 0;
    min-height: 86px;
    padding: 12px;
    border: 1px solid var(--line);
    border-radius: var(--radius, 8px);
    background: color-mix(in srgb, var(--panel) 82%, var(--panel-strong));
  }

  .metric span,
  .metric small {
    min-width: 0;
    overflow: hidden;
    color: var(--muted);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .metric span {
    font-size: 0.72rem;
    font-weight: 800;
    text-transform: uppercase;
  }

  .metric strong {
    min-width: 0;
    overflow: hidden;
    font-size: 1.16rem;
    line-height: 1.15;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .metric.accent strong {
    color: var(--accent);
  }

  .metric.ok strong {
    color: var(--success);
  }

  .metric.warn strong {
    color: var(--danger);
  }

  @container (max-width: 780px) {
    .overview-metrics {
      grid-template-columns: repeat(5, minmax(0, 1fr));
    }

    .metric {
      min-height: 72px;
      padding: 10px;
    }
  }

  @container (max-width: 520px) {
    .overview-title-line {
      align-items: flex-start;
      flex-direction: column;
      gap: 7px;
    }

    .overview-title-line h2,
    p {
      white-space: normal;
      overflow-wrap: anywhere;
    }

    .overview-actions button {
      flex: 1 1 118px;
      grid-template-columns: 16px minmax(0, 1fr);
      gap: 6px;
      min-width: 0;
      padding: 0 8px;
      font-size: 0.88rem;
    }

    .metric small {
      white-space: normal;
      overflow-wrap: anywhere;
    }
  }

  @container (max-width: 420px) {
    .overview-metrics {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
</style>
