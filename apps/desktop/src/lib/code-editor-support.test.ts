import { describe, expect, it } from "vitest";
import { highlightTree, tags } from "@lezer/highlight";
import type { DataFormat } from "@schematica/core";
import { LanguageSupport } from "@codemirror/language";
import { editorHighlightStyle, editorTokenStyles, languageForFormat } from "./code-editor-support";

function tokenClasses(source: string, format: DataFormat) {
  const support = languageForFormat(format);
  const language = support instanceof LanguageSupport ? support.language : support;
  const tokens: Array<{ text: string; classes: string }> = [];
  highlightTree(language.parser.parse(source), editorHighlightStyle, (from, to, classes) => {
    tokens.push({ text: source.slice(from, to), classes });
  });
  return tokens;
}

describe("code editor syntax highlighting", () => {
  it("assigns distinct styles to JSON keys, strings, numbers, booleans, and null", () => {
    const tokens = tokenClasses(
      '{"name":"demo","retries":3,"enabled":true,"fallback":null}',
      "json",
    );

    expect(tokens.find((token) => token.text === '"name"')?.classes).toBe(
      editorHighlightStyle.style([tags.propertyName]),
    );
    expect(tokens.find((token) => token.text === '"demo"')?.classes).toBe(
      editorHighlightStyle.style([tags.string]),
    );
    expect(tokens.find((token) => token.text === "3")?.classes).toBe(
      editorHighlightStyle.style([tags.number]),
    );
    expect(tokens.find((token) => token.text === "true")?.classes).toBe(
      editorHighlightStyle.style([tags.bool]),
    );
    expect(tokens.find((token) => token.text === "null")?.classes).toBe(
      editorHighlightStyle.style([tags.null]),
    );
  });

  it.each([
    ["yaml" as const, "name: demo\n# note\n"],
    ["toml" as const, 'name = "demo"\n# note\n'],
  ])("highlights keys, values, and comments in %s", (format, source) => {
    const tokens = tokenClasses(source, format);
    const propertyClass = editorHighlightStyle.style([tags.propertyName]);
    const commentClass = editorHighlightStyle.style([tags.comment]);

    expect(
      tokens.some((token) => token.text.includes("name") && token.classes === propertyClass),
    ).toBe(true);
    expect(
      tokens.some((token) => token.text.includes("demo") && token.classes !== propertyClass),
    ).toBe(true);
    expect(
      tokens.some((token) => token.text.includes("note") && token.classes === commentClass),
    ).toBe(true);
  });

  it("makes property names and constants bold while keeping comments italic", () => {
    expect(editorTokenStyles.find((style) => style.name === "property")).toMatchObject({
      fontWeight: "700",
    });
    expect(editorTokenStyles.find((style) => style.name === "constant")).toMatchObject({
      fontWeight: "700",
    });
    expect(editorTokenStyles.find((style) => style.name === "comment")).toMatchObject({
      fontStyle: "italic",
    });
  });
});
