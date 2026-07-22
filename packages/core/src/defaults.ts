import type { JsonObject, JsonSchema, JsonValue } from "./types.js";

export function applySchemaDefaults(
  schema: JsonSchema,
  input: JsonValue | undefined,
): JsonValue | undefined {
  if (input === undefined && schema.default !== undefined) {
    return clone(schema.default);
  }

  const type = primaryType(schema);

  if (type === "object") {
    if (input !== undefined && !isObject(input)) return input;
    const source = input ?? {};
    const result: JsonObject = { ...source };

    for (const [key, childSchema] of Object.entries(schema.properties ?? {})) {
      const current = result[key];
      const next = applySchemaDefaults(childSchema, current);
      if (next !== undefined) {
        result[key] = next;
      }
    }

    return result;
  }

  if (type === "array" && Array.isArray(input) && schema.items) {
    const itemSchema = schema.items;
    return input.map((item) => applySchemaDefaults(itemSchema, item) ?? null);
  }

  return input;
}

function primaryType(schema: JsonSchema) {
  if (Array.isArray(schema.type)) {
    return schema.type.find((type) => type !== "null") ?? schema.type[0];
  }

  if (schema.type) {
    return schema.type;
  }

  if (schema.properties) {
    return "object";
  }

  if (schema.enum) {
    const first = schema.enum.find((value) => value !== null);
    if (first === undefined) return "null";
    if (Array.isArray(first)) return "array";
    return typeof first;
  }

  return undefined;
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
