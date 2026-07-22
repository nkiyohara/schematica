import type { DataFormat } from "@schematica/core";
import { json } from "@codemirror/lang-json";
import { yaml } from "@codemirror/lang-yaml";
import {
  HighlightStyle,
  StreamLanguage,
  syntaxHighlighting,
  type LanguageSupport,
  type TagStyle,
} from "@codemirror/language";
import { toml } from "@codemirror/legacy-modes/mode/toml";
import { tags } from "@lezer/highlight";

export type EditorTokenStyleName =
  | "punctuation"
  | "content"
  | "string"
  | "number"
  | "constant"
  | "metadata"
  | "comment"
  | "property"
  | "invalid";

export type NamedEditorTokenStyle = TagStyle & { name: EditorTokenStyleName };

export const editorTokenStyles: readonly NamedEditorTokenStyle[] = [
  {
    name: "punctuation",
    tag: [tags.punctuation, tags.separator, tags.bracket],
    color: "color-mix(in srgb, var(--muted) 82%, var(--text))",
  },
  {
    name: "content",
    tag: tags.content,
    color: "var(--syntax-string)",
  },
  {
    name: "string",
    tag: [tags.string, tags.docString, tags.character, tags.attributeValue],
    color: "var(--syntax-string)",
  },
  {
    name: "number",
    tag: [tags.number, tags.integer, tags.float],
    color: "var(--syntax-number)",
    fontWeight: "650",
  },
  {
    name: "constant",
    tag: [tags.bool, tags.null, tags.atom, tags.unit],
    color: "var(--syntax-constant)",
    fontWeight: "700",
  },
  {
    name: "metadata",
    tag: [tags.keyword, tags.meta, tags.annotation, tags.typeName, tags.labelName],
    color: "var(--syntax-metadata)",
    fontWeight: "650",
  },
  {
    name: "comment",
    tag: [tags.comment, tags.lineComment, tags.blockComment, tags.docComment],
    color: "var(--muted)",
    fontStyle: "italic",
  },
  {
    name: "property",
    tag: [tags.propertyName, tags.attributeName],
    color: "var(--syntax-key)",
    fontWeight: "700",
  },
  {
    name: "invalid",
    tag: tags.invalid,
    color: "var(--danger)",
    textDecoration: "underline wavy",
  },
];

export const editorHighlightStyle = HighlightStyle.define(
  editorTokenStyles.map(({ name, ...style }) => {
    void name;
    return style;
  }),
);

export const editorSyntaxHighlighting = syntaxHighlighting(editorHighlightStyle);

export function languageForFormat(format: DataFormat): LanguageSupport | StreamLanguage<unknown> {
  if (format === "json") return json();
  if (format === "toml") return StreamLanguage.define(toml);
  return yaml();
}
