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

test("a fresh latex workspace is usable out of the box, not an empty shell", async (t) => {
  const port = await freePort();
  process.env.PAPER_OS_PORT = String(port);
  const workspaceId = `tpl-${process.pid}-${Date.now()}`;
  const managedRoot = join(root, "workspaces", workspaceId);
  const stateRoot = mkdtempSync(join(tmpdir(), "paperos-tpl-"));
  const previousDataDir = process.env.PAPER_OS_DATA_DIR;
  process.env.PAPER_OS_DATA_DIR = join(stateRoot, "data");
  const { startServer, server } = await import(`../app/server.mjs?template=${Date.now()}`);

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
  await json("/api/editor/projects", { method: "POST", ...jsonBody({ id: workspaceId, name: "Tpl", pack: "latex" }) }, 201);

  // Structured tree: chapters, bibliography, evidence sample.
  const tree = (await json(`/api/editor/tree?workspace=${ws}`)).tree;
  assert.equal(findNode(tree, "main.tex")?.type, "file");
  assert.equal(findNode(tree, "sections/intro.tex")?.type, "file");
  assert.equal(findNode(tree, "sections/method.tex")?.type, "file");
  assert.equal(findNode(tree, "sections/results.tex")?.type, "file");
  assert.equal(findNode(tree, "references.bib")?.type, "file");
  assert.equal(findNode(tree, "results/model-fit.json")?.type, "file");

  // References panel works immediately: real classic entries, all cited, none missing.
  const refs = await json(`/api/editor/references?workspace=${ws}`);
  const keys = refs.entries.map((e) => e.key).sort();
  assert.deepEqual(keys, ["boyd2004", "cover2006", "shannon1948"]);
  for (const entry of refs.entries) {
    assert.ok(entry.citedCount >= 1, `${entry.key} should be cited by the template sections`);
  }
  assert.deepEqual(refs.missing, []);

  // The evidence discipline sample is wired: results section cites the JSON.
  const resultsTex = await json(`/api/editor/file?workspace=${ws}&path=${encodeURIComponent("sections/results.tex")}`);
  assert.match(resultsTex.content, /% evidence: results\/model-fit\.json/);
  const evidence = await json(`/api/editor/file?workspace=${ws}&path=${encodeURIComponent("results/model-fit.json")}`);
  assert.match(evidence.content, /占位示例/);
});
