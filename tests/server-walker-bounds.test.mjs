import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
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
      const address = probe.address();
      const port = typeof address === "object" ? address.port : 0;
      probe.close(() => resolvePort(port));
    });
  });
}

function countTree(nodes) {
  let total = 0;
  for (const node of nodes) {
    total += 1;
    if (node.children) total += countTree(node.children);
  }
  return total;
}

test("tree/search/export walkers stop at configured bounds", async (t) => {
  const port = await freePort();
  process.env.PAPER_OS_PORT = String(port);
  // Tight limits so the fixture stays small while still exceeding them.
  process.env.PAPER_OS_WALKER_MAX_ENTRIES = "25";
  process.env.PAPER_OS_WALKER_MAX_DEPTH = "3";

  const workspaceId = `walker-bounds-${process.pid}-${Date.now()}`;
  const managedRoot = join(root, "workspaces", workspaceId);
  const stateRoot = mkdtempSync(join(tmpdir(), "paperos-walker-"));
  const previousDataDir = process.env.PAPER_OS_DATA_DIR;
  process.env.PAPER_OS_DATA_DIR = join(stateRoot, "data");
  const { startServer, server } = await import(`../app/server.mjs?walker-bounds=${Date.now()}`);

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
  t.after(async () => {
    if (server.listening) {
      await new Promise((resolveClose) => server.close(resolveClose));
    }
    rmSync(managedRoot, { recursive: true, force: true });
    rmSync(stateRoot, { recursive: true, force: true });
    if (previousDataDir === undefined) delete process.env.PAPER_OS_DATA_DIR;
    else process.env.PAPER_OS_DATA_DIR = previousDataDir;
    delete process.env.PAPER_OS_WALKER_MAX_ENTRIES;
    delete process.env.PAPER_OS_WALKER_MAX_DEPTH;
  });

  await json("/api/auth/bootstrap");
  await json("/api/auth/local", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  await json("/api/editor/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: workspaceId, name: "Walker Bounds", pack: "general" }),
  }, 201);

  // 60 files across a flat layout (exceeds the 25-entry budget) plus a
  // deep chain (exceeds the depth cap).
  for (let index = 0; index < 60; index++) {
    writeFileSync(join(managedRoot, `file-${String(index).padStart(2, "0")}.md`), `needle ${index}\n`, "utf-8");
  }
  let deep = managedRoot;
  for (let level = 0; level < 8; level++) {
    deep = join(deep, `level-${level}`);
  }
  mkdirSync(deep, { recursive: true });
  writeFileSync(join(deep, "buried.md"), "needle buried\n", "utf-8");

  const tree = await json(`/api/editor/tree?workspace=${encodeURIComponent(workspaceId)}`);
  assert.equal(tree.truncated, true, "tree must flag truncation");
  assert.ok(countTree(tree.tree) <= 25, "tree entries must respect the budget");

  const search = await json(
    `/api/editor/search?workspace=${encodeURIComponent(workspaceId)}&q=needle&limit=200`,
  );
  assert.equal(search.truncated, true, "search must flag truncation");
  assert.ok(search.results.length <= 25, "search scan must respect the budget");

  const exported = await json(`/api/editor/export?workspace=${encodeURIComponent(workspaceId)}`);
  assert.equal(exported.truncated, true, "export must flag truncation");
  assert.ok(exported.files.length <= 25, "export listing must respect the budget");
});
