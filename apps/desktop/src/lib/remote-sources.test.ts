import { describe, expect, it } from "vitest";
import {
  createLatestRemoteBrowseGate,
  filterRemoteHostOptions,
  forgetRecentRemoteFile,
  initialRemoteBrowsePath,
  maxRecentRemoteFiles,
  mergeSshHostOptions,
  normalizeRecentRemoteFiles,
  readRecentRemoteFiles,
  recentRemoteFilesStorageKey,
  rememberRecentRemoteFile,
  remoteDisplayPath,
  remoteParentPath,
  writeRecentRemoteFiles,
} from "./remote-sources";

describe("remote sources", () => {
  it("remembers remote files by provider host and path", () => {
    const files = rememberRecentRemoteFile([], {
      provider: "ssh",
      host: "build-host",
      path: "~/project/config.yaml",
      now: 1,
    });
    const updated = rememberRecentRemoteFile(files, {
      provider: "ssh",
      host: "build-host",
      path: "~/project/config.yaml",
      now: 2,
    });

    expect(updated).toEqual([
      {
        provider: "ssh",
        host: "build-host",
        path: "~/project/config.yaml",
        name: "config.yaml",
        format: "yaml",
        lastOpenedAt: 2,
      },
    ]);
  });

  it("normalizes, sorts, deduplicates, and caps persisted remote files", () => {
    const files = normalizeRecentRemoteFiles({
      version: 1,
      files: Array.from({ length: maxRecentRemoteFiles + 2 }, (_value, index) => ({
        provider: "ssh",
        host: "compute-host",
        path: `/tmp/config-${index}.json`,
        lastOpenedAt: index,
      })).concat([
        {
          provider: "ssh",
          host: "compute-host",
          path: "/tmp/config-1.json",
          lastOpenedAt: 999,
        },
      ]),
    });

    expect(files).toHaveLength(maxRecentRemoteFiles);
    expect(files[0]).toMatchObject({
      host: "compute-host",
      path: "/tmp/config-1.json",
      format: "json",
      lastOpenedAt: 999,
    });
  });

  it("round-trips remote history through storage", () => {
    const storage = new MemoryStorage();
    const files = rememberRecentRemoteFile([], {
      provider: "ssh",
      host: "login-host",
      path: "/workspace/config.toml",
      now: 42,
    });

    expect(writeRecentRemoteFiles(storage, files)).toBe(true);
    expect(JSON.parse(storage.getItem(recentRemoteFilesStorageKey) ?? "{}")).toMatchObject({
      version: 1,
      files: [{ provider: "ssh", host: "login-host", path: "/workspace/config.toml" }],
    });
    expect(readRecentRemoteFiles(storage)).toEqual(files);
  });

  it("merges recent hosts ahead of configured hosts", () => {
    const options = mergeSshHostOptions(
      [
        {
          host: "build-host",
          label: "build-host",
          source: "config",
          sourcePath: "/fixtures/ssh/config",
          line: 3,
        },
        {
          host: "new-host",
          label: "new-host",
          source: "knownHosts",
        },
      ],
      [
        {
          provider: "ssh",
          host: "build-host",
          path: "~/project/config.yaml",
          name: "config.yaml",
          format: "yaml",
          lastOpenedAt: 30,
        },
        {
          provider: "ssh",
          host: "compute-host",
          path: "/tmp/config.yaml",
          name: "config.yaml",
          format: "yaml",
          lastOpenedAt: 40,
        },
      ],
    );

    expect(options.map((option) => option.host)).toEqual([
      "compute-host",
      "build-host",
      "new-host",
    ]);
    expect(options[1]).toMatchObject({
      source: "recent",
      sourcePath: "/fixtures/ssh/config",
      lastConnectedAt: 30,
    });
  });

  it("filters large host collections without truncating them", () => {
    const hosts = mergeSshHostOptions(
      Array.from({ length: 40 }, (_value, index) => ({
        host: `gpu-${index}`,
        label: index === 31 ? "training-primary" : `gpu-${index}`,
        source: index % 2 === 0 ? ("config" as const) : ("knownHosts" as const),
        sourcePath: index % 2 === 0 ? "/home/me/.ssh/config" : undefined,
      })),
      [],
    );

    expect(filterRemoteHostOptions(hosts, "")).toHaveLength(40);
    expect(filterRemoteHostOptions(hosts, "training").map((host) => host.host)).toEqual(["gpu-31"]);
    expect(
      filterRemoteHostOptions(hosts, "gpu-2 config").every((host) => host.host.includes("gpu-2")),
    ).toBe(true);
  });

  it("starts browsing a selected host from its most recent directory", () => {
    const recent = [
      {
        provider: "ssh" as const,
        host: "build-host",
        path: "~/old/config.yaml",
        name: "config.yaml",
        format: "yaml" as const,
        lastOpenedAt: 1,
      },
      {
        provider: "ssh" as const,
        host: "build-host",
        path: "/workspace/current/settings.toml",
        name: "settings.toml",
        format: "toml" as const,
        lastOpenedAt: 4,
      },
    ];

    expect(initialRemoteBrowsePath("build-host", recent)).toBe("/workspace/current");
    expect(initialRemoteBrowsePath("new-host", recent)).toBe("~");
    expect(remoteParentPath("~/config.yaml")).toBe("~");
    expect(remoteParentPath("/config.yaml")).toBe("/");
    expect(remoteParentPath("relative/config.yaml")).toBe("relative");
    expect(remoteParentPath("config.yaml")).toBe("~");
  });

  it("rejects stale remote browse requests after a newer request or invalidation", () => {
    const gate = createLatestRemoteBrowseGate();
    const first = gate.begin();
    const second = gate.begin();

    expect(gate.isCurrent(first)).toBe(false);
    expect(gate.isCurrent(second)).toBe(true);

    gate.invalidate();
    expect(gate.isCurrent(second)).toBe(false);
  });

  it("forgets remote files and formats display paths", () => {
    const ref = {
      provider: "ssh" as const,
      host: "build-host",
      path: "/fixtures/project/config.yaml",
    };
    const files = rememberRecentRemoteFile([], { ...ref, now: 1 });

    expect(remoteDisplayPath(ref)).toBe("build-host:/fixtures/project/config.yaml");
    expect(forgetRecentRemoteFile(files, ref)).toEqual([]);
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
