#!/usr/bin/env bun

import { sendCommand } from "./client.ts";
import { startDaemon } from "../daemon/server.ts";

const args = process.argv.slice(2);

// spike-browser daemon
if (args[0] === "daemon") {
  const port = parseInt(args[1] ?? "9231", 10);
  startDaemon(port);
  // Keep process alive
} else if (args.length > 0) {
  // spike-browser <command...>
  const command = args.join(" ");
  try {
    const result = await sendCommand(command);
    if (result) console.log(result);
  } catch (e: any) {
    console.error(`error: ${e.message}`);
    process.exit(1);
  }
} else {
  // stdin mode: echo "list" | spike-browser
  const chunks: string[] = [];
  const stdin = Bun.stdin.stream();
  const reader = stdin.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(decoder.decode(value, { stream: true }));
  }

  const command = chunks.join("").trim();
  if (!command) {
    console.log("usage: shrowser <command...>");
    console.log("       shrowser daemon [port]");
    console.log("       echo 'list' | shrowser");
    process.exit(0);
  }

  try {
    const result = await sendCommand(command);
    if (result) console.log(result);
  } catch (e: any) {
    console.error(`error: ${e.message}`);
    process.exit(1);
  }
}
