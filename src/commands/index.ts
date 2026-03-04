export { register, lookup, all } from "./registry.ts";
export type { CommandDef, CommandFn, Value } from "./types.ts";
export { text, table, VOID, renderValue, valueToLines } from "./types.ts";

// Register built-in commands
import "./util.ts";
