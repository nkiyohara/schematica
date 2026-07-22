import { describe, expect, it } from "vitest";
import {
  filterPaletteCommands,
  firstEnabledCommandIndex,
  groupPaletteCommands,
  lastEnabledCommandIndex,
  moveEnabledCommandIndex,
  type PaletteCommand,
} from "./command-palette";

const commands: PaletteCommand[] = [
  {
    id: "go.editor",
    title: "Editor",
    description: "Edit with schema controls.",
    category: "navigation",
  },
  {
    id: "file.open",
    title: "Open Config",
    description: "Open YAML, JSON, or TOML.",
    category: "files",
    shortcut: "Ctrl+O",
    keywords: ["load"],
  },
  {
    id: "updates.check",
    title: "Check for updates",
    description: "Inspect update availability.",
    category: "system",
    disabled: true,
    disabledReason: "Updater busy",
  },
];

describe("command palette helpers", () => {
  it("matches title, description, category, disabled reason, and keywords", () => {
    expect(filterPaletteCommands(commands, "toml").map((command) => command.id)).toEqual([
      "file.open",
    ]);
    expect(filterPaletteCommands(commands, "load").map((command) => command.id)).toEqual([
      "file.open",
    ]);
    expect(filterPaletteCommands(commands, "updater busy").map((command) => command.id)).toEqual([
      "updates.check",
    ]);
    expect(filterPaletteCommands(commands, "go.editor").map((command) => command.id)).toEqual([
      "go.editor",
    ]);
    expect(filterPaletteCommands(commands, "ctrl+o").map((command) => command.id)).toEqual([
      "file.open",
    ]);
  });

  it("matches normalized, independently positioned search terms", () => {
    expect(filterPaletteCommands(commands, "  YAML   OPEN ").map((command) => command.id)).toEqual([
      "file.open",
    ]);
    expect(filterPaletteCommands(commands, "ｌｏａｄ").map((command) => command.id)).toEqual([
      "file.open",
    ]);
    expect(filterPaletteCommands(commands, "open missing")).toEqual([]);
  });

  it("groups commands in stable product order", () => {
    expect(groupPaletteCommands(commands)).toEqual([
      { category: "navigation", commands: [commands[0]] },
      { category: "files", commands: [commands[1]] },
      { category: "system", commands: [commands[2]] },
    ]);
  });

  it("does not duplicate groups when a category order contains duplicates", () => {
    expect(
      groupPaletteCommands(commands, ["files", "files", "navigation"]).map(
        (group) => group.category,
      ),
    ).toEqual(["files", "navigation", "system"]);
  });

  it("finds enabled boundaries without selecting disabled-only results", () => {
    expect(firstEnabledCommandIndex(commands)).toBe(0);
    expect(lastEnabledCommandIndex(commands)).toBe(1);
    expect(firstEnabledCommandIndex([commands[2]])).toBe(-1);
    expect(lastEnabledCommandIndex([commands[2]])).toBe(-1);
    expect(firstEnabledCommandIndex([])).toBe(-1);
  });

  it("moves across enabled commands and clamps at the list boundaries", () => {
    const list: PaletteCommand[] = [
      commands[0],
      { ...commands[2], id: "disabled.middle" },
      commands[1],
      { ...commands[2], id: "disabled.last" },
    ];

    expect(moveEnabledCommandIndex(list, 0, 1)).toBe(2);
    expect(moveEnabledCommandIndex(list, 2, -1)).toBe(0);
    expect(moveEnabledCommandIndex(list, 2, 1)).toBe(2);
    expect(moveEnabledCommandIndex(list, 0, -1)).toBe(0);
    expect(moveEnabledCommandIndex(list, -1, 1)).toBe(0);
    expect(moveEnabledCommandIndex([commands[2]], -1, 1)).toBe(-1);
  });

  it("supports page-sized jumps while skipping disabled commands", () => {
    const longList = Array.from(
      { length: 20 },
      (_, index): PaletteCommand => ({
        id: `command.${index}`,
        title: `Command ${index}`,
        description: "",
        category: "navigation",
        disabled: index === 3 || index === 5,
      }),
    );

    expect(moveEnabledCommandIndex(longList, 0, 1, 8)).toBe(10);
    expect(moveEnabledCommandIndex(longList, 10, -1, 8)).toBe(0);
  });
});
