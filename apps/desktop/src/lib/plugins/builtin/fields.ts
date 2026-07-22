import type { FieldModel } from "@schematica/core";
import FieldEditor from "../../FieldEditor.svelte";
import type { FieldRendererProvider } from "../types";

export function createFieldRendererProviders(): FieldRendererProvider[] {
  return [
    renderer("core.field.object", 10, (field) => field.type === "object"),
    renderer("core.field.array", 10, (field) => field.type === "array"),
    renderer("core.field.enum", 20, (field) => Boolean(field.enum?.length)),
    renderer("core.field.boolean", 10, (field) => field.type === "boolean"),
    renderer(
      "core.field.number",
      10,
      (field) => field.type === "number" || field.type === "integer",
    ),
    renderer("core.field.text", 0, () => true),
  ];
}

export function fieldRendererFor(
  providers: readonly FieldRendererProvider[],
  field: FieldModel,
): FieldRendererProvider | undefined {
  return providers
    .filter((provider) => provider.supports(field))
    .sort((left, right) => right.priority - left.priority)[0];
}

function renderer(
  id: string,
  priority: number,
  supports: (field: FieldModel) => boolean,
): FieldRendererProvider {
  return {
    id,
    priority,
    supports,
    component: FieldEditor,
  };
}
