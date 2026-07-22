import { describe, expect, it } from "vitest";
import { parentResource, resolveSiblingResource } from "./resource-paths";

describe("resource path helpers", () => {
  it("resolves local schema references beside a config file", () => {
    expect(
      resolveSiblingResource(
        { scheme: "file", path: "/repo/examples/config.yaml" },
        "./schema.json",
      ),
    ).toEqual({
      scheme: "file",
      path: "/repo/examples/schema.json",
    });
  });

  it("resolves ssh schema references on the same host", () => {
    expect(
      resolveSiblingResource(
        { scheme: "ssh", host: "build", path: "~/runs/config.yaml" },
        "../schemas/train.schema.json",
      ),
    ).toEqual({
      scheme: "ssh",
      host: "build",
      path: "~/schemas/train.schema.json",
    });
  });

  it("keeps external references unsupported by file providers", () => {
    expect(
      resolveSiblingResource(
        { scheme: "file", path: "/repo/config.yaml" },
        "https://example.test/schema.json",
      ),
    ).toBeUndefined();
  });

  it("returns provider-specific parent resources", () => {
    expect(parentResource({ scheme: "ssh", host: "build", path: "~/runs" })).toEqual({
      scheme: "ssh",
      host: "build",
      path: "~",
    });
    expect(parentResource({ scheme: "file", path: "/repo/examples" })).toEqual({
      scheme: "file",
      path: "/repo",
    });
  });

  it("resolves Windows drive-relative schema references without duplicating the drive", () => {
    expect(
      resolveSiblingResource(
        { scheme: "file", path: "C:\\repo\\configs\\config.yaml" },
        "..\\schema.json",
      ),
    ).toEqual({
      scheme: "file",
      path: "C:\\repo\\schema.json",
    });
  });

  it("preserves UNC roots while resolving and finding parents", () => {
    expect(
      resolveSiblingResource(
        { scheme: "file", path: "\\\\server\\share\\configs\\config.yaml" },
        "..\\schema.json",
      ),
    ).toEqual({
      scheme: "file",
      path: "\\\\server\\share\\schema.json",
    });
    expect(parentResource({ scheme: "file", path: "\\\\server\\share\\configs" })).toEqual({
      scheme: "file",
      path: "\\\\server\\share\\",
    });
  });
});
