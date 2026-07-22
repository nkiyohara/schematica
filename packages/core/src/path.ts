import type { JsonObject, JsonValue } from "./types.js";

export function getPath(data: JsonValue, path: string): JsonValue | undefined {
  return tokens(path).reduce<JsonValue | undefined>((current, token) => {
    if (current === undefined || current === null) {
      return undefined;
    }

    if (Array.isArray(current)) {
      const index = Number(token);
      return Number.isInteger(index) ? current[index] : undefined;
    }

    if (typeof current === "object") {
      return current[token];
    }

    return undefined;
  }, data);
}

export function setPath(data: JsonValue, path: string, value: JsonValue): JsonValue {
  const parts = tokens(path);

  if (parts.length === 0) {
    return value;
  }

  const root = clone(data);
  let cursor: JsonValue = root;

  for (const [index, part] of parts.entries()) {
    const isLast = index === parts.length - 1;

    if (typeof cursor !== "object" || cursor === null) {
      throw new Error(`Cannot set ${path}: ${parts.slice(0, index).join(".")} is not an object`);
    }

    if (Array.isArray(cursor)) {
      const arrayIndex = Number(part);
      if (!Number.isInteger(arrayIndex)) {
        throw new Error(`Cannot set ${path}: ${part} is not an array index`);
      }

      if (isLast) {
        cursor[arrayIndex] = value;
      } else {
        const next = cursor[arrayIndex] ?? {};
        cursor[arrayIndex] = next;
        cursor = next;
      }
      continue;
    }

    const object: JsonObject = cursor;
    if (isLast) {
      object[part] = value;
    } else {
      const next = object[part] ?? {};
      object[part] = next;
      cursor = next;
    }
  }

  return root;
}

export function deletePath(data: JsonValue, path: string): JsonValue {
  const parts = tokens(path);
  if (parts.length === 0) {
    throw new Error("Cannot remove the document root");
  }

  const root = clone(data);
  let cursor: JsonValue | undefined = root;

  for (const [index, part] of parts.entries()) {
    if (typeof cursor !== "object" || cursor === null) {
      return root;
    }

    const isLast = index === parts.length - 1;
    if (Array.isArray(cursor)) {
      const arrayIndex = Number(part);
      if (!Number.isInteger(arrayIndex)) return root;
      if (isLast) {
        cursor.splice(arrayIndex, 1);
        return root;
      }
      cursor = cursor[arrayIndex];
      continue;
    }

    if (isLast) {
      delete cursor[part];
      return root;
    }
    cursor = cursor[part];
  }

  return root;
}

export function tokens(path: string): string[] {
  if (!path || path === ".") {
    return [];
  }

  if (path.startsWith("/")) {
    return path
      .slice(1)
      .split("/")
      .map((part) => part.replaceAll("~1", "/").replaceAll("~0", "~"));
  }

  const result: string[] = [];
  let current = "";
  let index = 0;

  const pushCurrent = () => {
    const part = current.trim();
    if (part) result.push(part);
    current = "";
  };

  while (index < path.length) {
    const character = path[index];
    if (character === "\\" && index + 1 < path.length) {
      current += path[index + 1];
      index += 2;
      continue;
    }

    if (character === ".") {
      pushCurrent();
      index += 1;
      continue;
    }

    if (character === "[") {
      pushCurrent();
      const close = findClosingBracket(path, index);
      if (close < 0) throw new Error(`Invalid path '${path}': missing closing bracket`);
      const content = path.slice(index + 1, close).trim();
      if (/^\d+$/.test(content)) {
        result.push(content);
      } else if (
        (content.startsWith('"') && content.endsWith('"')) ||
        (content.startsWith("'") && content.endsWith("'"))
      ) {
        result.push(parseQuotedToken(content, path));
      } else {
        throw new Error(`Invalid path '${path}': bracket keys must be quoted`);
      }
      index = close + 1;
      continue;
    }

    current += character;
    index += 1;
  }

  pushCurrent();
  return result;
}

export function appendPath(path: string, key: string | number): string {
  if (typeof key === "number") return path ? `${path}[${key}]` : `[${key}]`;
  const segment = /^[A-Za-z_$][A-Za-z0-9_$-]*$/.test(key) ? key : `[${JSON.stringify(key)}]`;
  if (!path) return segment;
  return segment.startsWith("[") ? `${path}${segment}` : `${path}.${segment}`;
}

function findClosingBracket(path: string, start: number) {
  let quote: string | undefined;
  let escaping = false;
  for (let index = start + 1; index < path.length; index += 1) {
    const character = path[index];
    if (escaping) {
      escaping = false;
      continue;
    }
    if (character === "\\") {
      escaping = true;
      continue;
    }
    if (quote) {
      if (character === quote) quote = undefined;
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === "]") return index;
  }
  return -1;
}

function parseQuotedToken(content: string, fullPath: string) {
  if (content.startsWith('"')) {
    try {
      return JSON.parse(content) as string;
    } catch {
      throw new Error(`Invalid quoted key in path '${fullPath}'`);
    }
  }

  return content.slice(1, -1).replaceAll("\\'", "'").replaceAll("\\\\", "\\");
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
