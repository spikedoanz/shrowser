import { describe, it, expect } from "bun:test";
import { renderValue, table } from "../src/commands/types.ts";

// Strip ANSI escape codes for assertion clarity
const strip = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, "");

describe("table rendering", () => {
  it("renders records with key: value fields", () => {
    const v = table(["id", "name"], [
      { id: "1", name: "alpha" },
      { id: "2", name: "beta" },
    ]);
    const out = strip(renderValue(v));
    expect(out).toContain("id  : 1");
    expect(out).toContain("name: alpha");
    expect(out).toContain("name: beta");
  });

  it("omits empty fields", () => {
    const v = table(["id", "name", "note"], [
      { id: "1", name: "alpha", note: "" },
    ]);
    const out = strip(renderValue(v));
    expect(out).toContain("id  :");
    expect(out).toContain("name:");
    expect(out).not.toContain("note");
  });

  it("handles long values naturally without truncation", () => {
    const v = table(["id", "url"], [
      { id: "1", url: "https://example.com/very/long/path/that/would/have/been/truncated" },
    ]);
    const out = strip(renderValue(v));
    expect(out).toContain("https://example.com/very/long/path/that/would/have/been/truncated");
  });

  it("highlights active rows in green", () => {
    const v = table(["title", "active"], [
      { title: "inactive tab", active: "" },
      { title: "active tab", active: "*" },
    ]);
    const out = renderValue(v);
    // Active row should contain green ANSI code
    expect(out).toContain("\x1b[32mactive tab\x1b[0m");
    // Inactive row should not have green
    expect(out).not.toContain("\x1b[32minactive tab");
  });

  it("separates rows with blank lines", () => {
    const v = table(["id"], [
      { id: "a" },
      { id: "b" },
    ]);
    const out = strip(renderValue(v));
    expect(out).toContain("\n\n");
  });

  it("numbers rows", () => {
    const v = table(["name"], [
      { name: "first" },
      { name: "second" },
    ]);
    const out = strip(renderValue(v));
    expect(out).toContain("─ 0");
    expect(out).toContain("─ 1");
  });
});
