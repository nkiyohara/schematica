import type {
  ConfigSnapshot,
  DiffCell,
  DiffOptions,
  DiffRow,
  DiffRowKind,
  DiffSummary,
  JsonObject,
  JsonValue,
} from "./types.js";
import { appendPath } from "./path.js";

const missing = Symbol("missing");
type FlattenedValue = JsonValue | typeof missing;

export function compareConfigs(snapshots: ConfigSnapshot[], options: DiffOptions = {}): DiffRow[] {
  if (snapshots.length < 2) {
    return [];
  }

  const flattened = snapshots.map((snapshot) => ({
    name: snapshot.name,
    values: flatten(snapshot.data),
  }));

  const paths = Array.from(
    new Set(flattened.flatMap((snapshot) => Array.from(snapshot.values.keys()))),
  )
    .filter((path, _index, allPaths) => !hasDescendantPath(path, allPaths))
    .sort(comparePath);

  const baselineName = options.baseline ?? snapshots[0]?.name;
  const baselineIndex = flattened.findIndex((snapshot) => snapshot.name === baselineName);
  if (baselineIndex < 0) {
    throw new Error(`Unknown diff baseline '${baselineName}'.`);
  }

  return paths
    .map((path) => {
      const values = flattened.map((snapshot) => snapshot.values.get(path) ?? missing);
      const rowKind = classify(values);
      const baselineValue = values[baselineIndex];

      const cells: DiffCell[] = flattened.map((snapshot, index) => {
        const value = values[index];
        const exists = value !== missing;
        return {
          name: snapshot.name,
          exists,
          value: exists ? value : undefined,
          status: cellStatus(rowKind, value, baselineValue),
        };
      });

      return {
        path,
        kind: rowKind,
        cells,
      };
    })
    .filter((row) => !options.onlyChanges || row.kind !== "same");
}

function hasDescendantPath(path: string, allPaths: string[]) {
  if (path === ".") return allPaths.length > 1;
  return allPaths.some(
    (candidate) =>
      candidate !== path && (candidate.startsWith(`${path}.`) || candidate.startsWith(`${path}[`)),
  );
}

export function summarizeDiffRows(rows: DiffRow[]): DiffSummary {
  return rows.reduce<DiffSummary>(
    (summary, row) => ({
      ...summary,
      total: summary.total + 1,
      [row.kind]: summary[row.kind] + 1,
    }),
    {
      total: 0,
      same: 0,
      changed: 0,
      missing: 0,
    },
  );
}

function flatten(value: JsonValue, path = "", result = new Map<string, JsonValue>()) {
  if (Array.isArray(value)) {
    if (value.length === 0) {
      result.set(path, value);
      return result;
    }

    value.forEach((item, index) => flatten(item, appendPath(path, index), result));
    return result;
  }

  if (isObject(value)) {
    const entries = Object.entries(value).filter(([, child]) => child !== undefined);
    if (entries.length === 0) {
      result.set(path || ".", value);
      return result;
    }

    for (const [key, child] of entries) {
      flatten(child as JsonValue, appendPath(path, key), result);
    }
    return result;
  }

  result.set(path, value);
  return result;
}

function classify(values: FlattenedValue[]): DiffRowKind {
  if (values.some((value) => value === missing)) {
    return "missing";
  }

  const unique = new Set(values.map(stableStringify));
  return unique.size === 1 ? "same" : "changed";
}

function cellStatus(
  rowKind: DiffRowKind,
  value: FlattenedValue,
  baselineValue: FlattenedValue,
): DiffRowKind {
  if (value === missing) {
    return "missing";
  }

  if (rowKind === "same") {
    return "same";
  }

  return stableStringify(value) === stableStringify(baselineValue) ? "same" : "changed";
}

function stableStringify(value: FlattenedValue): string {
  if (value === missing) {
    return "__SCHEMATICA_MISSING__";
  }

  if (isObject(value)) {
    return JSON.stringify(
      Object.fromEntries(
        Object.entries(value).sort(([left], [right]) => left.localeCompare(right)),
      ),
    );
  }

  return JSON.stringify(value);
}

function comparePath(left: string, right: string) {
  return left.localeCompare(right, undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
