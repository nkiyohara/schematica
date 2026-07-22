<script lang="ts">
  import Check from "@lucide/svelte/icons/check";
  import Monitor from "@lucide/svelte/icons/monitor";
  import Moon from "@lucide/svelte/icons/moon";
  import Sun from "@lucide/svelte/icons/sun";
  import { tick, type Component } from "svelte";
  import {
    accentPresets,
    appearanceContrastModes,
    appearanceMotionModes,
    appearancePalettes,
    densityOptions,
    fontPresets,
    monoFontPresets,
    type AppearancePreset,
    type AppearancePresetId,
    type FontPreset,
  } from "./appearance-catalog";
  import type { AppAppearance } from "./app-config";

  type AppearancePath =
    | "appearance.theme"
    | "appearance.palette"
    | "appearance.accent"
    | "appearance.density"
    | "appearance.contrast"
    | "appearance.motion"
    | "appearance.fontFamily"
    | "appearance.monoFontFamily"
    | "appearance.fontSize"
    | "appearance.cornerRadius";

  interface ThemeOption {
    id: AppAppearance["theme"];
    icon: Component;
  }

  export let appearance: AppAppearance;
  export let effectiveDark = false;
  export let labels: Record<string, string>;
  export let presets: readonly (AppearancePreset & { id: AppearancePresetId })[] = [];
  export let activePresetId: AppearancePresetId | "custom" = "custom";
  export let presetChanges: Record<string, number> = {};
  export let onChange: (path: AppearancePath, value: string | number) => void;
  export let onPreset: (id: AppearancePresetId) => void = () => {};

  const customFontValue = "__custom__";
  let accentDraft = appearance.accent;
  let accentEditing = false;
  let accentInvalid = false;
  let fontDraft = appearance.fontFamily;
  let fontEditing = false;
  let fontInvalid = false;
  let fontCustomMode = presetValue(fontPresets, appearance.fontFamily) === customFontValue;
  let fontCustomInput: HTMLInputElement;
  let observedFont = appearance.fontFamily;
  let monoFontDraft = appearance.monoFontFamily;
  let monoFontEditing = false;
  let monoFontInvalid = false;
  let monoFontCustomMode =
    presetValue(monoFontPresets, appearance.monoFontFamily) === customFontValue;
  let monoFontCustomInput: HTMLInputElement;
  let observedMonoFont = appearance.monoFontFamily;

  const themes: ThemeOption[] = [
    { id: "system", icon: Monitor },
    { id: "light", icon: Sun },
    { id: "dark", icon: Moon },
  ];

  const palettes = Object.values(appearancePalettes);
  const densities = Object.values(densityOptions);
  const contrastModes = [...appearanceContrastModes];
  const motionModes = [...appearanceMotionModes];

  $: previewTheme = effectiveDark ? "dark" : "light";
  $: previewStyle = [
    `--preview-font: ${appearance.fontFamily}`,
    `--preview-mono: ${appearance.monoFontFamily}`,
    `--preview-radius: ${appearance.cornerRadius}px`,
  ].join(";");
  $: activeProfileLabel =
    activePresetId === "custom"
      ? label("profile.custom", "Custom")
      : label(`preset.${activePresetId}.title`, titleCase(activePresetId));
  $: if (!accentEditing) accentDraft = appearance.accent;
  $: if (appearance.fontFamily !== observedFont) {
    observedFont = appearance.fontFamily;
    if (!fontEditing) {
      fontDraft = appearance.fontFamily;
      fontCustomMode = presetValue(fontPresets, appearance.fontFamily) === customFontValue;
    }
  }
  $: if (appearance.monoFontFamily !== observedMonoFont) {
    observedMonoFont = appearance.monoFontFamily;
    if (!monoFontEditing) {
      monoFontDraft = appearance.monoFontFamily;
      monoFontCustomMode =
        presetValue(monoFontPresets, appearance.monoFontFamily) === customFontValue;
    }
  }

  function label(key: string, fallback: string, params: Record<string, string | number> = {}) {
    return (labels[key] ?? fallback).replace(/\{(\w+)\}/g, (_match, name) =>
      String(params[name] ?? `{${name}}`),
    );
  }

  function titleCase(value: string) {
    return value
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }

  function updateNumber(path: AppearancePath, raw: string, min: number, max: number) {
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed)) return;
    onChange(path, Math.min(max, Math.max(min, parsed)));
  }

  function presetValue(presets: FontPreset[], value: string) {
    return presets.some((preset) => preset.value === value) ? value : customFontValue;
  }

  async function updateFontPreset(path: AppearancePath, value: string) {
    const isMono = path === "appearance.monoFontFamily";
    if (value === customFontValue) {
      if (isMono) monoFontCustomMode = true;
      else fontCustomMode = true;
      await tick();
      const input = isMono ? monoFontCustomInput : fontCustomInput;
      input?.focus();
      input?.select();
      return;
    }

    if (isMono) {
      monoFontCustomMode = false;
      monoFontEditing = false;
      monoFontInvalid = false;
      monoFontDraft = value;
    } else {
      fontCustomMode = false;
      fontEditing = false;
      fontInvalid = false;
      fontDraft = value;
    }
    selectValue(path, value, isMono ? appearance.monoFontFamily : appearance.fontFamily);
  }

  function selectValue(path: AppearancePath, value: string, current: string) {
    if (value !== current) onChange(path, value);
  }

  function updateAccent(raw: string, input: HTMLInputElement) {
    accentDraft = raw;
    accentInvalid = !/^#[\da-f]{6}$/i.test(raw);
    input.setCustomValidity(
      accentInvalid ? label("invalidAccent", "Enter a 6-digit HEX color such as #2563eb.") : "",
    );
    if (!accentInvalid) selectValue("appearance.accent", raw.toLowerCase(), appearance.accent);
  }

  function updateFont(
    kind: "ui" | "mono",
    raw: string,
    input: HTMLInputElement,
  ) {
    const invalid = !raw.trim() || /[;{}]/.test(raw);
    input.setCustomValidity(
      invalid ? label("invalidFont", "Enter a font family without ;, {, or }.") : "",
    );
    if (kind === "mono") {
      monoFontDraft = raw;
      monoFontInvalid = invalid;
      if (!invalid) {
        selectValue("appearance.monoFontFamily", raw.trim(), appearance.monoFontFamily);
      }
    } else {
      fontDraft = raw;
      fontInvalid = invalid;
      if (!invalid) selectValue("appearance.fontFamily", raw.trim(), appearance.fontFamily);
    }
  }

  function finishCustomInput(input: HTMLInputElement, kind: "accent" | "ui" | "mono") {
    if (!input.checkValidity()) {
      input.reportValidity();
      return;
    }
    if (kind === "accent") accentEditing = false;
    else if (kind === "mono") monoFontEditing = false;
    else fontEditing = false;
  }

  function handleChoiceKeydown(
    event: KeyboardEvent,
    index: number,
    count: number,
    select: (index: number) => void,
  ) {
    let next = index;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (index + 1) % count;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      next = (index - 1 + count) % count;
    } else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = count - 1;
    else return;

    event.preventDefault();
    select(next);
    const current = event.currentTarget;
    if (!(current instanceof HTMLButtonElement)) return;
    const buttons = current.parentElement?.querySelectorAll<HTMLButtonElement>(":scope > button");
    buttons?.[next]?.focus();
  }
</script>

<section class="appearance-panel" style={previewStyle}>
  <header class="appearance-hero">
    <div class="appearance-copy">
      <div>
        <span class="eyebrow">{label("eyebrow", "Workspace")}</span>
        <h2>{label("title", "Appearance")}</h2>
      </div>

      <div class="theme-cards" aria-label={label("theme", "Theme")}>
        {#each themes as theme, index (theme.id)}
          <button
            class:active={appearance.theme === theme.id}
            type="button"
            aria-label={label(`theme.${theme.id}.title`, titleCase(theme.id))}
            aria-pressed={appearance.theme === theme.id}
            title={`${label(`theme.${theme.id}.title`, titleCase(theme.id))} — ${label(`theme.${theme.id}.detail`, "")}`}
            on:click={() => selectValue("appearance.theme", theme.id, appearance.theme)}
            on:keydown={(event) =>
              handleChoiceKeydown(event, index, themes.length, (next) =>
                selectValue("appearance.theme", themes[next].id, appearance.theme),
              )}
          >
            <span>
              <svelte:component this={theme.icon} size={16} />
            </span>
            <strong>{label(`theme.${theme.id}.title`, titleCase(theme.id))}</strong>
            <small>{label(`theme.${theme.id}.detail`, "")}</small>
          </button>
        {/each}
      </div>

      <div class="active-theme" role="status" aria-live="polite">
        <span class={previewTheme}></span>
        {label("currentMode", "Currently {mode}", {
          mode: previewTheme === "dark" ? label("dark", "dark") : label("light", "light"),
        })}
      </div>

      {#if presets.length > 0}
        <div class="profile-section">
          <div class="profile-head">
            <span>{label("profile", "Profile")}</span>
            <small aria-live="polite">{activeProfileLabel}</small>
          </div>
          <div class="profile-grid">
            {#each presets as preset, index (preset.id)}
              <button
                class:active={activePresetId === preset.id}
                type="button"
                style={`--preset-accent: ${preset.accent}`}
                aria-pressed={activePresetId === preset.id}
                title={`${label(`preset.${preset.id}.title`, titleCase(preset.id))} — ${label(`preset.${preset.id}.detail`, titleCase(preset.palette))}`}
                on:click={() => activePresetId !== preset.id && onPreset(preset.id)}
                on:keydown={(event) =>
                  handleChoiceKeydown(event, index, presets.length, (next) => {
                    const nextPreset = presets[next];
                    if (activePresetId !== nextPreset.id) onPreset(nextPreset.id);
                  })}
              >
                <span class="preset-swatches">
                  {#each appearancePalettes[preset.palette].swatches as swatch}
                    <i style={`background: ${swatch}`}></i>
                  {/each}
                  <i class="accent"></i>
                </span>
                <strong>{label(`preset.${preset.id}.title`, titleCase(preset.id))}</strong>
                <small>{label(`preset.${preset.id}.detail`, titleCase(preset.palette))}</small>
                {#if activePresetId === preset.id}
                  <em class="active-preset">
                    <Check size={12} />
                    {label("profile.active", "Active")}
                  </em>
                {:else if presetChanges[preset.id] > 0}
                  <em>{label("profile.changes", "{count} changes", { count: presetChanges[preset.id] })}</em>
                {/if}
              </button>
            {/each}
          </div>
        </div>
      {/if}
    </div>

    <div
      class={`live-preview ${previewTheme}`}
      role="img"
      aria-label={label("preview", "Live preview")}
    >
      <div class="preview-sidebar">
        <span></span>
        <span></span>
        <span></span>
      </div>
      <div class="preview-main">
        <div class="preview-top">
          <strong>{label("previewTitle", "config.yaml")}</strong>
          <span></span>
        </div>
        <div class="preview-tabs">
          <i></i>
          <i></i>
          <i></i>
        </div>
        <div class="preview-form">
          <span>{label("sampleKey", "learning_rate")}</span>
          <code>{label("sampleValue", "0.0003")}</code>
          <div></div>
        </div>
      </div>
    </div>
  </header>

  <div class="appearance-grid">
    <section class="appearance-section palette-section">
      <div class="section-label">
        <span>{label("palette", "Palette")}</span>
        <small>{titleCase(appearance.palette)}</small>
      </div>
      <div class="palette-list" aria-label={label("palette", "Palette")}>
        {#each palettes as palette, index (palette.id)}
          <button
            class:active={appearance.palette === palette.id}
            type="button"
            title={titleCase(palette.id)}
            aria-label={titleCase(palette.id)}
            aria-pressed={appearance.palette === palette.id}
            on:click={() => selectValue("appearance.palette", palette.id, appearance.palette)}
            on:keydown={(event) =>
              handleChoiceKeydown(event, index, palettes.length, (next) =>
                selectValue("appearance.palette", palettes[next].id, appearance.palette),
              )}
          >
            {#each palette.swatches as swatch}
              <i style={`background: ${swatch}`}></i>
            {/each}
            <strong>{titleCase(palette.id)}</strong>
            {#if appearance.palette === palette.id}
              <Check size={14} />
            {/if}
          </button>
        {/each}
      </div>
    </section>

    <section class="appearance-section accent-section">
      <div class="section-label">
        <span>{label("accent", "Accent color")}</span>
        <small>{appearance.accent}</small>
      </div>
      <div class="accent-list" aria-label={label("accent", "Accent color")}>
        {#each accentPresets as accent, index}
          <button
            class:active={appearance.accent.toLowerCase() === accent}
            type="button"
            title={accent}
            aria-label={accent}
            aria-pressed={appearance.accent.toLowerCase() === accent}
            style={`--swatch: ${accent}`}
            on:click={() => selectValue("appearance.accent", accent, appearance.accent.toLowerCase())}
            on:keydown={(event) =>
              handleChoiceKeydown(event, index, accentPresets.length, (next) =>
                selectValue("appearance.accent", accentPresets[next], appearance.accent.toLowerCase()),
              )}
          ></button>
        {/each}
        <div class="custom-accent">
          <label
            class="color-picker"
            class:active={!accentPresets.some((accent) => appearance.accent.toLowerCase() === accent)}
            title={label("customAccent", "Custom accent")}
          >
            <input
              type="color"
              value={appearance.accent}
              aria-label={label("customAccent", "Custom accent")}
              on:input={(event) => {
                accentEditing = false;
                accentDraft = event.currentTarget.value;
                accentInvalid = false;
                selectValue("appearance.accent", event.currentTarget.value, appearance.accent);
              }}
            />
          </label>
          <input
            class="accent-text"
            value={accentDraft}
            aria-label={label("customAccent", "Custom accent")}
            aria-invalid={accentInvalid}
            maxlength="7"
            pattern="#[0-9a-fA-F]{6}"
            placeholder="#2563eb"
            spellcheck="false"
            on:focus={() => (accentEditing = true)}
            on:input={(event) => updateAccent(event.currentTarget.value, event.currentTarget)}
            on:blur={(event) => finishCustomInput(event.currentTarget, "accent")}
          />
        </div>
      </div>
    </section>

    <section class="appearance-section density-section">
      <div class="section-label">
        <span>{label("density", "Density")}</span>
        <small>{titleCase(appearance.density)}</small>
      </div>
      <div class="density-list" aria-label={label("density", "Density")}>
        {#each densities as density, index}
          <button
            class:active={appearance.density === density.id}
            type="button"
            aria-pressed={appearance.density === density.id}
            title={titleCase(density.id)}
            on:click={() => selectValue("appearance.density", density.id, appearance.density)}
            on:keydown={(event) =>
              handleChoiceKeydown(event, index, densities.length, (next) =>
                selectValue("appearance.density", densities[next].id, appearance.density),
              )}
          >
            <span>{titleCase(density.id)}</span>
            <i style={`width: ${density.bars[0]}%`}></i>
            <i style={`width: ${density.bars[1]}%`}></i>
            <i style={`width: ${density.bars[2]}%`}></i>
          </button>
        {/each}
      </div>
    </section>

    <section class="appearance-section accessibility-section">
      <div class="section-label">
        <span>{label("accessibility", "Accessibility")}</span>
        <small>
          {label(`contrast.${appearance.contrast}`, titleCase(appearance.contrast))} ·
          {label(`motion.${appearance.motion}`, titleCase(appearance.motion))}
        </small>
      </div>

      <div class="preference-grid">
        <div class="preference-control">
          <span>{label("contrast", "Contrast")}</span>
          <div class="mode-list" aria-label={label("contrast", "Contrast")}>
            {#each contrastModes as mode, index}
              <button
                class:active={appearance.contrast === mode}
                type="button"
                aria-pressed={appearance.contrast === mode}
                title={label(`contrast.${mode}`, titleCase(mode))}
                on:click={() => selectValue("appearance.contrast", mode, appearance.contrast)}
                on:keydown={(event) =>
                  handleChoiceKeydown(event, index, contrastModes.length, (next) =>
                    selectValue("appearance.contrast", contrastModes[next], appearance.contrast),
                  )}
              >
                {label(`contrast.${mode}`, titleCase(mode))}
              </button>
            {/each}
          </div>
        </div>

        <div class="preference-control">
          <span>{label("motion", "Motion")}</span>
          <div class="mode-list motion-list" aria-label={label("motion", "Motion")}>
            {#each motionModes as mode, index}
              <button
                class:active={appearance.motion === mode}
                type="button"
                aria-pressed={appearance.motion === mode}
                title={label(`motion.${mode}`, titleCase(mode))}
                on:click={() => selectValue("appearance.motion", mode, appearance.motion)}
                on:keydown={(event) =>
                  handleChoiceKeydown(event, index, motionModes.length, (next) =>
                    selectValue("appearance.motion", motionModes[next], appearance.motion),
                  )}
              >
                {label(`motion.${mode}`, titleCase(mode))}
              </button>
            {/each}
          </div>
        </div>
      </div>
    </section>

    <section class="appearance-section font-section">
      <div class="section-label">
        <span>{label("typography", "Typography")}</span>
        <small>{label("fontSizeValue", "{value}px", { value: appearance.fontSize })}</small>
      </div>

      <div class="font-grid">
        <label>
          <span>{label("fontFamily", "UI font")}</span>
          <select
            value={fontCustomMode ? customFontValue : presetValue(fontPresets, appearance.fontFamily)}
            on:change={(event) => updateFontPreset("appearance.fontFamily", event.currentTarget.value)}
          >
            {#each fontPresets as preset}
              <option value={preset.value}>{preset.label}</option>
            {/each}
            <option value={customFontValue}>{label("customFont", "Custom")}</option>
          </select>
          {#if fontCustomMode}
            <input
              bind:this={fontCustomInput}
              value={fontDraft}
              aria-label={`${label("fontFamily", "UI font")} — ${label("customFont", "Custom")}`}
              aria-invalid={fontInvalid}
              autocomplete="off"
              spellcheck="false"
              on:focus={() => (fontEditing = true)}
              on:input={(event) => updateFont("ui", event.currentTarget.value, event.currentTarget)}
              on:blur={(event) => finishCustomInput(event.currentTarget, "ui")}
            />
          {/if}
        </label>

        <label>
          <span>{label("monoFontFamily", "Monospace font")}</span>
          <select
            value={monoFontCustomMode
              ? customFontValue
              : presetValue(monoFontPresets, appearance.monoFontFamily)}
            on:change={(event) =>
              updateFontPreset("appearance.monoFontFamily", event.currentTarget.value)}
          >
            {#each monoFontPresets as preset}
              <option value={preset.value}>{preset.label}</option>
            {/each}
            <option value={customFontValue}>{label("customFont", "Custom")}</option>
          </select>
          {#if monoFontCustomMode}
            <input
              bind:this={monoFontCustomInput}
              value={monoFontDraft}
              aria-label={`${label("monoFontFamily", "Monospace font")} — ${label("customFont", "Custom")}`}
              aria-invalid={monoFontInvalid}
              autocomplete="off"
              spellcheck="false"
              on:focus={() => (monoFontEditing = true)}
              on:input={(event) => updateFont("mono", event.currentTarget.value, event.currentTarget)}
              on:blur={(event) => finishCustomInput(event.currentTarget, "mono")}
            />
          {/if}
        </label>
      </div>
    </section>

    <section class="appearance-section tune-section">
      <label>
        <span id="appearance-font-size-label">{label("fontSize", "Font size")}</span>
        <output for="appearance-font-size" aria-live="polite">
          {label("fontSizeValue", "{value}px", { value: appearance.fontSize })}
        </output>
        <input
          id="appearance-font-size"
          type="range"
          min="12"
          max="20"
          value={appearance.fontSize}
          aria-labelledby="appearance-font-size-label"
          aria-valuetext={label("fontSizeValue", "{value}px", { value: appearance.fontSize })}
          on:input={(event) => updateNumber("appearance.fontSize", event.currentTarget.value, 12, 20)}
        />
      </label>

      <label>
        <span id="appearance-corner-radius-label">{label("cornerRadius", "Corner radius")}</span>
        <output for="appearance-corner-radius" aria-live="polite">
          {label("radiusValue", "{value}px", { value: appearance.cornerRadius })}
        </output>
        <input
          id="appearance-corner-radius"
          type="range"
          min="2"
          max="12"
          value={appearance.cornerRadius}
          aria-labelledby="appearance-corner-radius-label"
          aria-valuetext={label("radiusValue", "{value}px", { value: appearance.cornerRadius })}
          on:input={(event) =>
            updateNumber("appearance.cornerRadius", event.currentTarget.value, 2, 12)}
        />
      </label>
    </section>
  </div>
</section>

<style>
  .appearance-panel {
    container-type: inline-size;
    display: grid;
    gap: 18px;
    min-width: 0;
    padding: 16px;
    border: 1px solid var(--line);
    border-radius: var(--radius, 8px);
    background:
      linear-gradient(
        140deg,
        color-mix(in srgb, var(--accent) 7%, transparent),
        transparent 38%
      ),
      color-mix(in srgb, var(--panel) 95%, var(--panel-strong));
  }

  .appearance-hero {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(260px, 420px);
    gap: 18px;
    align-items: stretch;
    min-width: 0;
  }

  .appearance-copy {
    display: grid;
    align-content: start;
    gap: 14px;
    min-width: 0;
  }

  .appearance-copy > div:first-child {
    display: grid;
    gap: 4px;
  }

  .eyebrow,
  .profile-head span,
  .section-label span,
  .preference-control > span,
  .font-grid label > span,
  .tune-section label > span {
    color: var(--muted);
    font-size: 0.74rem;
    font-weight: 800;
    letter-spacing: 0;
    text-transform: uppercase;
  }

  h2 {
    margin: 0;
    font-size: 1.08rem;
    line-height: 1.15;
  }

  .theme-cards {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
  }

  .theme-cards button {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 4px 8px;
    align-items: center;
    min-width: 0;
    min-height: 74px;
    padding: 10px;
    border: 1px solid var(--line);
    background: var(--control, color-mix(in srgb, var(--panel) 88%, var(--panel-strong)));
    text-align: left;
  }

  .theme-cards button.active {
    border-color: color-mix(in srgb, var(--accent) 54%, var(--line));
    background: color-mix(in srgb, var(--accent) 10%, var(--panel));
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 15%, transparent);
  }

  .theme-cards button > span {
    display: grid;
    width: 30px;
    height: 30px;
    grid-row: span 2;
    place-items: center;
    border: 1px solid color-mix(in srgb, var(--accent) 22%, var(--line));
    border-radius: var(--radius, 8px);
    color: var(--accent);
  }

  .theme-cards strong,
  .theme-cards small {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .theme-cards small,
  .active-theme,
  .section-label small {
    color: var(--muted);
  }

  .active-theme {
    display: flex;
    gap: 8px;
    align-items: center;
    min-width: 0;
    font-size: 0.84rem;
  }

  .active-theme span {
    width: 9px;
    height: 9px;
    border-radius: 999px;
    background: #f59e0b;
    box-shadow: 0 0 0 4px color-mix(in srgb, #f59e0b 14%, transparent);
  }

  .active-theme span.dark {
    background: #60a5fa;
    box-shadow: 0 0 0 4px color-mix(in srgb, #60a5fa 14%, transparent);
  }

  .profile-section {
    display: grid;
    gap: 9px;
    min-width: 0;
    padding: 10px;
    border: 1px solid var(--line);
    border-radius: var(--radius, 8px);
    background: color-mix(in srgb, var(--panel) 82%, var(--panel-strong));
  }

  .profile-head {
    display: flex;
    gap: 10px;
    align-items: baseline;
    justify-content: space-between;
    min-width: 0;
  }

  .profile-head small {
    min-width: 0;
    overflow: hidden;
    color: var(--muted);
    font-size: 0.8rem;
    font-weight: 700;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .profile-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(112px, 1fr));
    gap: 7px;
  }

  .profile-grid button {
    display: grid;
    gap: 6px;
    min-width: 0;
    min-height: 122px;
    align-content: start;
    padding: 8px;
    border: 1px solid var(--line);
    background: var(--control, color-mix(in srgb, var(--panel) 88%, var(--panel-strong)));
    text-align: left;
  }

  .profile-grid button.active {
    border-color: color-mix(in srgb, var(--preset-accent) 62%, var(--line));
    background: color-mix(in srgb, var(--preset-accent) 11%, var(--panel));
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--preset-accent) 16%, transparent);
  }

  .preset-swatches {
    position: relative;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    overflow: hidden;
    height: 24px;
    border: 1px solid var(--line);
    border-radius: calc(var(--radius, 8px) * 0.72);
  }

  .preset-swatches i {
    min-width: 0;
  }

  .preset-swatches .accent {
    position: absolute;
    right: 4px;
    bottom: 4px;
    width: 10px;
    height: 10px;
    border: 2px solid var(--panel);
    border-radius: 999px;
    background: var(--preset-accent);
  }

  .profile-grid strong,
  .profile-grid small,
  .profile-grid em {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .profile-grid strong {
    font-size: 0.82rem;
    line-height: 1.1;
  }

  .profile-grid small {
    display: -webkit-box;
    min-height: 2.35em;
    color: var(--muted);
    font-size: 0.72rem;
    line-height: 1.18;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    white-space: normal;
  }

  .profile-grid em {
    display: inline-flex;
    width: fit-content;
    max-width: 100%;
    align-items: center;
    gap: 4px;
    padding: 3px 6px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--muted) 12%, transparent);
    color: var(--muted);
    font-size: 0.68rem;
    font-style: normal;
    font-weight: 800;
  }

  .profile-grid em.active-preset {
    background: color-mix(in srgb, var(--preset-accent) 16%, transparent);
    color: var(--accent);
  }

  .live-preview {
    display: grid;
    grid-template-columns: 58px minmax(0, 1fr);
    min-height: 184px;
    min-width: 0;
    overflow: hidden;
    border: 1px solid var(--line);
    border-radius: var(--preview-radius);
    background: var(--panel);
    box-shadow: var(--shadow-md, 0 18px 36px rgb(15 23 42 / 10%));
    font-family: var(--preview-font);
  }

  .live-preview.dark {
    box-shadow: var(--shadow-md, 0 18px 36px rgb(0 0 0 / 20%));
  }

  .preview-sidebar {
    display: grid;
    align-content: start;
    gap: 10px;
    padding: 14px 12px;
    border-right: 1px solid var(--line);
    background: color-mix(in srgb, var(--sidebar) 84%, var(--panel-strong));
  }

  .preview-sidebar span,
  .preview-top span,
  .preview-tabs i,
  .preview-form div {
    display: block;
    border-radius: 999px;
  }

  .preview-sidebar span {
    height: 10px;
    background: color-mix(in srgb, var(--muted) 34%, transparent);
  }

  .preview-sidebar span:first-child {
    background: var(--accent);
  }

  .preview-main {
    display: grid;
    grid-template-rows: auto auto 1fr;
    min-width: 0;
  }

  .preview-top {
    display: flex;
    gap: 12px;
    align-items: center;
    justify-content: space-between;
    min-width: 0;
    padding: 14px;
    border-bottom: 1px solid var(--line);
  }

  .preview-top strong {
    min-width: 0;
    overflow: hidden;
    font-size: 0.9rem;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .preview-top span {
    width: 74px;
    height: 22px;
    border: 1px solid color-mix(in srgb, var(--accent) 32%, var(--line));
    background: color-mix(in srgb, var(--accent) 10%, transparent);
  }

  .preview-tabs {
    display: grid;
    grid-template-columns: 1.2fr 0.8fr 0.9fr;
    gap: 8px;
    padding: 10px 14px;
    border-bottom: 1px solid var(--line);
  }

  .preview-tabs i {
    height: 22px;
    border: 1px solid var(--line);
    background: var(--control, color-mix(in srgb, var(--panel) 76%, var(--panel-strong)));
  }

  .preview-tabs i:first-child {
    border-color: color-mix(in srgb, var(--accent) 48%, var(--line));
    box-shadow: inset 0 -2px 0 var(--accent);
  }

  .preview-form {
    display: grid;
    align-content: start;
    gap: 9px;
    padding: 14px;
  }

  .preview-form span {
    font-weight: 800;
  }

  .preview-form code {
    width: fit-content;
    max-width: 100%;
    overflow: hidden;
    padding: 6px 8px;
    border: 1px solid var(--line);
    border-radius: calc(var(--preview-radius) * 0.72);
    background: color-mix(in srgb, var(--panel-strong) 64%, transparent);
    font-family: var(--preview-mono);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .preview-form div {
    width: 82%;
    height: 8px;
    background: color-mix(in srgb, var(--muted) 28%, transparent);
  }

  .appearance-grid {
    display: grid;
    grid-template-columns: minmax(260px, 1fr) minmax(260px, 1fr);
    gap: 16px 18px;
    min-width: 0;
    padding-top: 2px;
  }

  .appearance-section {
    display: grid;
    gap: 10px;
    min-width: 0;
  }

  .font-section,
  .accessibility-section,
  .tune-section {
    grid-column: 1 / -1;
  }

  .section-label {
    display: flex;
    gap: 10px;
    align-items: baseline;
    justify-content: space-between;
    min-width: 0;
  }

  .section-label small {
    min-width: 0;
    overflow: hidden;
    font-weight: 700;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .palette-list {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(124px, 1fr));
    gap: 8px;
  }

  .palette-list button {
    position: relative;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    grid-template-rows: 34px auto;
    gap: 0;
    align-items: stretch;
    overflow: hidden;
    min-width: 0;
    padding: 0;
    border: 1px solid var(--line);
    background: var(--panel);
    text-align: left;
  }

  .palette-list button.active {
    border-color: color-mix(in srgb, var(--accent) 55%, var(--line));
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 12%, transparent);
  }

  .palette-list i {
    min-width: 0;
  }

  .palette-list strong {
    grid-column: 1 / -1;
    min-width: 0;
    padding: 8px 10px;
    overflow: hidden;
    font-size: 0.82rem;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .palette-list :global(svg) {
    position: absolute;
    right: 7px;
    bottom: 7px;
    padding: 2px;
    border-radius: 999px;
    background: var(--panel);
    color: var(--accent);
  }

  .accent-list {
    display: flex;
    flex-wrap: wrap;
    gap: 9px;
    align-items: center;
  }

  .accent-list button,
  .color-picker {
    width: 34px;
    height: 34px;
    border: 1px solid var(--line);
    border-radius: 999px;
    background: var(--swatch);
  }

  .accent-list button.active {
    border-color: color-mix(in srgb, var(--swatch) 80%, var(--text));
    box-shadow:
      0 0 0 2px var(--panel),
      0 0 0 4px var(--swatch);
  }

  .color-picker {
    display: grid;
    place-items: center;
    overflow: hidden;
    background:
      linear-gradient(90deg, #ef4444, #f59e0b, #22c55e, #06b6d4, #3b82f6, #a855f7);
    cursor: pointer;
  }

  .color-picker.active {
    border-color: color-mix(in srgb, var(--accent) 72%, var(--text));
    box-shadow:
      0 0 0 2px var(--panel),
      0 0 0 4px var(--accent);
  }

  .accent-list input[type="color"] {
    width: 44px;
    height: 44px;
    border: 0;
    opacity: 0;
    cursor: pointer;
  }

  .custom-accent {
    display: inline-grid;
    grid-template-columns: 34px minmax(84px, 108px);
    gap: 8px;
    align-items: center;
  }

  .accent-text {
    width: 100%;
    min-width: 0;
    height: 34px;
    padding: 0 9px;
    border: 1px solid var(--line);
    border-radius: var(--radius, 8px);
    background: var(--surface-raised, var(--panel));
    color: var(--text);
    font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  }

  .accent-text[aria-invalid="true"],
  .font-grid input[aria-invalid="true"] {
    border-color: color-mix(in srgb, var(--danger, #dc2626) 62%, var(--line));
  }

  .density-list {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
  }

  .density-list button {
    display: grid;
    gap: 6px;
    min-width: 0;
    min-height: 76px;
    padding: 10px;
    border: 1px solid var(--line);
    background: var(--control, color-mix(in srgb, var(--panel) 88%, var(--panel-strong)));
    color: var(--muted);
    text-align: left;
  }

  .density-list button.active {
    border-color: color-mix(in srgb, var(--accent) 54%, var(--line));
    background: color-mix(in srgb, var(--accent) 9%, var(--panel));
    color: var(--text);
  }

  .density-list span {
    min-width: 0;
    overflow: hidden;
    font-weight: 800;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .density-list i {
    height: 6px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--muted) 34%, transparent);
  }

  .density-list button.active i {
    background: color-mix(in srgb, var(--accent) 48%, transparent);
  }

  .preference-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }

  .preference-control {
    display: grid;
    gap: 8px;
    min-width: 0;
    padding: 10px;
    border: 1px solid var(--line);
    border-radius: var(--radius, 8px);
    background: var(--control, color-mix(in srgb, var(--panel) 88%, var(--panel-strong)));
  }

  .mode-list {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px;
    padding: 3px;
    border: 1px solid var(--line);
    border-radius: var(--radius, 8px);
    background: var(--panel-strong);
  }

  .motion-list {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .mode-list button {
    min-width: 0;
    min-height: 30px;
    padding: 0 8px;
    overflow: hidden;
    color: var(--muted);
    font-size: 0.82rem;
    font-weight: 750;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .mode-list button.active {
    border-color: color-mix(in srgb, var(--accent) 30%, var(--line));
    background: var(--surface-raised, var(--panel));
    color: var(--text);
    box-shadow: var(--shadow-sm, 0 1px 2px rgb(15 23 42 / 10%));
  }

  .font-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }

  .font-grid label,
  .tune-section label {
    display: grid;
    gap: 8px;
    min-width: 0;
  }

  .font-grid select,
  .font-grid input {
    min-width: 0;
    min-height: 34px;
    border: 1px solid var(--line);
    border-radius: var(--radius, 8px);
    background: var(--surface-raised, var(--panel));
    color: var(--text);
  }

  .font-grid select {
    padding: 0 10px;
  }

  .font-grid input {
    padding: 0 10px;
    font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  }

  .tune-section {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }

  .tune-section label {
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    padding: 12px;
    border: 1px solid var(--line);
    border-radius: var(--radius, 8px);
    background: var(--control, color-mix(in srgb, var(--panel) 90%, var(--panel-strong)));
  }

  .tune-section output {
    font-variant-numeric: tabular-nums;
    font-weight: 800;
  }

  .tune-section input {
    grid-column: 1 / -1;
    width: 100%;
    accent-color: var(--accent);
  }

  button:focus-visible,
  input:focus-visible,
  select:focus-visible {
    outline: 2px solid var(--focus-ring, color-mix(in srgb, var(--accent) 70%, white));
    outline-offset: 2px;
  }

  @container (max-width: 720px) {
    .appearance-hero,
    .appearance-grid,
    .preference-grid,
    .font-grid,
    .tune-section {
      grid-template-columns: 1fr;
    }

    .live-preview {
      max-width: 520px;
    }
  }

  @container (max-width: 520px) {
    .theme-cards,
    .density-list {
      grid-template-columns: 1fr;
    }

    .live-preview {
      grid-template-columns: 48px minmax(0, 1fr);
    }

    .profile-grid,
    .palette-list {
      grid-template-columns: minmax(0, 1fr);
    }

    .mode-list,
    .motion-list {
      grid-template-columns: minmax(0, 1fr);
    }

    .mode-list button {
      min-height: 34px;
      white-space: normal;
      overflow-wrap: anywhere;
    }
  }

  @media (max-width: 1180px) {
    .appearance-hero,
    .appearance-grid,
    .preference-grid,
    .font-grid,
    .tune-section {
      grid-template-columns: 1fr;
    }
  }
</style>
