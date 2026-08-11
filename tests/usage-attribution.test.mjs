import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

function freePort() {
  return new Promise((resolvePort, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const port = probe.address().port;
      probe.close(() => resolvePort(port));
    });
  });
}

test("usage records carry workspace and aggregate into hour/workspace buckets", async (t) => {
  const port = await freePort();
  process.env.PAPER_OS_PORT = String(port);
  const stateRoot = mkdtempSync(join(tmpdir(), "paperos-usage-attr-"));
  const previousDataDir = process.env.PAPER_OS_DATA_DIR;
  process.env.PAPER_OS_DATA_DIR = join(stateRoot, "data");
  const { startServer, server } = await import(`../app/server.mjs?usage-attr=${Date.now()}`);

  let cookie = "";
  async function request(path, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (cookie) headers.Cookie = cookie;
    const response = await fetch(`http://127.0.0.1:${port}${path}`, { ...options, headers });
    const setCookie = response.headers.get("set-cookie");
    if (setCookie) cookie = setCookie.split(";")[0];
    return response;
  }
  async function json(path, options = {}, expected = 200) {
    const response = await request(path, options);
    const payload = await response.json();
    assert.equal(response.status, expected, `${path}: ${JSON.stringify(payload)}`);
    return payload;
  }
  const jsonBody = (obj) => ({ headers: { "Content-Type": "application/json" }, body: JSON.stringify(obj) });
  async function chat(body) {
    const response = await request("/api/chat", { method: "POST", ...jsonBody(body) });
    assert.equal(response.status, 200);
    await response.text();
  }

  startServer();
  t.after(async () => {
    if (server.listening) await new Promise((r) => server.close(r));
    rmSync(stateRoot, { recursive: true, force: true });
    if (previousDataDir === undefined) delete process.env.PAPER_OS_DATA_DIR;
    else process.env.PAPER_OS_DATA_DIR = previousDataDir;
  });

  await json("/api/auth/bootstrap");
  await json("/api/auth/local", { method: "POST", ...jsonBody({}) });

  // One attributed chat, one legacy-style chat without a workspace.
  await chat({ messages: [{ role: "user", content: "hello alpha" }], mode: "chat", workspace: "ws-alpha" });
  await chat({ messages: [{ role: "user", content: "hello anon" }], mode: "chat" });

  const usage = await json("/api/usage/me?days=7");
  assert.equal(usage.totalRequests, 2);

  // Workspace ranking: the attributed workspace and the honest "未标注" bucket.
  const names = usage.workspaces.map((w) => w.workspace);
  assert.ok(names.includes("ws-alpha"), `missing ws-alpha in ${names}`);
  assert.ok(names.includes("未标注"), `missing 未标注 in ${names}`);
  const alpha = usage.workspaces.find((w) => w.workspace === "ws-alpha");
  assert.equal(alpha.requests, 1);
  assert.ok(alpha.tokens > 0);

  // Hour buckets: 24 slots, all tokens land in real hours, current hour non-empty.
  assert.equal(usage.hours.length, 24);
  const hourSum = usage.hours.reduce((a, b) => a + b, 0);
  assert.equal(hourSum, usage.totalTokens);
  assert.ok(usage.hours[new Date().getHours()] > 0, "current hour bucket is empty");
});
