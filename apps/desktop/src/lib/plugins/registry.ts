import type {
  CommandCategoryContribution,
  CommandSource,
  CommandContribution,
  ConfigCodec,
  FieldRendererProvider,
  ResourceProvider,
  SchematicaPlugin,
  SchemaProvider,
  WorkspaceContext,
} from "./types";

export class PluginRegistry<Context = WorkspaceContext> {
  private readonly pluginsById = new Map<string, SchematicaPlugin<Context>>();

  register(plugin: SchematicaPlugin<Context>) {
    if (this.pluginsById.has(plugin.id)) {
      throw new Error(`Plugin '${plugin.id}' is already registered.`);
    }
    this.pluginsById.set(plugin.id, plugin);
  }

  registerAll(plugins: readonly SchematicaPlugin<Context>[]) {
    for (const plugin of plugins) {
      this.register(plugin);
    }
  }

  plugins(): SchematicaPlugin<Context>[] {
    return [...this.pluginsById.values()];
  }

  resources(): ResourceProvider[] {
    return this.plugins().flatMap((plugin) => plugin.resources ?? []);
  }

  codecs(): ConfigCodec[] {
    return this.plugins().flatMap((plugin) => plugin.codecs ?? []);
  }

  schemas(): SchemaProvider[] {
    return this.plugins().flatMap((plugin) => plugin.schemas ?? []);
  }

  fields(): FieldRendererProvider[] {
    return this.plugins().flatMap((plugin) => plugin.fields ?? []);
  }

  resourceProviderFor(scheme: string): ResourceProvider | undefined {
    return this.resources().find((provider) => provider.scheme === scheme);
  }

  commands(context: Context): CommandContribution<Context>[] {
    return this.plugins().flatMap((plugin) => resolveCommandSource(plugin.commands, context));
  }

  commandCategories(): CommandCategoryContribution[] {
    const byId = new Map<string, CommandCategoryContribution>();
    for (const plugin of this.plugins()) {
      for (const category of plugin.commandCategories ?? []) {
        const existing = byId.get(category.id);
        if (!existing || category.order < existing.order) {
          byId.set(category.id, category);
        }
      }
    }
    return [...byId.values()].sort((left, right) => left.order - right.order);
  }
}

function resolveCommandSource<Context>(
  source: CommandSource<Context> | undefined,
  context: Context,
): CommandContribution<Context>[] {
  if (!source) return [];
  return typeof source === "function" ? source(context) : [...source];
}

export function createPluginRegistry<Context = WorkspaceContext>(
  plugins: readonly SchematicaPlugin<Context>[] = [],
): PluginRegistry<Context> {
  const registry = new PluginRegistry<Context>();
  registry.registerAll(plugins);
  return registry;
}
