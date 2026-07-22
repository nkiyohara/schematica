import { describe, expect, it } from "vitest";
import {
  forgetRecentFile,
  maxRecentFiles,
  normalizeRecentFiles,
  readRecentFiles,
  recentFilesStorageKey,
  rememberRecentFile,
  writeRecentFiles,
} from "./recent-files";

describe("recent files", () => {
  it("moves repeated paths to the front with updated metadata", () => {
    const files = rememberRecentFile([], {
      path: "/workspace/config.yaml",
      kind: "config",
      now: 1,
    });
    const updated = rememberRecentFile(files, {
      path: "/workspace/config.yaml",
      kind: "schema",
      now: 2,
    });

    expect(updated).toEqual([
      {
        path: "/workspace/config.yaml",
        name: "config.yaml",
        kind: "schema",
        format: "yaml",
        lastOpenedAt: 2,
      },
    ]);
  });

  it("sorts, deduplicates, and caps persisted entries", () => {
    const files = normalizeRecentFiles({
      version: 1,
      files: Array.from({ length: maxRecentFiles + 4 }, (_value, index) => ({
        path: `/tmp/config-${index}.yaml`,
        kind: "config",
        lastOpenedAt: index,
      })).concat([
        {
          path: "/tmp/config-2.yaml",
          kind: "config",
          lastOpenedAt: 999,
        },
      ]),
    });

    expect(files).toHaveLength(maxRecentFiles);
    expect(files[0]).toMatchObject({
      path: "/tmp/config-2.yaml",
      lastOpenedAt: 999,
    });
  });

  it("round-trips through local storage", () => {
    const storage = new MemoryStorage();
    const files = rememberRecentFile([], {
      path: "/tmp/schema.json",
      kind: "schema",
      now: 42,
    });

    expect(writeRecentFiles(storage, files)).toBe(true);
    expect(JSON.parse(storage.getItem(recentFilesStorageKey) ?? "{}")).toMatchObject({
      version: 1,
      files: [{ path: "/tmp/schema.json", kind: "schema" }],
    });
    expect(readRecentFiles(storage)).toEqual(files);
  });

  it("forgets a single path and ignores malformed storage", () => {
    const storage = new MemoryStorage();
    storage.setItem(recentFilesStorageKey, "{");

    expect(readRecentFiles(storage)).toEqual([]);
    expect(
      forgetRecentFile(
        rememberRecentFile([], {
          path: "/tmp/config.toml",
          kind: "config",
          now: 1,
        }),
        "/tmp/config.toml",
      ),
    ).toEqual([]);
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
