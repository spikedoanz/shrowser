import { register } from "./registry.ts";
import { text, VOID, valueToLines } from "./types.ts";
import type { Value } from "./types.ts";

// echo — return args as text, or pass through pipe input
register("echo", "echo arguments or pipe input", async (args, pipe) => {
  if (args.length > 0) return text(args.join(" "));
  if (pipe.kind !== "void") return pipe;
  return text("");
});

// grep — filter lines matching a pattern
register("grep", "filter lines matching a pattern", async (args, pipe) => {
  const pattern = args[0];
  if (!pattern) return pipe;
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

// count — count lines or rows
register("count", "count lines or rows", async (_args, pipe) => {
  if (pipe.kind === "table") return text(String(pipe.rows.length));
  const lines = valueToLines(pipe);
  // don't count trailing empty line from split
  const count = lines.length === 1 && lines[0] === "" ? 0 : lines.length;
  return text(String(count));
});

// select — pick columns from a table
register("select", "pick columns from a table", async (args, pipe) => {
  if (pipe.kind !== "table") return pipe;
  const cols = args;
  const rows = pipe.rows.map((row) => {
    const out: Record<string, string> = {};
    for (const col of cols) {
      if (row[col] !== undefined) out[col] = row[col];
    }
    return out;
  });
  return { kind: "table", columns: cols, rows };
});

// help — list available commands
register("help", "list available commands", async (_args, _pipe) => {
  const { all } = await import("./registry.ts");
  const cmds = all();
  return {
    kind: "table",
    columns: ["name", "description"],
    rows: cmds.map((c) => ({ name: c.name, description: c.description })),
  };
});
