// Content script — command bar overlay (Ctrl+`) and DOM command handler.

// ── Command bar state ────────────────────────────────────────────

let bar: HTMLDivElement | null = null;
let input: HTMLInputElement | null = null;
let output: HTMLPreElement | null = null;
const history: string[] = [];
let historyIdx = -1;

const STYLES = {
  bar: `
    position: fixed; top: 0; left: 0; right: 0; z-index: 2147483647;
    background: #1e1e1e; border-bottom: 1px solid #444;
    font-family: monospace; font-size: 14px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.5);
  `,
  input: `
    width: 100%; box-sizing: border-box;
    background: #1e1e1e; color: #e0e0e0; border: none; outline: none;
    font-family: monospace; font-size: 14px;
    padding: 8px 12px;
  `,
  output: `
    margin: 0; padding: 8px 12px;
    background: #252525; color: #ccc;
    font-family: monospace; font-size: 13px;
    max-height: 60vh; overflow-y: auto;
    white-space: pre-wrap; word-break: break-all;
    border-top: 1px solid #333;
    display: none;
  `,
};

const createBar = () => {
  bar = document.createElement("div");
  bar.setAttribute("style", STYLES.bar);
  bar.id = "spike-cmdbar";

  input = document.createElement("input");
  input.setAttribute("style", STYLES.input);
  input.setAttribute("placeholder", "spike>");
  input.setAttribute("spellcheck", "false");

  output = document.createElement("pre");
  output.setAttribute("style", STYLES.output);

  bar.appendChild(input);
  bar.appendChild(output);
  document.documentElement.appendChild(bar);

  input.addEventListener("keydown", onInputKey);
  input.focus();
};

const showBar = () => {
  if (!bar) createBar();
  bar!.style.display = "";
  input!.value = "";
  output!.style.display = "none";
  output!.textContent = "";
  historyIdx = -1;
  input!.focus();
};

const hideBar = () => {
  if (bar) bar.style.display = "none";
};

const showOutput = (text: string) => {
  if (!output) return;
  output.textContent = text;
  output.style.display = text ? "" : "none";
};

// ── Keyboard handling ────────────────────────────────────────────

const onInputKey = async (e: KeyboardEvent) => {
  if (e.key === "Escape" || (e.key === "`" && e.ctrlKey)) {
    e.preventDefault();
    e.stopPropagation();
    hideBar();
    return;
  }

  if (e.key === "Enter") {
    e.preventDefault();
    const cmd = input!.value.trim();
    if (!cmd) return;

    // Push to history
    if (history[history.length - 1] !== cmd) history.push(cmd);
    historyIdx = -1;

    input!.value = "";
    showOutput("...");

    try {
      const response = await browser.runtime.sendMessage({
        type: "exec-repl",
        command: cmd,
      });
      showOutput(response?.value ?? "");
    } catch (err: any) {
      showOutput(`error: ${err.message}`);
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
    return;
  }

  if (e.key === "ArrowDown") {
    e.preventDefault();
    if (historyIdx === -1) return;
    historyIdx = Math.min(history.length, historyIdx + 1);
    input!.value = historyIdx === history.length ? "" : (history[historyIdx] ?? "");
    return;
  }
};

// ── Global Ctrl+` listener ───────────────────────────────────────

document.addEventListener("keydown", (e) => {
  if (e.key === "`" && e.ctrlKey) {
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
  if (msg.type === "dom-command") {
    sendResponse({ ok: true });
  }
});
