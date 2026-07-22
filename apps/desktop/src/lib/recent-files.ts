import { formatFromPath, type DataFormat } from "@schematica/core";

export const recentFilesStorageKey = "schematica.recentFiles.v1";
export const maxRecentFiles = 12;

export type RecentFileKind = "config" | "schema" | "settings";

export interface RecentFile {
  path: string;
  name: string;
  kind: RecentFileKind;
  format: DataFormat;
  lastOpenedAt: number;
}

interface StoredRecentFiles {
  version: 1;
  files: RecentFile[];
}

export function readRecentFiles(storage: Storage | undefined): RecentFile[] {
  if (!storage) return [];

  try {
    const raw = storage.getItem(recentFilesStorageKey);
    if (!raw) return [];
    return normalizeRecentFiles(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function writeRecentFiles(
  storage: Storage | undefined,
  files: readonly RecentFile[],
): boolean {
  if (!storage) return false;

  try {
    const normalized = normalizeRecentFiles({
      version: 1,
      files,
    });
    const stored: StoredRecentFiles = {
      version: 1,
      files: normalized,
    };
    storage.setItem(recentFilesStorageKey, JSON.stringify(stored));
    return true;
  } catch {
    return false;
  }
}

export function rememberRecentFile(
  files: readonly RecentFile[],
  input: { path: string; kind: RecentFileKind; now?: number },
): RecentFile[] {
  const path = input.path.trim();
  if (!path) return normalizeRecentFiles({ version: 1, files });

  const item: RecentFile = {
    path,
    name: fileName(path),
    kind: input.kind,
    format: formatFromPath(path, input.kind === "schema" ? "json" : "yaml"),
    lastOpenedAt: input.now ?? Date.now(),
  };

  return normalizeRecentFiles({
    version: 1,
    files: [item, ...files.filter((file) => file.path !== path)],
  });
}

export function forgetRecentFile(files: readonly RecentFile[], path: string): RecentFile[] {
  return normalizeRecentFiles({
    version: 1,
    files: files.filter((file) => file.path !== path),
  });
}

export function normalizeRecentFiles(value: unknown): RecentFile[] {
  const record = asRecord(value);
  if (!record || record.version !== 1 || !Array.isArray(record.files)) return [];

  const byPath = new Map<string, RecentFile>();
  for (const file of record.files) {
    const normalized = normalizeRecentFile(file);
    if (!normalized) continue;

    const existing = byPath.get(normalized.path);
    if (!existing || normalized.lastOpenedAt > existing.lastOpenedAt) {
      byPath.set(normalized.path, normalized);
    }
  }

  return [...byPath.values()]
    .sort((left, right) => right.lastOpenedAt - left.lastOpenedAt)
    .slice(0, maxRecentFiles);
}

function normalizeRecentFile(value: unknown): RecentFile | undefined {
  const record = asRecord(value);
  if (!record) return undefined;

  const path = typeof record.path === "string" ? record.path.trim() : "";
  if (!path) return undefined;

  const kind = isRecentFileKind(record.kind) ? record.kind : undefined;
  if (!kind) return undefined;

  const lastOpenedAt =
    typeof record.lastOpenedAt === "number" && Number.isFinite(record.lastOpenedAt)
      ? record.lastOpenedAt
      : 0;

  return {
    path,
    name:
      typeof record.name === "string" && record.name.trim().length > 0
        ? record.name.trim()
        : fileName(path),
    kind,
    format:
      record.format === "yaml" || record.format === "json" || record.format === "toml"
        ? record.format
        : formatFromPath(path, kind === "schema" ? "json" : "yaml"),
    lastOpenedAt,
  };
}

function isRecentFileKind(value: unknown): value is RecentFileKind {
  return value === "config" || value === "schema" || value === "settings";
}

function fileName(path: string) {
  return path.split(/[\\/]/).at(-1) ?? path;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}
