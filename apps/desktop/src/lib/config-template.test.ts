import { describe, expect, it } from "vitest";
import { parseData, type JsonSchema } from "@schematica/core";
import { defaultConfigText, draftConfigName } from "./config-template";

const schema: JsonSchema = {
  type: "object",
  properties: {
    project: {
      type: "string",
      default: "demo",
    },
    training: {
      type: "object",
      properties: {
        batch_size: {
          type: "integer",
          default: 64,
        },
      },
    },
  },
};

describe("config template generation", () => {
  it("creates draft text from schema defaults", () => {
    const text = defaultConfigText(schema, "yaml");

    expect(parseData(text)).toEqual({
      project: "demo",
      training: {
        batch_size: 64,
      },
    });
  });

  it("uses the requested output format", () => {
    expect(defaultConfigText(schema, "json")).toContain('"project": "demo"');
    expect(defaultConfigText(schema, "toml")).toContain("[training]");
  });

  it("uses an object fallback for TOML when the schema default is scalar", () => {
    expect(defaultConfigText({ type: "string", default: "demo" }, "toml")).toBe("");
  });

  it("allocates a stable draft name for the selected format", () => {
    expect(draftConfigName(["config.yaml", "config-2.yaml"], "yaml")).toBe("config-3.yaml");
    expect(draftConfigName(["config.json"], "json")).toBe("config-2.json");
  });
});
