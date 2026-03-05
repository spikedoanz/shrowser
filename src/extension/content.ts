// Content script — command bar overlay (Ctrl+`) and DOM command handler.

import { config } from "../config.gen.ts";

// ── Command bar state ────────────────────────────────────────────

let bar: HTMLDivElement | null = null;
let input: HTMLInputElement | null = null;
let output: HTMLDivElement | null = null;
let statusHint: HTMLSpanElement | null = null;
let colonEl: HTMLSpanElement | null = null;
const history: string[] = [];
let historyIdx = -1;
let liveSeq = 0;

const STYLES = config.repl.styles;

const TABLE_CSS = STYLES.tableCss;

const createBar = () => {
  bar = document.createElement("div");
  bar.setAttribute("style", STYLES.bar);
  bar.id = "shrowser-cmdbar";

  // Inject scoped styles
  const style = document.createElement("style");
  style.textContent = TABLE_CSS;
  bar.appendChild(style);

  output = document.createElement("div");
  output.className = "shrowser-output";
  output.setAttribute("style", STYLES.output);

  const inputWrap = document.createElement("div");
  inputWrap.setAttribute("style", "position: relative; display: flex; align-items: center;");

  input = document.createElement("input");
  input.setAttribute("style", STYLES.input);
  input.setAttribute("placeholder", "");
  input.setAttribute("spellcheck", "false");

  statusHint = document.createElement("span");
  statusHint.setAttribute("style", STYLES.hint);

  inputWrap.appendChild(input);
  inputWrap.appendChild(statusHint);
  bar.appendChild(output);
  bar.appendChild(inputWrap);
  document.documentElement.appendChild(bar);

  input.addEventListener("keydown", onInputKey);
  input.addEventListener("input", onInputChange);
  input.addEventListener("blur", () => {
    setTimeout(() => {
      if (!bar?.contains(document.activeElement) && document.activeElement !== input) {
        hideBar();
      }
    }, 0);
  });
  output.setAttribute("tabindex", "-1");
  input.focus();
};

const showBar = () => {
  if (!bar) createBar();
  bar!.style.display = "";
  input!.value = "";
  output!.style.display = "none";
  output!.innerHTML = "";
  if (statusHint) statusHint.textContent = "";
  historyIdx = -1;
  input!.focus();
};

const hideBar = () => {
  if (bar) bar.style.display = "none";
};

// ── Render results ──────────────────────────────────────────────

type Value =
  | { kind: "void" }
  | { kind: "text"; data: string }
  | { kind: "table"; columns: string[]; rows: Record<string, string>[] };

const renderResult = (result: Value) => {
  if (!output) return;

  if (result.kind === "void" || (result.kind === "text" && !result.data)) {
    output.innerHTML = "";
    output.style.display = "none";
    return;
  }

  if (result.kind === "text") {
    const pre = document.createElement("div");
    pre.className = "shrowser-text";
    pre.textContent = result.data;
    output.innerHTML = "";
    output.appendChild(pre);
    output.style.display = "";
    return;
  }

  if (result.kind === "table") {
    if (result.rows.length === 0) {
      output.innerHTML = "";
      output.style.display = "none";
      return;
    }

    const tbl = document.createElement("table");
    tbl.className = "shrowser-table";

    for (const row of result.rows) {
      const tr = document.createElement("tr");
      for (const col of result.columns) {
        const td = document.createElement("td");
        td.className = `col-${col}`;
        td.textContent = row[col] ?? "";
        tr.appendChild(td);
      }
      tbl.appendChild(tr);
    }

    output.innerHTML = "";
    output.appendChild(tbl);
    output.style.display = "";
  }
};

const showText = (text: string) => {
  renderResult({ kind: "text", data: text });
};

// ── Live execution on input change ───────────────────────────────

const onInputChange = async () => {
  const cmd = input!.value.trim();
  if (!cmd) {
    renderResult({ kind: "void" });
    if (statusHint) statusHint.textContent = "";
    return;
  }

  const seq = ++liveSeq;

  try {
    const response = await browser.runtime.sendMessage({
      type: "exec-repl",
      command: cmd,
      live: true,
    });

    if (seq !== liveSeq) return;

    console.log("[shrowser] live response:", JSON.stringify(response)?.substring(0, 500));
    if (response?.impure) {
      if (statusHint) statusHint.textContent = "↵ enter to run";
    } else if (response?.result) {
      if (statusHint) statusHint.textContent = "";
      renderResult(response.result);
    } else if (response?.value) {
      if (statusHint) statusHint.textContent = "";
      showText(response.value);
    } else if (response?.parseError) {
      if (statusHint) statusHint.textContent = "? " + response.parseError;
    }
  } catch (err: any) {
    console.log("[shrowser] live error:", err?.message);
    // Keep showing last valid output
  }
};

// ── Keyboard handling ────────────────────────────────────────────

const onInputKey = async (e: KeyboardEvent) => {
  const isDismiss =
    config.repl.dismissKeys.includes(e.key) ||
    config.repl.dismissChords.some((c) => e.key === c.key && e[c.modifier as keyof KeyboardEvent]) ||
    (e.key === config.repl.toggleKey && e[config.repl.toggleModifier as keyof KeyboardEvent]);
  if (isDismiss) {
    e.preventDefault();
    e.stopPropagation();
    hideBar();
    return;
  }

  if (e.key === "Enter") {
    e.preventDefault();
    const cmd = input!.value.trim();
    if (!cmd) return;

    if (history[history.length - 1] !== cmd) history.push(cmd);
    historyIdx = -1;

    // Remove listener before clearing input to prevent onInputChange from wiping output
    input!.removeEventListener("input", onInputChange);
    input!.value = "";
    input!.addEventListener("input", onInputChange);
    if (statusHint) statusHint.textContent = "";
    showText("...");

    try {
      const response = await browser.runtime.sendMessage({
        type: "exec-repl",
        command: cmd,
      });
      console.log("[shrowser] Enter response:", JSON.stringify(response)?.substring(0, 500));
      if (response?.error) {
        showText(`error: ${response.error}`);
      } else if (response?.result) {
        console.log("[shrowser] rendering result kind:", response.result.kind);
        renderResult(response.result);
      } else if (response?.value) {
        console.log("[shrowser] rendering value fallback");
        showText(response.value);
      } else {
        console.log("[shrowser] no result or value, rendering void");
        renderResult({ kind: "void" });
      }
    } catch (err: any) {
      console.log("[shrowser] Enter error:", err.message);
      showText(`error: ${err.message}`);
    }
    return;
  }

  // History navigation
  if (e.key === "ArrowUp") {
    e.preventDefault();
    if (history.length === 0) return;
    if (historyIdx === -1) historyIdx = history.length;
    historyIdx = Math.max(0, historyIdx - 1);
    input!.value = history[historyIdx] ?? "";
    onInputChange();
    return;
  }

  if (e.key === "ArrowDown") {
    e.preventDefault();
    if (historyIdx === -1) return;
    historyIdx = Math.min(history.length, historyIdx + 1);
    input!.value = historyIdx === history.length ? "" : (history[historyIdx] ?? "");
    onInputChange();
    return;
  }
};

// ── Global Ctrl+` listener ───────────────────────────────────────

document.addEventListener("keydown", (e) => {
  if (e.key === config.repl.toggleKey && e[config.repl.toggleModifier as keyof KeyboardEvent]) {
    e.preventDefault();
    e.stopPropagation();
    if (bar && bar.style.display !== "none") {
      hideBar();
    } else {
      showBar();
    }
  }
}, true);

// ── DOM command handler (from background) ────────────────────────

browser.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "open-bar") {
    showBar();
    sendResponse({ ok: true });
    return;
  }
  if (msg.type === "dom-command") {
    sendResponse({ ok: true });
  }
});
