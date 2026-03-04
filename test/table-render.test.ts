import { describe, it, expect } from "bun:test";
import { renderValue, table } from "../src/commands/types.ts";

// Strip ANSI escape codes for assertion clarity
const strip = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, "");

describe("table rendering", () => {
  it("renders idx and title inline", () => {
    const v = table(["idx", "title", "url"], [
      { idx: "0", title: "GitHub", url: "https://github.com" },
    ]);
    const out = strip(renderValue(v));
    expect(out).toContain("0: GitHub");
  });

  it("renders url on its own line without background", () => {
    const v = table(["idx", "title", "url"], [
      { idx: "0", title: "GitHub", url: "https://github.com" },
    ]);
    const raw = renderValue(v);
    const lines = raw.split("\n");
    // URL line should not contain background escape codes (48;5;)
    const urlLine = lines.find((l) => strip(l).includes("https://github.com"))!;
    expect(urlLine).not.toContain("\x1b[48;5;");
  });

  it("alternates grey backgrounds on main lines", () => {
    const v = table(["idx", "title"], [
      { idx: "0", title: "First" },
      { idx: "1", title: "Second" },
      { idx: "2", title: "Third" },
    ]);
    const raw = renderValue(v);
    const lines = raw.split("\n");
    expect(lines[0]).toContain("\x1b[48;5;236m"); // even = dark
    expect(lines[1]).toContain("\x1b[48;5;238m"); // odd = light
    expect(lines[2]).toContain("\x1b[48;5;236m"); // even again
  });

  it("highlights active rows in green", () => {
    const v = table(["idx", "title", "active"], [
      { idx: "0", title: "Inactive", active: "" },
      { idx: "1", title: "Active", active: "*" },
    ]);
    const raw = renderValue(v);
    expect(raw).toContain("\x1b[32m");
    expect(raw).not.toContain("\x1b[32m 0: Inactive");
  });

  it("falls back to row index when no idx column", () => {
    const v = table(["name"], [
      { name: "alpha" },
    ]);
    const out = strip(renderValue(v));
    expect(out).toContain("0: alpha");
  });

  it("uses name column when no title column", () => {
    const v = table(["name"], [
      { name: "alpha" },
    ]);
    const out = strip(renderValue(v));
    expect(out).toContain("alpha");
  });

  it("shows extra fields below url", () => {
    const v = table(["idx", "title", "url", "pinned"], [
      { idx: "0", title: "Tab", url: "https://a.com", pinned: "yes" },
    ]);
    const out = strip(renderValue(v));
    expect(out).toContain("pinned: yes");
  });

  it("omits empty fields", () => {
    const v = table(["idx", "title", "url", "pinned"], [
      { idx: "0", title: "Tab", url: "https://a.com", pinned: "" },
    ]);
    const out = strip(renderValue(v));
    expect(out).not.toContain("pinned");
  });
});
