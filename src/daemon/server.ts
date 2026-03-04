// WebSocket broker — routes commands between CLI clients and the browser extension.
//
// Protocol:
//   CLI sends:      { id: string, type: "exec", command: string }
//   Broker forwards to extension, extension replies:
//                   { id: string, type: "result", value: Value }
//                or { id: string, type: "error", message: string }
//   Broker forwards reply back to the originating CLI client.
//
// On connect, clients send: { type: "hello", role: "cli" | "extension" }

import type { ServerWebSocket } from "bun";

type ClientData = { role: "cli" | "extension" | "unknown" };

let extensionSocket: ServerWebSocket<ClientData> | null = null;
const pendingRequests = new Map<string, ServerWebSocket<ClientData>>();

export const startDaemon = (port = 9231) => {
  const server = Bun.serve<ClientData>({
    port,
    fetch(req, server) {
      const ok = server.upgrade(req, { data: { role: "unknown" as const } });
      if (!ok) return new Response("WebSocket upgrade failed", { status: 400 });
    },
    websocket: {
      open(ws) {
        console.log("client connected");
      },

      message(ws, raw) {
        let msg: any;
        try {
          msg = JSON.parse(typeof raw === "string" ? raw : new TextDecoder().decode(raw));
        } catch {
          ws.send(JSON.stringify({ type: "error", message: "invalid JSON" }));
          return;
        }

        // Handshake
        if (msg.type === "hello") {
          ws.data.role = msg.role;
          if (msg.role === "extension") {
            extensionSocket = ws;
            console.log("extension connected");
          } else {
            console.log("cli client connected");
          }
          return;
        }

        // CLI sending a command
        if (msg.type === "exec" && ws.data.role === "cli") {
          if (!extensionSocket) {
            ws.send(JSON.stringify({ id: msg.id, type: "error", message: "no extension connected" }));
            return;
          }
          pendingRequests.set(msg.id, ws);
          extensionSocket.send(JSON.stringify(msg));
          return;
        }

        // Extension sending a result back
        if ((msg.type === "result" || msg.type === "error") && ws.data.role === "extension") {
          const cli = pendingRequests.get(msg.id);
          if (cli) {
            cli.send(JSON.stringify(msg));
            pendingRequests.delete(msg.id);
          }
          return;
        }
      },

      close(ws) {
        if (ws.data.role === "extension" && extensionSocket === ws) {
          extensionSocket = null;
          console.log("extension disconnected");
        }
        // Clean up any pending requests from this CLI
        for (const [id, client] of pendingRequests) {
          if (client === ws) pendingRequests.delete(id);
        }
      },
    },
  });

  console.log(`shrowser daemon listening on ws://localhost:${server.port}`);
  return server;
};
