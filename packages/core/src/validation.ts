import { Ajv } from "ajv";
import { Ajv2019 } from "ajv/dist/2019.js";
import { Ajv2020 } from "ajv/dist/2020.js";
import * as addFormatsModule from "ajv-formats";
import type { ErrorObject, ValidateFunction } from "ajv";
import type { JsonSchema, ValidationIssue, ValidationResult } from "./types.js";

const validatorCache = new WeakMap<JsonSchema, ValidateFunction>();

export function createValidator(schema: JsonSchema) {
  const cached = validatorCache.get(schema);
  if (cached) return cached;

  const options = {
    allErrors: true,
    allowUnionTypes: true,
    strict: false,
    useDefaults: false,
  } as const;
  const dialect = schema.$schema ?? "https://json-schema.org/draft/2020-12/schema";
  const ajv = dialect.includes("2019-09")
    ? new Ajv2019(options)
    : dialect.includes("draft-07") || dialect.includes("draft-7")
      ? new Ajv(options)
      : new Ajv2020(options);

  const addFormats = addFormatsModule.default as unknown as (validator: typeof ajv) => void;
  addFormats(ajv);

  const validator = ajv.compile(schema);
  validatorCache.set(schema, validator);
  return validator;
}

export function validateConfig(schema: JsonSchema, data: unknown): ValidationResult {
  const validate = createValidator(schema);
  const valid = validate(data);

  return {
    valid,
    issues: (validate.errors ?? []).map(toIssue),
  };
}

function toIssue(error: ErrorObject): ValidationIssue {
  return {
    path: error.instancePath || "/",
    message: error.message ?? "Invalid value",
    keyword: error.keyword,
    params: error.params,
  };
}
