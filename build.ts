#!/usr/bin/env bun
// Bundles the extension's background + content scripts for Firefox.

import { build } from "esbuild";
import { cpSync } from "fs";

await Promise.all([
  build({
    entryPoints: ["src/extension/background.ts"],
    bundle: true,
    outfile: "dist/extension/background.js",
    format: "iife",
    target: "firefox115",
    define: { "process.env.NODE_ENV": '"production"' },
  }),
  build({
    entryPoints: ["src/extension/content.ts"],
    bundle: true,
    outfile: "dist/extension/content.js",
    format: "iife",
    target: "firefox115",
    define: { "process.env.NODE_ENV": '"production"' },
  }),
]);

cpSync("src/extension/manifest.json", "dist/extension/manifest.json");

console.log("built dist/extension/");
