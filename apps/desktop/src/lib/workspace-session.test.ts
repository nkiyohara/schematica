import { describe, expect, it } from "vitest";
import { createConfigDocument, isDocumentDirty } from "./config-document";
import {
  normalizeWorkspaceSession,
  readWorkspaceSession,
  workspaceSessionKey,
  writeWorkspaceSession,
} from "./workspace-session";

describe("workspace session", () => {
  it("round-trips open documents and schema state", () => {
    const storage = new MemoryStorage();
    const documents = [
      createConfigDocument({
        id: "a",
        name: "base.yaml",
        path: "/tmp/base.yaml",
        text: "name: edited\n",
        savedText: "name: base\n",
      }),
      createConfigDocument({
        id: "b",
        name: "other.json",
        resource: {
          scheme: "ssh",
          host: "build-host",
          path: "~/runs/other.json",
        },
        text: '{\n  "name": "other"\n}\n',
      }),
    ];

    expect(
      writeWorkspaceSession(storage, {
        activeDocumentId: "a",
        documents,
        schemaPath: "/tmp/schema.json",
        schemaResource: { scheme: "file", path: "/tmp/schema.json" },
        schemaText: '{ "type": "object" }\n',
        schemaSavedText: '{ "type": "string" }\n',
      }),
    ).toBe(true);

    expect(JSON.parse(storage.getItem(workspaceSessionKey) ?? "{}")).toMatchObject({
      version: 1,
      activeDocumentId: "a",
      schemaPath: "/tmp/schema.json",
      schemaResource: { scheme: "file", path: "/tmp/schema.json" },
      documents: [{ id: "a", savedText: "name: base\n", resource: { scheme: "file" } }],
    });

    const restored = readWorkspaceSession(storage);
    expect(restored?.activeDocumentId).toBe("a");
    expect(restored?.schemaResource).toEqual({ scheme: "file", path: "/tmp/schema.json" });
    expect(restored?.schemaText).toBe('{ "type": "object" }\n');
    expect(restored?.schemaSavedText).toBe('{ "type": "string" }\n');
    expect(restored?.documents).toHaveLength(1);
    expect(restored?.documents[0].saveState).toBe("idle");
    expect(restored?.documents[0].text).toBe("name: edited\n");
    expect(isDocumentDirty(restored?.documents[0] ?? documents[0])).toBe(true);
  });

  it("restores legacy location sessions into resource refs", () => {
    const session = normalizeWorkspaceSession({
      version: 1,
      activeDocumentId: "remote",
      schemaText: "",
      documents: [
        {
          id: "remote",
          name: "config.yaml",
          location: {
            kind: "remote",
            provider: "ssh",
            host: "example-host",
            path: "/fixtures/config.yaml",
          },
          text: "name: demo\n",
          savedText: "name: demo\n",
        },
      ],
    });

    expect(session?.documents[0].resource).toEqual({
      scheme: "ssh",
      host: "example-host",
      path: "/fixtures/config.yaml",
    });
  });

  it("falls back to the first document when the active id is stale", () => {
    const session = normalizeWorkspaceSession({
      version: 1,
      activeDocumentId: "missing",
      schemaText: "",
      documents: [{ id: "first", name: "first.yaml", text: "ok: true\n" }],
    });

    expect(session?.activeDocumentId).toBe("first");
  });

  it("round-trips an intentionally empty workspace", () => {
    const storage = new MemoryStorage();

    expect(
      writeWorkspaceSession(storage, {
        activeDocumentId: "",
        documents: [],
        schemaText: "",
      }),
    ).toBe(true);

    expect(readWorkspaceSession(storage)).toEqual({
      activeDocumentId: "",
      documents: [],
      schemaText: "",
    });
  });

  it("does not persist clean files or SSH contents in crash recovery", () => {
    const storage = new MemoryStorage();
    const documents = [
      createConfigDocument({
        id: "clean",
        name: "clean.yaml",
        path: "/tmp/clean.yaml",
        text: "secret: local\n",
      }),
      createConfigDocument({
        id: "remote",
        name: "remote.yaml",
        resource: { scheme: "ssh", host: "build", path: "~/remote.yaml" },
        text: "secret: edited\n",
        savedText: "secret: old\n",
      }),
    ];

    expect(
      writeWorkspaceSession(storage, {
        activeDocumentId: "remote",
        documents,
        schemaText: "",
        schemaSavedText: "",
      }),
    ).toBe(true);
    const raw = storage.getItem(workspaceSessionKey) ?? "";
    expect(raw).not.toContain("secret:");
    expect(readWorkspaceSession(storage)?.documents).toEqual([]);
  });

  it("restores legacy schema paths as file resources", () => {
    const session = normalizeWorkspaceSession({
      version: 1,
      activeDocumentId: "",
      documents: [],
      schemaPath: "/tmp/schema.json",
      schemaText: "{}\n",
    });

    expect(session?.schemaResource).toEqual({ scheme: "file", path: "/tmp/schema.json" });
  });

  it("ignores malformed persisted sessions", () => {
    const storage = new MemoryStorage();
    storage.setItem(workspaceSessionKey, JSON.stringify({ version: 1 }));

    expect(readWorkspaceSession(storage)).toBeUndefined();
  });
});

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}
