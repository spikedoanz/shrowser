import type { Script, Pipeline, Command, Arg } from "../lang/types.ts";
import { lookup } from "../commands/registry.ts";
import { VOID, renderValue } from "../commands/types.ts";
import type { Value } from "../commands/types.ts";

export class ExecutionError extends Error {}

const resolveArg = async (arg: Arg): Promise<string> => {
  switch (arg.kind) {
    case "literal":
      return arg.value;
    case "subshell": {
      const result = await executeScript(arg.expr);
      return renderValue(result).trim();
    }
  }
};

const executeCommand = async (cmd: Command, pipeInput: Value): Promise<Value> => {
  const def = lookup(cmd.name);
  if (!def) throw new ExecutionError(`unknown command: ${cmd.name}`);
  const args = await Promise.all(cmd.args.map(resolveArg));
  return def.execute(args, pipeInput);
};

const executePipeline = async (pipeline: Pipeline): Promise<Value> => {
  let value: Value = VOID;
  for (const cmd of pipeline.commands) {
    value = await executeCommand(cmd, value);
  }
  return value;
};

export const executeScript = async (script: Script): Promise<Value> => {
  let last: Value = VOID;
  for (const pipeline of script.pipelines) {
    last = await executePipeline(pipeline);
  }
  return last;
};

// Convenience: parse + execute a string
export const run = async (input: string): Promise<Value> => {
  const { tokenize } = await import("../lang/tokenizer.ts");
  const { parse } = await import("../lang/parser.ts");
  const tokens = tokenize(input);
  const ast = parse(tokens);
  return executeScript(ast);
};
