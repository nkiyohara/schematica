import { describe, expect, it } from "vitest";
import { createPluginRegistry } from "./registry";
import type { SchematicaPlugin, WorkspaceContext } from "./types";

const context: WorkspaceContext = {
  t: (key) => key,
  state: {},
  services: {},
  actions: {},
};

describe("plugin registry", () => {
  it("registers plugins once and preserves registration order", () => {
    const first = plugin("core.alpha");
    const second = plugin("core.beta");
    const registry = createPluginRegistry([first, second]);

    expect(registry.plugins().map((candidate) => candidate.id)).toEqual([
      "core.alpha",
      "core.beta",
    ]);
    expect(() => registry.register(first)).toThrow("already registered");
  });

  it("aggregates resources, commands, and context-aware command providers", () => {
    const registry = createPluginRegistry([
      {
        id: "core.local",
        title: "Local",
        resources: [
          {
            id: "file",
            scheme: "file",
            title: "File",
            read: () => Promise.resolve({ text: "" }),
            displayName: () => "config.yaml",
            displayPath: () => "/fixtures/config.yaml",
            formatHint: () => "yaml",
          },
        ],
        codecs: [
          {
            id: "yaml",
            title: "YAML",
            format: "yaml",
            extensions: ["yaml", "yml"],
            parse: () => ({}),
            stringify: () => "{}",
          },
        ],
        schemas: [
          {
            id: "schema",
            title: "Schema",
            canLoad: () => true,
            parse: () => ({}),
            coverage: () => ({
              dialect: "unknown",
              dialectLabel: "Unknown",
              validation: {
                engine: "test",
                detail: "Synthetic coverage",
              },
              form: {
                supportedKeywords: [],
                validatedOnlyKeywords: [],
                unsupportedKeywords: [],
              },
              totals: {
                supported: 0,
                validatedOnly: 0,
                unsupported: 0,
              },
            }),
            fields: () => [],
          },
        ],
        fields: [
          {
            id: "field",
            priority: 0,
            supports: () => true,
            component: "field",
          },
        ],
        commands: [
          {
            id: "file.open",
            category: "files",
            title: () => "Open",
            description: () => "Open file",
            execute: () => undefined,
          },
        ],
      },
      {
        id: "core.dynamic",
        title: "Dynamic commands",
        commands: (nextContext) =>
          nextContext.state.enabled
            ? [
                {
                  id: "dynamic.execute",
                  category: "workflow",
                  title: () => "Execute",
                  description: () => "Execute dynamic command",
                  execute: () => undefined,
                },
              ]
            : [],
      },
    ]);

    expect(registry.resources().map((resource) => resource.scheme)).toEqual(["file"]);
    expect(registry.codecs().map((codec) => codec.id)).toEqual(["yaml"]);
    expect(registry.schemas().map((schema) => schema.id)).toEqual(["schema"]);
    expect(registry.fields().map((field) => field.id)).toEqual(["field"]);
    expect(registry.commands(context).map((command) => command.id)).toEqual(["file.open"]);
    expect(
      registry.commands({ ...context, state: { enabled: true } }).map((command) => command.id),
    ).toEqual(["file.open", "dynamic.execute"]);
  });

  it("orders command categories by contribution order and deduplicates by id", () => {
    const registry = createPluginRegistry([
      {
        ...plugin("core.one"),
        commandCategories: [
          { id: "system", title: "System", order: 50 },
          { id: "files", title: "Files", order: 20 },
        ],
      },
      {
        ...plugin("core.two"),
        commandCategories: [{ id: "system", title: "System", order: 40 }],
      },
    ]);

    expect(registry.commandCategories()).toEqual([
      { id: "files", title: "Files", order: 20 },
      { id: "system", title: "System", order: 40 },
    ]);
  });
});

function plugin(id: string): SchematicaPlugin {
  return {
    id,
    title: id,
  };
}
