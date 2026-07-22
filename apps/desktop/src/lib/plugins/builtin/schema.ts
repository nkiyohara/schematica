import {
  analyzeSchemaCoverage,
  buildFieldModel,
  parseSchema,
  type DataFormat,
  type JsonSchema,
} from "@schematica/core";
import type { ResourceRef, SchemaProvider } from "../types";

export function createJsonSchemaProvider(): SchemaProvider {
  return {
    id: "core.schema.json-schema",
    title: "JSON Schema",
    canLoad(ref) {
      return schemaResourcePath(ref).trim().length > 0;
    },
    parse(text, format) {
      return parseSchema(text, { format });
    },
    coverage(schema) {
      return analyzeSchemaCoverage(schema);
    },
    fields(schema) {
      return buildFieldModel(schema);
    },
  };
}

export function schemaProviderForResource(
  providers: readonly SchemaProvider[],
  resource: ResourceRef,
): SchemaProvider | undefined {
  return providers.find((provider) => provider.canLoad(resource));
}

export function parseSchemaWithProvider(
  provider: SchemaProvider,
  text: string,
  format: DataFormat,
): JsonSchema {
  return provider.parse(text, format);
}

function schemaResourcePath(ref: ResourceRef) {
  return ref.path;
}
