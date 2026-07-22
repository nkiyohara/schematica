import { createConfigDocument, isDocumentDirty, type ConfigDocument } from "./config-document";
import type { ResourceRef } from "./plugins/types";

export const workspaceSessionKey = "schematica.workspaceSession.v1";

interface StoredWorkspaceSession {
  version: 1;
  activeDocumentId: string;
  documents: StoredDocument[];
  schemaPath?: string;
  schemaResource?: ResourceRef;
  schemaText: string;
  schemaSavedText?: string;
}

interface StoredDocument {
  id: string;
  name: string;
  resource?: ResourceRef;
  location?: unknown;
  path?: string;
  text: string;
  savedText: string;
  lastSavedAt?: number;
}

export interface WorkspaceSession {
  activeDocumentId: string;
  documents: ConfigDocument[];
  schemaPath?: string;
  schemaResource?: ResourceRef;
  schemaText: string;
  schemaSavedText?: string;
}

const maxRecoveryDocuments = 8;
const maxRecoveryTextLength = 1_000_000;

export function readWorkspaceSession(storage: Storage | undefined): WorkspaceSession | undefined {
  if (!storage) return undefined;

  try {
    const raw = storage.getItem(workspaceSessionKey);
    if (!raw) return undefined;
    return normalizeWorkspaceSession(JSON.parse(raw));
  } catch {
    return undefined;
  }
}

export function writeWorkspaceSession(
  storage: Storage | undefined,
  session: WorkspaceSession,
): boolean {
  if (!storage) return false;

  try {
    let remainingText = maxRecoveryTextLength;
    const recoverableDocuments: ConfigDocument[] = [];
    for (const document of session.documents) {
      if (recoverableDocuments.length >= maxRecoveryDocuments) break;
      const recoveryLength = document.text.length + document.savedText.length;
      if (
        document.resource?.scheme === "ssh" ||
        !isDocumentDirty(document) ||
        recoveryLength > remainingText
      ) {
        continue;
      }
      recoverableDocuments.push(document);
      remainingText -= recoveryLength;
    }
    const schemaRecoverable =
      session.schemaText.length <= remainingText &&
      session.schemaText !== (session.schemaSavedText ?? "");
    const normalized = normalizeWorkspaceSession({
      version: 1,
      activeDocumentId: session.activeDocumentId,
      documents: recoverableDocuments.map((document) => ({
        id: document.id,
        name: document.name,
        resource: document.resource,
        path: document.path,
        text: document.text,
        savedText: document.savedText,
        lastSavedAt: document.lastSavedAt,
      })),
      schemaPath: schemaRecoverable ? session.schemaPath : undefined,
      schemaResource: schemaRecoverable ? session.schemaResource : undefined,
      schemaText: schemaRecoverable ? session.schemaText : "",
      schemaSavedText: schemaRecoverable ? session.schemaSavedText : undefined,
    });
    if (!normalized) return false;

    const stored: StoredWorkspaceSession = {
      version: 1,
      activeDocumentId: normalized.activeDocumentId,
      documents: normalized.documents.map((document) => ({
        id: document.id,
        name: document.name,
        resource: document.resource,
        path: document.path,
        text: document.text,
        savedText: document.savedText,
        lastSavedAt: document.lastSavedAt,
      })),
      schemaPath: normalized.schemaPath,
      schemaResource: normalized.schemaResource,
      schemaText: normalized.schemaText,
      schemaSavedText: normalized.schemaSavedText,
    };
    storage.setItem(workspaceSessionKey, JSON.stringify(stored));
    return true;
  } catch {
    return false;
  }
}

export function normalizeWorkspaceSession(value: unknown): WorkspaceSession | undefined {
  const record = asRecord(value);
  if (!record || record.version !== 1) return undefined;

  const documents = Array.isArray(record.documents)
    ? record.documents
        .map((document, index) => normalizeDocument(document, index))
        .filter((document): document is ConfigDocument => Boolean(document))
        .slice(0, 32)
    : [];
  if (!Array.isArray(record.documents)) return undefined;

  const activeDocumentId =
    typeof record.activeDocumentId === "string" &&
    documents.some((document) => document.id === record.activeDocumentId)
      ? record.activeDocumentId
      : (documents[0]?.id ?? "");

  return {
    activeDocumentId,
    documents,
    schemaPath: typeof record.schemaPath === "string" ? record.schemaPath : undefined,
    schemaResource:
      normalizeResourceRef(record.schemaResource) ??
      normalizeLegacyPath(typeof record.schemaPath === "string" ? record.schemaPath : undefined),
    schemaText: typeof record.schemaText === "string" ? record.schemaText : "",
    schemaSavedText:
      typeof record.schemaSavedText === "string" ? record.schemaSavedText : undefined,
  };
}

function normalizeDocument(value: unknown, index: number): ConfigDocument | undefined {
  const record = asRecord(value);
  if (!record || typeof record.text !== "string") return undefined;

  const name =
    typeof record.name === "string" && record.name.trim().length > 0
      ? record.name
      : `config-${index + 1}.yaml`;
  const path = typeof record.path === "string" && record.path.length > 0 ? record.path : undefined;
  const resource =
    normalizeResourceRef(record.resource) ??
    normalizeResourceRef(record.location) ??
    normalizeLegacyPath(path);

  return createConfigDocument({
    id:
      typeof record.id === "string" && record.id.trim().length > 0
        ? record.id
        : `restored-${index}`,
    name,
    resource,
    path,
    text: record.text,
    savedText: typeof record.savedText === "string" ? record.savedText : record.text,
    saveState: "idle",
    lastSavedAt: typeof record.lastSavedAt === "number" ? record.lastSavedAt : undefined,
  });
}

function normalizeResourceRef(value: unknown): ResourceRef | undefined {
  const record = asRecord(value);

  if (record?.scheme === "file" && typeof record.path === "string" && record.path.trim()) {
    return {
      scheme: "file",
      path: record.path.trim(),
    };
  }

  if (
    record?.scheme === "ssh" &&
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

  if (record?.kind === "local" && typeof record.path === "string" && record.path.trim()) {
    return {
      scheme: "file",
      path: record.path.trim(),
    };
  }

  if (
    record?.kind === "remote" &&
    record.provider === "ssh" &&
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

function normalizeLegacyPath(path?: string): ResourceRef | undefined {
  return path ? { scheme: "file", path } : undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}
