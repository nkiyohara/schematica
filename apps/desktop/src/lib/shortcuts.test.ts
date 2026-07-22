import { describe, expect, it } from "vitest";
import { isPrimaryShortcut, primaryNumberShortcut, shortcutLabel } from "./shortcuts";

describe("keyboard shortcuts", () => {
  it("recognizes macOS command shortcuts by physical key code", () => {
    expect(
      isPrimaryShortcut(
        {
          altKey: false,
          code: "KeyK",
          ctrlKey: false,
          key: "Dead",
          metaKey: true,
          shiftKey: false,
        },
        "k",
        { platform: "apple" },
      ),
    ).toBe(true);
  });

  it("recognizes control shortcuts on non-Apple platforms", () => {
    expect(
      isPrimaryShortcut(
        {
          altKey: false,
          code: "KeyS",
          ctrlKey: true,
          key: "s",
          metaKey: false,
          shiftKey: true,
        },
        "s",
        { platform: "other", shift: true },
      ),
    ).toBe(true);
  });

  it("maps primary number shortcuts to workbench tabs", () => {
    expect(
      primaryNumberShortcut(
        {
          altKey: false,
          code: "Digit4",
          ctrlKey: false,
          key: "&",
          metaKey: true,
          shiftKey: false,
        },
        { platform: "apple" },
      ),
    ).toBeUndefined();
    expect(
      primaryNumberShortcut(
        {
          altKey: false,
          code: "Digit2",
          ctrlKey: false,
          key: "é",
          metaKey: true,
          shiftKey: false,
        },
        { platform: "apple" },
      ),
    ).toBe("compare");
  });

  it("does not expose removed workbench surfaces", () => {
    expect(
      primaryNumberShortcut(
        {
          altKey: false,
          code: "Digit5",
          ctrlKey: true,
          key: "5",
          metaKey: false,
          shiftKey: false,
        },
        { platform: "other" },
      ),
    ).toBeUndefined();
  });

  it("formats platform labels", () => {
    expect(shortcutLabel("K", "apple")).toBe("⌘K");
    expect(shortcutLabel("K", "other")).toBe("Ctrl+K");
  });
});
