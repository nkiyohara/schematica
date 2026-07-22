import { describe, expect, it } from "vitest";
import { rememberRecentFile, writeRecentFiles } from "./recent-files";
import { rememberRecentRemoteFile, writeRecentRemoteFiles } from "./remote-sources";
import {
  forgetRecentResource,
  normalizeRecentResources,
  readRecentResources,
  recentResourcesStorageKey,
  rememberRecentResource,
  resourceDisplayPath,
  writeRecentResources,
} from "./resource-history";

describe("resource history", () => {
  it("remembers local and ssh resources through one model", () => {
    const local = rememberRecentResource([], {
      resource: { scheme: "file", path: "/fixtures/config.yaml" },
      kind: "config",
      now: 1,
    });
    const remote = rememberRecentResource(local, {
      resource: { scheme: "ssh", host: "example-host", path: "/fixtures/config.yaml" },
      kind: "config",
      now: 2,
    });

    expect(remote.map((item) => resourceDisplayPath(item.resource))).toEqual([
      "example-host:/fixtures/config.yaml",
      "/fixtures/config.yaml",
    ]);
  });

  it("deduplicates by resource key and caps persisted resources", () => {
    const resources = normalizeRecentResources({
      version: 1,
      resources: Array.from({ length: 20 }, (_value, index) => ({
        resource: { scheme: "file", path: `/fixtures/config-${index}.yaml` },
        kind: "config",
        lastOpenedAt: index,
      })).concat([
        {
          resource: { scheme: "file", path: "/fixtures/config-2.yaml" },
          kind: "schema",
          lastOpenedAt: 999,
        },
      ]),
    });

    expect(resources).toHaveLength(16);
    expect(resources[0]).toMatchObject({
      resource: { scheme: "file", path: "/fixtures/config-2.yaml" },
      kind: "schema",
      lastOpenedAt: 999,
    });
  });

  it("round-trips through storage", () => {
    const storage = new MemoryStorage();
    const resources = rememberRecentResource([], {
      resource: { scheme: "ssh", host: "login.example.edu", path: "~/project/config.toml" },
      kind: "config",
      now: 42,
    });

    expect(writeRecentResources(storage, resources)).toBe(true);
    expect(JSON.parse(storage.getItem(recentResourcesStorageKey) ?? "{}")).toMatchObject({
      version: 1,
      resources: [{ resource: { scheme: "ssh", host: "login.example.edu" } }],
    });
    expect(readRecentResources(storage)).toEqual(resources);
  });

  it("migrates legacy local and remote histories when the unified key is absent", () => {
    const storage = new MemoryStorage();
    writeRecentFiles(
      storage,
      rememberRecentFile([], {
        path: "/fixtures/local.yaml",
        kind: "config",
        now: 2,
      }),
    );
    writeRecentRemoteFiles(
      storage,
      rememberRecentRemoteFile([], {
        provider: "ssh",
        host: "research-node",
        path: "/fixtures/remote.yaml",
        now: 3,
      }),
    );

    expect(readRecentResources(storage).map((item) => resourceDisplayPath(item.resource))).toEqual([
      "research-node:/fixtures/remote.yaml",
      "/fixtures/local.yaml",
    ]);
  });

  it("forgets one resource", () => {
    const ref = { scheme: "file" as const, path: "/fixtures/config.yaml" };
    const resources = rememberRecentResource([], {
      resource: ref,
      kind: "config",
      now: 1,
    });

    expect(forgetRecentResource(resources, ref)).toEqual([]);
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
