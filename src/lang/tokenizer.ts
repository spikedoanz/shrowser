import type { Token } from "./types.ts";

export class TokenizeError extends Error {
  constructor(
    message: string,
    public readonly pos: number,
  ) {
    super(`${message} at position ${pos}`);
  }
}

const isWhitespace = (ch: string): boolean => ch === " " || ch === "\t" || ch === "\r" || ch === "\n";

export const tokenize = (input: string): readonly Token[] => {
  const tokens: Token[] = [];
  let i = 0;

  while (i < input.length) {
    // skip whitespace
    if (isWhitespace(input[i]!)) {
      i++;
      continue;
    }

    // skip comments
    if (input[i] === "#") {
      while (i < input.length && input[i] !== "\n") i++;
      continue;
    }

    // pipe
    if (input[i] === "|") {
      tokens.push({ kind: "pipe", value: "|", pos: i });
      i++;
      continue;
    }

    // semicolon
    if (input[i] === ";") {
      tokens.push({ kind: "semicolon", value: ";", pos: i });
      i++;
      continue;
    }

    // subshell open: $(
    if (input[i] === "$" && input[i + 1] === "(") {
      tokens.push({ kind: "subopen", value: "$(", pos: i });
      i += 2;
      continue;
    }

    // subshell close: )
    if (input[i] === ")") {
      tokens.push({ kind: "subclose", value: ")", pos: i });
      i++;
      continue;
    }

    // double-quoted string
    if (input[i] === '"') {
      const start = i;
      i++; // skip opening quote
      let value = "";
      while (i < input.length && input[i] !== '"') {
        if (input[i] === "\\" && i + 1 < input.length) {
          const next = input[i + 1]!;
          if (next === '"' || next === "\\" || next === "n" || next === "t") {
            value += next === "n" ? "\n" : next === "t" ? "\t" : next;
            i += 2;
            continue;
          }
        }
        value += input[i];
        i++;
      }
      if (i >= input.length) throw new TokenizeError("unterminated double quote", start);
      i++; // skip closing quote
      tokens.push({ kind: "word", value, pos: start });
      continue;
    }

    // single-quoted string (no escaping)
    if (input[i] === "'") {
      const start = i;
      i++; // skip opening quote
      let value = "";
      while (i < input.length && input[i] !== "'") {
        value += input[i];
        i++;
      }
      if (i >= input.length) throw new TokenizeError("unterminated single quote", start);
      i++; // skip closing quote
      tokens.push({ kind: "word", value, pos: start });
      continue;
    }

    // bare word — anything not special
    const start = i;
    let value = "";
    while (
      i < input.length &&
      !isWhitespace(input[i]!) &&
      input[i] !== "|" &&
      input[i] !== ";" &&
      input[i] !== ")" &&
      input[i] !== '"' &&
      input[i] !== "'" &&
      !(input[i] === "$" && input[i + 1] === "(")
    ) {
      value += input[i];
      i++;
    }
    if (value.length > 0) {
      tokens.push({ kind: "word", value, pos: start });
    }
  }

  tokens.push({ kind: "eof", value: "", pos: i });
  return tokens;
};
