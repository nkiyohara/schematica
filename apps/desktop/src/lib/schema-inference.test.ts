import { describe, expect, it } from "vitest";
import {
  analyzeSchemaFreeDocument,
  defaultValueForSettingType,
  inferSchemaFromData,
} from "./schema-inference";

describe("schema inference", () => {
  it("infers editable nested fields while preserving config order", () => {
    const schema = inferSchemaFromData({
      enabled: true,
      retries: 3,
      ratio: 0.5,
      service: { url: "x" },
    });

    expect(schema.type).toBe("object");
    expect(Object.keys(schema.properties ?? {})).toEqual([
      "enabled",
      "retries",
      "ratio",
      "service",
    ]);
    expect(schema.properties?.enabled.type).toBe("boolean");
    expect(schema.properties?.retries.type).toBe("integer");
    expect(schema.properties?.ratio.type).toBe("number");
    expect(schema.properties?.service.properties?.url.type).toBe("string");
    expect(schema.required).toBeUndefined();
    expect(schema.additionalProperties).toBe(true);
  });

  it("handles arrays, nulls, and non-object roots without inventing defaults", () => {
    expect(inferSchemaFromData([1, 2]).items?.type).toBe("integer");
    expect(inferSchemaFromData(null).type).toBe("null");
    expect(inferSchemaFromData("value").type).toBe("string");
  });

  it("provides safe initial values for settings added without a schema", () => {
    expect(defaultValueForSettingType("string")).toBe("");
    expect(defaultValueForSettingType("boolean")).toBe(false);
    expect(defaultValueForSettingType("object")).toEqual({});
    expect(defaultValueForSettingType("array")).toEqual([]);
  });

  it("uses a raw document view for large traces and collection roots", () => {
    const events = Array.from({ length: 4_271 }, (_, index) => ({
      name: `event-${index}`,
      ts: index,
    }));
    const trace = { schemaVersion: 1, traceEvents: events };

    expect(analyzeSchemaFreeDocument(trace, JSON.stringify(trace), "json")).toMatchObject({
      preferredView: "raw",
      maxArrayLength: 4_271,
    });
    expect(analyzeSchemaFreeDocument([1, 2, 3], "[1,2,3]", "json")).toMatchObject({
      preferredView: "raw",
      reason: "root",
    });
  });

  it("keeps small config objects in the inferred form", () => {
    expect(
      analyzeSchemaFreeDocument(
        { name: "demo", training: { batchSize: 8 } },
        '{"name":"demo"}',
        "json",
      ),
    ).toMatchObject({ preferredView: "form", reason: "form" });
  });

  it("protects unsafe JSON integers from form round-trip precision loss", () => {
    expect(
      analyzeSchemaFreeDocument(
        { baseTimeNanoseconds: 1_767_189_312_000_000_000 },
        '{"baseTimeNanoseconds":1767189312000000000}',
        "json",
      ),
    ).toMatchObject({ preferredView: "raw", reason: "unsafeInteger" });
    expect(
      analyzeSchemaFreeDocument({ id: 9_007_199_254_740_991 }, '{"id":9007199254740991}', "json"),
    ).toMatchObject({ preferredView: "form" });
  });
});
