import { describe, it, expect } from "bun:test";
import { run } from "../src/runtime/index.ts";
import { renderValue } from "../src/commands/types.ts";
import { register } from "../src/commands/registry.ts";
import { text, table } from "../src/commands/types.ts";

// Ensure built-ins are loaded
import "../src/commands/util.ts";

// Register a test command that returns a table
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

  it("executes count on text", async () => {
    expect(await exec('echo "a\\nb\\nc" | count')).toBe("3");
  });

  it("executes semicolon-separated pipelines", async () => {
    // last pipeline's result is returned
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

  it("select picks columns from table", async () => {
    const result = await run("test-table | select name");
    expect(result.kind).toBe("table");
    if (result.kind === "table") {
      expect(result.columns).toEqual(["name"]);
      expect(result.rows[0]).toEqual({ name: "alpha" });
    }
  });

  it("head works on tables", async () => {
    const result = await run("test-table | head 1");
    expect(result.kind).toBe("table");
    if (result.kind === "table") {
      expect(result.rows).toHaveLength(1);
    }
  });

  it("count works on tables", async () => {
    expect(await exec("test-table | count")).toBe("3");
  });

  it("throws on unknown command", async () => {
    expect(run("nonexistent")).rejects.toThrow("unknown command");
  });

  it("help returns a table", async () => {
    const result = await run("help");
    expect(result.kind).toBe("table");
  });
});
