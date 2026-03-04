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

// ANSI helpers
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const bgDark = (s: string) => `\x1b[48;5;236m${s}\x1b[0m`;
const bgLight = (s: string) => `\x1b[48;5;238m${s}\x1b[0m`;

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

// Record-style list output.
// Line 1: idx and title on grey background (alternating), active rows in green.
// Line 2: url (no background), dimmed.
// Remaining fields as key: value pairs, dimmed.
const renderTable = (
  columns: readonly string[],
  rows: readonly Record<string, string>[],
): string => {
  if (rows.length === 0) return "(empty table)";

  // Known inline fields — these go on the main line or url line
  const inlineKeys = new Set(["idx", "title", "name", "url", "active"]);

  return rows.map((row, i) => {
    const isActive = row["active"] === "*";
    const bg = i % 2 === 0 ? bgDark : bgLight;
    const colorize = isActive ? green : (s: string) => s;

    // Line 1: "idx: title" with background
    const idx = row["idx"] ?? String(i);
    const title = row["title"] ?? row["name"] ?? "";
    const mainLine = bg(colorize(` ${idx}: ${title} `));

    // Line 2: url (no background, dimmed)
    const url = row["url"] ?? "";
    const urlLine = url ? `   ${dim(url)}` : "";

    // Extra fields (not inline)
    const extras = columns
      .filter((col) => !inlineKeys.has(col) && (row[col] ?? "").length > 0)
      .map((col) => `   ${dim(`${col}: ${row[col]}`)}`)
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
