#!/usr/bin/env bun
// Validates config.cue, generates src/config.gen.ts, then bundles the extension.

import { build } from "esbuild";
import { cpSync } from "fs";

// ── Validate config and generate typed module ────────────────────

const cueResult = Bun.spawnSync(["cue", "export", "config.cue", "--out", "json"]);
if (cueResult.exitCode !== 0) {
  console.error("config.cue validation failed:");
  console.error(cueResult.stderr.toString());
  process.exit(1);
}

const config = JSON.parse(cueResult.stdout.toString());
const genTs = `// AUTO-GENERATED from config.cue — do not edit.
export const config = ${JSON.stringify(config, null, 2)} as const;
`;

await Bun.write("src/config.gen.ts", genTs);

// ── Bundle extension ─────────────────────────────────────────────

const target = config.build.target;

await Promise.all([
  build({
    entryPoints: ["src/extension/background.ts"],
    bundle: true,
    outfile: "dist/extension/background.js",
    format: "iife",
    target,
    define: { "process.env.NODE_ENV": '"production"' },
  }),
  build({
    entryPoints: ["src/extension/content.ts"],
    bundle: true,
    outfile: "dist/extension/content.js",
    format: "iife",
    target,
    define: { "process.env.NODE_ENV": '"production"' },
  }),
]);

cpSync("src/extension/manifest.json", "dist/extension/manifest.json");

console.log("built dist/extension/");
