import type { WorkbenchTab } from "./workbench";

export type ShortcutPlatform = "apple" | "other";

export function shortcutPlatform(platform = navigator.platform): ShortcutPlatform {
  return /Mac|iPhone|iPad/i.test(platform) ? "apple" : "other";
}

export function shortcutLabel(key: string, platform: ShortcutPlatform) {
  return platform === "apple" ? `⌘${key}` : `Ctrl+${key}`;
}

export function isPrimaryShortcut(
  event: Pick<KeyboardEvent, "altKey" | "code" | "ctrlKey" | "key" | "metaKey" | "shiftKey">,
  key: string,
  options: { shift?: boolean; platform?: ShortcutPlatform } = {},
) {
  const platform = options.platform ?? shortcutPlatform();
  const primaryPressed = platform === "apple" ? event.metaKey : event.ctrlKey || event.metaKey;
  if (!primaryPressed || event.altKey || event.shiftKey !== (options.shift ?? false)) {
    return false;
  }

  return shortcutKeyMatches(event, key);
}

export function primaryNumberShortcut(
  event: Pick<KeyboardEvent, "altKey" | "code" | "ctrlKey" | "key" | "metaKey" | "shiftKey">,
  options: { platform?: ShortcutPlatform } = {},
): WorkbenchTab | undefined {
  const platform = options.platform ?? shortcutPlatform();
  const primaryPressed = platform === "apple" ? event.metaKey : event.ctrlKey || event.metaKey;
  if (!primaryPressed || event.altKey || event.shiftKey) return undefined;

  const key = normalizedShortcutKey(event);
  const tabByKey: Record<string, WorkbenchTab> = {
    "1": "editor",
    "2": "compare",
    "3": "settings",
  };
  return tabByKey[key];
}

function shortcutKeyMatches(event: Pick<KeyboardEvent, "code" | "key">, key: string) {
  return normalizedShortcutKey(event) === key.toLowerCase();
}

function normalizedShortcutKey(event: Pick<KeyboardEvent, "code" | "key">) {
  if (/^Key[A-Z]$/.test(event.code)) {
    return event.code.slice(3).toLowerCase();
  }

  if (/^Digit\d$/.test(event.code)) {
    return event.code.slice(5);
  }

  return event.key.toLowerCase();
}
