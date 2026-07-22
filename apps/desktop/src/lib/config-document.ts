import type { ResourceRef } from "./plugins/types";

export type DocumentSaveState = "idle" | "queued" | "saving" | "saved" | "paused" | "error";

export type LocalDocumentLocation = Extract<ResourceRef, { scheme: "file" }>;
export type RemoteDocumentLocation = Extract<ResourceRef, { scheme: "ssh" }>;
export type DocumentLocation = ResourceRef;

export interface ConfigDocument {
  id: string;
  name: string;
  resource?: ResourceRef;
  path?: string;
  text: string;
  savedText: string;
  saveState: DocumentSaveState;
  saveMessage?: string;
  lastSavedAt?: number;
}

export interface ConfigDocumentInput {
  id: string;
  name: string;
  resource?: ResourceRef;
  location?: ResourceRef | LegacyDocumentLocation;
  path?: string;
  text: string;
  savedText?: string;
  saveState?: DocumentSaveState;
  saveMessage?: string;
  lastSavedAt?: number;
}

interface LegacyLocalDocumentLocation {
  kind: "local";
  path: string;
}

interface LegacyRemoteDocumentLocation {
  kind: "remote";
  provider: "ssh";
  host: string;
  path: string;
}

type LegacyDocumentLocation = LegacyLocalDocumentLocation | LegacyRemoteDocumentLocation;

export function createConfigDocument(input: ConfigDocumentInput): ConfigDocument {
  const resource =
    input.resource ??
    normalizeResourceRef(input.location) ??
    (input.path ? fileResourceRef(input.path) : undefined);

  return {
    id: input.id,
    name: input.name,
    resource,
    path: resource?.scheme === "file" ? resource.path : input.path,
    text: input.text,
    savedText: input.savedText ?? input.text,
    saveState: input.saveState ?? "idle",
    saveMessage: input.saveMessage,
    lastSavedAt: input.lastSavedAt,
  };
}

export function isDocumentDirty(document: ConfigDocument): boolean {
  return document.text !== document.savedText;
}

export function markDocumentSaved(
  document: ConfigDocument,
  options: {
    resource?: ResourceRef;
    location?: ResourceRef | LegacyDocumentLocation;
    path?: string;
    text: string;
    savedAt: number;
    message?: string;
  },
): ConfigDocument {
  const resource =
    options.resource ??
    normalizeResourceRef(options.location) ??
    (options.path ? fileResourceRef(options.path) : document.resource);

  return {
    ...document,
    resource,
    path: resource?.scheme === "file" ? resource.path : undefined,
    name: resource ? resourceDisplayName(resource) : document.name,
    text: options.text,
    savedText: options.text,
    saveState: "saved",
    saveMessage: options.message,
    lastSavedAt: options.savedAt,
  };
}

export function fileResourceRef(path: string): LocalDocumentLocation {
  return {
    scheme: "file",
    path,
  };
}

export function sshResourceRef(host: string, path: string): RemoteDocumentLocation {
  return {
    scheme: "ssh",
    host,
    path,
  };
}

export function resourceKey(resource: ResourceRef): string {
  return resource.scheme === "file"
    ? `file:${resource.path}`
    : `${resource.scheme}:${resource.host}:${resource.path}`;
}

export function resourceDisplayName(resource: ResourceRef): string {
  return fileName(resource.path);
}

export function resourcePath(resource: ResourceRef): string {
  return resource.path;
}

export function resourceDisplayPath(resource: ResourceRef): string {
  return resource.scheme === "file" ? resource.path : `${resource.host}:${resource.path}`;
}

export function localResourcePath(document: ConfigDocument): string | undefined {
  if (document.resource?.scheme === "file") return document.resource.path;
  return document.path;
}

export function formatPathForDocument(document: ConfigDocument): string {
  return document.resource ? resourcePath(document.resource) : (document.path ?? document.name);
}

export const localDocumentLocation = fileResourceRef;
export const sshDocumentLocation = sshResourceRef;
export const documentLocationKey = resourceKey;
export const documentLocationName = resourceDisplayName;
export const documentLocationPath = resourcePath;
export const documentLocationLabel = resourceDisplayPath;
export const localDocumentPath = localResourcePath;

function normalizeResourceRef(value: unknown): ResourceRef | undefined {
  if (!isRecord(value)) return undefined;

  if (value.scheme === "file" && typeof value.path === "string" && value.path.trim()) {
    return fileResourceRef(value.path.trim());
  }

  if (
    value.scheme === "ssh" &&
    typeof value.host === "string" &&
    value.host.trim() &&
    typeof value.path === "string" &&
    value.path.trim()
  ) {
    return sshResourceRef(value.host.trim(), value.path.trim());
  }

  if (value.kind === "local" && typeof value.path === "string" && value.path.trim()) {
    return fileResourceRef(value.path.trim());
  }

  if (
    value.kind === "remote" &&
    value.provider === "ssh" &&
    typeof value.host === "string" &&
    value.host.trim() &&
    typeof value.path === "string" &&
    value.path.trim()
  ) {
    return sshResourceRef(value.host.trim(), value.path.trim());
  }

  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function fileName(path: string) {
  return path.split(/[\\/]/).at(-1) ?? path;
}
