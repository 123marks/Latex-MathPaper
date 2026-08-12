import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
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

test("global search aggregates workspaces, files, sessions, and posts", async (t) => {
  const port = await freePort();
  process.env.PAPER_OS_PORT = String(port);
  const workspaceId = `srch-${process.pid}-${Date.now()}`;
  const managedRoot = join(root, "workspaces", workspaceId);
  const stateRoot = mkdtempSync(join(tmpdir(), "paperos-search-"));
  const previousDataDir = process.env.PAPER_OS_DATA_DIR;
  process.env.PAPER_OS_DATA_DIR = join(stateRoot, "data");
  const { startServer, server } = await import(`../app/server.mjs?search=${Date.now()}`);

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
    rmSync(managedRoot, { recursive: true, force: true });
    rmSync(stateRoot, { recursive: true, force: true });
    if (previousDataDir === undefined) delete process.env.PAPER_OS_DATA_DIR;
    else process.env.PAPER_OS_DATA_DIR = previousDataDir;
  });

  // Unauthenticated -> 401.
  const anon = await fetch(`http://127.0.0.1:${port}/api/search?q=zephyr`);
  assert.equal(anon.status, 401);

  await json("/api/auth/bootstrap");
  await json("/api/auth/local", { method: "POST", ...jsonBody({}) });
  await json("/api/editor/projects", { method: "POST", ...jsonBody({ id: workspaceId, name: "Zephyr Study", pack: "latex" }) }, 201);
  await json("/api/editor/file", { method: "POST", ...jsonBody({ workspace: workspaceId, path: "sections/zephyr-model.tex", content: "\\section{Zephyr}" }) }, 201);

  // A chat session and a community post carrying the same marker.
  const chat = await request("/api/chat", {
    method: "POST",
    ...jsonBody({ messages: [{ role: "user", content: "解释 zephyr 模型的收敛性" }], mode: "chat", workspace: workspaceId }),
  });
  assert.equal(chat.status, 200);
  await chat.text();
  await json("/api/community/posts", { method: "POST", ...jsonBody({ title: "Zephyr 建模心得", content: "关于 zephyr 的经验分享", category: "方法" }) });

  // Short queries return empty groups instead of scanning.
  const short = await json("/api/search?q=z");
  assert.deepEqual(short, { workspaces: [], files: [], sessions: [], posts: [] });

  // One query hits all four groups.
  const hits = await json("/api/search?q=zephyr");
  assert.ok(hits.workspaces.some((w) => w.id === workspaceId), "workspace hit missing");
  assert.ok(hits.files.some((f) => f.workspace === workspaceId && f.path === "sections/zephyr-model.tex"), "file hit missing");
  assert.ok(hits.sessions.some((s) => s.prompt.includes("zephyr") && s.workspace === workspaceId), "session hit missing");
  assert.ok(hits.posts.some((p) => p.title.includes("Zephyr")), "post hit missing");

  // No cross-user leakage: a second user sees no sessions.
  let cookie2 = "";
  const other = await fetch(`http://127.0.0.1:${port}/api/auth/bootstrap`);
  cookie2 = (other.headers.get("set-cookie") || "").split(";")[0];
  const login2 = await fetch(`http://127.0.0.1:${port}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie2 },
    body: JSON.stringify({ username: "searcher2", password: "Passw0rd!xyz12", displayName: "S2" }),
  });
  if (login2.status === 200 || login2.status === 201) {
    const sc = login2.headers.get("set-cookie");
    if (sc) cookie2 = sc.split(";")[0];
    const res2 = await fetch(`http://127.0.0.1:${port}/api/search?q=zephyr`, { headers: { Cookie: cookie2 } });
    const data2 = await res2.json();
    assert.equal(res2.status, 200);
    assert.equal(data2.sessions.length, 0, "second user must not see another user's sessions");
  }
});
