<script lang="ts">
  import Braces from "@lucide/svelte/icons/braces";
  import FileJson from "@lucide/svelte/icons/file-json";
  import FolderOpen from "@lucide/svelte/icons/folder-open";
  import Plus from "@lucide/svelte/icons/plus";
  import WandSparkles from "@lucide/svelte/icons/wand-sparkles";
  import { tick } from "svelte";
  import {
    schemaFreeSettingTypes,
    type SchemaFreeSettingType,
  } from "./schema-inference";

  export let labels: Record<string, string>;
  export let existingKeys: string[] = [];
  export let inferredFieldCount = 0;
  export let canAddSetting = false;
  export let onAddSetting: (key: string, type: SchemaFreeSettingType) => void;
  export let onCreateSchema: () => void;
  export let onOpenSchema: () => void | Promise<void>;
  export let onEditRaw: () => void;

  let keyInput: HTMLInputElement;
  let key = "";
  let type: SchemaFreeSettingType = "string";

  $: normalizedKey = key.trim();
  $: duplicate = existingKeys.includes(normalizedKey);
  $: invalid = normalizedKey.length > 0 && /[\u0000-\u001f\u007f]/.test(normalizedKey);
  $: canAdd = canAddSetting && normalizedKey.length > 0 && !duplicate && !invalid;

  function label(key: string, fallback: string) {
    return labels[key] ?? fallback;
  }

  async function addSetting() {
    if (!canAdd) return;
    onAddSetting(normalizedKey, type);
    key = "";
    await tick();
    keyInput?.focus();
  }
</script>

<section class="schema-free" aria-labelledby="schema-free-title">
  <div class="schema-free-copy">
    <span class="schema-free-icon"><WandSparkles size={18} /></span>
    <div>
      <h2 id="schema-free-title">{label("title", "Schema optional")}</h2>
      <p>{label("detail", "Values inferred from this file remain editable without a schema.")}</p>
      <small>{label("fieldCount", "{count} inferred settings").replace("{count}", String(inferredFieldCount))}</small>
    </div>
  </div>

  <div class="schema-free-actions">
    <button type="button" on:click={onCreateSchema}>
      <FileJson size={15} />
      <span>{label("create", "Create schema from config")}</span>
    </button>
    <button type="button" on:click={onOpenSchema}>
      <FolderOpen size={15} />
      <span>{label("open", "Open schema")}</span>
    </button>
    <button type="button" on:click={onEditRaw}>
      <Braces size={15} />
      <span>{label("raw", "Edit raw")}</span>
    </button>
  </div>

  <form class="add-setting" on:submit|preventDefault={addSetting}>
    <label>
      <span>{label("key", "New setting")}</span>
      <input
        bind:this={keyInput}
        bind:value={key}
        placeholder={label("keyPlaceholder", "setting_name")}
        autocomplete="off"
        spellcheck="false"
        disabled={!canAddSetting}
        aria-invalid={duplicate || invalid}
      />
    </label>
    <label>
      <span>{label("type", "Type")}</span>
      <select bind:value={type} disabled={!canAddSetting}>
        {#each schemaFreeSettingTypes as option}
          <option value={option}>{label(`type.${option}`, option)}</option>
        {/each}
      </select>
    </label>
    <button class="primary" type="submit" disabled={!canAdd}>
      <Plus size={15} />
      <span>{label("add", "Add setting")}</span>
    </button>
    {#if duplicate}
      <small class="setting-error" role="alert">{label("duplicate", "That setting already exists.")}</small>
    {:else if invalid}
      <small class="setting-error" role="alert">{label("invalid", "Use a key without control characters.")}</small>
    {:else if !canAddSetting}
      <small>{label("nonObject", "Add settings in the raw editor for a non-object document.")}</small>
    {/if}
  </form>
</section>

<style>
  .schema-free {
    display: grid;
    gap: 12px;
    border: 1px solid color-mix(in srgb, var(--accent) 28%, var(--line));
    border-radius: var(--radius, 8px);
    padding: 14px;
    background: color-mix(in srgb, var(--accent) 5%, var(--panel));
  }

  .schema-free-copy {
    display: grid;
    grid-template-columns: 38px minmax(0, 1fr);
    gap: 11px;
  }

  .schema-free-icon {
    display: grid;
    place-items: center;
    width: 36px;
    height: 36px;
    border-radius: var(--radius, 8px);
    background: color-mix(in srgb, var(--accent) 13%, transparent);
    color: var(--accent);
  }

  h2,
  p {
    margin: 0;
  }

  h2 {
    font-size: 0.98rem;
  }

  p,
  small {
    color: var(--muted);
  }

  p {
    margin-top: 3px;
    line-height: 1.45;
  }

  .schema-free-actions,
  .add-setting {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: end;
  }

  button {
    display: inline-flex;
    gap: 7px;
    align-items: center;
  }

  .add-setting {
    border-top: 1px solid var(--line);
    padding-top: 12px;
  }

  label {
    display: grid;
    flex: 1 1 150px;
    gap: 5px;
    min-width: 0;
  }

  label > span {
    color: var(--muted);
    font-size: 0.72rem;
    font-weight: 760;
    text-transform: uppercase;
  }

  input,
  select {
    min-width: 0;
    height: 36px;
    border: 1px solid var(--line);
    border-radius: var(--radius, 8px);
    padding: 0 9px;
    background: var(--control, var(--panel));
    color: var(--text);
    font: inherit;
  }

  .add-setting > button {
    min-height: 36px;
  }

  .add-setting > small {
    flex-basis: 100%;
  }

  .setting-error {
    color: var(--danger, #d24a4a);
  }
</style>
