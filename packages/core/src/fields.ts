import type { FieldModel, JsonSchema, SchemaType } from "./types.js";
import { appendPath, tokens } from "./path.js";

export function buildFieldModel(schema: JsonSchema, basePath = ""): FieldModel[] {
  if (!schema.properties) {
    return [];
  }

  return Object.entries(schema.properties)
    .filter(([, child]) => child["x-ui"]?.hidden !== true)
    .sort((a, b) => {
      const orderA = a[1]["x-ui"]?.order ?? Number.MAX_SAFE_INTEGER;
      const orderB = b[1]["x-ui"]?.order ?? Number.MAX_SAFE_INTEGER;
      return orderA - orderB || a[0].localeCompare(b[0]);
    })
    .map(([key, child]) => fieldFromSchema(key, child, basePath, schema.required ?? []));
}

export function describeSchemaPath(schema: JsonSchema, path: string): FieldModel | undefined {
  let current: JsonSchema | undefined = schema;
  const parts = tokens(path);
  let basePath = "";

  for (const [index, part] of parts.entries()) {
    const parent: JsonSchema | undefined = current;
    current = parent?.properties?.[part];
    if (!current) {
      return undefined;
    }
    if (index === parts.length - 1) {
      return fieldFromSchema(part, current, basePath, parent.required ?? []);
    }
    basePath = appendPath(basePath, part);
  }
  return undefined;
}

function fieldFromSchema(
  key: string,
  schema: JsonSchema,
  basePath: string,
  requiredKeys: string[],
): FieldModel {
  const path = appendPath(basePath, key);
  const type = resolveType(schema);
  const children = type === "object" ? buildFieldModel(schema, path) : undefined;
  const ui = schema["x-ui"] ?? {};

  return {
    path,
    key,
    title: schema.title ?? toTitle(key),
    description: schema.description,
    type,
    required: requiredKeys.includes(key),
    enum: schema.enum,
    constValue: schema.const,
    defaultValue: schema.default,
    minimum: schema.minimum,
    maximum: schema.maximum,
    exclusiveMinimum: schema.exclusiveMinimum,
    exclusiveMaximum: schema.exclusiveMaximum,
    widget: ui.widget ?? inferWidget(schema, type),
    ui,
    children,
  };
}

function resolveType(schema: JsonSchema): SchemaType {
  if (Array.isArray(schema.type)) {
    return schema.type.find((type) => type !== "null") ?? "string";
  }

  if (schema.type) {
    return schema.type;
  }

  if (schema.properties) {
    return "object";
  }

  if (schema.enum?.length) {
    const first = schema.enum.find((value) => value !== null);
    if (Array.isArray(first)) return "array";
    if (first !== null && typeof first === "object") return "object";
    if (first === null) return "null";
    return typeof first as SchemaType;
  }

  return "string";
}

function inferWidget(schema: JsonSchema, type: SchemaType): FieldModel["widget"] {
  if (schema.enum) {
    return "select";
  }

  if (type === "boolean") {
    return "checkbox";
  }

  if (type === "number" || type === "integer") {
    return schema.minimum !== undefined && schema.maximum !== undefined ? "slider" : "number";
  }

  return "text";
}

function toTitle(key: string): string {
  return key
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
