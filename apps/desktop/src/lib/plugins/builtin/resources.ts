import { invoke } from "@tauri-apps/api/core";
import { formatFromPath } from "@schematica/core";
import type { ResourceEntry, ResourceProvider, ResourceRef, ResourceTarget } from "../types";
import type { SshHostCandidate } from "../../remote-sources";

export function createLocalResourceProvider(): ResourceProvider<
  Extract<ResourceRef, { scheme: "file" }>
> {
  return {
    id: "core.local.resources",
    scheme: "file",
    title: "Local files",
    async read(ref) {
      return {
        text: await invoke<string>("read_text_file", { path: ref.path }),
      };
    },
    async list(ref) {
      const entries = await invoke<DirectoryEntry[]>("list_local_directory", {
        path: ref.path,
      });
      return entries.map((entry) => localDirectoryEntry(entry));
    },
    async write(ref, contents) {
      await invoke("write_text_file", { path: ref.path, contents });
    },
    displayName(ref) {
      return fileName(ref.path);
    },
    displayPath(ref) {
      return ref.path;
    },
    formatHint(ref) {
      return formatFromPath(ref.path, "yaml");
    },
  };
}

export function createSshResourceProvider(): ResourceProvider<
  Extract<ResourceRef, { scheme: "ssh" }>
> {
  return {
    id: "core.ssh.resources",
    scheme: "ssh",
    title: "SSH",
    async discoverTargets() {
      const hosts = await invoke<SshHostCandidate[]>("ssh_hosts");
      return hosts.map((host) => sshHostTarget(host));
    },
    async read(ref) {
      return {
        text: await invoke<string>("read_ssh_text_file", {
          request: {
            host: ref.host,
            path: ref.path,
          },
        }),
      };
    },
    async list(ref) {
      const entries = await invoke<RemoteDirectoryEntry[]>("list_ssh_directory", {
        request: {
          host: ref.host,
          path: ref.path,
        },
      });
      return entries.map((entry) => sshDirectoryEntry(ref.host, entry));
    },
    async write(ref, contents) {
      await invoke("write_ssh_text_file", {
        request: {
          host: ref.host,
          path: ref.path,
        },
        contents,
      });
    },
    displayName(ref) {
      return fileName(ref.path);
    },
    displayPath(ref) {
      return `${ref.host}:${ref.path}`;
    },
    formatHint(ref) {
      return formatFromPath(ref.path, "yaml");
    },
  };
}

interface RemoteDirectoryEntry {
  name: string;
  path: string;
  kind: "directory" | "file";
  size?: number;
}

interface DirectoryEntry {
  name: string;
  path: string;
  kind: "directory" | "file";
  size?: number;
}

export function providerForResource(
  providers: readonly ResourceProvider[],
  resource: ResourceRef,
): ResourceProvider | undefined {
  return providers.find((provider) => provider.scheme === resource.scheme);
}

function sshHostTarget(
  host: SshHostCandidate,
): ResourceTarget<Extract<ResourceRef, { scheme: "ssh" }>> {
  return {
    id: `ssh:${host.host}`,
    label: host.label,
    detail: host.source === "config" ? "SSH config" : "Known host",
    source: host.source,
    metadata: {
      host: host.host,
      sourcePath: host.sourcePath,
      line: host.line,
    },
  };
}

function fileName(path: string) {
  return path.split(/[\\/]/).at(-1) ?? path;
}

function localDirectoryEntry(
  entry: DirectoryEntry,
): ResourceEntry<Extract<ResourceRef, { scheme: "file" }>> {
  return {
    id: `file:${entry.path}`,
    name: entry.name,
    kind: entry.kind,
    resource: {
      scheme: "file",
      path: entry.path,
    },
    size: entry.size,
  };
}

function sshDirectoryEntry(
  host: string,
  entry: RemoteDirectoryEntry,
): ResourceEntry<Extract<ResourceRef, { scheme: "ssh" }>> {
  return {
    id: `ssh:${host}:${entry.path}`,
    name: entry.name,
    kind: entry.kind,
    resource: {
      scheme: "ssh",
      host,
      path: entry.path,
    },
    size: entry.size,
  };
}
