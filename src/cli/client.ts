// CLI WebSocket client — connects to daemon, sends a command, prints result, exits.

import type { Value } from "../commands/types.ts";
import { renderValue } from "../commands/types.ts";
import { config } from "../config.gen.ts";

type ExecResult =
  | { id: string; type: "result"; value: Value }
  | { id: string; type: "error"; message: string };

export const sendCommand = (command: string, port = config.daemon.port): Promise<string> =>
  new Promise((resolve, reject) => {
    const id = crypto.randomUUID();
    const ws = new WebSocket(`ws://localhost:${port}`);

    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error("timeout waiting for response"));
    }, 30_000);

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "hello", role: "cli" }));
      ws.send(JSON.stringify({ id, type: "exec", command }));
    };

    ws.onmessage = (event) => {
      const msg: ExecResult = JSON.parse(event.data as string);
      if (msg.id !== id) return;
      clearTimeout(timeout);
      ws.close();
      if (msg.type === "error") {
        reject(new Error(msg.message));
      } else {
        resolve(renderValue(msg.value));
      }
    };

    ws.onerror = (event) => {
      clearTimeout(timeout);
      reject(new Error("could not connect to daemon — is `shrowser daemon` running?"));
    };
  });
