import { formatFromPath, type DataFormat } from "@schematica/core";
import { readRecentFiles, type RecentFile, type RecentFileKind } from "./recent-files";
import { readRecentRemoteFiles, type RecentRemoteFile, type RemoteFileRef } from "./remote-sources";
import type { ResourceRef } from "./plugins/types";

export const recentResourcesStorageKey = "schematica.recentResources.v1";
export const maxRecentResources = 16;

export type RecentResourceKind = RecentFileKind;

export interface RecentResource {
  resource: ResourceRef;
  name: string;
  kind: RecentResourceKind;
  format: DataFormat;
  lastOpenedAt: number;
}

interface StoredRecentResources {
  version: 1;
  resources: RecentResource[];
}

export function readRecentResources(storage: Storage | undefined): RecentResource[] {
  if (!storage) return [];

  try {
    const raw = storage.getItem(recentResourcesStorageKey);
    if (raw) {
      return normalizeRecentResources(JSON.parse(raw));
    }
  } catch {
    return [];
  }

  return normalizeRecentResources({
    version: 1,
    resources: [
      ...readRecentFiles(storage).map(recentFileToResource),
      ...readRecentRemoteFiles(storage).map(recentRemoteFileToResource),
    ],
  });
}

export function writeRecentResources(
  storage: Storage | undefined,
  resources: readonly RecentResource[],
): boolean {
  if (!storage) return false;

  try {
    const normalized = normalizeRecentResources({ version: 1, resources });
    const stored: StoredRecentResources = {
      version: 1,
      resources: normalized,
    };
    storage.setItem(recentResourcesStorageKey, JSON.stringify(stored));
    return true;
  } catch {
    return false;
  }
}

export function rememberRecentResource(
  resources: readonly RecentResource[],
  input: { resource: ResourceRef; kind: RecentResourceKind; now?: number },
): RecentResource[] {
  const normalized = normalizeResourceRef(input.resource);
  if (!normalized) return normalizeRecentResources({ version: 1, resources });

  const item: RecentResource = {
    resource: normalized,
    name: resourceFileName(normalized),
    kind: input.kind,
    format: formatFromPath(normalized.path, input.kind === "schema" ? "json" : "yaml"),
    lastOpenedAt: input.now ?? Date.now(),
  };

  return normalizeRecentResources({
    version: 1,
    resources: [
      item,
      ...resources.filter(
        (resource) => resourceKey(resource.resource) !== resourceKey(item.resource),
      ),
    ],
  });
}

export function forgetRecentResource(
  resources: readonly RecentResource[],
  resource: ResourceRef,
): RecentResource[] {
  const key = resourceKey(resource);
  return normalizeRecentResources({
    version: 1,
    resources: resources.filter((item) => resourceKey(item.resource) !== key),
  });
}

export function normalizeRecentResources(value: unknown): RecentResource[] {
  const record = asRecord(value);
  if (!record || record.version !== 1 || !Array.isArray(record.resources)) return [];

  const byResource = new Map<string, RecentResource>();
  for (const item of record.resources) {
    const normalized = normalizeRecentResource(item);
    if (!normalized) continue;

    const key = resourceKey(normalized.resource);
    const existing = byResource.get(key);
    if (!existing || normalized.lastOpenedAt > existing.lastOpenedAt) {
      byResource.set(key, normalized);
    }
  }

  return [...byResource.values()]
    .sort((left, right) => right.lastOpenedAt - left.lastOpenedAt)
    .slice(0, maxRecentResources);
}

export function resourceKey(resource: ResourceRef): string {
  return resource.scheme === "file"
    ? `file:${resource.path}`
    : `${resource.scheme}:${resource.host}:${resource.path}`;
}

export function resourceDisplayPath(resource: ResourceRef): string {
  return resource.scheme === "file" ? resource.path : `${resource.host}:${resource.path}`;
}

export function compactResourceDisplayPath(resource: ResourceRef): string {
  if (resource.scheme === "file") return compactPathTail(resource.path);
  return `${resource.host}:${compactPathTail(resource.path)}`;
}

function normalizeRecentResource(value: unknown): RecentResource | undefined {
  const record = asRecord(value);
  if (!record) return undefined;

  const resource = normalizeResourceRef(record.resource);
  if (!resource) return undefined;

  const kind = isRecentResourceKind(record.kind) ? record.kind : "config";
  const lastOpenedAt =
    typeof record.lastOpenedAt === "number" && Number.isFinite(record.lastOpenedAt)
      ? record.lastOpenedAt
      : 0;

  return {
    resource,
    name:
      typeof record.name === "string" && record.name.trim().length > 0
        ? record.name.trim()
        : resourceFileName(resource),
    kind,
    format:
      record.format === "yaml" || record.format === "json" || record.format === "toml"
        ? record.format
        : formatFromPath(resource.path, kind === "schema" ? "json" : "yaml"),
    lastOpenedAt,
  };
}

function normalizeResourceRef(value: unknown): ResourceRef | undefined {
  const record = asRecord(value);
  if (!record) return undefined;

  if (record.scheme === "file" && typeof record.path === "string" && record.path.trim()) {
    return {
      scheme: "file",
      path: record.path.trim(),
    };
  }

  if (
    record.scheme === "ssh" &&
    typeof record.host === "string" &&
    record.host.trim() &&
    typeof record.path === "string" &&
    record.path.trim()
  ) {
    return {
      scheme: "ssh",
      host: record.host.trim(),
      path: record.path.trim(),
    };
  }

  return undefined;
}

function recentFileToResource(file: RecentFile): RecentResource {
  return {
    resource: {
      scheme: "file",
      path: file.path,
    },
    name: file.name,
    kind: file.kind,
    format: file.format,
    lastOpenedAt: file.lastOpenedAt,
  };
}

function recentRemoteFileToResource(file: RecentRemoteFile): RecentResource {
  return {
    resource: remoteFileRefToResource(file),
    name: file.name,
    kind: "config",
    format: file.format,
    lastOpenedAt: file.lastOpenedAt,
  };
}

function remoteFileRefToResource(file: RemoteFileRef): ResourceRef {
  return {
    scheme: "ssh",
    host: file.host,
    path: file.path,
  };
}

function isRecentResourceKind(value: unknown): value is RecentResourceKind {
  return value === "config" || value === "schema" || value === "settings";
}

function resourceFileName(resource: ResourceRef) {
  return resource.path.split(/[\\/]/).filter(Boolean).at(-1) ?? resource.path;
}

function compactPathTail(path: string): string {
  const parts = path.split(/[\\/]/).filter(Boolean);
  if (parts.length <= 3) return path;
  const prefix = path.startsWith("/") ? "/..." : "...";
  return `${prefix}/${parts.slice(-3).join("/")}`;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}
