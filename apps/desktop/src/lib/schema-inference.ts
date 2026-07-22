import type { DataFormat, JsonSchema, JsonValue, SchemaType } from "@schematica/core";

const rawViewCharacterThreshold = 256 * 1024;
const rawViewArrayThreshold = 200;
const rawViewNodeThreshold = 1_000;
const rawViewDepthThreshold = 8;

export type SchemaFreeViewReason =
  "form" | "invalid" | "root" | "large" | "collection" | "complex" | "unsafeInteger";

export interface SchemaFreeDocumentAnalysis {
  preferredView: "form" | "raw";
  reason: SchemaFreeViewReason;
  characters: number;
  nodes: number;
  maxDepth: number;
  maxArrayLength: number;
}

export const schemaFreeSettingTypes = [
  "string",
  "number",
  "integer",
  "boolean",
  "object",
  "array",
] as const satisfies readonly SchemaType[];

export type SchemaFreeSettingType = (typeof schemaFreeSettingTypes)[number];

export function analyzeSchemaFreeDocument(
  value: JsonValue | undefined,
  source: string,
  format: DataFormat,
): SchemaFreeDocumentAnalysis {
  const base = {
    characters: source.length,
    nodes: 0,
    maxDepth: 0,
    maxArrayLength: 0,
  };
  if (value === undefined) return { ...base, preferredView: "raw", reason: "invalid" };
  if (!isPlainObject(value)) {
    const metrics = collectMetrics(value);
    return { ...base, ...metrics, preferredView: "raw", reason: "root" };
  }

  const metrics = collectMetrics(value);
  if (format === "json" && containsUnsafeJsonInteger(source)) {
    return { ...base, ...metrics, preferredView: "raw", reason: "unsafeInteger" };
  }
  if (source.length > rawViewCharacterThreshold) {
    return { ...base, ...metrics, preferredView: "raw", reason: "large" };
  }
  if (metrics.maxArrayLength > rawViewArrayThreshold) {
    return { ...base, ...metrics, preferredView: "raw", reason: "collection" };
  }
  if (metrics.nodes > rawViewNodeThreshold || metrics.maxDepth > rawViewDepthThreshold) {
    return { ...base, ...metrics, preferredView: "raw", reason: "complex" };
  }
  return { ...base, ...metrics, preferredView: "form", reason: "form" };
}

export function inferSchemaFromData(value: JsonValue, title = "Inferred Config"): JsonSchema {
  const inferred = inferValueSchema(value);
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    title,
    ...inferred,
  };
}

export function defaultValueForSettingType(type: SchemaFreeSettingType): JsonValue {
  switch (type) {
    case "boolean":
      return false;
    case "number":
    case "integer":
      return 0;
    case "object":
      return {};
    case "array":
      return [];
    default:
      return "";
  }
}

function inferValueSchema(value: JsonValue): JsonSchema {
  if (value === null) return { type: "null" };
  if (Array.isArray(value)) {
    const first = value.find((item) => item !== null);
    return {
      type: "array",
      ...(first === undefined ? {} : { items: inferValueSchema(first) }),
    };
  }
  if (typeof value === "object") {
    return {
      type: "object",
      properties: Object.fromEntries(
        Object.entries(value).map(([key, child], index) => [
          key,
          {
            title: humanizeKey(key),
            ...inferValueSchema(child ?? null),
            "x-ui": { order: index },
          },
        ]),
      ),
      additionalProperties: true,
    };
  }
  if (typeof value === "number") {
    return { type: Number.isInteger(value) ? "integer" : "number" };
  }
  return { type: typeof value as "boolean" | "string" };
}

function humanizeKey(key: string) {
  return key
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (letter) => letter.toLocaleUpperCase());
}

function collectMetrics(root: JsonValue) {
  let nodes = 0;
  let maxDepth = 0;
  let maxArrayLength = 0;
  const stack: Array<{ value: JsonValue; depth: number }> = [{ value: root, depth: 0 }];
  while (stack.length > 0 && nodes <= rawViewNodeThreshold + 1) {
    const current = stack.pop();
    if (!current) break;
    nodes += 1;
    maxDepth = Math.max(maxDepth, current.depth);
    if (Array.isArray(current.value)) {
      maxArrayLength = Math.max(maxArrayLength, current.value.length);
      for (const child of current.value) stack.push({ value: child, depth: current.depth + 1 });
    } else if (isPlainObject(current.value)) {
      for (const child of Object.values(current.value)) {
        if (child !== undefined) stack.push({ value: child, depth: current.depth + 1 });
      }
    }
  }
  return { nodes, maxDepth, maxArrayLength };
}

function containsUnsafeJsonInteger(source: string) {
  let inString = false;
  let escaping = false;
  let index = 0;
  while (index < source.length) {
    const character = source[index];
    if (inString) {
      if (escaping) escaping = false;
      else if (character === "\\") escaping = true;
      else if (character === '"') inString = false;
      index += 1;
      continue;
    }
    if (character === '"') {
      inString = true;
      index += 1;
      continue;
    }
    if (character === "-" || (character >= "0" && character <= "9")) {
      const match = source.slice(index).match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/);
      const token = match?.[0];
      if (token) {
        if (!token.includes(".") && !/[eE]/.test(token) && !Number.isSafeInteger(Number(token))) {
          return true;
        }
        index += token.length;
        continue;
      }
    }
    index += 1;
  }
  return false;
}

function isPlainObject(value: JsonValue): value is Record<string, JsonValue | undefined> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
