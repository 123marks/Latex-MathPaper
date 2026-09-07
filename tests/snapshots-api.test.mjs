import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
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

test("snapshots: create, list, restore with pre-restore safety net; atomic saves leave no temp files", async (t) => {
  const port = await freePort();
  process.env.PAPER_OS_PORT = String(port);
  const workspaceId = `snap-${process.pid}-${Date.now()}`;
  const managedRoot = join(root, "workspaces", workspaceId);
  const stateRoot = mkdtempSync(join(tmpdir(), "paperos-snap-"));
  const previousDataDir = process.env.PAPER_OS_DATA_DIR;
  process.env.PAPER_OS_DATA_DIR = join(stateRoot, "data");
  const { startServer, server } = await import(`../app/server.mjs?snapshots=${Date.now()}`);

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
  await json("/api/editor/projects", { method: "POST", ...jsonBody({ id: workspaceId, name: "Snap", pack: "latex" }) }, 201);

  // Save v1 -> snapshot -> save v2 -> restore v1 (v2 preserved as pre-restore).
  await json("/api/editor/file", { method: "PUT", ...jsonBody({ workspace: workspaceId, path: "main.tex", content: "V1 content" }) });
  const created = await json("/api/editor/snapshots", { method: "POST", ...jsonBody({ workspace: workspaceId, path: "main.tex", reason: "manual" }) }, 201);
  assert.ok(created.id);
  assert.equal(created.snapshots.length, 1);
  assert.equal(created.snapshots[0].reason, "manual");

  await json("/api/editor/file", { method: "PUT", ...jsonBody({ workspace: workspaceId, path: "main.tex", content: "V2 content" }) });
  const restored = await json(`/api/editor/snapshots/${created.id}/restore`, { method: "POST", ...jsonBody({ workspace: workspaceId }) });
  assert.equal(restored.content, "V1 content");
  assert.equal(readFileSync(join(managedRoot, "main.tex"), "utf-8"), "V1 content");
  assert.ok(restored.snapshots.some((s) => s.reason === "pre-restore"), "pre-restore safety snapshot missing");

  // Listing filters by path; unknown snapshot 404; invalid path 400.
  const listed = await json(`/api/editor/snapshots?workspace=${ws}&path=main.tex`);
  assert.equal(listed.snapshots.length, 2);
  await json("/api/editor/snapshots/zzzz/restore", { method: "POST", ...jsonBody({ workspace: workspaceId }) }, 404);
  await json("/api/editor/snapshots", { method: "POST", ...jsonBody({ workspace: workspaceId, path: "../x.tex" }) }, 400);

  // Atomic write hygiene: no .tmp leftovers next to the saved file.
  const leftovers = readdirSync(managedRoot).filter((n) => n.endsWith(".tmp"));
  assert.deepEqual(leftovers, []);
  assert.equal(existsSync(join(managedRoot, "state", "snapshots")), true);
});
