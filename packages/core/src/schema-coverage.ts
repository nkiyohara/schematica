import type {
  JsonSchema,
  SchemaCoverageItem,
  SchemaCoverageLevel,
  SchemaCoverageReport,
  SchemaDialect,
} from "./types.js";

const formSupportedKeywords = new Set([
  "$schema",
  "$id",
  "default",
  "description",
  "enum",
  "exclusiveMaximum",
  "exclusiveMinimum",
  "maximum",
  "minimum",
  "properties",
  "required",
  "title",
  "type",
  "x-ui",
]);

const validatedOnlyKeywordDetails = new Map<string, string>([
  [
    "$defs",
    "Validated by AJV when referenced, but definitions are not expanded into generated controls.",
  ],
  ["$ref", "Validated by AJV when resolvable, but not expanded into generated controls."],
  ["additionalProperties", "Validated by AJV; dynamic keys are not generated as controls."],
  ["allOf", "Validated by AJV; merged form controls are not generated."],
  ["anyOf", "Validated by AJV; branch selection controls are not generated."],
  ["contains", "Validated by AJV; array item editors are not generated yet."],
  ["const", "Validated by AJV; displayed as a normal field only when a type is also renderable."],
  [
    "definitions",
    "Validated by AJV when referenced, but definitions are not expanded into generated controls.",
  ],
  ["dependentRequired", "Validated by AJV; dependent field controls are not generated."],
  ["dependentSchemas", "Validated by AJV; dependent schema controls are not generated."],
  ["else", "Validated by AJV; conditional form branching is not generated."],
  ["format", "Validated by AJV formats; specialized widgets are not inferred from it yet."],
  ["if", "Validated by AJV; conditional form branching is not generated."],
  ["items", "Validated by AJV; array item editors are not generated yet."],
  ["maxItems", "Validated by AJV; array item editors are not generated yet."],
  ["maxLength", "Validated by AJV; text controls do not enforce it client-side yet."],
  ["maxProperties", "Validated by AJV; object size controls are not generated."],
  ["minItems", "Validated by AJV; array item editors are not generated yet."],
  ["minLength", "Validated by AJV; text controls do not enforce it client-side yet."],
  ["minProperties", "Validated by AJV; object size controls are not generated."],
  ["multipleOf", "Validated by AJV; numeric controls do not enforce it client-side yet."],
  ["not", "Validated by AJV; negative schema controls are not generated."],
  ["oneOf", "Validated by AJV; branch selection controls are not generated."],
  ["pattern", "Validated by AJV; text controls do not enforce it client-side yet."],
  ["patternProperties", "Validated by AJV; pattern-key controls are not generated."],
  ["prefixItems", "Validated by AJV; tuple editors are not generated yet."],
  ["propertyNames", "Validated by AJV; dynamic key editors are not generated."],
  ["then", "Validated by AJV; conditional form branching is not generated."],
  ["unevaluatedItems", "Validated by AJV; array item editors are not generated yet."],
  ["unevaluatedProperties", "Validated by AJV; dynamic keys are not generated as controls."],
  ["uniqueItems", "Validated by AJV; array item editors are not generated yet."],
]);

const annotationKeywords = new Set(["examples", "readOnly", "writeOnly", "deprecated"]);
const schemaArrayKeywords = new Set(["allOf", "anyOf", "oneOf"]);
const schemaObjectKeywords = new Set([
  "$defs",
  "additionalProperties",
  "contains",
  "definitions",
  "dependentSchemas",
  "else",
  "if",
  "items",
  "not",
  "patternProperties",
  "prefixItems",
  "properties",
  "propertyNames",
  "then",
  "unevaluatedItems",
  "unevaluatedProperties",
]);

export function analyzeSchemaCoverage(schema: JsonSchema): SchemaCoverageReport {
  const counts = new Map<string, number>();
  visitSchema(schema, counts);
  const dialect = detectDialect(schema.$schema);

  const validatedOnlyKeywords = toItems(counts, validatedOnlyKeywordDetails, "validated");
  const unsupportedKeywords = [...counts]
    .filter(([keyword]) => isUnsupportedKeyword(keyword))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([keyword, count]) => ({
      keyword,
      level: "unsupported" as const,
      count,
      detail:
        "Unknown to Schematica's form generator. AJV may reject or ignore it depending on schema semantics.",
    }));

  const supported = [...counts].reduce(
    (total, [keyword, count]) => total + (formSupportedKeywords.has(keyword) ? count : 0),
    0,
  );
  const validatedOnly = validatedOnlyKeywords.reduce((total, item) => total + item.count, 0);
  const unsupported = unsupportedKeywords.reduce((total, item) => total + item.count, 0);

  return {
    dialect,
    dialectLabel: dialectLabel(schema.$schema),
    validation: {
      engine: `${dialectEngine(dialect)} + ajv-formats`,
      detail: `Validation runs with ${dialectLabel(schema.$schema)} semantics, allErrors, union types, and strict mode disabled.`,
    },
    form: {
      supportedKeywords: [...formSupportedKeywords].sort(),
      validatedOnlyKeywords,
      unsupportedKeywords,
    },
    totals: {
      supported,
      validatedOnly,
      unsupported,
    },
  };
}

function dialectEngine(dialect: SchemaDialect) {
  if (dialect === "draft-2019-09") return "AJV 2019";
  if (dialect === "draft-07") return "AJV draft-07";
  return "AJV 2020";
}

function visitSchema(value: unknown, counts: Map<string, number>) {
  if (!isSchemaObject(value)) return;

  for (const [keyword, child] of Object.entries(value)) {
    counts.set(keyword, (counts.get(keyword) ?? 0) + 1);

    if (keyword === "properties" && isRecord(child)) {
      for (const propertySchema of Object.values(child)) {
        visitSchema(propertySchema, counts);
      }
      continue;
    }

    if (schemaArrayKeywords.has(keyword) && Array.isArray(child)) {
      for (const childSchema of child) {
        visitSchema(childSchema, counts);
      }
      continue;
    }

    if (schemaObjectKeywords.has(keyword)) {
      visitNestedSchemaKeyword(child, counts);
    }
  }
}

function visitNestedSchemaKeyword(value: unknown, counts: Map<string, number>) {
  if (typeof value === "boolean") return;
  if (Array.isArray(value)) {
    for (const child of value) {
      visitSchema(child, counts);
    }
    return;
  }
  if (!isRecord(value)) return;

  if (looksLikeSchema(value)) {
    visitSchema(value, counts);
    return;
  }

  for (const child of Object.values(value)) {
    visitSchema(child, counts);
  }
}

function toItems(
  counts: Map<string, number>,
  details: Map<string, string>,
  level: SchemaCoverageLevel,
): SchemaCoverageItem[] {
  return [...details]
    .flatMap(([keyword, detail]) => {
      const count = counts.get(keyword) ?? 0;
      return count > 0 ? [{ keyword, level, count, detail }] : [];
    })
    .sort((a, b) => a.keyword.localeCompare(b.keyword));
}

function isUnsupportedKeyword(keyword: string) {
  return (
    !formSupportedKeywords.has(keyword) &&
    !validatedOnlyKeywordDetails.has(keyword) &&
    !annotationKeywords.has(keyword)
  );
}

function detectDialect(schemaUri: string | undefined): SchemaDialect {
  if (!schemaUri) return "draft-2020-12";
  if (schemaUri.includes("2020-12")) return "draft-2020-12";
  if (schemaUri.includes("2019-09")) return "draft-2019-09";
  if (schemaUri.includes("draft-07") || schemaUri.includes("draft-7")) return "draft-07";
  return "unknown";
}

function dialectLabel(schemaUri: string | undefined) {
  const dialect = detectDialect(schemaUri);
  if (dialect === "draft-2020-12") return "JSON Schema draft 2020-12";
  if (dialect === "draft-2019-09") return "JSON Schema draft 2019-09";
  if (dialect === "draft-07") return "JSON Schema draft-07";
  return schemaUri ?? "JSON Schema draft 2020-12";
}

function isSchemaObject(value: unknown): value is JsonSchema {
  return isRecord(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function looksLikeSchema(value: Record<string, unknown>) {
  return [...formSupportedKeywords, ...validatedOnlyKeywordDetails.keys()].some((keyword) =>
    Object.prototype.hasOwnProperty.call(value, keyword),
  );
}
