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
    case "table": {
      if (v.rows.length === 0) return "(empty table)";
      const widths = v.columns.map((col) =>
        Math.max(col.length, ...v.rows.map((r) => (r[col] ?? "").length)),
      );
      const header = v.columns.map((col, i) => col.padEnd(widths[i]!)).join("  ");
      const sep = widths.map((w) => "─".repeat(w)).join("──");
      const body = v.rows
        .map((row) => v.columns.map((col, i) => (row[col] ?? "").padEnd(widths[i]!)).join("  "))
        .join("\n");
      return `${header}\n${sep}\n${body}`;
    }
  }
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
