import type { JsonValue } from "@schematica/core";

export function fieldOptionLabel(
  fieldPath: string,
  option: JsonValue | undefined,
  labels: Readonly<Record<string, string>>,
): string {
  if (option === undefined) return "";
  const raw = typeof option === "string" ? option : JSON.stringify(option);
  return labels[`option.${fieldPath}.${raw}`] ?? raw;
}
