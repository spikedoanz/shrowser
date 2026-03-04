import { describe, it, expect } from "bun:test";
import { tokenize, parse, ParseError } from "../src/lang/index.ts";
import type { Script } from "../src/lang/index.ts";

const run = (input: string): Script => parse(tokenize(input));

describe("parser", () => {
  it("parses a simple command", () => {
    const ast = run("list");
    expect(ast).toEqual({
      kind: "script",
      pipelines: [
        {
          kind: "pipeline",
          commands: [{ kind: "command", name: "list", args: [] }],
        },
      ],
    });
  });

  it("parses command with arguments", () => {
    const ast = run("close 3");
    expect(ast.pipelines[0]!.commands[0]).toEqual({
      kind: "command",
      name: "close",
      args: [{ kind: "literal", value: "3" }],
    });
  });

  it("parses a pipeline", () => {
    const ast = run("list | grep github | close");
    expect(ast.pipelines).toHaveLength(1);
    const cmds = ast.pipelines[0]!.commands;
    expect(cmds).toHaveLength(3);
    expect(cmds.map((c) => c.name)).toEqual(["list", "grep", "close"]);
  });

  it("parses semicolon-separated pipelines", () => {
    const ast = run("new a.com ; new b.com");
    expect(ast.pipelines).toHaveLength(2);
    expect(ast.pipelines[0]!.commands[0]!.name).toBe("new");
    expect(ast.pipelines[1]!.commands[0]!.name).toBe("new");
  });

  it("parses subshell arguments", () => {
    const ast = run("new $(bookmark.get reading)");
    const cmd = ast.pipelines[0]!.commands[0]!;
    expect(cmd.args).toHaveLength(1);
    const arg = cmd.args[0]!;
    expect(arg.kind).toBe("subshell");
    if (arg.kind === "subshell") {
      expect(arg.expr.pipelines[0]!.commands[0]!.name).toBe("bookmark.get");
    }
  });

  it("parses nested subshells", () => {
    const ast = run("echo $(echo $(echo hi))");
    const arg = ast.pipelines[0]!.commands[0]!.args[0]!;
    expect(arg.kind).toBe("subshell");
  });

  it("handles trailing semicolons", () => {
    const ast = run("list ;");
    expect(ast.pipelines).toHaveLength(1);
  });

  it("handles leading semicolons", () => {
    const ast = run("; list");
    expect(ast.pipelines).toHaveLength(1);
  });

  it("handles empty input", () => {
    const ast = run("");
    expect(ast.pipelines).toHaveLength(0);
  });

  it("throws on pipe with no right-hand command", () => {
    expect(() => run("list |")).toThrow(ParseError);
  });

  it("parses search with unquoted multi-word args", () => {
    const ast = run("search where is mount everest");
    const cmd = ast.pipelines[0]!.commands[0]!;
    expect(cmd.name).toBe("search");
    expect(cmd.args.map((a) => a.kind === "literal" ? a.value : "")).toEqual([
      "where", "is", "mount", "everest",
    ]);
  });
});
