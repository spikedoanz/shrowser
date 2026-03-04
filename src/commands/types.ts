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

// YAML-like record list. Active rows highlighted green.
const renderTable = (
  columns: readonly string[],
  rows: readonly Record<string, string>[],
): string => {
  if (rows.length === 0) return "(empty table)";

  // Find the longest key name for alignment
  const keyWidth = Math.max(...columns.map((c) => c.length));

  return rows.map((row, i) => {
    const isActive = row["active"] === "*";
    const colorize = isActive ? green : (s: string) => s;

    const fields = columns
      .filter((col) => (row[col] ?? "").length > 0)
      .map((col) => {
        const label = dim(`${col.padEnd(keyWidth)}: `);
        const val = colorize(row[col] ?? "");
        return `  ${label}${val}`;
      })
      .join("\n");

    return `${dim("─")} ${colorize(String(i))}\n${fields}`;
  }).join("\n\n");
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
