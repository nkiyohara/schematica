import { parseDocument, stringify } from "yaml";
import { parse as parseToml, stringify as stringifyToml } from "smol-toml";
import type {
  DataFormat,
  FormatOptions,
  JsonObject,
  JsonSchema,
  JsonValue,
  ParseOptions,
} from "./types.js";
import { setPath, tokens } from "./path.js";

const tomlTemporalMetadata = new WeakMap<object, Map<string, Date>>();

export function parseSchema(source: string, options: ParseOptions = {}): JsonSchema {
  return parseData(source, options) as JsonSchema;
}

export function parseData(source: string, options: ParseOptions = {}): JsonValue {
  if (options.format === "json") {
    return JSON.parse(source) as JsonValue;
  }

  if (options.format === "toml") {
    const temporalValues = new Map<string, Date>();
    const parsed = normalizeTomlValue(parseToml(source), "", temporalValues);
    if (typeof parsed === "object" && parsed !== null) {
      tomlTemporalMetadata.set(parsed, temporalValues);
    }
    return parsed;
  }

  const doc = parseDocument(source, {
    prettyErrors: true,
    strict: true,
    version: "1.2",
  });

  if (doc.errors.length > 0) {
    throw new Error(doc.errors.map((error) => error.message).join("\n"));
  }

  return doc.toJSON() as JsonValue;
}

export function stringifyData(data: unknown, options: FormatOptions = {}): string {
  if (options.format === "json") {
    return `${JSON.stringify(data, null, 2)}\n`;
  }

  if (options.format === "toml") {
    if (!isRecord(data)) {
      throw new Error("TOML output requires an object at the document root.");
    }
    return stringifyToml(restoreTomlTemporalValues(data));
  }

  return stringify(data, {
    indent: 2,
    lineWidth: 100,
    singleQuote: false,
  });
}

export function updateDataText(
  source: string,
  path: string,
  value: JsonValue,
  options: FormatOptions = {},
): string {
  const format = options.format ?? "yaml";
  if (format === "toml") {
    return updateTomlText(source, path, value);
  }
  if (format === "yaml" && options.preserveComments === "best-effort") {
    return updateYamlText(source, path, value);
  }

  return stringifyData(setPath(parseData(source, { format }), path, value), { format });
}

export function formatFromPath(path: string, fallback: DataFormat = "yaml"): DataFormat {
  const extension = path.split(".").at(-1)?.toLowerCase();

  if (extension === "json") {
    return "json";
  }

  if (extension === "toml") {
    return "toml";
  }

  if (extension === "yaml" || extension === "yml") {
    return "yaml";
  }

  return fallback;
}

function normalizeTomlValue(
  value: unknown,
  path: string,
  temporalValues: Map<string, Date>,
): JsonValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (value instanceof Date) {
    temporalValues.set(path, value);
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((child, index) =>
      normalizeTomlValue(child, `${path}/${index}`, temporalValues),
    );
  }

  if (isRecord(value)) {
    const output: JsonObject = {};
    for (const [key, child] of Object.entries(value)) {
      output[key] = normalizeTomlValue(
        child,
        `${path}/${key.replaceAll("~", "~0").replaceAll("/", "~1")}`,
        temporalValues,
      );
    }
    return output;
  }

  throw new Error(`Unsupported TOML value: ${Object.prototype.toString.call(value)}`);
}

function restoreTomlTemporalValues(data: Record<string, unknown>) {
  const temporalValues = tomlTemporalMetadata.get(data);
  if (!temporalValues?.size) return data;

  const restore = (value: unknown, path: string): unknown => {
    const temporal = temporalValues.get(path);
    if (temporal && value === temporal.toISOString()) return temporal;
    if (Array.isArray(value)) {
      return value.map((child, index) => restore(child, `${path}/${index}`));
    }
    if (isRecord(value)) {
      return Object.fromEntries(
        Object.entries(value).map(([key, child]) => [
          key,
          restore(child, `${path}/${key.replaceAll("~", "~0").replaceAll("/", "~1")}`),
        ]),
      );
    }
    return value;
  };

  return restore(data, "");
}

function updateTomlText(source: string, path: string, value: JsonValue) {
  const data = parseToml(source) as Record<string, unknown>;
  const parts = tokens(path);
  if (parts.length === 0) {
    if (!isRecord(value)) throw new Error("TOML output requires an object at the document root.");
    return stringifyToml(value);
  }

  let cursor: unknown = data;
  for (const [index, part] of parts.entries()) {
    const isLast = index === parts.length - 1;
    if (Array.isArray(cursor)) {
      const arrayIndex = Number(part);
      if (!Number.isInteger(arrayIndex)) {
        throw new Error(`Cannot set ${path}: ${part} is not an array index`);
      }
      if (isLast) cursor[arrayIndex] = value;
      else cursor = cursor[arrayIndex] ??= {};
      continue;
    }
    if (!isRecord(cursor)) {
      throw new Error(`Cannot set ${path}: ${parts.slice(0, index).join(".")} is not an object`);
    }
    if (isLast) cursor[part] = value;
    else cursor = cursor[part] ??= {};
  }
  return stringifyToml(data);
}

function updateYamlText(source: string, path: string, value: JsonValue): string {
  const doc = parseDocument(source, {
    prettyErrors: true,
    strict: true,
    version: "1.2",
  });

  if (doc.errors.length > 0) {
    throw new Error(doc.errors.map((error) => error.message).join("\n"));
  }

  const pathTokens = tokens(path).map((token) => (/^\d+$/.test(token) ? Number(token) : token));
  if (pathTokens.length === 0) {
    doc.contents = doc.createNode(value) as NonNullable<typeof doc.contents>;
  } else {
    doc.setIn(pathTokens, value);
  }

  return doc.toString({
    indent: 2,
    lineWidth: 100,
    singleQuote: false,
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
