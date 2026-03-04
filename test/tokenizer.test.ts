import { describe, it, expect } from "bun:test";
import { tokenize, TokenizeError } from "../src/lang/index.ts";

const kinds = (input: string) => tokenize(input).map((t) => t.kind);
const values = (input: string) => tokenize(input).map((t) => t.value);

describe("tokenizer", () => {
  it("tokenizes bare words", () => {
    expect(kinds("list")).toEqual(["word", "eof"]);
    expect(values("close 3")).toEqual(["close", "3", ""]);
  });

  it("tokenizes pipes and semicolons", () => {
    expect(kinds("list | grep foo")).toEqual(["word", "pipe", "word", "word", "eof"]);
    expect(kinds("new a.com ; new b.com")).toEqual([
      "word", "word", "semicolon", "word", "word", "eof",
    ]);
  });

  it("tokenizes double-quoted strings", () => {
    expect(values('"hello world"')).toEqual(["hello world", ""]);
  });

  it("handles escape sequences in double quotes", () => {
    expect(values('"line\\nbreak"')).toEqual(["line\nbreak", ""]);
    expect(values('"tab\\there"')).toEqual(["tab\there", ""]);
    expect(values('"escaped\\"quote"')).toEqual(['escaped"quote', ""]);
  });

  it("tokenizes single-quoted strings (no escaping)", () => {
    expect(values("'hello world'")).toEqual(["hello world", ""]);
    expect(values("'no\\escapes'")).toEqual(["no\\escapes", ""]);
  });

  it("tokenizes subshell expressions", () => {
    expect(kinds("new $(bookmark.get foo)")).toEqual([
      "word", "subopen", "word", "word", "subclose", "eof",
    ]);
  });

  it("skips comments", () => {
    expect(kinds("list # this is a comment")).toEqual(["word", "eof"]);
    expect(kinds("# full comment\nlist")).toEqual(["word", "eof"]);
  });

  it("handles empty input", () => {
    expect(kinds("")).toEqual(["eof"]);
    expect(kinds("   ")).toEqual(["eof"]);
  });

  it("throws on unterminated double quote", () => {
    expect(() => tokenize('"unterminated')).toThrow(TokenizeError);
  });

  it("throws on unterminated single quote", () => {
    expect(() => tokenize("'unterminated")).toThrow(TokenizeError);
  });

  it("coerces unquoted urls as words", () => {
    expect(values("new example.com")).toEqual(["new", "example.com", ""]);
  });
});
