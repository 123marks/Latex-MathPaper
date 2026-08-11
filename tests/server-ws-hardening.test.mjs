import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

// The ws client lives in app/node_modules; resolve it exactly like the
// server does (native global WebSocket cannot send a Cookie header).
const requireFromApp = createRequire(new URL("../app/server.mjs", import.meta.url));
const WebSocket = requireFromApp("ws");

function freePort() {
  return new Promise((resolvePort, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      const port = typeof address === "object" ? address.port : 0;
      probe.close(() => resolvePort(port));
    });
  });
}

test("malformed WebSocket frames cannot crash the server", async (t) => {
  const port = await freePort();
  process.env.PAPER_OS_PORT = String(port);
  const stateRoot = mkdtempSync(join(tmpdir(), "paperos-ws-hardening-"));
  const previousDataDir = process.env.PAPER_OS_DATA_DIR;
  process.env.PAPER_OS_DATA_DIR = join(stateRoot, "data");
  const { startServer, server } = await import(`../app/server.mjs?ws-hardening=${Date.now()}`);

  let cookie = "";
  async function json(path, options = {}, expected = 200) {
    const headers = { ...(options.headers || {}) };
    if (cookie) headers.Cookie = cookie;
    const response = await fetch(`http://127.0.0.1:${port}${path}`, { ...options, headers });
    const setCookie = response.headers.get("set-cookie");
    if (setCookie) cookie = setCookie.split(";")[0];
    const payload = await response.json();
    assert.equal(response.status, expected, `${path}: ${JSON.stringify(payload)}`);
    return payload;
  }

  startServer();
  let ws = null;
  t.after(async () => {
    // Terminate the socket BEFORE server.close(): a live upgraded
    // connection keeps the HTTP server (and the test runner) waiting.
    try { ws?.terminate(); } catch { /* */ }
    if (server.listening) {
      await new Promise((resolveClose) => server.close(resolveClose));
    }
    rmSync(stateRoot, { recursive: true, force: true });
    if (previousDataDir === undefined) delete process.env.PAPER_OS_DATA_DIR;
    else process.env.PAPER_OS_DATA_DIR = previousDataDir;
  });

  await json("/api/auth/bootstrap");
  await json("/api/auth/local", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });

  ws = new WebSocket(`ws://127.0.0.1:${port}/ws/api`, {
    headers: { Cookie: cookie, Origin: `http://127.0.0.1:${port}` },
  });
  await new Promise((resolveOpen, rejectOpen) => {
    ws.once("open", resolveOpen);
    ws.once("error", rejectOpen);
  });

  // Frames that used to throw inside the message handler (missing channel,
  // wrong types, invalid JSON) and a valid subscribe afterwards.
  ws.send('{"op":"subscribe"}');
  ws.send('{"op":"unsubscribe"}');
  ws.send('{"channel":123,"op":"subscribe"}');
  ws.send("not json at all");
  ws.send('{"op":"subscribe","channel":"team:not-my-team"}');
  ws.send('{"op":"subscribe","channel":"compile:demo"}');
  await new Promise((resolveSleep) => setTimeout(resolveSleep, 150));

  assert.equal(ws.readyState, WebSocket.OPEN, "socket should survive malformed frames");
  const me = await json("/api/auth/me");
  assert.ok(me.user, "HTTP API must remain responsive after malformed WS frames");
});
