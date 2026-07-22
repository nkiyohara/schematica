import type { ResourceRef } from "./plugins/types";

export function resolveSiblingResource(
  owner: ResourceRef | undefined,
  reference: string,
): ResourceRef | undefined {
  const trimmed = reference.trim();
  if (!trimmed || isExternalReference(trimmed)) return undefined;

  if (!owner) return undefined;

  if (owner.scheme === "ssh") {
    return {
      scheme: "ssh",
      host: owner.host,
      path: resolvePosixPath(dirnamePosix(owner.path), trimmed),
    };
  }

  return {
    scheme: "file",
    path: resolveLocalPath(dirnameLocal(owner.path), trimmed),
  };
}

export function parentResource(resource: ResourceRef): ResourceRef {
  if (resource.scheme === "ssh") {
    return {
      ...resource,
      path: parentPosixPath(resource.path),
    };
  }

  return {
    ...resource,
    path: parentLocalPath(resource.path),
  };
}

export function resourceBasename(resource: ResourceRef): string {
  return basename(resource.path);
}

function isExternalReference(reference: string) {
  return /^[a-z][a-z0-9+.-]*:/i.test(reference);
}

function resolvePosixPath(baseDirectory: string, reference: string) {
  if (reference === "~" || reference.startsWith("~/") || reference.startsWith("/")) {
    return normalizePosixPath(reference);
  }
  return normalizePosixPath(`${baseDirectory || "."}/${reference}`);
}

function normalizePosixPath(path: string) {
  if (path === "~" || path.startsWith("~/")) {
    const rest = path === "~" ? "" : path.slice(2);
    return rest ? `~/${normalizeParts(rest.split("/"))}` : "~";
  }

  const absolute = path.startsWith("/");
  const normalized = normalizeParts(path.split("/"));
  if (absolute) return `/${normalized}`.replace(/\/+$/, "") || "/";
  return normalized || ".";
}

function parentPosixPath(path: string) {
  const clean = path.replace(/\/+$/, "");
  if (!clean || clean === "/" || clean === "~") return clean || "/";
  if (clean.startsWith("~/")) {
    const parent = clean.slice(2).split("/").slice(0, -1).join("/");
    return parent ? `~/${parent}` : "~";
  }
  const parent = clean.split("/").slice(0, -1).join("/");
  return parent || "/";
}

function dirnamePosix(path: string) {
  return parentPosixPath(path);
}

function resolveLocalPath(baseDirectory: string, reference: string) {
  if (isLocalAbsolute(reference)) return normalizeLocalPath(reference);
  return normalizeLocalPath(joinLocal(baseDirectory || ".", reference));
}

function normalizeLocalPath(path: string) {
  const separator = usesWindowsSeparators(path) ? "\\" : "/";
  const { root, rest } = splitLocalRoot(path, separator);
  const normalized = normalizeLocalParts(rest.split(/[\\/]/), Boolean(root)).join(separator);
  if (!root) return normalized || ".";
  return normalized ? `${root}${normalized}` : root;
}

function parentLocalPath(path: string) {
  const normalized = normalizeLocalPath(path);
  const separator = usesWindowsSeparators(normalized) ? "\\" : "/";
  const { root, rest } = splitLocalRoot(normalized, separator);
  const parts = rest.split(/[\\/]/).filter(Boolean);
  parts.pop();
  if (parts.length > 0) return `${root}${parts.join(separator)}`;
  return root || ".";
}

function dirnameLocal(path: string) {
  return parentLocalPath(path);
}

function basename(path: string) {
  return path.split(/[\\/]/).filter(Boolean).at(-1) ?? path;
}

function joinLocal(baseDirectory: string, reference: string) {
  const separator = baseDirectory.includes("\\") && !baseDirectory.includes("/") ? "\\" : "/";
  return `${baseDirectory.replace(/[\\/]+$/, "")}${separator}${reference}`;
}

function isLocalAbsolute(path: string) {
  return path.startsWith("/") || /^[A-Za-z]:[\\/]/.test(path) || /^\\\\/.test(path);
}

function usesWindowsSeparators(path: string) {
  return (
    /^[A-Za-z]:[\\/]/.test(path) ||
    path.startsWith("\\\\") ||
    (path.includes("\\") && !path.includes("/"))
  );
}

function splitLocalRoot(path: string, separator: string) {
  if (path.startsWith("/")) return { root: "/", rest: path.slice(1) };

  const drive = path.match(/^([A-Za-z]:)[\\/]/);
  if (drive) {
    return { root: `${drive[1]}${separator}`, rest: path.slice(drive[0].length) };
  }

  const unc = path.match(/^\\\\([^\\/]+)[\\/]([^\\/]+)[\\/]?/);
  if (unc) {
    return {
      root: `\\\\${unc[1]}\\${unc[2]}\\`,
      rest: path.slice(unc[0].length),
    };
  }

  return { root: "", rest: path };
}

function normalizeLocalParts(parts: string[], rooted: boolean) {
  const output: string[] = [];
  for (const part of parts) {
    if (!part || part === ".") continue;
    if (part === "..") {
      if (output.length > 0 && output.at(-1) !== "..") output.pop();
      else if (!rooted) output.push(part);
      continue;
    }
    output.push(part);
  }
  return output;
}

function normalizeParts(parts: string[]) {
  const output: string[] = [];
  for (const part of parts) {
    if (!part || part === ".") continue;
    if (part === "..") {
      if (output.length > 0 && output.at(-1) !== "..") {
        output.pop();
      } else {
        output.push(part);
      }
      continue;
    }
    output.push(part);
  }
  return output.join("/");
}
