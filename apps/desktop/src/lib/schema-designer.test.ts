import { describe, expect, it } from "vitest";
import {
  addSchemaDesignerField,
  createSchemaDesignerCondition,
  createSchemaDesignerDraft,
  createSchemaDesignerField,
  nextSchemaDesignerFieldKey,
  removeSchemaDesignerField,
  rootFieldKeys,
  schemaDesignerDraftFromSchema,
  schemaFromDesignerDraft,
  updateSchemaDesignerField,
} from "./schema-designer";

describe("schema designer model", () => {
  it("builds an object schema from visual fields", () => {
    const draft = createSchemaDesignerDraft({
      title: "Training Config",
      fields: [
        createSchemaDesignerField({
          id: "backend",
          key: "backend",
          title: "Backend",
          type: "string",
          required: true,
          enumValues: "local\nslurm",
          defaultValue: "local",
        }),
        createSchemaDesignerField({
          id: "batch",
          key: "batch_size",
          title: "Batch size",
          type: "integer",
          minimum: "1",
          maximum: "512",
          defaultValue: "64",
        }),
      ],
    });

    expect(schemaFromDesignerDraft(draft)).toMatchObject({
      $schema: "https://json-schema.org/draft/2020-12/schema",
      title: "Training Config",
      type: "object",
      required: ["backend"],
      properties: {
        backend: {
          type: "string",
          enum: ["local", "slurm"],
          default: "local",
        },
        batch_size: {
          type: "integer",
          minimum: 1,
          maximum: 512,
          default: 64,
        },
      },
    });
  });

  it("round-trips supported fields from an existing schema", () => {
    const draft = schemaDesignerDraftFromSchema({
      title: "Demo",
      type: "object",
      required: ["enabled"],
      properties: {
        enabled: { type: "boolean", title: "Enabled", default: true },
        mode: { type: "string", enum: ["fast", "safe"] },
      },
    });

    expect(draft.fields.map((field) => field.key)).toEqual(["enabled", "mode"]);
    expect(draft.fields[0].required).toBe(true);
    expect(draft.fields[0].defaultValue).toBe("true");
    expect(draft.fields[1].enumValues).toBe("fast\nsafe");
  });

  it("preserves schema keywords the visual designer does not edit", () => {
    const original = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: "https://example.test/config.schema.json",
      title: "Demo",
      type: "object" as const,
      additionalProperties: false,
      $defs: { identifier: { type: "string" as const, pattern: "^[a-z]+$" } },
      properties: {
        id: {
          $ref: "#/$defs/identifier",
          description: "Stable identifier",
          "x-extra": { owner: "platform" },
        },
        tags: {
          type: "array" as const,
          items: { type: "string" as const, minLength: 1 },
        },
        count: {
          type: "integer" as const,
          exclusiveMinimum: 0,
        },
      },
      allOf: [{ anyOf: [{ required: ["id"] }, { required: ["tags"] }] }],
    };

    const next = schemaFromDesignerDraft(schemaDesignerDraftFromSchema(original));

    expect(next.$id).toBe(original.$id);
    expect(next.additionalProperties).toBe(false);
    expect(next.$defs).toEqual(original.$defs);
    expect(next.properties?.id?.$ref).toBe("#/$defs/identifier");
    expect(next.properties?.id?.["x-extra"]).toEqual({ owner: "platform" });
    expect(next.properties?.tags?.items).toEqual(original.properties.tags.items);
    expect(next.properties?.count?.exclusiveMinimum).toBe(0);
    expect(next.properties?.count?.minimum).toBeUndefined();
    expect(next.allOf).toEqual(original.allOf);
  });

  it("keeps commas and JSON-looking strings in enum values", () => {
    const draft = schemaDesignerDraftFromSchema({
      type: "object",
      properties: {
        "display name": { type: "string", enum: ["a,b", "true", "42"] },
      },
    });

    const properties = schemaFromDesignerDraft(draft).properties;
    expect(properties?.["display name"]?.enum).toEqual(["a,b", "true", "42"]);
    expect(properties?.display_name).toBeUndefined();
  });

  it("rejects duplicate field keys and incompatible literals", () => {
    const duplicate = createSchemaDesignerDraft({
      fields: [
        createSchemaDesignerField({ key: "same" }),
        createSchemaDesignerField({ key: "same" }),
      ],
    });
    expect(() => schemaFromDesignerDraft(duplicate)).toThrow("Duplicate field key");

    const invalidDefault = createSchemaDesignerDraft({
      fields: [createSchemaDesignerField({ key: "count", type: "integer", defaultValue: "nope" })],
    });
    expect(() => schemaFromDesignerDraft(invalidDefault)).toThrow("does not match type integer");
  });

  it("refuses to visually rewrite a non-object root schema", () => {
    expect(() =>
      schemaDesignerDraftFromSchema({ type: "array", items: { type: "string" } }),
    ).toThrow("only supports object schemas");
  });

  it("emits if/then required conditions", () => {
    const draft = createSchemaDesignerDraft({
      fields: [
        createSchemaDesignerField({ key: "backend", title: "Backend" }),
        createSchemaDesignerField({ key: "queue", title: "Queue" }),
      ],
      conditions: [
        createSchemaDesignerCondition({
          ifFieldKey: "backend",
          equals: "slurm",
          thenRequiredKey: "queue",
        }),
      ],
    });

    expect(schemaFromDesignerDraft(draft).allOf).toEqual([
      {
        if: {
          properties: {
            backend: { const: "slurm" },
          },
          required: ["backend"],
        },
        then: {
          required: ["queue"],
        },
      },
    ]);
  });

  it("updates, nests, and removes fields immutably", () => {
    const parent = createSchemaDesignerField({ id: "training", key: "training", type: "object" });
    const child = createSchemaDesignerField({ id: "lr", key: "learning_rate", type: "number" });
    const draft = addSchemaDesignerField(
      createSchemaDesignerDraft({ fields: [parent] }),
      child,
      parent.id,
    );
    const updated = updateSchemaDesignerField(draft, child.id, (field) => ({
      ...field,
      maximum: "1",
    }));

    expect(updated.fields[0].children[0].maximum).toBe("1");
    expect(removeSchemaDesignerField(updated, child.id).fields[0].children).toHaveLength(0);
  });

  it("generates an unused field key after fields have been removed or reordered", () => {
    const fields = [
      createSchemaDesignerField({ key: "field_1" }),
      createSchemaDesignerField({ key: "field_3" }),
    ];

    expect(nextSchemaDesignerFieldKey(fields)).toBe("field_2");
    expect(
      nextSchemaDesignerFieldKey([...fields, createSchemaDesignerField({ key: "field_2" })]),
    ).toBe("field_4");
  });

  it("returns unique non-empty root keys for condition selectors", () => {
    const draft = createSchemaDesignerDraft({
      fields: [
        createSchemaDesignerField({ key: " backend " }),
        createSchemaDesignerField({ key: "backend" }),
        createSchemaDesignerField({ key: "" }),
      ],
    });

    expect(rootFieldKeys(draft)).toEqual(["backend"]);
  });
});
