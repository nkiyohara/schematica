import { stringifyData, type JsonSchema, type JsonValue, type SchemaType } from "@schematica/core";

export const schemaDesignerFieldTypes = [
  "string",
  "number",
  "integer",
  "boolean",
  "object",
  "array",
] as const satisfies readonly SchemaType[];

export type SchemaDesignerFieldType = (typeof schemaDesignerFieldTypes)[number];

export interface SchemaDesignerField {
  id: string;
  key: string;
  title: string;
  type: SchemaDesignerFieldType;
  required: boolean;
  description: string;
  defaultValue: string;
  enumValues: string;
  minimum: string;
  maximum: string;
  children: SchemaDesignerField[];
  sourceSchema?: JsonSchema;
}

export interface SchemaDesignerCondition {
  id: string;
  ifFieldKey: string;
  equals: string;
  thenRequiredKey: string;
}

export interface SchemaDesignerDraft {
  title: string;
  description: string;
  fields: SchemaDesignerField[];
  conditions: SchemaDesignerCondition[];
  sourceSchema: JsonSchema;
  unmanagedAllOf: JsonSchema[];
}

interface FieldLocation {
  field: SchemaDesignerField;
  parentId?: string;
}

export function createSchemaDesignerDraft(
  input: Partial<SchemaDesignerDraft> = {},
): SchemaDesignerDraft {
  return {
    title: input.title ?? "Untitled Config",
    description: input.description ?? "",
    fields: input.fields ?? [],
    conditions: input.conditions ?? [],
    sourceSchema:
      input.sourceSchema ??
      ({
        $schema: "https://json-schema.org/draft/2020-12/schema",
        type: "object",
        properties: {},
      } satisfies JsonSchema),
    unmanagedAllOf: input.unmanagedAllOf ?? [],
  };
}

export function createSchemaDesignerField(
  input: Partial<SchemaDesignerField> = {},
): SchemaDesignerField {
  return {
    id: input.id ?? crypto.randomUUID(),
    key: input.key ?? uniqueFieldKey(input.title ?? "field"),
    title: input.title ?? "Field",
    type: input.type ?? "string",
    required: input.required ?? false,
    description: input.description ?? "",
    defaultValue: input.defaultValue ?? "",
    enumValues: input.enumValues ?? "",
    minimum: input.minimum ?? "",
    maximum: input.maximum ?? "",
    children: input.children ?? [],
    sourceSchema: input.sourceSchema,
  };
}

export function createSchemaDesignerCondition(
  input: Partial<SchemaDesignerCondition> = {},
): SchemaDesignerCondition {
  return {
    id: input.id ?? crypto.randomUUID(),
    ifFieldKey: input.ifFieldKey ?? "",
    equals: input.equals ?? "true",
    thenRequiredKey: input.thenRequiredKey ?? "",
  };
}

export function schemaDesignerDraftFromSchema(schema: JsonSchema | undefined): SchemaDesignerDraft {
  if (!schema) return createSchemaDesignerDraft();
  const rootTypes = Array.isArray(schema.type) ? schema.type : [schema.type];
  if (schema.type !== undefined && !rootTypes.includes("object")) {
    throw new Error(
      "The visual schema designer only supports object schemas. Use the JSON editor.",
    );
  }
  const allOf = splitAllOfConditions(schema.allOf);

  return createSchemaDesignerDraft({
    title: schema.title ?? "Untitled Config",
    description: schema.description ?? "",
    fields: fieldsFromProperties(schema.properties ?? {}, schema.required ?? []),
    conditions: allOf.conditions,
    unmanagedAllOf: allOf.unmanaged,
    sourceSchema: clone(schema),
  });
}

export function schemaFromDesignerDraft(draft: SchemaDesignerDraft): JsonSchema {
  assertUniqueFieldKeys(draft.fields);
  const schema: JsonSchema = clone(draft.sourceSchema);
  schema.$schema ??= "https://json-schema.org/draft/2020-12/schema";
  if (schema.type === undefined) schema.type = "object";
  schema.title = draft.title.trim() || "Untitled Config";
  schema.properties = {};

  if (draft.description.trim()) {
    schema.description = draft.description.trim();
  } else {
    delete schema.description;
  }

  const required = draft.fields
    .filter((field) => field.required && normalizeKey(field.key))
    .map((field) => normalizeKey(field.key));
  if (required.length > 0) {
    schema.required = uniqueValues(required);
  } else {
    delete schema.required;
  }

  for (const [index, field] of draft.fields.entries()) {
    const key = normalizeKey(field.key);
    if (!key) continue;
    schema.properties[key] = schemaFromField(field, index);
  }

  const conditions = draft.conditions
    .map((condition) => conditionSchema(condition))
    .filter((condition): condition is JsonSchema => Boolean(condition));
  const allOf = [...draft.unmanagedAllOf.map(clone), ...conditions];
  if (allOf.length > 0) schema.allOf = allOf;
  else delete schema.allOf;

  return schema;
}

export function schemaTextFromDesignerDraft(draft: SchemaDesignerDraft) {
  return `${stringifyData(schemaFromDesignerDraft(draft), { format: "json" })}\n`;
}

export function findSchemaDesignerField(
  draft: SchemaDesignerDraft,
  id: string,
): FieldLocation | undefined {
  return findFieldInList(draft.fields, id);
}

export function updateSchemaDesignerField(
  draft: SchemaDesignerDraft,
  id: string,
  update: (field: SchemaDesignerField) => SchemaDesignerField,
): SchemaDesignerDraft {
  return {
    ...draft,
    fields: updateFieldList(draft.fields, id, update),
  };
}

export function removeSchemaDesignerField(
  draft: SchemaDesignerDraft,
  id: string,
): SchemaDesignerDraft {
  const removedKey = findSchemaDesignerField(draft, id)?.field.key;

  return {
    ...draft,
    fields: removeFieldFromList(draft.fields, id),
    conditions: draft.conditions.filter(
      (condition) =>
        condition.ifFieldKey !== removedKey && condition.thenRequiredKey !== removedKey,
    ),
  };
}

export function addSchemaDesignerField(
  draft: SchemaDesignerDraft,
  field: SchemaDesignerField,
  parentId?: string,
): SchemaDesignerDraft {
  if (!parentId) {
    return { ...draft, fields: [...draft.fields, field] };
  }

  return updateSchemaDesignerField(draft, parentId, (parent) => ({
    ...parent,
    type: "object",
    children: [...parent.children, field],
  }));
}

export function rootFieldKeys(draft: SchemaDesignerDraft) {
  return uniqueValues(draft.fields.map((field) => normalizeKey(field.key)).filter(Boolean));
}

export function nextSchemaDesignerFieldKey(
  fields: readonly SchemaDesignerField[],
  prefix = "field",
) {
  const normalizedPrefix = normalizeKey(prefix) || "field";
  const existing = new Set(fields.map((field) => normalizeKey(field.key)));
  let suffix = 1;
  while (existing.has(`${normalizedPrefix}_${suffix}`)) suffix += 1;
  return `${normalizedPrefix}_${suffix}`;
}

function fieldsFromProperties(
  properties: Record<string, JsonSchema>,
  requiredKeys: string[],
): SchemaDesignerField[] {
  return Object.entries(properties).map(([key, schema], index) =>
    createSchemaDesignerField({
      id: stableFieldId(key, index),
      key,
      title: schema.title ?? titleFromKey(key),
      type: designerType(schema),
      required: requiredKeys.includes(key),
      description: schema.description ?? "",
      defaultValue: schema.default === undefined ? "" : literalToText(schema.default),
      enumValues: schema.enum?.map(literalToText).join("\n") ?? "",
      minimum: numberText(schema.minimum ?? schema.exclusiveMinimum),
      maximum: numberText(schema.maximum ?? schema.exclusiveMaximum),
      sourceSchema: clone(schema),
      children:
        designerType(schema) === "object"
          ? fieldsFromProperties(schema.properties ?? {}, schema.required ?? [])
          : [],
    }),
  );
}

function schemaFromField(field: SchemaDesignerField, index: number): JsonSchema {
  const schema: JsonSchema = clone(field.sourceSchema ?? {});
  const originalType = field.sourceSchema ? designerType(field.sourceSchema) : undefined;
  if (!field.sourceSchema || originalType !== field.type || field.sourceSchema.type !== undefined) {
    schema.type = field.type;
  }
  schema.title = field.title.trim() || titleFromKey(field.key);
  if (!field.sourceSchema) {
    schema["x-ui"] = { ...(schema["x-ui"] ?? {}), order: index + 1 };
  }

  if (field.description.trim()) {
    schema.description = field.description.trim();
  } else {
    delete schema.description;
  }

  const defaultValue = parseLooseLiteral(field.defaultValue);
  if (defaultValue !== undefined) {
    assertValueMatchesType(defaultValue, field.type, `${field.key} default`);
    schema.default = defaultValue;
  } else {
    delete schema.default;
  }

  const enumValues = parseEnumValues(field.enumValues);
  if (enumValues.length > 0) {
    for (const value of enumValues) assertValueMatchesType(value, field.type, `${field.key} enum`);
    schema.enum = enumValues;
  } else {
    delete schema.enum;
  }

  const minimum = parseOptionalNumber(field.minimum);
  if (minimum !== undefined && (field.type === "number" || field.type === "integer")) {
    if (field.sourceSchema?.exclusiveMinimum !== undefined) schema.exclusiveMinimum = minimum;
    else schema.minimum = minimum;
  } else {
    delete schema.minimum;
    delete schema.exclusiveMinimum;
  }

  const maximum = parseOptionalNumber(field.maximum);
  if (maximum !== undefined && (field.type === "number" || field.type === "integer")) {
    if (field.sourceSchema?.exclusiveMaximum !== undefined) schema.exclusiveMaximum = maximum;
    else schema.maximum = maximum;
  } else {
    delete schema.maximum;
    delete schema.exclusiveMaximum;
  }

  if (field.type === "object") {
    schema.properties = {};
    const required = field.children
      .filter((child) => child.required && normalizeKey(child.key))
      .map((child) => normalizeKey(child.key));
    if (required.length > 0) {
      schema.required = uniqueValues(required);
    } else {
      delete schema.required;
    }

    for (const [childIndex, child] of field.children.entries()) {
      const key = normalizeKey(child.key);
      if (!key) continue;
      schema.properties[key] = schemaFromField(child, childIndex);
    }
  }

  if (field.type === "array" && schema.items === undefined) {
    schema.items = {};
  }

  if (field.type !== "object") {
    delete schema.properties;
    delete schema.required;
  }
  if (field.type !== "array" && originalType === "array") {
    delete schema.items;
  }

  return schema;
}

function conditionSchema(condition: SchemaDesignerCondition): JsonSchema | undefined {
  const ifFieldKey = normalizeKey(condition.ifFieldKey);
  const thenRequiredKey = normalizeKey(condition.thenRequiredKey);
  const equals = parseLooseLiteral(condition.equals);

  if (!ifFieldKey || !thenRequiredKey || equals === undefined) return undefined;

  return {
    if: {
      properties: {
        [ifFieldKey]: { const: equals },
      },
      required: [ifFieldKey],
    },
    then: {
      required: [thenRequiredKey],
    },
  };
}

function splitAllOfConditions(allOf: JsonSchema[] | undefined) {
  const conditions: SchemaDesignerCondition[] = [];
  const unmanaged: JsonSchema[] = [];
  if (!Array.isArray(allOf)) return { conditions, unmanaged };

  allOf.forEach((schema, index) => {
    const ifRequired = schema.if?.required?.[0];
    const thenRequired = schema.then?.required?.[0];
    const constValue =
      ifRequired && schema.if?.properties?.[ifRequired]
        ? schema.if.properties[ifRequired].const
        : undefined;
    if (!ifRequired || !thenRequired || constValue === undefined) {
      unmanaged.push(clone(schema));
    } else {
      conditions.push(
        createSchemaDesignerCondition({
          id: `condition-${index}-${ifRequired}-${thenRequired}`,
          ifFieldKey: ifRequired,
          equals: literalToText(constValue),
          thenRequiredKey: thenRequired,
        }),
      );
    }
  });
  return { conditions, unmanaged };
}

function designerType(schema: JsonSchema): SchemaDesignerFieldType {
  const type = Array.isArray(schema.type)
    ? schema.type.find((candidate) => candidate !== "null")
    : schema.type;

  if (type && schemaDesignerFieldTypes.includes(type as SchemaDesignerFieldType)) {
    return type as SchemaDesignerFieldType;
  }

  if (schema.properties) return "object";
  if (schema.enum?.length) {
    const enumType = typeof schema.enum[0];
    if (enumType === "number") return "number";
    if (enumType === "boolean") return "boolean";
  }
  return "string";
}

function findFieldInList(
  fields: SchemaDesignerField[],
  id: string,
  parentId?: string,
): FieldLocation | undefined {
  for (const field of fields) {
    if (field.id === id) return { field, parentId };
    const child = findFieldInList(field.children, id, field.id);
    if (child) return child;
  }
  return undefined;
}

function updateFieldList(
  fields: SchemaDesignerField[],
  id: string,
  update: (field: SchemaDesignerField) => SchemaDesignerField,
): SchemaDesignerField[] {
  return fields.map((field) => {
    if (field.id === id) return update(field);
    return { ...field, children: updateFieldList(field.children, id, update) };
  });
}

function removeFieldFromList(fields: SchemaDesignerField[], id: string): SchemaDesignerField[] {
  return fields
    .filter((field) => field.id !== id)
    .map((field) => ({ ...field, children: removeFieldFromList(field.children, id) }));
}

function parseEnumValues(source: string): JsonValue[] {
  return source
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => parseLooseLiteral(value) ?? value);
}

function parseLooseLiteral(source: string): JsonValue | undefined {
  const trimmed = source.trim();
  if (!trimmed) return undefined;

  try {
    return JSON.parse(trimmed) as JsonValue;
  } catch {
    if (trimmed === "true") return true;
    if (trimmed === "false") return false;
    if (trimmed === "null") return null;
    const number = Number(trimmed);
    if (Number.isFinite(number) && /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(trimmed)) {
      return number;
    }
    return trimmed;
  }
}

function literalToText(value: JsonValue): string {
  if (typeof value !== "string") return JSON.stringify(value);
  return parseLooseLiteral(value) === value ? value : JSON.stringify(value);
}

function parseOptionalNumber(source: string) {
  if (!source.trim()) return undefined;
  const number = Number(source);
  return Number.isFinite(number) ? number : undefined;
}

function numberText(value: number | undefined) {
  return value === undefined ? "" : String(value);
}

function normalizeKey(key: string) {
  return key.trim();
}

function uniqueFieldKey(title: string) {
  const key = normalizeKey(title.toLowerCase().replace(/[^a-z0-9_ -]/g, ""));
  return key || "field";
}

function titleFromKey(key: string) {
  return key
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function stableFieldId(key: string, index: number) {
  return `field-${index}-${key.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

function assertUniqueFieldKeys(fields: SchemaDesignerField[], parent = "root") {
  const seen = new Set<string>();
  for (const field of fields) {
    const key = normalizeKey(field.key);
    if (!key) throw new Error(`A field under ${parent} has an empty key.`);
    if (seen.has(key)) throw new Error(`Duplicate field key '${key}' under ${parent}.`);
    seen.add(key);
    assertUniqueFieldKeys(field.children, key);
  }
}

function assertValueMatchesType(value: JsonValue, type: SchemaDesignerFieldType, label: string) {
  const valid =
    (type === "array" && Array.isArray(value)) ||
    (type === "object" && typeof value === "object" && value !== null && !Array.isArray(value)) ||
    (type === "integer" && typeof value === "number" && Number.isInteger(value)) ||
    (type === "number" && typeof value === "number" && Number.isFinite(value)) ||
    (type === "boolean" && typeof value === "boolean") ||
    (type === "string" && typeof value === "string");
  if (!valid) throw new Error(`${label} does not match type ${type}.`);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function uniqueValues(values: string[]) {
  return [...new Set(values)];
}
