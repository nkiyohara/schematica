import { describe, expect, it } from "vitest";
import { dataWithoutDocumentMetadata, documentSchemaReference } from "./document-metadata";

describe("document metadata", () => {
  it("reads a top-level schema reference", () => {
    expect(documentSchemaReference({ $schema: " ./schema.json ", project: "demo" })).toBe(
      "./schema.json",
    );
  });

  it("removes editor metadata before schema validation", () => {
    expect(dataWithoutDocumentMetadata({ $schema: "./schema.json", project: "demo" })).toEqual({
      project: "demo",
    });
  });
});
