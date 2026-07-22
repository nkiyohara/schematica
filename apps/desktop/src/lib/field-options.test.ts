import { describe, expect, it } from "vitest";
import { fieldOptionLabel } from "./field-options";

describe("field option labels", () => {
  it("uses a field-scoped display label without changing the underlying value", () => {
    const labels = {
      "option.interface.locale.system": "Système",
      "option.interface.locale.zh-CN": "简体中文",
    };

    expect(fieldOptionLabel("interface.locale", "system", labels)).toBe("Système");
    expect(fieldOptionLabel("interface.locale", "zh-CN", labels)).toBe("简体中文");
  });

  it("falls back to stable scalar and structured values", () => {
    expect(fieldOptionLabel("editor.defaultFormat", "yaml", {})).toBe("yaml");
    expect(fieldOptionLabel("example", 3, {})).toBe("3");
    expect(fieldOptionLabel("example", { enabled: true }, {})).toBe('{"enabled":true}');
    expect(fieldOptionLabel("example", undefined, {})).toBe("");
  });
});
