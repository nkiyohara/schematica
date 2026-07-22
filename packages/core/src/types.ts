import type { ErrorObject } from "ajv";

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export interface JsonObject {
  [key: string]: JsonValue | undefined;
}

export type SchemaType = "array" | "boolean" | "integer" | "null" | "number" | "object" | "string";

export interface JsonSchema {
  $schema?: string;
  $id?: string;
  title?: string;
  description?: string;
  type?: SchemaType | SchemaType[];
  const?: JsonValue;
  enum?: JsonValue[];
  default?: JsonValue;
  examples?: JsonValue[];
  required?: string[];
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  additionalProperties?: boolean | JsonSchema;
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  minItems?: number;
  maxItems?: number;
  oneOf?: JsonSchema[];
  anyOf?: JsonSchema[];
  allOf?: JsonSchema[];
  if?: JsonSchema;
  then?: JsonSchema;
  else?: JsonSchema;
  $ref?: string;
  "x-ui"?: UiHints;
  [keyword: string]: unknown;
}

export interface UiHints {
  section?: string;
  widget?:
    | "checkbox"
    | "code"
    | "color"
    | "log-slider"
    | "number"
    | "password"
    | "select"
    | "slider"
    | "textarea"
    | "text";
  order?: number;
  placeholder?: string;
  hidden?: boolean;
  readOnly?: boolean;
  scale?: "linear" | "log";
  step?: number;
  unit?: string;
  note?: string;
  optionsFrom?: {
    command?: string;
    url?: string;
  };
}

export interface ValidationIssue {
  path: string;
  message: string;
  keyword: string;
  params: ErrorObject["params"];
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

export type SchemaDialect = "draft-2020-12" | "draft-2019-09" | "draft-07" | "unknown";
export type SchemaCoverageLevel = "supported" | "validated" | "unsupported";

export interface SchemaCoverageItem {
  keyword: string;
  level: SchemaCoverageLevel;
  count: number;
  detail: string;
}

export interface SchemaCoverageReport {
  dialect: SchemaDialect;
  dialectLabel: string;
  validation: {
    engine: string;
    detail: string;
  };
  form: {
    supportedKeywords: string[];
    validatedOnlyKeywords: SchemaCoverageItem[];
    unsupportedKeywords: SchemaCoverageItem[];
  };
  totals: {
    supported: number;
    validatedOnly: number;
    unsupported: number;
  };
}

export interface FieldModel {
  path: string;
  key: string;
  title: string;
  description?: string;
  type: SchemaType;
  required: boolean;
  enum?: JsonValue[];
  constValue?: JsonValue;
  defaultValue?: JsonValue;
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;
  widget?: UiHints["widget"];
  ui: UiHints;
  children?: FieldModel[];
}

export type DataFormat = "json" | "toml" | "yaml";
export type CommentPreservation = "best-effort" | "off";

export interface FormatOptions {
  format?: DataFormat;
  preserveComments?: CommentPreservation;
}

export interface ParseOptions {
  format?: DataFormat;
}

export interface ConfigSnapshot {
  name: string;
  data: JsonValue;
}

export type DiffRowKind = "same" | "changed" | "missing";

export interface DiffCell {
  name: string;
  exists: boolean;
  value?: JsonValue;
  status: DiffRowKind;
}

export interface DiffRow {
  path: string;
  kind: DiffRowKind;
  cells: DiffCell[];
}

export interface DiffSummary {
  total: number;
  same: number;
  changed: number;
  missing: number;
}

export interface DiffOptions {
  onlyChanges?: boolean;
  baseline?: string;
}
