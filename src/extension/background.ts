// Background script — connects to the daemon via WebSocket,
// receives commands, executes them using browser APIs, sends results back.

import type { Value } from "../commands/types.ts";
import { text, table, VOID, renderValue, valueToLines } from "../commands/types.ts";
import { tokenize } from "../lang/tokenizer.ts";
import { parse } from "../lang/parser.ts";
import type { Script, Pipeline, Command, Arg } from "../lang/types.ts";
import { config } from "../config.gen.ts";

// ── Command registry (browser-side) ─────────────────────────────

type CommandFn = (args: readonly string[], pipe: Value) => Promise<Value>;
type CommandEntry = { fn: CommandFn; usage: string; desc: string; pure: boolean };
const commands = new Map<string, CommandEntry>();

const impure = new Set(["close", "new", "jump", "search", "reload", "pin", "mute"]);

const register = (name: string, usage: string, desc: string, fn: CommandFn) =>
  commands.set(name, { fn, usage, desc, pure: !impure.has(name) });

const alias = (short: string, long: string) => {
  const entry = commands.get(long);
  if (entry) commands.set(short, entry);
};

// Check if a script is pure (all commands are side-effect-free)
const isScriptPure = (script: Script): boolean =>
  script.pipelines.every((p) =>
    p.commands.every((c) => {
      const entry = commands.get(c.name);
      if (!entry) return false;
      // Check subshell args too
      return entry.pure && c.args.every((a) =>
        a.kind === "literal" || (a.kind === "subshell" && isScriptPure(a.expr)),
      );
    }),
  );

// ── Built-in browser commands ────────────────────────────────────

register("list", "list [pattern]", "list tabs, optionally filtering by pattern", async (args, _pipe) => {
  const all = await listTabs();
  const pattern = args[0];
  if (!pattern || all.kind !== "table") return all;
  const lower = pattern.toLowerCase();
  const matching = all.rows.filter((row) =>
    all.columns.some((col) => (row[col] ?? "").toLowerCase().includes(lower)),
  );
  return { kind: "table", columns: all.columns, rows: matching };
});

register("close", "close [idx]", "close tab by index, piped table, or current tab", async (args, pipe) => {
  if (args.length > 0) {
    const idx = parseInt(args[0]!, 10);
    const tabs = await browser.tabs.query({});
    const tab = tabs[idx];
    if (tab?.id) await browser.tabs.remove(tab.id);
  } else if (pipe.kind === "table") {
    const tabs = await browser.tabs.query({});
    const ids: number[] = [];
    for (const row of pipe.rows) {
      const idx = parseInt(row["idx"] ?? "", 10);
      if (!isNaN(idx)) {
        const tab = tabs[idx];
        if (tab?.id) ids.push(tab.id);
      }
    }
    if (ids.length > 0) await browser.tabs.remove(ids);
  } else {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) await browser.tabs.remove(tab.id);
  }
  return VOID;
});

register("new", "new <url>", "open a new tab, auto-prepends https://", async (args, _pipe) => {
  let url = args[0] ?? "about:blank";
  if (url && !url.includes("://") && !url.includes(":")) {
    url = "https://" + url;
  }
  await browser.tabs.create({ url });
  return VOID;
});

register("jump", "jump <idx | string>", "switch to tab by index or search title/url", async (args, pipe) => {
  const arg = args[0] ?? (pipe.kind === "table" && pipe.rows[0]?.["idx"]) ?? "0";
  const tabs = await browser.tabs.query({});

  const idx = parseInt(arg, 10);
  if (!isNaN(idx) && String(idx) === arg.trim() && tabs[idx]?.id) {
    await browser.tabs.update(tabs[idx]!.id!, { active: true });
    return VOID;
  }

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

register("search", "search <query...>", "search with default engine", async (args, _pipe) => {
  const query = args.join(" ");
  await browser.search.search({ query, tabId: undefined });
  return VOID;
});

register("reload", "reload", "reload current tab", async (_args, _pipe) => {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) await browser.tabs.reload(tab.id);
  return VOID;
});

register("pin", "pin [idx]", "toggle pin on tab", async (args, _pipe) => {
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

register("mute", "mute [idx]", "toggle mute on tab", async (args, _pipe) => {
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

const listTabs = async (): Promise<Value> => {
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
};

register("grep", "grep [pattern]", "filter tabs (or piped input) by pattern", async (args, pipe) => {
  // No pipe and no pattern — just list tabs
  if (pipe.kind === "void" && !args[0]) return listTabs();

  const pattern = args[0] ?? "";
  const lower = pattern.toLowerCase();

  // No pipe — grep over tabs
  if (pipe.kind === "void") {
    const all = await listTabs();
    if (all.kind !== "table") return all;
    const matching = all.rows.filter((row) =>
      all.columns.some((col) => (row[col] ?? "").toLowerCase().includes(lower)),
    );
    return { kind: "table", columns: all.columns, rows: matching };
  }

  if (pipe.kind === "table") {
    const matching = pipe.rows.filter((row) =>
      pipe.columns.some((col) => (row[col] ?? "").toLowerCase().includes(lower)),
    );
    return { kind: "table", columns: pipe.columns, rows: matching };
  }
  const lines = valueToLines(pipe);
  return text(lines.filter((l) => l.toLowerCase().includes(lower)).join("\n"));
});

register("head", "head [n=10]", "take first N lines or rows", async (args, pipe) => {
  const n = parseInt(args[0] ?? "10", 10);
  if (pipe.kind === "table") return { kind: "table", columns: pipe.columns, rows: pipe.rows.slice(0, n) };
  return text(valueToLines(pipe).slice(0, n).join("\n"));
});

register("tail", "tail [n=10]", "take last N lines or rows", async (args, pipe) => {
  const n = parseInt(args[0] ?? "10", 10);
  if (pipe.kind === "table") return { kind: "table", columns: pipe.columns, rows: pipe.rows.slice(-n) };
  return text(valueToLines(pipe).slice(-n).join("\n"));
});

// Aliases defined before help so help can display them
const aliases: Record<string, string> = {
  l: "list", c: "close", n: "new", j: "jump", s: "search",
  r: "reload", p: "pin", m: "mute", h: "head", t: "tail",
};

for (const [short, long] of Object.entries(aliases)) alias(short, long);

register("help", "help", "list available commands", async () => {
  const seen = new Set<CommandEntry>();
  const reverseAlias = new Map<string, string>();
  for (const [short, long] of Object.entries(aliases)) reverseAlias.set(long, short);
  reverseAlias.set("help", "?");

  const entries = [...commands.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .filter(([name, entry]) => {
      if (seen.has(entry)) return false;
      seen.add(entry);
      return true;
    });

  return table(
    ["command", "usage", "desc"],
    entries.map(([name, entry]) => {
      const short = reverseAlias.get(name);
      const label = short && name.startsWith(short)
        ? `[${short}]${name.slice(short.length)}`
        : short ? `${name} [${short}]` : name;
      return { command: label, usage: entry.usage, desc: entry.desc };
    }),
  );
});

alias("?", "help");

// ── Executor ─────────────────────────────────────────────────────

const resolveArg = async (arg: Arg): Promise<string> => {
  if (arg.kind === "literal") return arg.value;
  const result = await executeScript(arg.expr);
  return renderValue(result).trim();
};

const executeCommand = async (cmd: Command, pipeInput: Value): Promise<Value> => {
  const entry = commands.get(cmd.name);
  if (!entry) throw new Error(`unknown command: ${cmd.name}`);
  const args = await Promise.all(cmd.args.map(resolveArg));
  return entry.fn(args, pipeInput);
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

const openBarOnActiveTab = async () => {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    try { await browser.tabs.sendMessage(tab.id, { type: "open-bar" }); } catch {}
  }
};

browser.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type !== "exec-repl") return;

  const senderTabId = _sender.tab?.id;

  (async () => {
    try {
      const tokens = tokenize(msg.command);
      const ast = parse(tokens);

      // In live mode, refuse to execute impure commands
      if (msg.live && !isScriptPure(ast)) {
        sendResponse({ impure: true });
        return;
      }

      const result = await executeScript(ast);
      sendResponse({ result, value: renderValue(result) });

      // If the active tab changed (e.g. jump, close), open bar on the new tab
      if (!msg.live && senderTabId != null) {
        const [active] = await browser.tabs.query({ active: true, currentWindow: true });
        if (active?.id && active.id !== senderTabId) {
          openBarOnActiveTab();
        }
      }
    } catch (e: any) {
      // In live mode, swallow parse/unknown-command errors silently
      if (msg.live) {
        sendResponse({});
      } else {
        sendResponse({ error: e.message });
      }
    }
  })();

  return true; // keep message channel open for async response
});

// ── WebSocket connection to daemon ───────────────────────────────

const DAEMON_URL = `ws://localhost:${config.daemon.port}`;
let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

const connect = () => {
  ws = new WebSocket(DAEMON_URL);

  ws.onopen = () => {
    console.log("[shrowser] connected to daemon");
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
    console.log("[shrowser] disconnected from daemon, reconnecting in 3s...");
    reconnectTimer = setTimeout(connect, 3000);
  };

  ws.onerror = () => {
    // onclose will fire after this
  };
};

connect();
