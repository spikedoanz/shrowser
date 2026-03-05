import { register } from "./registry.ts";
import { text, valueToLines } from "./types.ts";

// grep — filter lines matching a pattern
register("grep", "filter lines matching a pattern", async (args, pipe) => {
  const pattern = args[0] ?? "";
  const lower = pattern.toLowerCase();

  if (pipe.kind === "table") {
    const matching = pipe.rows.filter((row) =>
      pipe.columns.some((col) => (row[col] ?? "").toLowerCase().includes(lower)),
    );
    return { kind: "table", columns: pipe.columns, rows: matching };
  }

  const lines = valueToLines(pipe);
  const matching = lines.filter((line) => line.toLowerCase().includes(lower));
  return text(matching.join("\n"));
});

// head — take first N lines/rows (default 10)
register("head", "take first N lines or rows", async (args, pipe) => {
  const n = parseInt(args[0] ?? "10", 10);

  if (pipe.kind === "table") {
    return { kind: "table", columns: pipe.columns, rows: pipe.rows.slice(0, n) };
  }

  const lines = valueToLines(pipe);
  return text(lines.slice(0, n).join("\n"));
});

// tail — take last N lines/rows (default 10)
register("tail", "take last N lines or rows", async (args, pipe) => {
  const n = parseInt(args[0] ?? "10", 10);

  if (pipe.kind === "table") {
    return { kind: "table", columns: pipe.columns, rows: pipe.rows.slice(-n) };
  }

  const lines = valueToLines(pipe);
  return text(lines.slice(-n).join("\n"));
});
