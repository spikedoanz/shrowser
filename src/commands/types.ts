// Value types that flow through pipes
export type Value =
  | { readonly kind: "text"; readonly data: string }
  | { readonly kind: "table"; readonly columns: readonly string[]; readonly rows: readonly Record<string, string>[] }
  | { readonly kind: "void" };

export type CommandFn = (args: readonly string[], pipeInput: Value) => Promise<Value>;

export type CommandDef = {
  readonly name: string;
  readonly description: string;
  readonly execute: CommandFn;
};

// Helpers to construct values
export const text = (data: string): Value => ({ kind: "text", data });
export const table = (columns: readonly string[], rows: readonly Record<string, string>[]): Value =>
  ({ kind: "table", columns, rows });
export const VOID: Value = { kind: "void" };

// Render a value to a printable string
export const renderValue = (v: Value): string => {
  switch (v.kind) {
    case "void":
      return "";
    case "text":
      return v.data;
    case "table":
      return renderTable(v.columns, v.rows);
  }
};

// Format the index marker:
//   plain:            3
//   active:          (3)
//   pinned:          [3]
//   active + pinned: ([3])
const formatIdx = (idx: string, active: boolean, pinned: boolean): string => {
  let s = idx;
  if (pinned) s = `[${s}]`;
  if (active) s = `(${s})`;
  return s;
};

// Record-style list output. Plain text, no ANSI.
// Line 1: \t<marker> title
// Line 2: \turl
// Extra fields below.
const renderTable = (
  columns: readonly string[],
  rows: readonly Record<string, string>[],
): string => {
  if (rows.length === 0) return "(empty table)";

  const inlineKeys = new Set(["idx", "title", "name", "url", "active", "pinned"]);

  return rows.map((row, i) => {
    const idx = row["idx"] ?? String(i);
    const active = row["active"] === "*";
    const pinned = row["pinned"] === "pin" || row["pinned"] === "yes" || row["pinned"] === "*";
    const title = row["title"] ?? row["name"] ?? "";
    const url = row["url"] ?? "";

    const marker = formatIdx(idx, active, pinned);
    const mainLine = `\t${marker} ${title}`;
    const urlLine = url ? url : "";

    const extras = columns
      .filter((col) => !inlineKeys.has(col) && (row[col] ?? "").length > 0)
      .map((col) => `${col}: ${row[col]}`)
      .join("\n");

    return [mainLine, urlLine, extras].filter(Boolean).join("\n");
  }).join("\n");
};

// Convert a value to lines of text (for grep, head, tail)
export const valueToLines = (v: Value): readonly string[] => {
  switch (v.kind) {
    case "void":
      return [];
    case "text":
      return v.data.split("\n");
    case "table":
      return v.rows.map((row) =>
        v.columns.map((col) => row[col] ?? "").join("\t"),
      );
  }
};
