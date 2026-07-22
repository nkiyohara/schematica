<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import type { DataFormat } from "@schematica/core";
  import { indentWithTab } from "@codemirror/commands";
  import { Compartment } from "@codemirror/state";
  import { EditorView, keymap } from "@codemirror/view";
  import { basicSetup } from "codemirror";
  import { editorSyntaxHighlighting, languageForFormat } from "./code-editor-support";

  export let value = "";
  export let format: DataFormat = "yaml";
  export let label = "Source editor";
  export let onChange: (value: string) => void = () => {};

  let host: HTMLDivElement;
  let view: EditorView | undefined;
  let currentValue = value;
  let currentFormat = format;

  const language = new Compartment();
  const accessibility = new Compartment();

  onMount(() => {
    view = new EditorView({
      parent: host,
      doc: value,
      extensions: [
        basicSetup,
        keymap.of([indentWithTab]),
        language.of(languageForFormat(format)),
        editorSyntaxHighlighting,
        accessibility.of(EditorView.contentAttributes.of({ "aria-label": label, spellcheck: "false" })),
        EditorView.lineWrapping,
        EditorView.updateListener.of((update) => {
          if (!update.docChanged) return;
          currentValue = update.state.doc.toString();
          onChange(currentValue);
        }),
        editorTheme,
      ],
    });
  });

  onDestroy(() => {
    view?.destroy();
  });

  $: if (view && value !== currentValue) {
    currentValue = value;
    view.dispatch({
      changes: {
        from: 0,
        to: view.state.doc.length,
        insert: value,
      },
    });
  }

  $: if (view && format !== currentFormat) {
    currentFormat = format;
    view.dispatch({
      effects: language.reconfigure(languageForFormat(format)),
    });
  }

  $: if (view) {
    view.dispatch({
      effects: accessibility.reconfigure(
        EditorView.contentAttributes.of({ "aria-label": label, spellcheck: "false" }),
      ),
    });
  }

  const editorTheme = EditorView.theme({
    "&": {
      height: "100%",
      minHeight: "100%",
      backgroundColor: "var(--panel)",
      color: "var(--text)",
      fontSize: "0.92rem",
    },
    ".cm-scroller": {
      fontFamily: "var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)",
      lineHeight: "1.55",
    },
    ".cm-content": {
      minHeight: "100%",
      padding: "14px 0",
      caretColor: "var(--accent)",
    },
    ".cm-line": {
      padding: "0 18px",
    },
    ".cm-matchingBracket": {
      borderBottom: "2px solid var(--accent)",
      backgroundColor: "color-mix(in srgb, var(--accent) 14%, transparent)",
      color: "var(--text)",
      fontWeight: "700",
    },
    ".cm-nonmatchingBracket": {
      borderBottom: "2px solid var(--danger)",
      backgroundColor: "color-mix(in srgb, var(--danger) 12%, transparent)",
      color: "var(--danger)",
      fontWeight: "700",
    },
    ".cm-foldPlaceholder": {
      border: "1px solid var(--line)",
      backgroundColor: "var(--control, var(--panel-strong))",
      color: "var(--muted)",
    },
    ".cm-gutters": {
      borderRight: "1px solid var(--line)",
      backgroundColor: "color-mix(in srgb, var(--panel) 90%, var(--surface))",
      color: "var(--muted)",
    },
    ".cm-activeLine, .cm-activeLineGutter": {
      backgroundColor: "color-mix(in srgb, var(--accent) 7%, transparent)",
    },
    ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
      backgroundColor: "var(--selection, rgb(37 99 235 / 24%))",
    },
    "&.cm-focused": {
      outline: "none",
    },
  });
</script>

<div class="code-editor" bind:this={host}></div>

<style>
  .code-editor {
    min-width: 0;
    min-height: 0;
    height: 100%;
  }
</style>
