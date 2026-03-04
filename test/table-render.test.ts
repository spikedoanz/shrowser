import { describe, it, expect } from "bun:test";
import { renderValue, table } from "../src/commands/types.ts";

// Strip ANSI escape codes for assertion clarity
const strip = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, "");

describe("table rendering", () => {
  it("renders a simple table without folding when it fits", () => {
    const v = table(["id", "name"], [
      { id: "1", name: "alpha" },
      { id: "2", name: "beta" },
    ]);
    const out = strip(renderValue(v, 80));
    const lines = out.split("\n");
    expect(lines).toHaveLength(4); // header + sep + 2 rows
    expect(lines[0]).toContain("id");
    expect(lines[0]).toContain("name");
  });

  it("folds long cell values onto multiple lines", () => {
    const v = table(["id", "url"], [
      { id: "1", url: "https://example.com/very/long/path/that/will/not/fit" },
    ]);
    const out = strip(renderValue(v, 30));
    const lines = out.split("\n");
    // header + sep = 2, then row should be more than 1 line
    expect(lines.length).toBeGreaterThan(3);
    // Reassemble the url fragments from the row lines (skip header + sep)
    const rowLines = lines.slice(2);
    const urlParts = rowLines.map((l) => l.slice(l.indexOf("  ")).trim());
    expect(urlParts.join("")).toBe("https://example.com/very/long/path/that/will/not/fit");
  });

  it("aligns folded rows — short columns padded on continuation lines", () => {
    const v = table(["id", "url"], [
      { id: "1", url: "abcdefghijklmnopqrstuvwxyz" },
    ]);
    const out = strip(renderValue(v, 20));
    const lines = out.split("\n");
    const rowLines = lines.slice(2);
    // The "id" column should be blank-padded on continuation lines
    for (const line of rowLines.slice(1)) {
      expect(line.trimStart().length).toBeLessThan(line.length);
    }
  });

  it("handles multiple rows where some fold and some don't", () => {
    const v = table(["n", "val"], [
      { n: "1", val: "short" },
      { n: "2", val: "this-is-a-much-longer-value-that-needs-folding" },
      { n: "3", val: "ok" },
    ]);
    const out = strip(renderValue(v, 25));
    expect(out).toContain("short");
    expect(out).toContain("this-is-a-much-longer-");
  });

  it("alternates row background colors", () => {
    const v = table(["id"], [
      { id: "a" },
      { id: "b" },
      { id: "c" },
    ]);
    const out = renderValue(v, 80);
    const lines = out.split("\n");
    const rowLines = lines.slice(2); // skip header + sep
    // Even rows use 236, odd rows use 238
    expect(rowLines[0]).toContain("\x1b[48;5;236m");
    expect(rowLines[1]).toContain("\x1b[48;5;238m");
    expect(rowLines[2]).toContain("\x1b[48;5;236m");
  });
});
