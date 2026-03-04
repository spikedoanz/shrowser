// Background script — connects to the daemon via WebSocket,
// receives commands, executes them using browser APIs, sends results back.

import type { Value } from "../commands/types.ts";
import { text, table, VOID, renderValue, valueToLines } from "../commands/types.ts";
import { tokenize } from "../lang/tokenizer.ts";
import { parse } from "../lang/parser.ts";
import type { Script, Pipeline, Command, Arg } from "../lang/types.ts";

// ── Command registry (browser-side) ─────────────────────────────

type CommandFn = (args: readonly string[], pipe: Value) => Promise<Value>;
const commands = new Map<string, CommandFn>();

const register = (name: string, fn: CommandFn) => commands.set(name, fn);

// ── Built-in browser commands ────────────────────────────────────

register("list", async (_args, _pipe) => {
  const tabs = await browser.tabs.query({});
  return table(
    ["idx", "title", "url", "active", "pinned"],
    tabs.map((t, i) => ({
      idx: String(i),
      title: t.title ?? "",
      url: t.url ?? "",
      active: t.active ? "*" : "",
      pinned: t.pinned ? "pin" : "",
    })),
  );
});

register("close", async (args, pipe) => {
  if (args.length > 0) {
    const idx = parseInt(args[0]!, 10);
    const tabs = await browser.tabs.query({});
    const tab = tabs[idx];
    if (tab?.id) await browser.tabs.remove(tab.id);
  } else if (pipe.kind === "table") {
    // Close tabs from piped table (expects an "idx" or "id" column)
    const ids: number[] = [];
    for (const row of pipe.rows) {
      const idx = parseInt(row["idx"] ?? "", 10);
      if (!isNaN(idx)) {
        const tabs = await browser.tabs.query({});
        const tab = tabs[idx];
        if (tab?.id) ids.push(tab.id);
      }
    }
    if (ids.length > 0) await browser.tabs.remove(ids);
  } else {
    // Close current tab
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) await browser.tabs.remove(tab.id);
  }
  return VOID;
});

register("new", async (args, _pipe) => {
  let url = args[0] ?? "about:blank";
  if (url && !url.includes("://") && !url.startsWith("about:")) {
    url = "https://" + url;
  }
  await browser.tabs.create({ url });
  return VOID;
});

register("jump", async (args, pipe) => {
  const arg = args[0] ?? (pipe.kind === "table" && pipe.rows[0]?.["idx"]) ?? "0";
  const tabs = await browser.tabs.query({});

  // Try as number first
  const idx = parseInt(arg, 10);
  if (!isNaN(idx) && String(idx) === arg.trim() && tabs[idx]?.id) {
    await browser.tabs.update(tabs[idx]!.id!, { active: true });
    return VOID;
  }

  // String: search titles/urls for match
  const query = args.join(" ").toLowerCase();
  const match = tabs.find(
    (t) =>
      (t.title ?? "").toLowerCase().includes(query) ||
      (t.url ?? "").toLowerCase().includes(query),
  );
  if (match?.id) {
    await browser.tabs.update(match.id, { active: true });
    return VOID;
  }

  return text(`no tab matching "${query}" (searched ${tabs.length} tabs)`);
});

register("search", async (args, _pipe) => {
  const query = args.join(" ");
  const engine = "https://duckduckgo.com/?q=";
  const url = engine + encodeURIComponent(query);
  await browser.tabs.create({ url });
  return VOID;
});

register("reload", async (_args, _pipe) => {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) await browser.tabs.reload(tab.id);
  return VOID;
});

register("back", async (_args, _pipe) => {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) await browser.tabs.executeScript(tab.id, { code: "history.back()" });
  return VOID;
});

register("forward", async (_args, _pipe) => {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) await browser.tabs.executeScript(tab.id, { code: "history.forward()" });
  return VOID;
});

register("pin", async (args, _pipe) => {
  const idx = args[0] ? parseInt(args[0], 10) : undefined;
  let tab: browser.tabs.Tab;
  if (idx !== undefined) {
    const tabs = await browser.tabs.query({});
    tab = tabs[idx]!;
  } else {
    [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  }
  if (tab?.id) await browser.tabs.update(tab.id, { pinned: !tab.pinned });
  return VOID;
});

register("mute", async (args, _pipe) => {
  const idx = args[0] ? parseInt(args[0], 10) : undefined;
  let tab: browser.tabs.Tab;
  if (idx !== undefined) {
    const tabs = await browser.tabs.query({});
    tab = tabs[idx]!;
  } else {
    [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  }
  if (tab?.id) await browser.tabs.update(tab.id, { muted: !tab.mutedInfo?.muted });
  return VOID;
});

// ── Util commands (also available in extension) ──────────────────

register("echo", async (args, pipe) => {
  if (args.length > 0) return text(args.join(" "));
  if (pipe.kind !== "void") return pipe;
  return text("");
});

register("grep", async (args, pipe) => {
  const pattern = args[0];
  if (!pattern) return pipe;
  if (pipe.kind === "table") {
    const matching = pipe.rows.filter((row) =>
      pipe.columns.some((col) => (row[col] ?? "").includes(pattern)),
    );
    return { kind: "table", columns: pipe.columns, rows: matching };
  }
  const lines = valueToLines(pipe);
  return text(lines.filter((l) => l.includes(pattern)).join("\n"));
});

register("head", async (args, pipe) => {
  const n = parseInt(args[0] ?? "10", 10);
  if (pipe.kind === "table") return { kind: "table", columns: pipe.columns, rows: pipe.rows.slice(0, n) };
  return text(valueToLines(pipe).slice(0, n).join("\n"));
});

register("tail", async (args, pipe) => {
  const n = parseInt(args[0] ?? "10", 10);
  if (pipe.kind === "table") return { kind: "table", columns: pipe.columns, rows: pipe.rows.slice(-n) };
  return text(valueToLines(pipe).slice(-n).join("\n"));
});

register("count", async (_args, pipe) => {
  if (pipe.kind === "table") return text(String(pipe.rows.length));
  const lines = valueToLines(pipe);
  return text(String(lines.length === 1 && lines[0] === "" ? 0 : lines.length));
});

register("select", async (args, pipe) => {
  if (pipe.kind !== "table") return pipe;
  const rows = pipe.rows.map((row) => {
    const out: Record<string, string> = {};
    for (const col of args) if (row[col] !== undefined) out[col] = row[col];
    return out;
  });
  return { kind: "table", columns: args, rows };
});

register("help", async () => {
  const names = [...commands.keys()].sort();
  return table(["command"], names.map((n) => ({ command: n })));
});

// ── Executor ─────────────────────────────────────────────────────

const resolveArg = async (arg: Arg): Promise<string> => {
  if (arg.kind === "literal") return arg.value;
  const result = await executeScript(arg.expr);
  return renderValue(result).trim();
};

const executeCommand = async (cmd: Command, pipeInput: Value): Promise<Value> => {
  const fn = commands.get(cmd.name);
  if (!fn) throw new Error(`unknown command: ${cmd.name}`);
  const args = await Promise.all(cmd.args.map(resolveArg));
  return fn(args, pipeInput);
};

const executePipeline = async (pipeline: Pipeline): Promise<Value> => {
  let value: Value = VOID;
  for (const cmd of pipeline.commands) {
    value = await executeCommand(cmd, value);
  }
  return value;
};

const executeScript = async (script: Script): Promise<Value> => {
  let last: Value = VOID;
  for (const pipeline of script.pipelines) {
    last = await executePipeline(pipeline);
  }
  return last;
};

// ── REPL message handler (from content script) ──────────────────

browser.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type !== "exec-repl") return;

  (async () => {
    try {
      const tokens = tokenize(msg.command);
      const ast = parse(tokens);
      const result = await executeScript(ast);
      sendResponse({ value: renderValue(result) });
    } catch (e: any) {
      sendResponse({ value: `error: ${e.message}` });
    }
  })();

  return true; // keep message channel open for async response
});

// ── WebSocket connection to daemon ───────────────────────────────

const DAEMON_URL = "ws://localhost:9231";
let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

const connect = () => {
  ws = new WebSocket(DAEMON_URL);

  ws.onopen = () => {
    console.log("[spike] connected to daemon");
    ws!.send(JSON.stringify({ type: "hello", role: "extension" }));
  };

  ws.onmessage = async (event) => {
    let msg: any;
    try {
      msg = JSON.parse(event.data as string);
    } catch {
      return;
    }

    if (msg.type !== "exec") return;

    try {
      const tokens = tokenize(msg.command);
      const ast = parse(tokens);
      const result = await executeScript(ast);
      ws?.send(JSON.stringify({ id: msg.id, type: "result", value: result }));
    } catch (e: any) {
      ws?.send(JSON.stringify({ id: msg.id, type: "error", message: e.message }));
    }
  };

  ws.onclose = () => {
    console.log("[spike] disconnected from daemon, reconnecting in 3s...");
    reconnectTimer = setTimeout(connect, 3000);
  };

  ws.onerror = () => {
    // onclose will fire after this
  };
};

connect();
