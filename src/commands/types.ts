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
export const renderValue = (v: Value, termWidth = 80): string => {
  switch (v.kind) {
    case "void":
      return "";
    case "text":
      return v.data;
    case "table":
      return renderTable(v.columns, v.rows, termWidth);
  }
};

const renderTable = (
  columns: readonly string[],
  rows: readonly Record<string, string>[],
  termWidth: number,
): string => {
  if (rows.length === 0) return "(empty table)";

  const gap = 2; // spaces between columns
  const numCols = columns.length;

  // Natural width each column wants (max of header + all cell values)
  const natural = columns.map((col) =>
    Math.max(col.length, ...rows.map((r) => (r[col] ?? "").length)),
  );

  const totalGap = gap * (numCols - 1);
  const totalNatural = natural.reduce((a, b) => a + b, 0) + totalGap;

  // If it fits, use natural widths
  const widths =
    totalNatural <= termWidth
      ? natural
      : fitColumns(columns, natural, termWidth, totalGap);

  const truncate = (s: string, w: number): string =>
    s.length <= w ? s.padEnd(w) : s.slice(0, w - 1) + "…";

  const header = columns.map((col, i) => truncate(col, widths[i]!)).join(" ".repeat(gap));
  const sep = widths.map((w) => "─".repeat(w)).join("─".repeat(gap));
  const body = rows
    .map((row) =>
      columns.map((col, i) => truncate(row[col] ?? "", widths[i]!)).join(" ".repeat(gap)),
    )
    .join("\n");
  return `${header}\n${sep}\n${body}`;
};

// Shrink columns to fit within termWidth.
// Strategy: give each column at least min(header.length, 4), then distribute
// remaining space proportionally to natural width.
const fitColumns = (
  columns: readonly string[],
  natural: readonly number[],
  termWidth: number,
  totalGap: number,
): number[] => {
  const available = termWidth - totalGap;
  const mins = columns.map((col) => Math.min(Math.max(col.length, 3), 8));
  const minTotal = mins.reduce((a, b) => a + b, 0);

  // If even minimums don't fit, just use minimums and accept overflow
  if (available <= minTotal) return [...mins];

  const extra = available - minTotal;
  const natTotal = natural.reduce((a, b) => a + b, 0);

  // Distribute extra space proportionally to natural widths
  const widths = mins.map((min, i) => {
    const share = natTotal > 0 ? (natural[i]! / natTotal) * extra : extra / columns.length;
    return Math.min(min + Math.floor(share), natural[i]!);
  });

  // Distribute any leftover pixels to columns that are still truncated
  let used = widths.reduce((a, b) => a + b, 0);
  for (let i = 0; i < widths.length && used < available; i++) {
    const add = Math.min(natural[i]! - widths[i]!, available - used);
    if (add > 0) {
      widths[i] += add;
      used += add;
    }
  }

  return widths;
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
