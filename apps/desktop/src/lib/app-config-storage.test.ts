import { describe, expect, it } from "vitest";
import { sampleAppConfig } from "./samples";
import {
  appConfigStorageKey,
  readStoredAppConfig,
  writeStoredAppConfig,
} from "./app-config-storage";

describe("app config storage", () => {
  it("round-trips valid config text through local storage", () => {
    const storage = new MemoryStorage();

    expect(writeStoredAppConfig(storage, sampleAppConfig)).toBe(true);
    expect(JSON.parse(storage.getItem(appConfigStorageKey) ?? "{}")).toMatchObject({
      version: 2,
      text: sampleAppConfig,
      format: "yaml",
    });
    expect(readStoredAppConfig(storage)).toEqual({
      text: sampleAppConfig,
      format: "yaml",
    });
  });

  it("ignores malformed stored payloads", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      appConfigStorageKey,
      JSON.stringify({ version: 2, text: "appearance: [", format: "yaml" }),
    );

    expect(readStoredAppConfig(storage)).toBeUndefined();
  });

  it("does not overwrite storage with malformed YAML", () => {
    const storage = new MemoryStorage();
    expect(writeStoredAppConfig(storage, sampleAppConfig)).toBe(true);
    expect(writeStoredAppConfig(storage, "appearance: [")).toBe(false);

    expect(readStoredAppConfig(storage)?.text).toBe(sampleAppConfig);
  });

  it("round-trips TOML app settings with format metadata", () => {
    const storage = new MemoryStorage();
    const toml = `[appearance]\ntheme = "dark"\n`;

    expect(writeStoredAppConfig(storage, toml, "toml")).toBe(true);
    expect(readStoredAppConfig(storage)).toEqual({
      text: toml,
      format: "toml",
    });
  });

  it("reads legacy YAML-only app settings", () => {
    const storage = new MemoryStorage();
    storage.setItem(appConfigStorageKey, JSON.stringify({ version: 1, text: sampleAppConfig }));

    expect(readStoredAppConfig(storage)).toEqual({
      text: sampleAppConfig,
      format: "yaml",
    });
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
