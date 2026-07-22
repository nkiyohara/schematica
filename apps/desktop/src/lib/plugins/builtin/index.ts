import type { SchematicaPlugin } from "../types";
import {
  createAppearanceCommandContributions,
  createFeedbackCommandContributions,
  createFileCommandContributions,
  createLayoutCommandContributions,
  createNavigationCommandContributions,
  createRecentResourceCommandContributions,
  createSchemaCommandContributions,
  createSshCommandContributions,
  createUpdateCommandContributions,
  type WorkbenchCommandContext,
} from "./commands";
import { createConfigCodecs } from "./codecs";
import { createFieldRendererProviders } from "./fields";
import { createJsonSchemaProvider } from "./schema";
import { createLocalResourceProvider, createSshResourceProvider } from "./resources";

export function createBuiltInPlugins(): SchematicaPlugin<WorkbenchCommandContext>[] {
  return [
    {
      id: "core.local",
      title: "Local files",
      resources: [createLocalResourceProvider()],
      codecs: createConfigCodecs(),
      commands: (context) => [
        ...createNavigationCommandContributions(),
        ...createFileCommandContributions(),
        ...createLayoutCommandContributions(),
        ...createRecentResourceCommandContributions(context),
      ],
      commandCategories: [
        { id: "navigation", title: "Navigation", order: 10 },
        { id: "files", title: "Files", order: 20 },
        { id: "layout", title: "Layout", order: 30 },
        { id: "system", title: "System", order: 40 },
      ],
    },
    {
      id: "core.schema",
      title: "JSON Schema",
      schemas: [createJsonSchemaProvider()],
      fields: createFieldRendererProviders(),
      commands: createSchemaCommandContributions(),
    },
    {
      id: "core.ssh",
      title: "SSH",
      resources: [createSshResourceProvider()],
      commands: createSshCommandContributions(),
    },
    {
      id: "core.appearance",
      title: "Appearance",
      commands: createAppearanceCommandContributions,
    },
    {
      id: "core.feedback",
      title: "Feedback",
      commands: createFeedbackCommandContributions(),
    },
    {
      id: "core.updates",
      title: "Updates",
      commands: createUpdateCommandContributions(),
    },
  ];
}
