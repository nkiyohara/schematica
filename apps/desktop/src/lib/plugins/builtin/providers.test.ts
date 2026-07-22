import { describe, expect, it } from "vitest";
import type { FieldModel } from "@schematica/core";
import { codecForFormat, createConfigCodecs } from "./codecs";
import { createFieldRendererProviders, fieldRendererFor } from "./fields";
import { createJsonSchemaProvider } from "./schema";

describe("built-in config codecs", () => {
  it("parses, updates, and stringifies through the selected codec", () => {
    const codec = codecForFormat(createConfigCodecs(), "json");

    expect(codec?.parse('{"learningRate":0.1}')).toEqual({ learningRate: 0.1 });
    expect(codec?.updateText?.('{"learningRate":0.1}', "learningRate", 0.2)).toContain("0.2");
    expect(codec?.stringify({ learningRate: 0.3 })).toContain("0.3");
  });
});

describe("built-in schema provider", () => {
  it("owns JSON Schema parsing, coverage, and field model generation", () => {
    const provider = createJsonSchemaProvider();
    const schema = provider.parse(
      JSON.stringify({
        type: "object",
        properties: {
          optimizer: {
            type: "string",
            enum: ["adam", "sgd"],
          },
        },
      }),
      "json",
    );

    expect(provider.coverage(schema).totals.unsupported).toBe(0);
    expect(provider.fields(schema)).toMatchObject([
      {
        path: "optimizer",
        type: "string",
        enum: ["adam", "sgd"],
      },
    ]);
  });
});

describe("built-in field renderers", () => {
  it("selects the highest-priority renderer that supports a field", () => {
    const field: FieldModel = {
      path: "optimizer",
      key: "optimizer",
      title: "Optimizer",
      type: "string",
      required: false,
      enum: ["adam", "sgd"],
      ui: {},
    };

    expect(fieldRendererFor(createFieldRendererProviders(), field)?.id).toBe("core.field.enum");
  });
});
