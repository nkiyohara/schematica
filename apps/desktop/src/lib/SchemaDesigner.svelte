<script lang="ts">
  import FileJson from "@lucide/svelte/icons/file-json";
  import Plus from "@lucide/svelte/icons/plus";
  import RefreshCw from "@lucide/svelte/icons/refresh-cw";
  import Save from "@lucide/svelte/icons/save";
  import SchemaDesignerField from "./SchemaDesignerField.svelte";
  import {
    createSchemaDesignerCondition,
    createSchemaDesignerField,
    nextSchemaDesignerFieldKey,
    removeSchemaDesignerField,
    rootFieldKeys,
    type SchemaDesignerCondition,
    type SchemaDesignerDraft,
  } from "./schema-designer";

  export let draft: SchemaDesignerDraft;
  export let schemaDirty = false;
  export let labels: Record<string, string>;
  export let onChange: (draft: SchemaDesignerDraft) => void;
  export let onUseJson: () => void;
  export let onNewConfig: () => void;
  export let onSaveSchema: () => void | Promise<void>;

  $: fieldKeys = rootFieldKeys(draft);
  let focusFieldId = "";

  function patch(update: Partial<SchemaDesignerDraft>) {
    draft = { ...draft, ...update };
    onChange(draft);
  }

  function label(key: string, fallback: string) {
    return labels[key] ?? fallback;
  }

  function addField() {
    const key = nextSchemaDesignerFieldKey(draft.fields);
    const nextNumber = Number(key.split("_").at(-1)) || draft.fields.length + 1;
    const nextField = createSchemaDesignerField({
      key,
      title: `${label("field.new", "Field")} ${nextNumber}`,
    });
    focusFieldId = nextField.id;
    patch({
      fields: [...draft.fields, nextField],
    });
  }

  function removeField(id: string) {
    const next = removeSchemaDesignerField(draft, id);
    draft = next;
    onChange(next);
  }

  function removeCondition(id: string) {
    if (!window.confirm(`${label("remove", "Remove")}?`)) return;
    patch({
      conditions: draft.conditions.filter((candidate) => candidate.id !== id),
    });
  }

  function updateCondition(id: string, update: Partial<SchemaDesignerCondition>) {
    patch({
      conditions: draft.conditions.map((condition) =>
        condition.id === id ? { ...condition, ...update } : condition,
      ),
    });
  }
</script>

<section class="schema-designer">
  <header class="designer-head">
    <div>
      <span>{label("eyebrow", "Schema Designer")}</span>
      <h2>{draft.title || label("untitled", "Untitled Config")}</h2>
    </div>
    <div class="designer-actions">
      <button type="button" on:click={onUseJson}>
        <RefreshCw size={16} />
        <span>{label("useJson", "Use JSON")}</span>
      </button>
      <button type="button" disabled={!schemaDirty} aria-live="polite" on:click={onSaveSchema}>
        <Save size={16} />
        <span>{schemaDirty ? label("save", "Save schema") : label("saved", "Saved")}</span>
      </button>
      <button type="button" on:click={onNewConfig}>
        <FileJson size={16} />
        <span>{label("newConfig", "New config")}</span>
      </button>
    </div>
  </header>

  <section class="schema-basics">
    <label>
      <span>{label("title", "Title")}</span>
      <input value={draft.title} on:input={(event) => patch({ title: event.currentTarget.value })} />
    </label>
    <label>
      <span>{label("description", "Description")}</span>
      <input
        value={draft.description}
        on:input={(event) => patch({ description: event.currentTarget.value })}
      />
    </label>
  </section>

  <section class="designer-section">
    <div class="section-head">
      <div>
        <h3>{label("fields", "Fields")}</h3>
        <p>{label("fieldCount", "{count} top-level fields").replace("{count}", String(draft.fields.length))}</p>
      </div>
      <button type="button" on:click={addField}>
        <Plus size={16} />
        <span>{label("addField", "Add field")}</span>
      </button>
    </div>

    <div class="field-list">
      {#if draft.fields.length === 0}
        <div class="empty-fields">
          <p>{label("fieldCount", "{count} top-level fields").replace("{count}", "0")}</p>
          <button type="button" on:click={addField}>
            <Plus size={16} />
            <span>{label("addField", "Add field")}</span>
          </button>
        </div>
      {/if}
      {#each draft.fields as field (field.id)}
        <SchemaDesignerField
          {field}
          {labels}
          focusOnMount={field.id === focusFieldId}
          onChange={(next: typeof field) =>
            patch({
              fields: draft.fields.map((candidate) =>
                candidate.id === field.id ? next : candidate,
              ),
            })}
          onRemove={() => removeField(field.id)}
          onAddChild={() =>
            patch({
              fields: draft.fields.map((candidate) =>
                candidate.id === field.id
                  ? {
                      ...candidate,
                      type: "object",
                      children: [
                        ...candidate.children,
                        createSchemaDesignerField({
                          key: nextSchemaDesignerFieldKey(candidate.children),
                          title: `${label("field.new", "Field")} ${candidate.children.length + 1}`,
                        }),
                      ],
                    }
                  : candidate,
              ),
            })}
        />
      {/each}
    </div>
  </section>

  <details class="designer-section advanced">
    <summary>
      <span>{label("conditions", "Conditions")}</span>
      <small>{draft.conditions.length}</small>
    </summary>
    <div class="condition-list">
      {#each draft.conditions as condition (condition.id)}
        <div
          class="condition-row"
          class:incomplete={!condition.ifFieldKey || !condition.thenRequiredKey || !condition.equals.trim()}
        >
          <label>
            <span>{label("condition.if", "If")}</span>
            <select
              value={condition.ifFieldKey}
              on:change={(event) => updateCondition(condition.id, { ifFieldKey: event.currentTarget.value })}
            >
              <option value="" disabled>— {label("condition.if", "If")} —</option>
              {#each fieldKeys as key}
                <option value={key}>{key}</option>
              {/each}
            </select>
          </label>
          <label>
            <span>{label("condition.equals", "Equals")}</span>
            <input
              value={condition.equals}
              aria-invalid={!condition.equals.trim()}
              on:input={(event) => updateCondition(condition.id, { equals: event.currentTarget.value })}
            />
          </label>
          <label>
            <span>{label("condition.require", "Require")}</span>
            <select
              value={condition.thenRequiredKey}
              on:change={(event) =>
                updateCondition(condition.id, { thenRequiredKey: event.currentTarget.value })}
            >
              <option value="" disabled>— {label("condition.require", "Require")} —</option>
              {#each fieldKeys as key}
                <option value={key}>{key}</option>
              {/each}
            </select>
          </label>
          <button
            type="button"
            on:click={() => removeCondition(condition.id)}
          >
            {label("remove", "Remove")}
          </button>
        </div>
      {/each}
      <button
        class="add-condition"
        type="button"
        on:click={() => patch({ conditions: [...draft.conditions, createSchemaDesignerCondition()] })}
      >
        <Plus size={16} />
        <span>{label("addCondition", "Add condition")}</span>
      </button>
    </div>
  </details>
</section>

<style>
  .schema-designer {
    container-type: inline-size;
    display: grid;
    align-content: start;
    gap: 14px;
    min-width: 0;
  }

  .designer-head,
  .section-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-width: 0;
  }

  .designer-head span {
    color: var(--accent);
    font-size: 0.72rem;
    font-weight: 760;
    text-transform: uppercase;
  }

  .designer-head h2,
  .section-head h3 {
    margin: 0;
  }

  .designer-head h2 {
    overflow-wrap: anywhere;
    font-size: 1.12rem;
  }

  .designer-head > div:first-child,
  .section-head > div {
    min-width: 0;
  }

  .designer-actions,
  .section-head button,
  .add-condition {
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }

  .designer-actions {
    flex-wrap: wrap;
  }

  .designer-actions button,
  .section-head button,
  .condition-row button,
  .add-condition {
    min-height: 34px;
    padding: 0 11px;
    border: 1px solid var(--line);
    background: var(--control, var(--panel));
  }

  .designer-actions button:disabled {
    cursor: default;
    opacity: 0.62;
  }

  .schema-basics {
    display: grid;
    grid-template-columns: minmax(160px, 0.42fr) minmax(0, 1fr);
    gap: 10px;
  }

  label {
    display: grid;
    gap: 6px;
    min-width: 0;
  }

  label span,
  .section-head p,
  .advanced summary {
    color: var(--muted);
    font-size: 0.74rem;
    font-weight: 720;
    text-transform: uppercase;
  }

  input,
  select {
    width: 100%;
    height: 34px;
    min-width: 0;
    padding: 0 10px;
    border: 1px solid var(--line);
    border-radius: calc(var(--radius, 8px) - 2px);
    background: var(--panel);
    color: var(--text);
  }

  .designer-section {
    display: grid;
    gap: 10px;
    min-width: 0;
    padding: 14px;
    border: 1px solid var(--line);
    border-radius: var(--radius, 8px);
    background: color-mix(in srgb, var(--panel) 92%, var(--surface));
  }

  .section-head p {
    margin: 4px 0 0;
    text-transform: none;
  }

  .field-list,
  .condition-list {
    display: grid;
    gap: 10px;
    min-width: 0;
  }

  .empty-fields {
    display: grid;
    justify-items: center;
    gap: 10px;
    padding: 22px 14px;
    border: 1px dashed var(--line);
    border-radius: calc(var(--radius, 8px) - 2px);
    color: var(--muted);
    text-align: center;
  }

  .empty-fields p {
    margin: 0;
  }

  .empty-fields button {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: 34px;
    padding: 0 11px;
    border: 1px solid color-mix(in srgb, var(--accent) 36%, var(--line));
    background: color-mix(in srgb, var(--accent) 9%, var(--panel));
  }

  .advanced {
    display: block;
  }

  .advanced summary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    cursor: pointer;
  }

  .condition-list {
    padding-top: 12px;
  }

  .condition-row {
    display: grid;
    grid-template-columns: minmax(120px, 1fr) minmax(110px, 0.8fr) minmax(120px, 1fr) max-content;
    gap: 8px;
    align-items: end;
    min-width: 0;
  }

  .condition-row.incomplete {
    padding-left: 8px;
    border-left: 2px solid color-mix(in srgb, var(--danger, #dc2626) 72%, var(--line));
  }

  .condition-row [aria-invalid="true"] {
    border-color: color-mix(in srgb, var(--danger, #dc2626) 62%, var(--line));
  }

  .designer-actions button:hover,
  .section-head button:hover,
  .condition-row button:hover,
  .add-condition:hover {
    border-color: color-mix(in srgb, var(--accent) 36%, var(--line));
    background: color-mix(in srgb, var(--accent) 9%, var(--panel));
  }

  @container (max-width: 720px) {
    .designer-head {
      align-items: stretch;
      flex-direction: column;
    }

    .designer-actions {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      width: 100%;
    }

    .designer-actions button {
      justify-content: center;
      min-width: 0;
      padding: 6px 8px;
      text-align: center;
    }

    .designer-actions button span {
      min-width: 0;
      overflow-wrap: anywhere;
    }

    .condition-row {
      grid-template-columns: minmax(0, 1fr);
    }
  }

  @container (max-width: 520px) {
    .schema-basics {
      grid-template-columns: minmax(0, 1fr);
    }

    .designer-actions {
      grid-template-columns: minmax(0, 1fr);
    }

    .section-head {
      align-items: stretch;
      flex-direction: column;
    }

    .section-head > button {
      justify-content: center;
      width: 100%;
    }

    .designer-section {
      padding: 10px;
    }
  }
</style>
