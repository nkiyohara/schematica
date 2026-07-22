<script lang="ts">
  import FileInput from "@lucide/svelte/icons/file-input";
  import FileJson from "@lucide/svelte/icons/file-json";
  import FlaskConical from "@lucide/svelte/icons/flask-conical";
  import FolderTree from "@lucide/svelte/icons/folder-tree";
  import Plus from "@lucide/svelte/icons/plus";
  import Server from "@lucide/svelte/icons/server";
  import Settings2 from "@lucide/svelte/icons/settings-2";
  import {
    resourceDisplayPath,
    type RecentResource,
    type RecentResourceKind,
  } from "./resource-history";

  export let title: string;
  export let subtitle: string;
  export let openConfigLabel: string;
  export let openDirectoryLabel: string;
  export let newConfigLabel: string;
  export let exampleLabel: string;
  export let buildSchemaLabel: string;
  export let openRemoteLabel: string;
  export let recentLabel: string;
  export let remoteRecentLabel: string;
  export let onOpenConfig: () => void | Promise<void>;
  export let onOpenDirectory: () => void | Promise<void>;
  export let onOpenRemote: () => void | Promise<void>;
  export let onNewConfig: () => void;
  export let onLoadExample: () => void;
  export let onBuildSchema: () => void;
  export let onOpenRecent: (file: RecentResource) => void | Promise<void>;
  export let onOpenRemoteRecent: (file: RecentResource) => void | Promise<void>;
  export let recentFiles: RecentResource[] = [];
  export let recentRemoteFiles: RecentResource[] = [];

  let pendingAction = "";

  function recentFileIcon(kind: RecentResourceKind) {
    if (kind === "schema") return FileJson;
    if (kind === "settings") return Settings2;
    return FileInput;
  }

  async function runAction(id: string, action: () => void | Promise<void>) {
    if (pendingAction) return;
    pendingAction = id;
    try {
      await action();
    } finally {
      pendingAction = "";
    }
  }
</script>

<section class="start-screen">
  <div class="start-copy">
    <span>Schematica</span>
    <h2>{title}</h2>
    <p>{subtitle}</p>
  </div>

  <div class="start-actions" aria-label={title}>
    <button
      class="primary"
      type="button"
      title={openConfigLabel}
      disabled={Boolean(pendingAction)}
      aria-busy={pendingAction === "open-config"}
      on:click={() => void runAction("open-config", onOpenConfig)}
    >
      <FileInput size={18} />
      <span>{openConfigLabel}</span>
    </button>
    <button
      type="button"
      title={openDirectoryLabel}
      disabled={Boolean(pendingAction)}
      aria-busy={pendingAction === "open-directory"}
      on:click={() => void runAction("open-directory", onOpenDirectory)}
    >
      <FolderTree size={18} />
      <span>{openDirectoryLabel}</span>
    </button>
    <button
      type="button"
      title={openRemoteLabel}
      disabled={Boolean(pendingAction)}
      aria-busy={pendingAction === "open-remote"}
      on:click={() => void runAction("open-remote", onOpenRemote)}
    >
      <Server size={18} />
      <span>{openRemoteLabel}</span>
    </button>
    <button
      type="button"
      title={exampleLabel}
      disabled={Boolean(pendingAction)}
      on:click={() => void runAction("example", onLoadExample)}
    >
      <FlaskConical size={18} />
      <span>{exampleLabel}</span>
    </button>
    <button
      type="button"
      title={buildSchemaLabel}
      disabled={Boolean(pendingAction)}
      on:click={() => void runAction("build-schema", onBuildSchema)}
    >
      <FileJson size={18} />
      <span>{buildSchemaLabel}</span>
    </button>
    <button
      type="button"
      title={newConfigLabel}
      disabled={Boolean(pendingAction)}
      on:click={() => void runAction("new-config", onNewConfig)}
    >
      <Plus size={18} />
      <span>{newConfigLabel}</span>
    </button>
  </div>

  {#if recentFiles.length > 0}
    <section class="start-recent" aria-label={recentLabel}>
      <h3>{recentLabel}</h3>
      <div>
        {#each recentFiles as file (resourceDisplayPath(file.resource))}
          <button
            type="button"
            disabled={Boolean(pendingAction)}
            aria-busy={pendingAction === `recent:${resourceDisplayPath(file.resource)}`}
            on:click={() =>
              void runAction(`recent:${resourceDisplayPath(file.resource)}`, () => onOpenRecent(file))}
            title={resourceDisplayPath(file.resource)}
          >
            <svelte:component this={recentFileIcon(file.kind)} size={16} />
            <span>
              <strong>{file.name}</strong>
              <small>{resourceDisplayPath(file.resource)}</small>
            </span>
          </button>
        {/each}
      </div>
    </section>
  {/if}

  {#if recentRemoteFiles.length > 0}
    <section class="start-recent" aria-label={remoteRecentLabel}>
      <h3>{remoteRecentLabel}</h3>
      <div>
        {#each recentRemoteFiles as file (resourceDisplayPath(file.resource))}
          <button
            type="button"
            disabled={Boolean(pendingAction)}
            aria-busy={pendingAction === `recent:${resourceDisplayPath(file.resource)}`}
            on:click={() =>
              void runAction(`recent:${resourceDisplayPath(file.resource)}`, () => onOpenRemoteRecent(file))}
            title={resourceDisplayPath(file.resource)}
          >
            <Server size={16} />
            <span>
              <strong>{file.name}</strong>
              <small>{resourceDisplayPath(file.resource)}</small>
            </span>
          </button>
        {/each}
      </div>
    </section>
  {/if}
</section>

<style>
  .start-screen {
    display: grid;
    align-content: start;
    gap: 18px;
    min-height: 100%;
    overflow: auto;
    overscroll-behavior: contain;
    padding: clamp(22px, 4vw, 48px);
    background:
      linear-gradient(
        135deg,
        color-mix(in srgb, var(--accent) 8%, transparent),
        transparent 34%
      ),
      var(--panel);
  }

  .start-copy {
    display: grid;
    gap: 6px;
    max-width: 760px;
  }

  .start-copy span {
    color: var(--accent);
    font-size: 0.78rem;
    font-weight: 760;
    text-transform: uppercase;
  }

  .start-copy h2 {
    margin: 0;
    font-size: clamp(1.35rem, 2.4vw, 2rem);
    line-height: 1.12;
  }

  .start-copy p {
    margin: 0;
    color: var(--muted);
    font-size: 0.95rem;
    line-height: 1.45;
  }

  .start-actions {
    display: grid;
    grid-template-columns: repeat(3, minmax(126px, 1fr));
    gap: 10px;
    max-width: 860px;
  }

  .start-actions button,
  .start-recent button {
    border: 1px solid var(--line);
    background: var(--control, var(--panel));
  }

  .start-actions button {
    display: grid;
    grid-template-columns: 20px minmax(0, 1fr);
    align-items: center;
    gap: 10px;
    min-height: 52px;
    padding: 0 14px;
    text-align: left;
  }

  .start-actions button.primary {
    border-color: color-mix(in srgb, var(--accent) 42%, var(--line));
    background: color-mix(in srgb, var(--accent) 12%, var(--panel));
  }

  .start-actions button:hover,
  .start-recent button:hover {
    border-color: color-mix(in srgb, var(--accent) 36%, var(--line));
    background: color-mix(in srgb, var(--accent) 9%, var(--panel));
  }

  .start-actions button:disabled,
  .start-recent button:disabled {
    cursor: wait;
    opacity: 0.64;
  }

  .start-actions span {
    min-width: 0;
    overflow: hidden;
    font-weight: 700;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .start-recent {
    display: grid;
    gap: 10px;
    max-width: 860px;
  }

  .start-recent h3 {
    margin: 0;
    color: var(--muted);
    font-size: 0.78rem;
    text-transform: uppercase;
  }

  .start-recent > div {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  .start-recent button {
    display: grid;
    grid-template-columns: 18px minmax(0, 1fr);
    align-items: center;
    gap: 10px;
    min-height: 48px;
    padding: 0 12px;
    text-align: left;
  }

  .start-recent span {
    display: grid;
    min-width: 0;
  }

  .start-recent strong,
  .start-recent small {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .start-recent small {
    color: var(--muted);
  }

  @media (max-width: 1180px) {
    .start-actions,
    .start-recent > div {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 480px) {
    .start-screen {
      align-content: start;
      gap: 18px;
      padding: 22px 18px;
    }

    .start-actions,
    .start-recent > div {
      grid-template-columns: minmax(0, 1fr);
    }

    .start-actions span,
    .start-recent strong,
    .start-recent small {
      white-space: normal;
      overflow-wrap: anywhere;
    }
  }
</style>
