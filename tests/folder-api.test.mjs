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

function findNode(nodes, path) {
  for (const node of nodes || []) {
    if (node.path === path) return node;
    if (node.type === "dir") {
      const hit = findNode(node.children, path);
      if (hit) return hit;
    }
  }
  return null;
}

test("folder lifecycle: create, populate, rename, delete", async (t) => {
  const port = await freePort();
  process.env.PAPER_OS_PORT = String(port);
  const workspaceId = `folders-${process.pid}-${Date.now()}`;
  const managedRoot = join(root, "workspaces", workspaceId);
  const stateRoot = mkdtempSync(join(tmpdir(), "paperos-folders-"));
  const previousDataDir = process.env.PAPER_OS_DATA_DIR;
  process.env.PAPER_OS_DATA_DIR = join(stateRoot, "data");
  const { startServer, server } = await import(`../app/server.mjs?folders=${Date.now()}`);

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
  const ws = encodeURIComponent(workspaceId);

  startServer();
  t.after(async () => {
    if (server.listening) await new Promise((r) => server.close(r));
    rmSync(managedRoot, { recursive: true, force: true });
    rmSync(stateRoot, { recursive: true, force: true });
    if (previousDataDir === undefined) delete process.env.PAPER_OS_DATA_DIR;
    else process.env.PAPER_OS_DATA_DIR = previousDataDir;
  });

  await json("/api/auth/bootstrap");
  await json("/api/auth/local", { method: "POST", ...jsonBody({}) });
  await json("/api/editor/projects", { method: "POST", ...jsonBody({ id: workspaceId, name: "Folders", pack: "latex" }) }, 201);

  // Create a nested folder; duplicates and escapes are rejected.
  await json("/api/editor/folder", { method: "POST", ...jsonBody({ workspace: workspaceId, path: "paper/sections" }) }, 201);
  await json("/api/editor/folder", { method: "POST", ...jsonBody({ workspace: workspaceId, path: "paper/sections" }) }, 409);
  await json("/api/editor/folder", { method: "POST", ...jsonBody({ workspace: workspaceId, path: "../evil" }) }, 400);
  await json("/api/editor/folder", { method: "POST", ...jsonBody({ workspace: workspaceId }) }, 400);

  // Populate it and confirm the tree shows the hierarchy.
  await json("/api/editor/file", { method: "POST", ...jsonBody({ workspace: workspaceId, path: "paper/sections/intro.tex", content: "\\section{Intro}" }) }, 201);
  let tree = (await json(`/api/editor/tree?workspace=${ws}`)).tree;
  const dir = findNode(tree, "paper/sections");
  assert.equal(dir?.type, "dir");
  assert.equal(findNode(tree, "paper/sections/intro.tex")?.type, "file");

  // Rename (move) the folder; children follow.
  await json("/api/editor/file", { method: "PATCH", ...jsonBody({ workspace: workspaceId, from: "paper/sections", to: "paper/chapters" }) });
  tree = (await json(`/api/editor/tree?workspace=${ws}`)).tree;
  assert.equal(findNode(tree, "paper/sections"), null);
  assert.equal(findNode(tree, "paper/chapters/intro.tex")?.type, "file");
  const moved = await json(`/api/editor/file?workspace=${ws}&path=${encodeURIComponent("paper/chapters/intro.tex")}`);
  assert.match(moved.content, /\\section\{Intro\}/);

  // Delete the folder recursively.
  await json(`/api/editor/file?workspace=${ws}&path=${encodeURIComponent("paper/chapters")}`, { method: "DELETE" });
  tree = (await json(`/api/editor/tree?workspace=${ws}`)).tree;
  assert.equal(findNode(tree, "paper/chapters"), null);
});
