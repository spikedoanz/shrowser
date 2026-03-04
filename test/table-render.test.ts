import { describe, it, expect } from "bun:test";
import { renderValue, table } from "../src/commands/types.ts";

describe("table rendering", () => {
  it("renders idx and title inline with tab indent", () => {
    const v = table(["idx", "title", "url"], [
      { idx: "0", title: "GitHub", url: "https://github.com" },
    ]);
    const out = renderValue(v);
    expect(out).toContain("\t0 GitHub");
    expect(out).toContain("https://github.com");
    // url should NOT be tab-indented
    const urlLine = out.split("\n").find((l) => l.includes("https://github.com"))!;
    expect(urlLine).not.toMatch(/^\t/);
  });

  it("wraps active tab index in parens", () => {
    const v = table(["idx", "title", "active"], [
      { idx: "3", title: "Active Tab", active: "*" },
    ]);
    const out = renderValue(v);
    expect(out).toContain("\t(3) Active Tab");
  });

  it("wraps pinned tab index in brackets", () => {
    const v = table(["idx", "title", "pinned"], [
      { idx: "1", title: "Pinned Tab", pinned: "pin" },
    ]);
    const out = renderValue(v);
    expect(out).toContain("\t[1] Pinned Tab");
  });

  it("wraps active+pinned tab as ([idx])", () => {
    const v = table(["idx", "title", "active", "pinned"], [
      { idx: "2", title: "Both", active: "*", pinned: "pin" },
    ]);
    const out = renderValue(v);
    expect(out).toContain("\t([2]) Both");
  });

  it("plain tab has no brackets or parens", () => {
    const v = table(["idx", "title", "active", "pinned"], [
      { idx: "5", title: "Plain", active: "", pinned: "" },
    ]);
    const out = renderValue(v);
    expect(out).toContain("\t5 Plain");
    expect(out).not.toContain("(5)");
    expect(out).not.toContain("[5]");
  });

  it("shows url on its own line", () => {
    const v = table(["idx", "title", "url"], [
      { idx: "0", title: "Test", url: "https://example.com" },
    ]);
    const lines = renderValue(v).split("\n");
    expect(lines[1]).toBe("https://example.com");
  });

  it("shows extra fields below url", () => {
    const v = table(["idx", "title", "url", "muted"], [
      { idx: "0", title: "Tab", url: "https://a.com", muted: "yes" },
    ]);
    const out = renderValue(v);
    expect(out).toContain("muted: yes");
    const mutedLine = out.split("\n").find((l) => l.includes("muted"))!;
    expect(mutedLine).not.toMatch(/^\t/);
  });

  it("omits empty fields", () => {
    const v = table(["idx", "title", "url", "muted"], [
      { idx: "0", title: "Tab", url: "https://a.com", muted: "" },
    ]);
    const out = renderValue(v);
    expect(out).not.toContain("muted");
  });

  it("falls back to row index when no idx column", () => {
    const v = table(["name"], [{ name: "alpha" }]);
    const out = renderValue(v);
    expect(out).toContain("\t0 alpha");
  });

  it("no ANSI codes in output", () => {
    const v = table(["idx", "title", "active"], [
      { idx: "0", title: "Tab", active: "*" },
    ]);
    const out = renderValue(v);
    expect(out).not.toContain("\x1b[");
  });

  it("pipes cleanly — no color codes to strip", () => {
    const v = table(["idx", "title"], [
      { idx: "0", title: "First" },
      { idx: "1", title: "Second" },
    ]);
    const out = renderValue(v);
    // Every line should be plain text
    for (const line of out.split("\n")) {
      expect(line).not.toMatch(/\x1b/);
    }
  });
});
