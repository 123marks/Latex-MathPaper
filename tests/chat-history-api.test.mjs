import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

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

test("chat history lists, details, and searches the caller's own threads", async (t) => {
  const port = await freePort();
  process.env.PAPER_OS_PORT = String(port);
  const stateRoot = mkdtempSync(join(tmpdir(), "paperos-chat-hist-"));
  const previousDataDir = process.env.PAPER_OS_DATA_DIR;
  process.env.PAPER_OS_DATA_DIR = join(stateRoot, "data");
  const { startServer, server } = await import(`../app/server.mjs?chat-history=${Date.now()}`);

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

  startServer();
  t.after(async () => {
    if (server.listening) await new Promise((r) => server.close(r));
    rmSync(stateRoot, { recursive: true, force: true });
    if (previousDataDir === undefined) delete process.env.PAPER_OS_DATA_DIR;
    else process.env.PAPER_OS_DATA_DIR = previousDataDir;
  });

  await json("/api/auth/bootstrap");
  await json("/api/auth/local", { method: "POST", ...jsonBody({}) });

  // Empty history to start.
  const empty = await json("/api/chat/history");
  assert.equal(empty.total, 0);
  assert.deepEqual(empty.threads, []);

  // Drive one real (mock-local) chat so a thread is recorded on disk.
  const chat = await request("/api/chat", {
    method: "POST",
    ...jsonBody({ messages: [{ role: "user", content: "update [file:paper/main.tex] 精简方法段" }], mode: "chat", workspace: "hist-ws" }),
  });
  assert.equal(chat.status, 200);
  await chat.text(); // drain the SSE stream so the thread is persisted

  const listed = await json("/api/chat/history");
  assert.equal(listed.total, 1);
  assert.equal(listed.threads.length, 1);
  const row = listed.threads[0];
  assert.match(row.prompt, /update \[file:paper\/main\.tex\]/);
  assert.ok(Array.isArray(row.fileBlocks));
  assert.equal(typeof row.replyPreview, "string");
  assert.equal(row.workspace, "hist-ws"); // threads remember their workspace

  // Detail returns the full thread without leaking userId.
  const detail = await json(`/api/chat/history?id=${row.id}`);
  assert.equal(detail.thread.id, row.id);
  assert.match(detail.thread.prompt, /精简方法段/);
  assert.ok(detail.thread.reply.length > 0);
  assert.equal(detail.thread.userId, undefined);

  // Search hits and misses.
  const hit = await json(`/api/chat/history?q=${encodeURIComponent("方法段")}`);
  assert.equal(hit.threads.length, 1);
  const miss = await json(`/api/chat/history?q=zzznotfound`);
  assert.equal(miss.threads.length, 0);

  // Unknown id -> 404.
  await json("/api/chat/history?id=nope", {}, 404);
});
