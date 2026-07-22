import { describe, expect, it } from "vitest";
import { createConfigDocument, isDocumentDirty, markDocumentSaved } from "./config-document";

describe("config document state", () => {
  it("creates clean documents from their initial text", () => {
    const document = createConfigDocument({
      id: "doc",
      name: "config.yaml",
      text: "name: demo\n",
    });

    expect(isDocumentDirty(document)).toBe(false);
    expect(document.saveState).toBe("idle");
  });

  it("detects edits relative to the last saved text", () => {
    const document = createConfigDocument({
      id: "doc",
      name: "config.yaml",
      text: "name: changed\n",
      savedText: "name: demo\n",
    });

    expect(isDocumentDirty(document)).toBe(true);
  });

  it("marks a document saved with its new path and snapshot", () => {
    const document = createConfigDocument({
      id: "doc",
      name: "draft.yaml",
      text: "name: changed\n",
      savedText: "name: demo\n",
    });

    const saved = markDocumentSaved(document, {
      path: "/tmp/project/config.json",
      text: '{\n  "name": "changed"\n}\n',
      savedAt: 42,
      message: "Saved",
    });

    expect(saved.name).toBe("config.json");
    expect(saved.savedText).toBe(saved.text);
    expect(saved.lastSavedAt).toBe(42);
    expect(saved.saveState).toBe("saved");
    expect(isDocumentDirty(saved)).toBe(false);
  });

  it("stores remote documents by resource ref without a local path projection", () => {
    const document = createConfigDocument({
      id: "remote",
      name: "config.yaml",
      resource: {
        scheme: "ssh",
        host: "example-host",
        path: "/fixtures/project/config.yaml",
      },
      text: "name: demo\n",
    });

    expect(document.resource).toEqual({
      scheme: "ssh",
      host: "example-host",
      path: "/fixtures/project/config.yaml",
    });
    expect(document.path).toBeUndefined();
  });
});
