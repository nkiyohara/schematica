import { describe, expect, it } from "vitest";
import {
  applySchemaDefaults,
  analyzeSchemaCoverage,
  buildFieldModel,
  compareConfigs,
  deletePath,
  describeSchemaPath,
  getPath,
  parseData,
  setPath,
  stringifyData,
  summarizeDiffRows,
  updateDataText,
  validateConfig,
} from "./index.js";
import type { JsonSchema } from "./types.js";

const schema: JsonSchema = {
  type: "object",
  required: ["name", "training"],
  properties: {
    name: { type: "string", default: "demo" },
    training: {
      type: "object",
      required: ["batch_size"],
      properties: {
        batch_size: { type: "integer", minimum: 1, default: 64 },
      },
    },
  },
};

describe("core", () => {
  it("parses YAML and validates with JSON Schema", () => {
    const data = parseData("name: demo\ntraining:\n  batch_size: 8\n");
    const result = validateConfig(schema, data);
    expect(result.valid).toBe(true);
  });

  it("parses JSON strictly instead of accepting YAML syntax", () => {
    expect(parseData('{"name":"demo","enabled":true}', { format: "json" })).toEqual({
      name: "demo",
      enabled: true,
    });
    expect(() => parseData("name: demo", { format: "json" })).toThrow();
  });

  it("parses and writes TOML configs", () => {
    const data = parseData('name = "demo"\n\n[training]\nbatch_size = 8\n', { format: "toml" });
    const result = validateConfig(schema, data);

    expect(result.valid).toBe(true);
    expect(stringifyData(data, { format: "toml" })).toContain("[training]");
  });

  it("rejects TOML integer literals outside JavaScript's safe range", () => {
    for (const literal of [
      "9007199254740992",
      "9007199254740993",
      "9223372036854775807",
      "-9223372036854775808",
    ]) {
      expect(() => parseData(`value = ${literal}\n`, { format: "toml" })).toThrow();
    }
  });

  it("refuses to save unsafe JavaScript integers as TOML", () => {
    const unsafeIntegers = [
      Number.MAX_SAFE_INTEGER + 1,
      Number("9223372036854775807"),
      Number("-9223372036854775808"),
    ];

    for (const value of unsafeIntegers) {
      expect(() => stringifyData({ value }, { format: "toml" })).toThrow(
        "cannot be saved losslessly",
      );
    }

    expect(() =>
      updateDataText("value = 1\n", "value", Number.MAX_SAFE_INTEGER + 1, { format: "toml" }),
    ).toThrow("cannot be saved losslessly");
    expect(stringifyData({ value: Number.MAX_SAFE_INTEGER }, { format: "toml" })).toContain(
      `value = ${Number.MAX_SAFE_INTEGER}`,
    );
  });

  it("applies nested defaults", () => {
    expect(applySchemaDefaults(schema, undefined)).toEqual({
      name: "demo",
      training: {
        batch_size: 64,
      },
    });
  });

  it("gets and sets dotted paths", () => {
    const data = parseData("training:\n  batch_size: 8\n");
    expect(getPath(data, "training.batch_size")).toBe(8);
    expect(getPath(setPath(data, "training.batch_size", 16), "training.batch_size")).toBe(16);
  });

  it("can update YAML text while preserving nearby comments", () => {
    const source = `# experiment defaults
training:
  # keep small for smoke tests
  batch_size: 8
  learning_rate: 0.001
`;

    const output = updateDataText(source, "training.batch_size", 16, {
      format: "yaml",
      preserveComments: "best-effort",
    });

    expect(output).toContain("# experiment defaults");
    expect(output).toContain("# keep small for smoke tests");
    expect(output).toContain("batch_size: 16");
    expect(parseData(output)).toMatchObject({
      training: {
        batch_size: 16,
        learning_rate: 0.001,
      },
    });
  });

  it("builds form field models", () => {
    const fields = buildFieldModel(schema);
    expect(fields.map((field) => field.path)).toEqual(["name", "training"]);
    expect(fields[1]?.children?.[0]?.path).toBe("training.batch_size");
  });

  it("reports required fields from the parent schema", () => {
    expect(describeSchemaPath(schema, "training")?.required).toBe(true);
    expect(describeSchemaPath(schema, "training.batch_size")?.required).toBe(true);
  });

  it("addresses literal dotted keys and can remove optional values", () => {
    const data = parseData('"a.b": 1\nnested:\n  keep: true\n  remove: false\n');
    expect(getPath(data, '["a.b"]')).toBe(1);
    expect(deletePath(data, "nested.remove")).toEqual({
      "a.b": 1,
      nested: { keep: true },
    });
  });

  it("keeps schema UI hints in field models", () => {
    const fields = buildFieldModel({
      type: "object",
      properties: {
        lr: {
          type: "number",
          minimum: 0.000001,
          maximum: 0.1,
          "x-ui": {
            scale: "log",
            unit: "lr",
            placeholder: "0.0003",
            note: "Use a logarithmic control for search-scale values.",
          },
        },
      },
    });

    expect(fields[0]).toMatchObject({
      path: "lr",
      widget: "slider",
      ui: {
        scale: "log",
        unit: "lr",
        placeholder: "0.0003",
      },
    });
  });

  it("reports validation and form coverage for advanced JSON Schema keywords", () => {
    const report = analyzeSchemaCoverage({
      $schema: "https://json-schema.org/draft/2020-12/schema",
      type: "object",
      properties: {
        name: { type: "string", minLength: 1 },
        tags: {
          type: "array",
          items: { type: "string" },
        },
        optimizer: {
          oneOf: [
            { type: "object", properties: { type: { const: "adam" } } },
            { type: "object", properties: { type: { const: "sgd" } } },
          ],
        },
      },
      unevaluatedProperties: false,
      "x-custom": true,
    });

    expect(report.dialect).toBe("draft-2020-12");
    expect(report.validation.engine).toContain("AJV 2020");
    expect(report.form.validatedOnlyKeywords.map((item) => item.keyword)).toEqual(
      expect.arrayContaining(["const", "items", "minLength", "oneOf", "unevaluatedProperties"]),
    );
    expect(report.form.unsupportedKeywords.map((item) => item.keyword)).toContain("x-custom");
  });

  it("compares multiple configs with missing and changed rows", () => {
    const rows = compareConfigs(
      [
        {
          name: "base",
          data: parseData("name: demo\ntraining:\n  batch_size: 8\n"),
        },
        {
          name: "large",
          data: parseData("name: demo\ntraining:\n  batch_size: 16\noptimizer: adam\n"),
        },
        {
          name: "missing",
          data: parseData("name: demo\ntraining: {}\n"),
        },
      ],
      { onlyChanges: true },
    );

    expect(rows.map((row) => [row.path, row.kind])).toEqual([
      ["optimizer", "missing"],
      ["training.batch_size", "missing"],
    ]);
    expect(rows.find((row) => row.path === "training.batch_size")?.cells[1]?.status).toBe(
      "changed",
    );
    expect(summarizeDiffRows(rows)).toEqual({
      total: 2,
      same: 0,
      changed: 0,
      missing: 2,
    });
  });

  it("keeps same rows when requested and supports arrays", () => {
    const rows = compareConfigs(
      [
        {
          name: "a",
          data: parseData("items:\n  - name: first\n    enabled: true\n"),
        },
        {
          name: "b",
          data: parseData("items:\n  - name: first\n    enabled: false\n"),
        },
      ],
      { onlyChanges: false },
    );

    expect(rows.map((row) => [row.path, row.kind])).toEqual([
      ["items[0].enabled", "changed"],
      ["items[0].name", "same"],
    ]);
    expect(summarizeDiffRows(rows)).toEqual({
      total: 2,
      same: 1,
      changed: 1,
      missing: 0,
    });
  });

  it("keeps dotted keys and empty containers distinct in diffs", () => {
    const rows = compareConfigs(
      [
        { name: "nested", data: { a: { b: 1 }, empty: {} } },
        { name: "literal", data: { "a.b": 1, other: {} } },
      ],
      { onlyChanges: false },
    );

    expect(rows.map((row) => row.path)).toEqual(['["a.b"]', "a.b", "empty", "other"]);
    expect(rows.every((row) => row.kind === "missing")).toBe(true);
  });

  it("rejects an unknown diff baseline", () => {
    expect(() =>
      compareConfigs(
        [
          { name: "a", data: {} },
          { name: "b", data: {} },
        ],
        { baseline: "typo" },
      ),
    ).toThrow("Unknown diff baseline");
  });

  it("validates draft-07 and draft 2019-09 schemas with matching engines", () => {
    for (const $schema of [
      "http://json-schema.org/draft-07/schema#",
      "https://json-schema.org/draft/2019-09/schema",
    ]) {
      expect(validateConfig({ $schema, type: "string", minLength: 2 }, "ok").valid).toBe(true);
      expect(validateConfig({ $schema, type: "string", minLength: 2 }, "x").valid).toBe(false);
    }
  });

  it("preserves TOML temporal literals when round-tripping and editing", () => {
    const source = 'created = 1979-05-27T07:32:00Z\nlocal_date = 1979-05-27\nname = "before"\n';
    const data = parseData(source, { format: "toml" });
    const roundTrip = stringifyData(data, { format: "toml" });
    const edited = updateDataText(source, "name", "after", { format: "toml" });

    expect(roundTrip).toMatch(/created = 1979-05-27T07:32:00(?:\.000)?Z/);
    expect(roundTrip).toContain("local_date = 1979-05-27");
    expect(edited).toMatch(/created = 1979-05-27T07:32:00(?:\.000)?Z/);
    expect(edited).toContain('name = "after"');
  });

  it("does not replace explicit incompatible inputs while applying defaults", () => {
    expect(applySchemaDefaults({ type: "object", properties: { name: { default: "x" } } }, 4)).toBe(
      4,
    );
    expect(applySchemaDefaults({ enum: [null, "x"] }, undefined)).toBeUndefined();
  });
});
