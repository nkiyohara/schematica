<script lang="ts">
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import Plus from "@lucide/svelte/icons/plus";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import { onMount } from "svelte";
  import {
    createSchemaDesignerField,
    nextSchemaDesignerFieldKey,
    type SchemaDesignerField,
    type SchemaDesignerFieldType,
    schemaDesignerFieldTypes,
  } from "./schema-designer";

  export let field: SchemaDesignerField;
  export let depth = 0;
  export let focusOnMount = false;
  export let labels: Record<string, string>;
  export let onChange: (field: SchemaDesignerField) => void;
  export let onRemove: () => void;
  export let onAddChild: () => void;

  const fieldTypes = schemaDesignerFieldTypes;
  let detailsOpen = false;
  let keyInput: HTMLInputElement;

  onMount(() => {
    if (focusOnMount) {
      keyInput.focus();
      keyInput.select();
    }
  });

  function patch(update: Partial<SchemaDesignerField>) {
    field = { ...field, ...update };
    onChange(field);
  }

  function label(key: string, fallback: string) {
    return labels[key] ?? fallback;
  }

  function confirmRemove() {
    const name = field.title.trim() || field.key.trim();
    if (window.confirm(`${label("field.remove", "Remove")} “${name}”?`)) onRemove();
  }
</script>

<section class="designer-field" style={`--depth: ${depth}`}>
  <div class="field-line">
    <button
      class="field-disclosure"
      class:open={detailsOpen}
      type="button"
      aria-label={label("field.details", "Details")}
      aria-expanded={detailsOpen}
      on:click={() => (detailsOpen = !detailsOpen)}
    >
      <ChevronDown size={15} />
    </button>
    <label>
      <span>{label("field.key", "Key")}</span>
      <input
        bind:this={keyInput}
        value={field.key}
        aria-invalid={!field.key.trim()}
        autocomplete="off"
        spellcheck="false"
        on:input={(event) => patch({ key: event.currentTarget.value })}
      />
    </label>
    <label>
      <span>{label("field.title", "Title")}</span>
      <input value={field.title} on:input={(event) => patch({ title: event.currentTarget.value })} />
    </label>
    <label>
      <span>{label("field.type", "Type")}</span>
      <select
        value={field.type}
        on:change={(event) => patch({ type: event.currentTarget.value as SchemaDesignerFieldType })}
      >
        {#each fieldTypes as type}
          <option value={type}>{type}</option>
        {/each}
      </select>
    </label>
    <label class="required-toggle">
      <input
        type="checkbox"
        checked={field.required}
        on:change={(event) => patch({ required: event.currentTarget.checked })}
      />
      <span>{label("field.required", "Required")}</span>
    </label>
    <button
      class="icon-button"
      type="button"
      title={`${label("field.remove", "Remove")}: ${field.title || field.key}`}
      on:click={confirmRemove}
      aria-label={label("field.remove", "Remove")}
    >
      <Trash2 size={15} />
    </button>
  </div>

  <details class="field-details" bind:open={detailsOpen}>
    <summary>{label("field.details", "Details")}</summary>
    <div class="field-details-grid">
      <label>
        <span>{label("field.description", "Description")}</span>
        <input
          value={field.description}
          on:input={(event) => patch({ description: event.currentTarget.value })}
        />
      </label>
      <label>
        <span>{label("field.default", "Default")}</span>
        <input
          value={field.defaultValue}
          on:input={(event) => patch({ defaultValue: event.currentTarget.value })}
        />
      </label>
      <label>
        <span>{label("field.enum", "Enum")}</span>
        <textarea
          value={field.enumValues}
          on:input={(event) => patch({ enumValues: event.currentTarget.value })}
          rows="3"
        ></textarea>
      </label>
      <label>
        <span>{label("field.minimum", "Minimum")}</span>
        <input value={field.minimum} on:input={(event) => patch({ minimum: event.currentTarget.value })} />
      </label>
      <label>
        <span>{label("field.maximum", "Maximum")}</span>
        <input value={field.maximum} on:input={(event) => patch({ maximum: event.currentTarget.value })} />
      </label>
    </div>
  </details>

  {#if field.type === "object"}
    <div class="nested-fields">
      {#each field.children as child (child.id)}
        <svelte:self
          field={child}
          depth={depth + 1}
          {labels}
          onChange={(next: SchemaDesignerField) =>
            patch({
              children: field.children.map((candidate) =>
                candidate.id === child.id ? next : candidate,
              ),
            })}
          onRemove={() =>
            patch({ children: field.children.filter((candidate) => candidate.id !== child.id) })}
          onAddChild={() => {
            const childKey = nextSchemaDesignerFieldKey(child.children);
            const newChild = createSchemaDesignerField({
              key: childKey,
              title: `${label("field.new", "Field")} ${child.children.length + 1}`,
            });
            patch({
              children: field.children.map((candidate) =>
                candidate.id === child.id
                  ? {
                      ...candidate,
                      type: "object",
                      children: [...candidate.children, newChild],
                    }
                  : candidate,
              ),
            });
          }}
        />
      {/each}
      <button class="add-child" type="button" on:click={onAddChild}>
        <Plus size={15} />
        <span>{label("field.addNested", "Add nested field")}</span>
      </button>
    </div>
  {/if}
</section>

<style>
  .designer-field {
    display: grid;
    gap: 8px;
    min-width: 0;
    padding-left: 0;
  }

  .field-line {
    display: grid;
    grid-template-columns: 28px minmax(92px, 0.9fr) minmax(120px, 1.1fr) minmax(96px, 0.58fr) max-content 30px;
    gap: 8px;
    align-items: end;
    min-width: 0;
    padding: 10px;
    border: 1px solid var(--line);
    border-radius: var(--radius, 8px);
    background: var(--control, var(--panel));
  }

  label,
  .field-details-grid label {
    display: grid;
    gap: 5px;
    min-width: 0;
  }

  label span,
  .field-details summary {
    color: var(--muted);
    font-size: 0.72rem;
    font-weight: 720;
    text-transform: uppercase;
  }

  input,
  select,
  textarea {
    min-width: 0;
    border: 1px solid var(--line);
    border-radius: calc(var(--radius, 8px) - 2px);
    background: var(--panel);
    color: var(--text);
  }

  input[aria-invalid="true"] {
    border-color: color-mix(in srgb, var(--danger, #dc2626) 62%, var(--line));
  }

  input,
  select {
    height: 32px;
    padding: 0 9px;
  }

  textarea {
    resize: vertical;
    padding: 8px 9px;
    font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
    line-height: 1.45;
  }

  .field-disclosure,
  .icon-button {
    display: grid;
    width: 28px;
    height: 32px;
    place-items: center;
    border: 1px solid var(--line);
    background: var(--panel);
    color: var(--muted);
  }

  .field-disclosure :global(svg) {
    transition: transform var(--motion-fast, 120ms) ease;
  }

  .field-disclosure.open :global(svg) {
    transform: rotate(180deg);
  }

  .required-toggle {
    display: inline-grid;
    grid-template-columns: 16px max-content;
    align-items: center;
    gap: 7px;
    height: 32px;
  }

  .required-toggle input {
    width: 16px;
    height: 16px;
    padding: 0;
  }

  .field-details {
    margin-left: 36px;
    border: 1px solid var(--line);
    border-radius: var(--radius, 8px);
    background: color-mix(in srgb, var(--panel) 72%, var(--surface));
  }

  .field-details summary {
    cursor: pointer;
    padding: 9px 12px;
  }

  .field-details-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
    padding: 0 12px 12px;
  }

  .field-details-grid label:first-child,
  .field-details-grid label:nth-child(3) {
    grid-column: 1 / -1;
  }

  .nested-fields {
    display: grid;
    gap: 8px;
    margin-left: max(0px, calc(18px - var(--depth) * 6px));
    padding-left: max(0px, calc(8px - var(--depth) * 2px));
    border-left: 1px solid color-mix(in srgb, var(--accent) 28%, var(--line));
  }

  .add-child {
    display: inline-grid;
    grid-template-columns: 16px minmax(0, 1fr);
    align-items: center;
    justify-self: start;
    gap: 8px;
    max-width: 100%;
    min-height: 32px;
    padding: 0 10px;
    border: 1px solid var(--line);
    background: var(--panel);
  }

  .add-child span {
    min-width: 0;
    overflow-wrap: anywhere;
  }

  @container (max-width: 720px) {
    .field-line {
      grid-template-columns: 28px minmax(120px, 1fr) minmax(96px, 0.7fr) max-content 30px;
    }

    .field-disclosure {
      grid-column: 1;
      grid-row: 1;
    }

    .field-line label:nth-of-type(1) {
      grid-column: 2;
      grid-row: 1;
    }

    .field-line label:nth-of-type(2) {
      grid-column: 2 / -1;
      grid-row: 2;
    }

    .field-line label:nth-of-type(3) {
      grid-column: 3;
      grid-row: 1;
    }

    .required-toggle {
      grid-column: 4;
      grid-row: 1;
    }

    .icon-button {
      grid-column: 5;
      grid-row: 1;
    }
  }

  @container (max-width: 520px) {
    .field-line {
      grid-template-columns: 28px minmax(0, 1fr) 30px;
    }

    .field-line label:nth-of-type(1) {
      grid-column: 2;
      grid-row: 1;
    }

    .field-line label:nth-of-type(2) {
      grid-column: 2 / -1;
      grid-row: 2;
    }

    .field-line label:nth-of-type(3) {
      grid-column: 2 / -1;
      grid-row: 3;
    }

    .required-toggle {
      grid-column: 2 / -1;
      grid-row: 4;
    }

    .icon-button {
      grid-column: 3;
      grid-row: 1;
    }

    .nested-fields {
      margin-left: max(0px, calc(10px - var(--depth) * 5px));
      padding-left: max(0px, calc(6px - var(--depth) * 3px));
    }

    .field-details {
      margin-left: 8px;
    }

    .field-details-grid {
      grid-template-columns: minmax(0, 1fr);
    }

    .field-details-grid label {
      grid-column: 1 !important;
    }
  }
</style>
