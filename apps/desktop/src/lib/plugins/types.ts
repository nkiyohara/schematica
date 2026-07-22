import type {
  DataFormat,
  FieldModel,
  JsonSchema,
  JsonValue,
  CommentPreservation,
  SchemaCoverageReport,
} from "@schematica/core";
import type { MessageKey } from "../i18n";

export type ResourceRef =
  | {
      scheme: "file";
      path: string;
    }
  | {
      scheme: "ssh";
      host: string;
      path: string;
    };

export interface ResourceTarget<Ref extends ResourceRef = ResourceRef> {
  id: string;
  label: string;
  detail?: string;
  resource?: Ref;
  source?: string;
  metadata?: Record<string, unknown>;
}

export interface ResourceReadResult {
  text: string;
  savedText?: string;
}

export type ResourceEntryKind = "directory" | "file";

export interface ResourceEntry<Ref extends ResourceRef = ResourceRef> {
  id: string;
  name: string;
  kind: ResourceEntryKind;
  resource: Ref;
  size?: number;
}

export interface ResourceProvider<Ref extends ResourceRef = ResourceRef> {
  id: string;
  scheme: Ref["scheme"];
  title: string;
  discoverTargets?(): Promise<ResourceTarget<Ref>[]>;
  list?(ref: Ref): Promise<ResourceEntry<Ref>[]>;
  read(ref: Ref): Promise<ResourceReadResult>;
  write?(ref: Ref, contents: string): Promise<void>;
  displayName(ref: Ref): string;
  displayPath(ref: Ref): string;
  formatHint(ref: Ref): DataFormat;
}

export interface ConfigCodec {
  id: string;
  title: string;
  format: DataFormat;
  extensions: string[];
  parse(text: string): JsonValue;
  stringify(value: JsonValue): string;
  updateText?(
    text: string,
    path: string,
    value: JsonValue,
    options?: { preserveComments?: CommentPreservation },
  ): string;
  preservesComments?: boolean;
}

export interface SchemaProvider {
  id: string;
  title: string;
  canLoad(ref: ResourceRef): boolean;
  parse(text: string, format: DataFormat): JsonSchema;
  coverage(schema: JsonSchema): SchemaCoverageReport;
  fields(schema: JsonSchema): FieldModel[];
}

export interface FieldRendererProvider {
  id: string;
  priority: number;
  supports(field: FieldModel): boolean;
  component: unknown;
}

export interface DisabledState {
  reason: string;
}

export interface CommandCategoryContribution {
  id: string;
  title: string;
  order: number;
}

export interface CommandContribution<Context = WorkspaceContext> {
  id: string;
  title(context: Context): string;
  description(context: Context): string;
  category: string;
  shortcut?: (context: Context) => string | undefined;
  keywords?: (context: Context) => string[];
  disabled?: (context: Context) => DisabledState | undefined;
  execute(context: Context): void | Promise<void>;
}

export type CommandProvider<Context = WorkspaceContext> = (
  context: Context,
) => CommandContribution<Context>[];

export type CommandSource<Context = WorkspaceContext> =
  CommandContribution<Context>[] | CommandProvider<Context>;

export interface WorkspaceContext {
  t: (key: MessageKey, params?: Record<string, string | number>) => string;
  state: Record<string, unknown>;
  services: Record<string, unknown>;
  actions: Record<string, (...args: unknown[]) => void | Promise<void>>;
}

export interface SchematicaPlugin<Context = WorkspaceContext> {
  id: string;
  title: string;
  resources?: ResourceProvider[];
  codecs?: ConfigCodec[];
  schemas?: SchemaProvider[];
  fields?: FieldRendererProvider[];
  commands?: CommandSource<Context>;
  commandCategories?: CommandCategoryContribution[];
}
