import type { JsonValue } from "@schematica/core";

export const documentSchemaKey = "$schema";

export function documentSchemaReference(data: JsonValue | undefined): string | undefined {
  if (!isRecord(data)) return undefined;
  const value = data[documentSchemaKey];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

export function dataWithoutDocumentMetadata(data: JsonValue | undefined): JsonValue | undefined {
  if (!isRecord(data) || !(documentSchemaKey in data)) return data;

  const rest = { ...data };
  delete rest[documentSchemaKey];
  return rest;
}

function isRecord(value: unknown): value is Record<string, JsonValue> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
