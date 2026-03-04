// AST types for the spike-browser command language

export type Arg =
  | { readonly kind: "literal"; readonly value: string }
  | { readonly kind: "subshell"; readonly expr: Script };

export type Command = {
  readonly kind: "command";
  readonly name: string;
  readonly args: readonly Arg[];
};

export type Pipeline = {
  readonly kind: "pipeline";
  readonly commands: readonly Command[];
};

export type Script = {
  readonly kind: "script";
  readonly pipelines: readonly Pipeline[];
};

// Token types produced by the tokenizer

export type TokenKind =
  | "word"       // unquoted word or quoted string (value is unescaped)
  | "pipe"       // |
  | "semicolon"  // ;
  | "subopen"    // $(
  | "subclose"   // )
  | "eof";

export type Token = {
  readonly kind: TokenKind;
  readonly value: string;
  readonly pos: number;
};
