import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const requireFromApp = createRequire(
  new URL("../app/package.json", import.meta.url),
);
const { WebSocketServer } = requireFromApp("ws");

test("CDP client works when Node does not provide a global WebSocket", async () => {
  const originalWebSocket = Object.getOwnPropertyDescriptor(globalThis, "WebSocket");
  Object.defineProperty(globalThis, "WebSocket", {
    configurable: true,
    value: undefined,
    writable: true,
  });

  const server = new WebSocketServer({ host: "127.0.0.1", port: 0 });
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });

  let serverSocket;
  let cdp;
  try {
    server.on("connection", (socket) => {
      serverSocket = socket;
      socket.on("message", (raw) => {
        const request = JSON.parse(String(raw));
        socket.send(JSON.stringify({
          id: request.id,
          result: { product: "Paper OS test browser" },
        }));
      });
    });

    const { connectCdp } = await import("../app/lib/cdp-client.mjs");
    const { port } = server.address();
    cdp = await connectCdp(`ws://127.0.0.1:${port}`);

    const notifications = [];
    const unsubscribe = cdp.on("Page.backForwardCacheNotUsed", (params) => {
      notifications.push(params);
    });
    serverSocket.send(JSON.stringify({
      method: "Page.backForwardCacheNotUsed",
      params: { frameId: "frame-1", notRestoredExplanations: [{ reason: "WebSocket" }] },
    }));
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(notifications[0].notRestoredExplanations[0].reason, "WebSocket");
    unsubscribe();
    assert.deepEqual(
      await cdp.send("Browser.getVersion"),
      { product: "Paper OS test browser" },
    );
  } finally {
    cdp?.close();
    for (const client of server.clients) client.terminate();
    await new Promise((resolve) => server.close(resolve));
    if (originalWebSocket) {
      Object.defineProperty(globalThis, "WebSocket", originalWebSocket);
    } else {
      delete globalThis.WebSocket;
    }
  }
});
