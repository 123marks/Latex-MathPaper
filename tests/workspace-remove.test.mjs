import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
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

test("workspace removal: managed needs confirm+deletes, external unregisters only", async (t) => {
  const port = await freePort();
  process.env.PAPER_OS_PORT = String(port);
  const managedId = `rm-${process.pid}-${Date.now()}`;
  const managedRoot = join(root, "workspaces", managedId);
  const stateRoot = mkdtempSync(join(tmpdir(), "paperos-remove-"));
  const externalDir = join(stateRoot, "my-notes");
  mkdirSync(externalDir, { recursive: true });
  writeFileSync(join(externalDir, "notes.md"), "# keep me\n", "utf-8");
  const previousDataDir = process.env.PAPER_OS_DATA_DIR;
  process.env.PAPER_OS_DATA_DIR = join(stateRoot, "data");
  const { startServer, server } = await import(`../app/server.mjs?remove=${Date.now()}`);

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

  await json("/api/auth/bootstrap");
  await json("/api/auth/local", { method: "POST", ...jsonBody({}) });

  // Managed workspace: refuse without deleteFiles, delete with it.
  await json("/api/editor/projects", { method: "POST", ...jsonBody({ id: managedId, name: "Rm", pack: "latex" }) }, 201);
  const refused = await json(`/api/editor/projects/${managedId}`, { method: "DELETE" }, 400);
  assert.equal(refused.code, "DELETE_REQUIRES_CONFIRM");
  assert.equal(existsSync(managedRoot), true, "folder must survive the refused delete");
  const removed = await json(`/api/editor/projects/${managedId}?deleteFiles=1`, { method: "DELETE" });
  assert.equal(removed.deletedFiles, true);
  assert.equal(existsSync(managedRoot), false, "managed folder should be deleted");

  // External folder: unregister keeps the files.
  const extId = `ext-${process.pid}`;
  await json("/api/editor/projects", { method: "POST", ...jsonBody({ id: extId, name: "Notes", path: externalDir, pack: "general" }) }, 201);
  const unreg = await json(`/api/editor/projects/${extId}`, { method: "DELETE" });
  assert.equal(unreg.deletedFiles, false);
  assert.equal(existsSync(join(externalDir, "notes.md")), true, "external files must stay on disk");
  const list = await json("/api/editor/projects");
  assert.equal(list.projects.some((p) => p.id === extId || p.id === managedId), false);

  // Legacy contest content is protected; unknown ids -> 404.
  const legacy = await json("/api/editor/projects/sample-contest?deleteFiles=1", { method: "DELETE" }, 400);
  assert.equal(legacy.code, "PACK_REQUIRES_ADAPTER");
  await json("/api/editor/projects/never-existed", { method: "DELETE" }, 404);
});
