export type CommandCategory = string;

export interface PaletteCommand {
  id: string;
  title: string;
  description: string;
  category: CommandCategory;
  shortcut?: string;
  disabled?: boolean;
  disabledReason?: string;
  keywords?: string[];
}

export interface CommandGroup {
  category: CommandCategory;
  commands: PaletteCommand[];
}

export const defaultCommandCategoryOrder: CommandCategory[] = [
  "navigation",
  "files",
  "layout",
  "system",
];

export function filterPaletteCommands(commands: PaletteCommand[], query: string): PaletteCommand[] {
  const terms = normalizeSearchText(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return commands;

  return commands.filter((command) => commandMatches(command, terms));
}

export function groupPaletteCommands(
  commands: PaletteCommand[],
  categoryOrder: readonly CommandCategory[] = defaultCommandCategoryOrder,
): CommandGroup[] {
  const uniqueCategoryOrder = categoryOrder.filter(
    (category, index) => categoryOrder.indexOf(category) === index,
  );
  const orderedCategories = [
    ...uniqueCategoryOrder,
    ...commands
      .map((command) => command.category)
      .filter(
        (category, index, categories) =>
          !uniqueCategoryOrder.includes(category) && categories.indexOf(category) === index,
      )
      .sort(),
  ];

  return orderedCategories.flatMap((category) => {
    const categoryCommands = commands.filter((command) => command.category === category);
    return categoryCommands.length > 0 ? [{ category, commands: categoryCommands }] : [];
  });
}

export function firstEnabledCommandIndex(commands: readonly PaletteCommand[]): number {
  return commands.findIndex((command) => !command.disabled);
}

export function lastEnabledCommandIndex(commands: readonly PaletteCommand[]): number {
  for (let index = commands.length - 1; index >= 0; index -= 1) {
    if (!commands[index]?.disabled) return index;
  }
  return -1;
}

export function moveEnabledCommandIndex(
  commands: readonly PaletteCommand[],
  currentIndex: number,
  direction: -1 | 1,
  steps = 1,
): number {
  const fallback =
    direction === 1 ? firstEnabledCommandIndex(commands) : lastEnabledCommandIndex(commands);
  if (fallback === -1) return -1;

  const current = commands[currentIndex];
  let index = current && !current.disabled ? currentIndex : fallback;
  if (index !== currentIndex) return index;

  for (let step = 0; step < Math.max(1, steps); step += 1) {
    let candidate = index + direction;
    while (candidate >= 0 && candidate < commands.length && commands[candidate]?.disabled) {
      candidate += direction;
    }
    if (candidate < 0 || candidate >= commands.length) break;
    index = candidate;
  }
  return index;
}

function commandMatches(command: PaletteCommand, terms: string[]) {
  const haystack = normalizeSearchText(
    [
      command.id,
      command.title,
      command.description,
      command.category,
      command.shortcut ?? "",
      command.disabledReason ?? "",
      ...(command.keywords ?? []),
    ].join(" "),
  );
  return terms.every((term) => haystack.includes(term));
}

function normalizeSearchText(value: string) {
  return value.normalize("NFKC").toLowerCase();
}
