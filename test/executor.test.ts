import { describe, it, expect } from "bun:test";
import { run } from "../src/runtime/index.ts";
import { renderValue } from "../src/commands/types.ts";
import { register } from "../src/commands/registry.ts";
import { text, table } from "../src/commands/types.ts";

// Ensure built-ins are loaded
import "../src/commands/util.ts";

// Register test helpers
register("echo", "echo arguments or pipe input", async (args, pipe) => {
  if (args.length > 0) return text(args.join(" "));
  if (pipe.kind !== "void") return pipe;
  return text("");
});

register("test-table", "test table", async () =>
  table(["id", "name"], [
    { id: "1", name: "alpha" },
    { id: "2", name: "beta" },
    { id: "3", name: "gamma" },
  ]),
);

const exec = async (input: string) => renderValue(await run(input));

describe("executor", () => {
  it("executes echo", async () => {
    expect(await exec("echo hello world")).toBe("hello world");
  });

  it("executes a pipeline", async () => {
    expect(await exec('echo "one\\ntwo\\nthree" | head 2')).toBe("one\ntwo");
  });

  it("executes grep on text", async () => {
    expect(await exec('echo "apple\\nbanana\\napricot" | grep ap')).toBe("apple\napricot");
  });

  it("executes tail", async () => {
    expect(await exec('echo "a\\nb\\nc\\nd" | tail 2')).toBe("c\nd");
  });

  it("executes semicolon-separated pipelines", async () => {
    expect(await exec("echo first ; echo second")).toBe("second");
  });

  it("executes subshell", async () => {
    expect(await exec("echo $(echo nested)")).toBe("nested");
  });

  it("grep filters table rows", async () => {
    const result = await run("test-table | grep alpha");
    expect(result.kind).toBe("table");
    if (result.kind === "table") {
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]!.name).toBe("alpha");
    }
  });

  it("head works on tables", async () => {
    const result = await run("test-table | head 1");
    expect(result.kind).toBe("table");
    if (result.kind === "table") {
      expect(result.rows).toHaveLength(1);
    }
  });

  it("throws on unknown command", async () => {
    expect(run("nonexistent")).rejects.toThrow("unknown command");
  });

});
