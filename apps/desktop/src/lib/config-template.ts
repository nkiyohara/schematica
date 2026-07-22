import {
  applySchemaDefaults,
  stringifyData,
  type DataFormat,
  type JsonSchema,
  type JsonValue,
} from "@schematica/core";

export function defaultConfigText(schema: JsonSchema | undefined, format: DataFormat): string {
  const data = defaultConfigData(schema);
  if (format === "toml" && !isObject(data)) {
    return "";
  }

  return stringifyData(data, { format });
}

export function defaultConfigData(schema: JsonSchema | undefined): JsonValue {
  const defaults = schema ? applySchemaDefaults(schema, undefined) : undefined;
  return defaults ?? {};
}

export function draftConfigName(existingNames: Iterable<string>, format: DataFormat): string {
  const extension = configExtension(format);
  const existing = new Set(existingNames);

  for (let index = 1; ; index += 1) {
    const name = index === 1 ? `config.${extension}` : `config-${index}.${extension}`;
    if (!existing.has(name)) return name;
  }
}

export function configExtension(format: DataFormat): "yaml" | "json" | "toml" {
  if (format === "json") return "json";
  if (format === "toml") return "toml";
  return "yaml";
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
