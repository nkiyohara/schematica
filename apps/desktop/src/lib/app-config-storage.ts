import { parseData, type DataFormat } from "@schematica/core";

export const appConfigStorageKey = "schematica.appConfig.v1";

interface StoredAppConfig {
  version: 2;
  text: string;
  format: DataFormat;
}

interface LegacyStoredAppConfig {
  version: 1;
  text: string;
}

export interface StoredAppConfigSnapshot {
  text: string;
  format: DataFormat;
}

export function readStoredAppConfig(
  storage: Storage | undefined,
): StoredAppConfigSnapshot | undefined {
  if (!storage) return undefined;

  try {
    const raw = storage.getItem(appConfigStorageKey);
    if (!raw) return undefined;

    const stored = JSON.parse(raw) as Partial<StoredAppConfig | LegacyStoredAppConfig>;
    if (stored.version === 1 && typeof stored.text === "string") {
      parseData(stored.text, { format: "yaml" });
      return { text: stored.text, format: "yaml" };
    }

    if (stored.version !== 2 || typeof stored.text !== "string" || !isDataFormat(stored.format)) {
      return undefined;
    }

    parseData(stored.text, { format: stored.format });
    return { text: stored.text, format: stored.format };
  } catch {
    return undefined;
  }
}

export function writeStoredAppConfig(
  storage: Storage | undefined,
  text: string,
  format: DataFormat = "yaml",
) {
  if (!storage) return false;

  try {
    parseData(text, { format });
    const stored: StoredAppConfig = {
      version: 2,
      text,
      format,
    };
    storage.setItem(appConfigStorageKey, JSON.stringify(stored));
    return true;
  } catch {
    return false;
  }
}

function isDataFormat(value: unknown): value is DataFormat {
  return value === "yaml" || value === "json" || value === "toml";
}
