import type { Token, Arg, Command, Pipeline, Script } from "./types.ts";

export class ParseError extends Error {
  constructor(
    message: string,
    public readonly pos: number,
  ) {
    super(`${message} at position ${pos}`);
  }
}

type Parser<T> = (tokens: readonly Token[], pos: number) => [T, number];

const peek = (tokens: readonly Token[], pos: number): Token =>
  tokens[pos] ?? { kind: "eof" as const, value: "", pos: -1 };

const expect = (tokens: readonly Token[], pos: number, kind: Token["kind"]): number => {
  const tok = peek(tokens, pos);
  if (tok.kind !== kind) {
    throw new ParseError(`expected ${kind}, got ${tok.kind}`, tok.pos);
  }
  return pos + 1;
};

// arg = word | "$(" script ")"
const parseArg: Parser<Arg> = (tokens, pos) => {
  const tok = peek(tokens, pos);

  if (tok.kind === "subopen") {
    const [expr, next] = parseScript(tokens, pos + 1);
    return [{ kind: "subshell", expr }, expect(tokens, next, "subclose")];
  }

  if (tok.kind === "word") {
    return [{ kind: "literal", value: tok.value }, pos + 1];
  }

  throw new ParseError(`expected argument, got ${tok.kind}`, tok.pos);
};

// command = word arg*
const parseCommand: Parser<Command> = (tokens, pos) => {
  const nameTok = peek(tokens, pos);
  if (nameTok.kind !== "word") {
    throw new ParseError(`expected command name, got ${nameTok.kind}`, nameTok.pos);
  }

  const args: Arg[] = [];
  let cur = pos + 1;

  while (true) {
    const next = peek(tokens, cur);
    if (next.kind === "word" || next.kind === "subopen") {
      const [arg, after] = parseArg(tokens, cur);
      args.push(arg);
      cur = after;
    } else {
      break;
    }
  }

  return [{ kind: "command", name: nameTok.value, args }, cur];
};

// pipeline = command ("|" command)*
const parsePipeline: Parser<Pipeline> = (tokens, pos) => {
  const commands: Command[] = [];
  const [first, next] = parseCommand(tokens, pos);
  commands.push(first);
  let cur = next;

  while (peek(tokens, cur).kind === "pipe") {
    cur++; // skip pipe
    const [cmd, after] = parseCommand(tokens, cur);
    commands.push(cmd);
    cur = after;
  }

  return [{ kind: "pipeline", commands }, cur];
};

// script = pipeline (";" pipeline)*
const parseScript: Parser<Script> = (tokens, pos) => {
  const pipelines: Pipeline[] = [];

  // skip leading semicolons
  let cur = pos;
  while (peek(tokens, cur).kind === "semicolon") cur++;

  // empty script is valid (e.g., inside empty subshell)
  const next = peek(tokens, cur);
  if (next.kind === "eof" || next.kind === "subclose") {
    return [{ kind: "script", pipelines }, cur];
  }

  const [first, afterFirst] = parsePipeline(tokens, cur);
  pipelines.push(first);
  cur = afterFirst;

  while (peek(tokens, cur).kind === "semicolon") {
    cur++; // skip semicolon
    // trailing semicolons are fine
    const tok = peek(tokens, cur);
    if (tok.kind === "eof" || tok.kind === "subclose") break;
    const [pipeline, after] = parsePipeline(tokens, cur);
    pipelines.push(pipeline);
    cur = after;
  }

  return [{ kind: "script", pipelines }, cur];
};

export const parse = (tokens: readonly Token[]): Script => {
  const [script, pos] = parseScript(tokens, 0);
  const remaining = peek(tokens, pos);
  if (remaining.kind !== "eof") {
    throw new ParseError(`unexpected token: ${remaining.kind}`, remaining.pos);
  }
  return script;
};
