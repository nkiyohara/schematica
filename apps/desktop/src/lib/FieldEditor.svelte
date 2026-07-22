<script lang="ts">
  import AlignLeft from "@lucide/svelte/icons/align-left";
  import AlertCircle from "@lucide/svelte/icons/alert-circle";
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import Hash from "@lucide/svelte/icons/hash";
  import ListFilter from "@lucide/svelte/icons/list-filter";
  import ToggleRight from "@lucide/svelte/icons/toggle-right";
  import Type from "@lucide/svelte/icons/type";
  import X from "@lucide/svelte/icons/x";
  import { tick } from "svelte";
  import type { FieldModel, JsonValue, ValidationIssue } from "@schematica/core";
  import { appendPath, getPath, tokens } from "@schematica/core";
  import { fieldOptionLabel } from "./field-options";

  export let field: FieldModel;
  export let data: JsonValue;
  export let issues: ValidationIssue[] = [];
  export let labels: Record<string, string>;
  export let onChange: (path: string, value: JsonValue) => void;
  export let onUnset: ((path: string) => void) | undefined = undefined;

  let structuredInputError = "";

  $: value = getPath(data, field.path);
  $: displayValue = value === undefined ? (field.constValue ?? field.defaultValue) : value;
  $: exactIssues = issues.filter((issue) => issuePathToFieldPath(issue) === field.path);
  $: descendantIssues = issues.filter((issue) => {
    const issuePath = issuePathToFieldPath(issue);
    const fieldTokens = tokens(field.path);
    const issueTokens = tokens(issuePath);
    return fieldTokens.every((token, index) => issueTokens[index] === token);
  });
  $: hasExactIssues = exactIssues.length > 0;
  $: hasDescendantIssues = descendantIssues.length > 0;
  $: isEnum = Boolean(field.enum?.length);
  $: useSegmentedEnum =
    Boolean(field.enum?.length) &&
    (field.enum?.length ?? 0) <= 5 &&
    field.enum?.every((option) => optionLabel(option).length <= 22);
  $: enumIndex = field.enum?.findIndex((option) => sameValue(option, displayValue)) ?? -1;
  $: numericValue = normalizeNumber(displayValue);
  $: ui = field.ui ?? {};
  $: isReadOnly = ui.readOnly === true || field.constValue !== undefined;
  $: effectiveMinimum = numericBoundary(field.minimum, field.exclusiveMinimum, field.type, ui.step, 1);
  $: effectiveMaximum = numericBoundary(field.maximum, field.exclusiveMaximum, field.type, ui.step, -1);
  $: hasRange =
    (field.type === "number" || field.type === "integer") &&
    Number.isFinite(effectiveMinimum) &&
    Number.isFinite(effectiveMaximum);
  $: usesLogScale =
    hasRange &&
    (field.widget === "log-slider" || ui.scale === "log") &&
    typeof effectiveMinimum === "number" &&
    typeof effectiveMaximum === "number" &&
    effectiveMinimum > 0 &&
    effectiveMaximum > effectiveMinimum;
  $: numberStep = ui.step !== undefined ? String(ui.step) : field.type === "integer" ? "1" : "any";
  $: rangeValue = usesLogScale
    ? logToRange(numericValue, effectiveMinimum ?? 1, effectiveMaximum ?? 10)
    : numericValue;
  $: rangeMin = usesLogScale ? 0 : effectiveMinimum;
  $: rangeMax = usesLogScale ? 1000 : effectiveMaximum;
  $: rangeStep = usesLogScale ? 1 : numberStep;
  $: rangeProgress = hasRange
    ? rangeProgressPercent(Number(rangeValue), Number(rangeMin), Number(rangeMax))
    : 0;
  $: typeIcon = fieldIcon(field);
  $: describedBy = `${fieldId(field.path)}-meta ${fieldId(field.path)}-issues`;

  function label(key: string, fallback: string) {
    return labels[key] ?? fallback;
  }

  function update(raw: string) {
    if (isReadOnly) return;

    if (field.type === "integer") {
      onChange(field.path, Number.parseInt(raw || String(field.defaultValue ?? 0), 10));
      return;
    }

    if (field.type === "number") {
      onChange(field.path, Number.parseFloat(raw || String(field.defaultValue ?? 0)));
      return;
    }

    onChange(field.path, raw);
  }

  function validateStructured(raw: string) {
    try {
      const parsed = JSON.parse(raw) as JsonValue;
      const valid =
        (field.type === "array" && Array.isArray(parsed)) ||
        (field.type === "object" &&
          typeof parsed === "object" &&
          parsed !== null &&
          !Array.isArray(parsed)) ||
        (field.type === "null" && parsed === null);
      return valid ? "" : label("invalidStructured", `Enter valid ${field.type} JSON.`);
    } catch {
      return label("invalidStructured", `Enter valid ${field.type} JSON.`);
    }
  }

  function validateStructuredInput(raw: string, input: HTMLTextAreaElement) {
    structuredInputError = validateStructured(raw);
    input.setCustomValidity(structuredInputError);
  }

  function updateStructured(raw: string, input: HTMLTextAreaElement) {
    if (isReadOnly) return;
    validateStructuredInput(raw, input);
    if (structuredInputError) {
      input.reportValidity();
      return;
    }

    try {
      const parsed = JSON.parse(raw) as JsonValue;
      onChange(field.path, parsed);
    } catch {
      // validateStructuredInput already exposes the error without replacing valid document data.
    }
  }

  async function unsetField() {
    onUnset?.(field.path);
    await tick();
    const control = document.getElementById(fieldId(field.path));
    if (control instanceof HTMLElement) {
      const focusTarget = control.matches("button, input, select, textarea")
        ? control
        : control.querySelector<HTMLElement>("button, input, select, textarea");
      focusTarget?.focus();
    }
  }

  function updateNumber(raw: string) {
    if (isReadOnly) return;

    const next = field.type === "integer" ? Number.parseInt(raw, 10) : Number.parseFloat(raw);
    if (!Number.isFinite(next)) return;
    onChange(field.path, next);
  }

  function updateRange(raw: string) {
    if (isReadOnly) return;

    if (usesLogScale && typeof effectiveMinimum === "number" && typeof effectiveMaximum === "number") {
      onChange(field.path, logFromRange(Number.parseFloat(raw), effectiveMinimum, effectiveMaximum));
      return;
    }

    updateNumber(raw);
  }

  function updateEnum(index: number) {
    if (isReadOnly) return;

    const option = field.enum?.[index];
    if (option !== undefined) {
      onChange(field.path, option);
    }
  }

  function toggleBoolean() {
    if (isReadOnly) return;
    onChange(field.path, !Boolean(displayValue));
  }

  function fieldId(path: string) {
    return `field-${path.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  }

  function issuePathToFieldPath(issue: ValidationIssue) {
    const path = issue.path;
    const base =
      !path || path === "/"
        ? ""
        : tokens(path).reduce((current, part) => appendPath(current, part), "");
    const missingProperty =
      issue.keyword === "required" && "missingProperty" in issue.params
        ? String(issue.params.missingProperty)
        : undefined;
    return missingProperty ? appendPath(base, missingProperty) : base;
  }

  function optionLabel(option: JsonValue | undefined) {
    return fieldOptionLabel(field.path, option, labels);
  }

  function sameValue(left: JsonValue | undefined, right: JsonValue | undefined) {
    return JSON.stringify(left) === JSON.stringify(right);
  }

  function normalizeNumber(nextValue: JsonValue | undefined) {
    return typeof nextValue === "number" && Number.isFinite(nextValue) ? nextValue : 0;
  }

  function formatMetaValue(nextValue: JsonValue | undefined) {
    if (nextValue === undefined) return label("notSet", "not set");
    if (field.enum?.some((option) => sameValue(option, nextValue))) {
      return optionLabel(nextValue);
    }
    if (typeof nextValue === "number") return formatNumber(nextValue);
    if (typeof nextValue === "string") return nextValue;
    return JSON.stringify(nextValue);
  }

  function formatNumber(value: number) {
    if (Number.isInteger(value)) return String(value);
    if (Math.abs(value) < 0.001 || Math.abs(value) >= 10000) return value.toExponential(2);
    return String(Number(value.toPrecision(5)));
  }

  function rangeProgressPercent(value: number, min: number, max: number) {
    if (!Number.isFinite(value) || !Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
      return 0;
    }

    return Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
  }

  function logToRange(value: number, min: number, max: number) {
    if (!Number.isFinite(value) || value <= 0) return 0;
    const logMin = Math.log10(min);
    const logMax = Math.log10(max);
    return Math.round(rangeProgressPercent(Math.log10(value), logMin, logMax) * 10);
  }

  function logFromRange(raw: number, min: number, max: number) {
    const ratio = Math.min(1, Math.max(0, raw / 1000));
    const next = 10 ** (Math.log10(min) + ratio * (Math.log10(max) - Math.log10(min)));
    if (field.type === "integer") return Math.round(next);
    return Number(next.toPrecision(4));
  }

  function numericBoundary(
    inclusive: number | undefined,
    exclusive: number | undefined,
    type: FieldModel["type"],
    step: number | undefined,
    direction: 1 | -1,
  ) {
    if (inclusive !== undefined) return inclusive;
    if (exclusive === undefined) return undefined;
    const increment =
      step ?? (type === "integer" ? 1 : Math.max(Math.abs(exclusive) * 1e-12, 1e-12));
    return exclusive + increment * direction;
  }

  function fieldIcon(nextField: FieldModel) {
    if (nextField.enum?.length) return ListFilter;
    if (nextField.type === "boolean") return ToggleRight;
    if (nextField.type === "number" || nextField.type === "integer") return Hash;
    if (nextField.widget === "textarea" || nextField.widget === "code") return AlignLeft;
    return Type;
  }
</script>

{#if field.type === "object" && (field.children?.length ?? 0) > 0}
  <section class="field-group" class:hasIssues={hasDescendantIssues}>
    <div class="group-head">
      <div class="field-title-block">
        <div>
          <h2>{field.title}</h2>
          {#if field.required}
            <span class="required">{label("required", "required")}</span>
          {/if}
        </div>
        {#if field.description}
          <p>{field.description}</p>
        {/if}
      </div>
      {#if hasDescendantIssues}
        <span class="issue-count">
          <AlertCircle size={14} />
          {descendantIssues.length}
        </span>
      {/if}
    </div>
    <div class="group-fields">
      {#each field.children ?? [] as child (child.path)}
        <svelte:self field={child} {data} {issues} {labels} {onChange} {onUnset} />
      {/each}
    </div>
  </section>
{:else}
  <section class="field-row" class:hasIssues={hasExactIssues}>
    <div class="field-copy">
      <div class="field-label">
        <span class="field-icon">
          <svelte:component this={typeIcon} size={15} />
        </span>
        <label id={`${fieldId(field.path)}-label`} for={fieldId(field.path)}>{field.title}</label>
        {#if field.required}
          <span class="required">{label("required", "required")}</span>
        {/if}
      </div>
      {#if field.description}
        <p>{field.description}</p>
      {/if}
      {#if ui.note}
        <p class="field-note">{ui.note}</p>
      {/if}
      <div class="field-meta" id={`${fieldId(field.path)}-meta`}>
        {#if isReadOnly}
          <span>{label("readOnly", "read-only")}</span>
        {/if}
        {#if field.defaultValue !== undefined}
          <span>{label("default", "default")}: {formatMetaValue(field.defaultValue)}</span>
        {/if}
        {#if field.minimum !== undefined}
          <span>{label("minimum", "min")}: {field.minimum}</span>
        {/if}
        {#if field.exclusiveMinimum !== undefined}
          <span>{label("minimum", "min")}: &gt; {field.exclusiveMinimum}</span>
        {/if}
        {#if field.maximum !== undefined}
          <span>{label("maximum", "max")}: {field.maximum}</span>
        {/if}
        {#if field.exclusiveMaximum !== undefined}
          <span>{label("maximum", "max")}: &lt; {field.exclusiveMaximum}</span>
        {/if}
        {#if ui.unit}
          <span>{label("unit", "unit")}: {ui.unit}</span>
        {/if}
        <span>{field.type}</span>
      </div>
    </div>

    <div class="field-control">
      {#if isEnum && useSegmentedEnum}
        <div
          id={fieldId(field.path)}
          class="enum-segments"
          role="group"
          aria-labelledby={`${fieldId(field.path)}-label`}
          aria-describedby={describedBy}
        >
          {#each field.enum ?? [] as option, index}
            <button
              type="button"
              class:active={sameValue(option, displayValue)}
              disabled={isReadOnly}
              aria-pressed={sameValue(option, displayValue)}
              on:click={() => updateEnum(index)}
            >
              {optionLabel(option)}
            </button>
          {/each}
        </div>
      {:else if isEnum}
        <div class="select-wrap">
          <select
            id={fieldId(field.path)}
            value={enumIndex >= 0 ? String(enumIndex) : ""}
            disabled={isReadOnly}
            aria-invalid={hasExactIssues}
            aria-describedby={describedBy}
            on:change={(event) => updateEnum(Number.parseInt(event.currentTarget.value, 10))}
          >
            <option value="" disabled>{label("notSet", "not set")}</option>
            {#each field.enum ?? [] as option, index}
              <option value={String(index)}>{optionLabel(option)}</option>
            {/each}
          </select>
          <span class="select-icon">
            <ChevronDown size={15} />
          </span>
        </div>
      {:else if field.type === "boolean"}
        <button
          id={fieldId(field.path)}
          class="switch"
          class:enabled={Boolean(displayValue)}
          class:invalid={hasExactIssues}
          type="button"
          disabled={isReadOnly}
          aria-pressed={Boolean(displayValue)}
          aria-describedby={describedBy}
          on:click={toggleBoolean}
        >
          <span>{Boolean(displayValue) ? label("enabled", "enabled") : label("disabled", "disabled")}</span>
          <i aria-hidden="true"></i>
        </button>
      {:else if field.type === "number" || field.type === "integer"}
        <div class="number-control" class:withRange={hasRange}>
          {#if hasRange}
            <div class="range-shell" class:logScale={usesLogScale}>
              <input
                id={fieldId(field.path)}
                type="range"
                min={rangeMin}
                max={rangeMax}
                step={rangeStep}
                value={rangeValue}
                style={`--range-progress: ${rangeProgress}%`}
                disabled={isReadOnly}
                aria-invalid={hasExactIssues}
                aria-describedby={describedBy}
                on:input={(event) => updateRange(event.currentTarget.value)}
              />
              <div class="range-meta">
                <span>{formatMetaValue(effectiveMinimum)}</span>
                <strong>
                  {formatMetaValue(displayValue)}
                  {#if ui.unit}
                    <em>{ui.unit}</em>
                  {/if}
                </strong>
                <span>{formatMetaValue(effectiveMaximum)}</span>
              </div>
            </div>
          {/if}
          <label class="number-input-wrap">
            <input
              id={hasRange ? `${fieldId(field.path)}-number` : fieldId(field.path)}
              type="number"
              min={effectiveMinimum}
              max={effectiveMaximum}
              step={numberStep}
              value={String(displayValue ?? 0)}
              placeholder={ui.placeholder}
              readonly={isReadOnly}
              aria-invalid={hasExactIssues}
              aria-describedby={describedBy}
              on:input={(event) => update(event.currentTarget.value)}
            />
            {#if ui.unit}
              <span>{ui.unit}</span>
            {/if}
          </label>
        </div>
      {:else if field.type === "array" || field.type === "object" || field.type === "null"}
        <textarea
          id={fieldId(field.path)}
          value={JSON.stringify(
            displayValue ?? (field.type === "array" ? [] : field.type === "null" ? null : {}),
            null,
            2,
          )}
          readonly={isReadOnly}
          spellcheck="false"
          aria-invalid={hasExactIssues || Boolean(structuredInputError)}
          aria-describedby={describedBy}
          on:input={(event) => validateStructuredInput(event.currentTarget.value, event.currentTarget)}
          on:change={(event) => updateStructured(event.currentTarget.value, event.currentTarget)}
        ></textarea>
      {:else if field.widget === "color"}
        <div class="color-control">
          <input
            id={fieldId(field.path)}
            type="color"
            value={String(displayValue ?? "#2563eb")}
            disabled={isReadOnly}
            aria-invalid={hasExactIssues}
            aria-describedby={describedBy}
            on:input={(event) => update(event.currentTarget.value)}
          />
          <input
            id={`${fieldId(field.path)}-text`}
            type="text"
            value={String(displayValue ?? "")}
            placeholder={ui.placeholder ?? "#2563eb"}
            readonly={isReadOnly}
            aria-invalid={hasExactIssues}
            aria-describedby={describedBy}
            on:input={(event) => update(event.currentTarget.value)}
          />
        </div>
      {:else if field.widget === "textarea" || field.widget === "code"}
        <textarea
          id={fieldId(field.path)}
          value={String(displayValue ?? "")}
          placeholder={ui.placeholder}
          readonly={isReadOnly}
          spellcheck="false"
          aria-invalid={hasExactIssues}
          aria-describedby={describedBy}
          on:input={(event) => update(event.currentTarget.value)}
        ></textarea>
      {:else}
        <input
          id={fieldId(field.path)}
          type={field.widget === "password" ? "password" : "text"}
          value={String(displayValue ?? "")}
          placeholder={ui.placeholder}
          readonly={isReadOnly}
          aria-invalid={hasExactIssues}
          aria-describedby={describedBy}
          on:input={(event) => update(event.currentTarget.value)}
        />
      {/if}

      <div class="field-issues" id={`${fieldId(field.path)}-issues`} aria-live="polite">
        {#if structuredInputError}
          <span>
            <AlertCircle size={14} />
            {structuredInputError}
          </span>
        {/if}
        {#each exactIssues as issue}
          <span>
            <AlertCircle size={14} />
            {issue.message}
          </span>
        {/each}
      </div>
      {#if !field.required && value !== undefined && !isReadOnly && onUnset}
        <button
          class="unset-button"
          type="button"
          on:click={() => void unsetField()}
          title={label("notSet", "not set")}
          aria-label={label("notSet", "not set")}
        >
          <X size={14} />
        </button>
      {/if}
    </div>
  </section>
{/if}

<style>
  .field-group,
  .field-row {
    border: 1px solid var(--line);
    border-radius: var(--radius, 8px);
    background: var(--control, color-mix(in srgb, var(--panel) 93%, var(--panel-strong)));
    box-shadow: var(--shadow-sm, none);
  }

  .field-group {
    display: grid;
  }

  .field-group.hasIssues,
  .field-row.hasIssues {
    border-color: color-mix(in srgb, var(--danger, #dc2626) 54%, var(--line));
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--danger, #dc2626) 12%, transparent);
  }

  .group-head {
    display: flex;
    justify-content: space-between;
    gap: 14px;
    padding: 14px 14px 11px;
    border-bottom: 1px solid var(--line);
    background: var(--surface-raised, color-mix(in srgb, var(--panel-strong) 44%, transparent));
  }

  .field-title-block {
    display: grid;
    gap: 5px;
    min-width: 0;
  }

  .field-title-block > div {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  }

  .group-head h2 {
    margin: 0;
    font-size: 0.98rem;
    line-height: 1.2;
  }

  .group-head p,
  .field-copy p {
    margin: 0;
    color: var(--muted);
    line-height: 1.45;
  }

  .field-copy .field-note {
    padding: 7px 9px;
    border: 1px solid color-mix(in srgb, var(--accent) 18%, var(--line));
    border-radius: calc(var(--radius, 8px) - 2px);
    background: var(--accent-soft, color-mix(in srgb, var(--accent) 8%, transparent));
    color: var(--text);
    font-size: 0.82rem;
  }

  .group-fields {
    display: grid;
    gap: 10px;
    padding: 12px;
  }

  .field-row {
    display: grid;
    grid-template-columns: minmax(150px, 0.88fr) minmax(0, 1fr);
    gap: 12px 18px;
    align-items: start;
    padding: 12px;
  }

  .field-copy {
    display: grid;
    gap: 6px;
    min-width: 0;
  }

  .field-label {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    min-width: 0;
  }

  .field-label label {
    min-width: 0;
    overflow-wrap: anywhere;
    font-weight: 700;
    line-height: 1.2;
  }

  .field-icon {
    display: inline-grid;
    width: 24px;
    height: 24px;
    place-items: center;
    border: 1px solid color-mix(in srgb, var(--accent) 20%, var(--line));
    border-radius: calc(var(--radius, 8px) - 2px);
    background: var(--accent-soft, color-mix(in srgb, var(--accent) 8%, transparent));
    color: var(--accent);
  }

  .required,
  .issue-count,
  .field-meta span {
    display: inline-flex;
    align-items: center;
    min-height: 20px;
    border-radius: 999px;
    font-size: 0.76rem;
    font-weight: 700;
    line-height: 1;
  }

  .required {
    padding: 0 7px;
    background: color-mix(in srgb, var(--accent) 10%, transparent);
    color: var(--accent);
  }

  .issue-count {
    gap: 5px;
    align-self: start;
    padding: 0 7px;
    background: color-mix(in srgb, var(--danger, #dc2626) 10%, transparent);
    color: var(--danger, #dc2626);
  }

  .field-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    min-height: 20px;
  }

  .field-meta span {
    padding: 0 6px;
    background: color-mix(in srgb, var(--panel-strong) 74%, transparent);
    color: var(--muted);
  }

  .field-control {
    container-name: field-control;
    container-type: inline-size;
    display: grid;
    gap: 7px;
    min-width: 0;
  }

  .unset-button {
    display: inline-grid;
    width: 30px;
    height: 30px;
    place-items: center;
    justify-self: end;
    border: 1px solid var(--line);
    border-radius: var(--radius, 8px);
    background: transparent;
    color: var(--muted);
  }

  .field-control input,
  .field-control select,
  .field-control textarea {
    width: 100%;
    min-width: 0;
    min-height: calc(36px * var(--density, 1));
    border: 1px solid var(--line);
    border-radius: var(--radius, 8px);
    background: var(--surface-raised, var(--panel));
    color: var(--text);
    font: inherit;
    transition:
      background-color var(--motion-fast, 120ms) ease,
      border-color var(--motion-fast, 120ms) ease,
      box-shadow var(--motion-fast, 120ms) ease;
  }

  .field-control input,
  .field-control select {
    padding: 0 10px;
  }

  .field-control textarea {
    min-height: 92px;
    padding: 10px;
    resize: vertical;
    font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
    line-height: 1.5;
  }

  .field-control input:hover,
  .field-control select:hover,
  .field-control textarea:hover {
    border-color: color-mix(in srgb, var(--accent) 28%, var(--line));
  }

  .field-control input:focus-visible,
  .field-control select:focus-visible,
  .field-control textarea:focus-visible,
  .enum-segments button:focus-visible,
  .switch:focus-visible {
    outline: 2px solid var(--focus-ring, color-mix(in srgb, var(--accent) 70%, white));
    outline-offset: 2px;
  }

  .field-control input[aria-invalid="true"],
  .field-control select[aria-invalid="true"],
  .field-control textarea[aria-invalid="true"] {
    border-color: color-mix(in srgb, var(--danger, #dc2626) 62%, var(--line));
  }

  .field-control input:read-only,
  .field-control textarea:read-only {
    color: var(--muted);
  }

  .field-control input:disabled,
  .field-control select:disabled,
  .field-control textarea:disabled,
  .enum-segments button:disabled,
  .switch:disabled {
    cursor: not-allowed;
    opacity: 0.68;
  }

  .select-wrap {
    position: relative;
    display: grid;
    align-items: center;
  }

  .select-wrap select {
    appearance: none;
    padding-right: 34px;
  }

  .select-icon {
    position: absolute;
    right: 10px;
    color: var(--muted);
    pointer-events: none;
  }

  .enum-segments {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    min-width: 0;
    padding: 3px;
    border: 1px solid var(--line);
    border-radius: var(--radius, 8px);
    background: var(--control, color-mix(in srgb, var(--panel-strong) 70%, transparent));
  }

  .enum-segments button {
    min-width: 0;
    min-height: 30px;
    padding: 0 10px;
    border: 1px solid transparent;
    border-radius: calc(var(--radius, 8px) - 2px);
    color: var(--muted);
    font: inherit;
    font-weight: 700;
    overflow-wrap: anywhere;
  }

  .enum-segments button.active {
    border-color: color-mix(in srgb, var(--accent) 32%, var(--line));
    background: var(--surface-raised, var(--panel));
    color: var(--text);
    box-shadow: var(--shadow-sm, 0 8px 18px rgb(0 0 0 / 8%));
  }

  .switch {
    display: flex;
    gap: 12px;
    align-items: center;
    justify-content: space-between;
    width: min(220px, 100%);
    min-height: calc(36px * var(--density, 1));
    padding: 0 5px 0 11px;
    border: 1px solid var(--line);
    border-radius: var(--radius, 8px);
    background: var(--panel);
    color: var(--muted);
    font: inherit;
    font-weight: 700;
  }

  .switch.enabled {
    border-color: color-mix(in srgb, var(--accent) 42%, var(--line));
    background: color-mix(in srgb, var(--accent) 8%, var(--panel));
    color: var(--text);
  }

  .switch.invalid {
    border-color: color-mix(in srgb, var(--danger, #dc2626) 62%, var(--line));
  }

  .switch i {
    position: relative;
    flex: 0 0 34px;
    width: 34px;
    height: 20px;
    border: 1px solid var(--line);
    border-radius: 999px;
    background: color-mix(in srgb, var(--surface) 80%, var(--panel));
  }

  .switch i::after {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 14px;
    height: 14px;
    border-radius: 999px;
    background: var(--muted);
    content: "";
    transition:
      background 150ms ease,
      transform 150ms ease;
  }

  .switch.enabled i {
    border-color: color-mix(in srgb, var(--accent) 54%, var(--line));
    background: color-mix(in srgb, var(--accent) 20%, var(--panel));
  }

  .switch.enabled i::after {
    background: var(--accent);
    transform: translateX(14px);
  }

  .number-control {
    display: grid;
    gap: 8px;
    min-width: 0;
  }

  .number-control.withRange {
    grid-template-columns: minmax(150px, 1fr) minmax(104px, 148px);
    align-items: center;
  }

  .range-shell {
    display: grid;
    gap: 6px;
    min-width: 0;
  }

  .range-shell input[type="range"] {
    min-height: 22px;
    padding: 0;
    accent-color: var(--accent);
    background: transparent;
  }

  .range-meta {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
    gap: 8px;
    align-items: center;
    color: var(--muted);
    font-size: 0.76rem;
    font-variant-numeric: tabular-nums;
  }

  .range-meta span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .range-meta span:last-child {
    text-align: right;
  }

  .range-meta strong {
    display: inline-flex;
    align-items: baseline;
    gap: 4px;
    max-width: min(170px, 100%);
    min-width: 0;
    padding: 2px 7px;
    overflow: hidden;
    border: 1px solid color-mix(in srgb, var(--accent) 22%, var(--line));
    border-radius: 999px;
    background: var(--accent-soft, color-mix(in srgb, var(--accent) 8%, transparent));
    color: var(--text);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .range-meta em {
    overflow: hidden;
    color: var(--muted);
    font-style: normal;
    font-size: 0.72rem;
    text-overflow: ellipsis;
  }

  .number-input-wrap {
    position: relative;
    display: grid;
    min-width: 0;
  }

  .number-input-wrap input {
    appearance: textfield;
    padding-right: 10px;
  }

  .number-input-wrap input::-webkit-inner-spin-button,
  .number-input-wrap input::-webkit-outer-spin-button {
    margin: 0;
    appearance: none;
  }

  .number-input-wrap span {
    position: absolute;
    top: 50%;
    right: 10px;
    max-width: 44%;
    overflow: hidden;
    color: var(--muted);
    font-size: 0.78rem;
    font-weight: 700;
    text-overflow: ellipsis;
    transform: translateY(-50%);
    white-space: nowrap;
    pointer-events: none;
  }

  .number-input-wrap:has(span) input {
    padding-right: max(48px, 34%);
  }

  .color-control {
    display: grid;
    grid-template-columns: 48px minmax(0, 1fr);
    gap: 8px;
    align-items: center;
  }

  .color-control input[type="color"] {
    min-height: calc(36px * var(--density, 1));
    padding: 3px;
  }

  .field-issues {
    display: grid;
    gap: 5px;
    min-height: 0;
  }

  .field-issues span {
    display: flex;
    gap: 6px;
    align-items: center;
    color: var(--danger, #dc2626);
    font-size: 0.82rem;
    font-weight: 700;
    line-height: 1.35;
  }

  button:hover {
    border-color: color-mix(in srgb, var(--accent) 34%, var(--line));
  }

  @container field-control (max-width: 320px) {
    .number-control.withRange {
      grid-template-columns: minmax(0, 1fr);
    }
  }

  @container form-pane (max-width: 520px) {
    .field-row {
      grid-template-columns: minmax(0, 1fr);
    }

    .number-control.withRange {
      grid-template-columns: minmax(0, 1fr);
    }

    .range-meta {
      grid-template-columns: 1fr auto 1fr;
    }

    .switch {
      width: 100%;
    }
  }

  @media (max-width: 720px) {
    .field-row,
    .number-control.withRange {
      grid-template-columns: minmax(0, 1fr);
    }

    .switch {
      width: 100%;
    }
  }
</style>
