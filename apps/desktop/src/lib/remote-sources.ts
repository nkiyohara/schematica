import { formatFromPath, type DataFormat } from "@schematica/core";

export const recentRemoteFilesStorageKey = "schematica.recentRemoteFiles.v1";
export const maxRecentRemoteFiles = 12;

export type RemoteProviderId = "ssh";
export type SshHostSource = "config" | "knownHosts";

export interface SshHostCandidate {
  host: string;
  label: string;
  source: SshHostSource;
  sourcePath?: string;
  line?: number;
}

export interface RemoteFileRef {
  provider: RemoteProviderId;
  host: string;
  path: string;
}

export interface RecentRemoteFile extends RemoteFileRef {
  name: string;
  format: DataFormat;
  lastOpenedAt: number;
}

export interface RemoteHostOption {
  provider: RemoteProviderId;
  host: string;
  label: string;
  source: "recent" | SshHostSource;
  detail: string;
  lastConnectedAt?: number;
  sourcePath?: string;
  line?: number;
}

export interface LatestRemoteBrowseGate {
  begin(): number;
  invalidate(): void;
  isCurrent(requestId: number): boolean;
}

interface StoredRecentRemoteFiles {
  version: 1;
  files: RecentRemoteFile[];
}

export function readRecentRemoteFiles(storage: Storage | undefined): RecentRemoteFile[] {
  if (!storage) return [];

  try {
    const raw = storage.getItem(recentRemoteFilesStorageKey);
    if (!raw) return [];
    return normalizeRecentRemoteFiles(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function writeRecentRemoteFiles(
  storage: Storage | undefined,
  files: readonly RecentRemoteFile[],
): boolean {
  if (!storage) return false;

  try {
    const normalized = normalizeRecentRemoteFiles({ version: 1, files });
    const stored: StoredRecentRemoteFiles = {
      version: 1,
      files: normalized,
    };
    storage.setItem(recentRemoteFilesStorageKey, JSON.stringify(stored));
    return true;
  } catch {
    return false;
  }
}

export function rememberRecentRemoteFile(
  files: readonly RecentRemoteFile[],
  input: RemoteFileRef & { now?: number },
): RecentRemoteFile[] {
  const normalized = normalizeRemoteFileRef(input);
  if (!normalized) return normalizeRecentRemoteFiles({ version: 1, files });

  const file: RecentRemoteFile = {
    ...normalized,
    name: remoteFileName(normalized.path),
    format: formatFromPath(normalized.path, "yaml"),
    lastOpenedAt: input.now ?? Date.now(),
  };

  return normalizeRecentRemoteFiles({
    version: 1,
    files: [file, ...files.filter((current) => remoteFileKey(current) !== remoteFileKey(file))],
  });
}

export function forgetRecentRemoteFile(
  files: readonly RecentRemoteFile[],
  ref: RemoteFileRef,
): RecentRemoteFile[] {
  const key = remoteFileKey(ref);
  return normalizeRecentRemoteFiles({
    version: 1,
    files: files.filter((file) => remoteFileKey(file) !== key),
  });
}

export function normalizeRecentRemoteFiles(value: unknown): RecentRemoteFile[] {
  const record = asRecord(value);
  if (!record || record.version !== 1 || !Array.isArray(record.files)) return [];

  const byKey = new Map<string, RecentRemoteFile>();
  for (const file of record.files) {
    const normalized = normalizeRecentRemoteFile(file);
    if (!normalized) continue;

    const key = remoteFileKey(normalized);
    const existing = byKey.get(key);
    if (!existing || normalized.lastOpenedAt > existing.lastOpenedAt) {
      byKey.set(key, normalized);
    }
  }

  return [...byKey.values()]
    .sort((left, right) => right.lastOpenedAt - left.lastOpenedAt)
    .slice(0, maxRecentRemoteFiles);
}

export function mergeSshHostOptions(
  discoveredHosts: readonly SshHostCandidate[],
  recentFiles: readonly RecentRemoteFile[],
): RemoteHostOption[] {
  const byHost = new Map<string, RemoteHostOption>();

  for (const file of recentFiles) {
    const existing = byHost.get(file.host);
    if (!existing || file.lastOpenedAt > (existing.lastConnectedAt ?? 0)) {
      byHost.set(file.host, {
        provider: "ssh",
        host: file.host,
        label: file.host,
        source: "recent",
        detail: "Recent SSH",
        lastConnectedAt: file.lastOpenedAt,
      });
    }
  }

  for (const candidate of discoveredHosts) {
    const existing = byHost.get(candidate.host);
    if (existing) {
      byHost.set(candidate.host, {
        ...existing,
        label: candidate.label || existing.label,
        sourcePath: candidate.sourcePath,
        line: candidate.line,
      });
      continue;
    }

    byHost.set(candidate.host, {
      provider: "ssh",
      host: candidate.host,
      label: candidate.label,
      source: candidate.source,
      detail: candidate.source === "config" ? "SSH config" : "Known host",
      sourcePath: candidate.sourcePath,
      line: candidate.line,
    });
  }

  return [...byHost.values()].sort((left, right) => {
    const leftRecent = left.lastConnectedAt ?? 0;
    const rightRecent = right.lastConnectedAt ?? 0;
    if (leftRecent !== rightRecent) return rightRecent - leftRecent;
    return left.label.localeCompare(right.label);
  });
}

export function filterRemoteHostOptions(
  hosts: readonly RemoteHostOption[],
  query: string,
): RemoteHostOption[] {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [...hosts];

  return hosts.filter((host) => {
    const searchable = [host.host, host.label, host.detail, host.source, host.sourcePath]
      .filter((value): value is string => Boolean(value))
      .join("\n")
      .toLocaleLowerCase();
    return terms.every((term) => searchable.includes(term));
  });
}

export function initialRemoteBrowsePath(
  host: string,
  recentFiles: readonly RecentRemoteFile[],
): string {
  const normalizedHost = host.trim();
  if (!normalizedHost) return "~";

  const recent = recentFiles
    .filter((file) => file.host === normalizedHost)
    .sort((left, right) => right.lastOpenedAt - left.lastOpenedAt)[0];
  return recent ? remoteParentPath(recent.path) : "~";
}

export function remoteParentPath(value: string): string {
  const path = value.trim();
  if (!path || path === "~" || path === "/") return path || "~";

  const clean = path.replace(/\/+$/, "");
  if (clean.startsWith("~/")) {
    const parent = clean.slice(2).split("/").slice(0, -1).join("/");
    return parent ? `~/${parent}` : "~";
  }

  const separator = clean.lastIndexOf("/");
  if (separator < 0) return "~";
  if (separator === 0) return "/";
  return clean.slice(0, separator);
}

export function createLatestRemoteBrowseGate(): LatestRemoteBrowseGate {
  let latestRequestId = 0;
  return {
    begin() {
      latestRequestId += 1;
      return latestRequestId;
    },
    invalidate() {
      latestRequestId += 1;
    },
    isCurrent(requestId) {
      return requestId === latestRequestId;
    },
  };
}

export function remoteFileKey(ref: RemoteFileRef): string {
  return `${ref.provider}:${ref.host}:${ref.path}`;
}

export function remoteDisplayPath(ref: RemoteFileRef): string {
  return `${ref.host}:${ref.path}`;
}

export function compactRemoteDisplayPath(ref: RemoteFileRef): string {
  const compactPath = compactPathTail(ref.path);
  return `${ref.host}:${compactPath}`;
}

export function remoteFileName(path: string): string {
  const trimmed = path.trim();
  return trimmed.split(/[\\/]/).filter(Boolean).at(-1) ?? trimmed;
}

function normalizeRecentRemoteFile(value: unknown): RecentRemoteFile | undefined {
  const ref = normalizeRemoteFileRef(value);
  if (!ref) return undefined;

  const record = asRecord(value);
  const lastOpenedAt =
    typeof record?.lastOpenedAt === "number" && Number.isFinite(record.lastOpenedAt)
      ? record.lastOpenedAt
      : 0;

  return {
    ...ref,
    name:
      typeof record?.name === "string" && record.name.trim().length > 0
        ? record.name.trim()
        : remoteFileName(ref.path),
    format:
      record?.format === "yaml" || record?.format === "json" || record?.format === "toml"
        ? record.format
        : formatFromPath(ref.path, "yaml"),
    lastOpenedAt,
  };
}

function normalizeRemoteFileRef(value: unknown): RemoteFileRef | undefined {
  const record = asRecord(value);
  if (!record) return undefined;

  const provider = record.provider === "ssh" ? record.provider : undefined;
  const host = typeof record.host === "string" ? record.host.trim() : "";
  const path = typeof record.path === "string" ? record.path.trim() : "";
  if (!provider || !host || !path) return undefined;

  return { provider, host, path };
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
