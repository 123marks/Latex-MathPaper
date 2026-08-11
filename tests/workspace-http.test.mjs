import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function snapshotFile(path) {
  return existsSync(path) ? readFileSync(path) : null;
}

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

test("Workspace HTTP flow creates, registers, edits, and summarizes", async (t) => {
  const port = await freePort();
  process.env.PAPER_OS_PORT = String(port);

  const workspaceId = `http-latex-${process.pid}-${Date.now()}`;
  const externalId = `http-external-${process.pid}-${Date.now()}`;
  const managedRoot = join(root, "workspaces", workspaceId);
  const externalRoot = mkdtempSync(join(tmpdir(), "paperos-http-workspace-"));
  writeFileSync(join(externalRoot, "README.md"), "# External Workspace\n", "utf8");
  const sentinel = `JUNCTION_ESCAPE_${process.pid}_${Date.now()}`;
  writeFileSync(join(externalRoot, "outside-secret.txt"), `${sentinel}\n`, "utf8");
  const protectedManifestPaths = [
    join(root, ".paperos", "workspace.json"),
    join(root, "workspaces", ".paperos", "workspace.json"),
  ];
  const protectedManifestBefore = protectedManifestPaths.map(snapshotFile);


  const stateRoot = mkdtempSync(join(tmpdir(), "paperos-http-state-"));
  const dataDir = join(stateRoot, "data");
  const previousDataDir = process.env.PAPER_OS_DATA_DIR;
  process.env.PAPER_OS_DATA_DIR = dataDir;
  const { startServer, server } = await import(`../app/server.mjs?workspace-http=${Date.now()}`);

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

  startServer();
  t.after(async () => {
    if (server.listening) {
      await new Promise((resolveClose) => server.close(resolveClose));
    }
    rmSync(managedRoot, { recursive: true, force: true });
    rmSync(externalRoot, { recursive: true, force: true });
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
  for (const name of ["users.json", "sessions.json", "audit.json"]) {
    assert.equal(existsSync(join(dataDir, name)), true, `${name} was not isolated`);
  }

  const catalog = await json("/api/editor/projects");
  assert.ok(catalog.packs.some((pack) => pack.id === "latex"));

  const created = await json("/api/editor/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: workspaceId, name: "HTTP LaTeX", pack: "latex" }),
  }, 201);
  assert.equal(created.workspace.id, workspaceId);
  assert.equal(created.workspace.pack, "latex");

  let junctionReady = true;
  try {
    symlinkSync(
      externalRoot,
      join(managedRoot, "escape"),
      process.platform === "win32" ? "junction" : "dir",
    );
  } catch (error) {
    if (process.platform === "win32") {
      assert.fail(`Windows junction setup failed: ${error.code || error.message}`);
    }
    junctionReady = false;
    t.diagnostic(`directory symlinks unavailable: ${error.code || error.message}`);
  }
  if (junctionReady) {
    const tree = await json(`/api/editor/tree?workspace=${encodeURIComponent(workspaceId)}`);
    const treePaths = [];
    const collectPaths = (items) => {
      for (const item of items) {
        treePaths.push(item.path);
        if (item.children) collectPaths(item.children);
      }
    };
    collectPaths(tree.tree);
    assert.equal(treePaths.some((path) => path.startsWith("escape")), false);

    const search = await json(
      `/api/editor/search?workspace=${encodeURIComponent(workspaceId)}&q=${encodeURIComponent(sentinel)}`,
    );
    assert.equal(search.results.length, 0);
    const exported = await json(
      `/api/editor/export?workspace=${encodeURIComponent(workspaceId)}`,
    );
    assert.equal(exported.files.some((file) => file.path.startsWith("escape")), false);
  }

  for (const id of [".", ".."]) {
    const rejected = await json("/api/editor/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, pack: "latex" }),
    }, 400);
    assert.equal(rejected.code, "INVALID_ID");
  }
  assert.deepEqual(protectedManifestPaths.map(snapshotFile), protectedManifestBefore);

  const registered = await json("/api/editor/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: externalId, name: "HTTP External", path: externalRoot, pack: "general" }),
  }, 201);
  assert.equal(registered.workspace.source, "external");

  const filePath = "sections/http.tex";
  const createdFile = await json("/api/editor/file", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ workspace: workspaceId, path: filePath, content: "HTTP draft\n" }),
  }, 201);
  assert.equal(createdFile.workspace, workspaceId);
  assert.equal(createdFile.contest, workspaceId);

  const saved = await json("/api/editor/file", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ workspace: workspaceId, path: filePath, content: "HTTP Workspace saved\n" }),
  });
  assert.equal(saved.workspace, workspaceId);
  assert.equal(saved.contest, workspaceId);

  const fileResponse = await request(
    `/api/editor/file?workspace=${encodeURIComponent(workspaceId)}&path=${encodeURIComponent(filePath)}`,
  );
  assert.equal(fileResponse.status, 200);
  assert.equal(fileResponse.headers.get("cache-control"), "no-store");
  const file = await fileResponse.json();
  assert.equal(file.content, "HTTP Workspace saved\n");

  for (const rootPath of [".", "./"]) {
    const denied = await json(
      `/api/editor/file?workspace=${encodeURIComponent(workspaceId)}&path=${encodeURIComponent(rootPath)}`,
      { method: "DELETE" },
      400,
    );
    assert.equal(denied.code, "WORKSPACE_ROOT_FORBIDDEN");
    assert.equal(existsSync(managedRoot), true);
  }

  const summary = await json("/api/summary");
  assert.ok(summary.workspaces.some((workspace) => workspace.id === workspaceId));
  assert.ok(summary.mathModeling);
});
