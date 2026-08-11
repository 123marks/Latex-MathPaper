import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
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

test("annotations CRUD is workspace-scoped, validated, and persisted", async (t) => {
  const port = await freePort();
  process.env.PAPER_OS_PORT = String(port);

  const workspaceId = `anno-${process.pid}-${Date.now()}`;
  const managedRoot = join(root, "workspaces", workspaceId);
  const stateRoot = mkdtempSync(join(tmpdir(), "paperos-anno-state-"));
  const dataDir = join(stateRoot, "data");
  const previousDataDir = process.env.PAPER_OS_DATA_DIR;
  process.env.PAPER_OS_DATA_DIR = dataDir;
  const { startServer, server } = await import(`../app/server.mjs?annotations=${Date.now()}`);

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
  await json("/api/editor/projects", { method: "POST", ...jsonBody({ id: workspaceId, name: "Anno", pack: "latex" }) }, 201);

  const ws = `?workspace=${encodeURIComponent(workspaceId)}`;

  // Empty to start.
  const empty = await json(`/api/editor/annotations${ws}`);
  assert.deepEqual(empty.annotations, []);

  // Create with a valid editor-range target; defaults applied.
  const created = await json("/api/editor/annotations", { method: "POST", ...jsonBody({
    workspace: workspaceId,
    target: { kind: "editor-range", path: "paper/main.tex", startLine: 12, endLine: 16, excerpt: "\\section{Methodology}" },
    note: "改成加权残差",
  }) });
  assert.match(created.annotation.id, /^[\w-]{6,}$/);
  assert.equal(created.annotation.status, "open");
  assert.equal(created.annotation.intent, "edit");
  assert.equal(created.annotation.priority, "normal");
  assert.equal(created.annotation.target.path, "paper/main.tex");
  assert.equal(created.annotation.target.startLine, 12);

  // Persisted to the Workspace state dir.
  const stateFile = join(managedRoot, "state", "annotations.json");
  assert.equal(existsSync(stateFile), true, "annotations.json was not written");
  assert.equal(JSON.parse(readFileSync(stateFile, "utf-8")).annotations.length, 1);

  // Listing returns it.
  const listed = await json(`/api/editor/annotations${ws}`);
  assert.equal(listed.annotations.length, 1);

  // Validation: traversal path and missing note are rejected.
  await json("/api/editor/annotations", { method: "POST", ...jsonBody({
    workspace: workspaceId, target: { kind: "editor-range", path: "../escape.tex", startLine: 1, endLine: 1 }, note: "x",
  }) }, 400);
  await json("/api/editor/annotations", { method: "POST", ...jsonBody({
    workspace: workspaceId, target: { kind: "editor-range", path: "paper/main.tex", startLine: 1, endLine: 1 }, note: "",
  }) }, 400);
  // pdf-region (Epic 1d): rect is required — no rect / zero area / bad page -> 400.
  await json("/api/editor/annotations", { method: "POST", ...jsonBody({
    workspace: workspaceId, target: { kind: "pdf-region", path: "paper/main.tex", page: 1 }, note: "later",
  }) }, 400);
  await json("/api/editor/annotations", { method: "POST", ...jsonBody({
    workspace: workspaceId, target: { kind: "pdf-region", path: "paper/main.tex", page: 1, rect: { x: 0.2, y: 0.2, w: 0, h: 0.1 } }, note: "zero width",
  }) }, 400);
  await json("/api/editor/annotations", { method: "POST", ...jsonBody({
    workspace: workspaceId, target: { kind: "pdf-region", path: "paper/main.tex", page: 0, rect: { x: 0.1, y: 0.1, w: 0.2, h: 0.2 } }, note: "bad page",
  }) }, 400);

  // pdf-region happy path: coordinates are clamped to 0..1 and rounded.
  const pdfAnno = await json("/api/editor/annotations", { method: "POST", ...jsonBody({
    workspace: workspaceId,
    target: { kind: "pdf-region", path: "paper/main.tex", page: 2, rect: { x: 0.25, y: 0.5, w: 0.9, h: 0.12345 } },
    note: "图太挤",
    intent: "fix",
  }) });
  assert.equal(pdfAnno.annotation.target.kind, "pdf-region");
  assert.equal(pdfAnno.annotation.target.page, 2);
  assert.equal(pdfAnno.annotation.target.rect.w, 0.75); // clamped to fit inside the page
  assert.equal(pdfAnno.annotation.target.rect.h, 0.1235); // rounded to 4 decimals
  await json(`/api/editor/annotations/${pdfAnno.annotation.id}${ws}`, { method: "DELETE" });

  // Patch status open -> resolved.
  const id = created.annotation.id;
  const patched = await json(`/api/editor/annotations/${id}${ws}`, { method: "PATCH", ...jsonBody({ status: "resolved", priority: "high" }) });
  assert.equal(patched.annotation.status, "resolved");
  assert.equal(patched.annotation.priority, "high");

  // Unknown id -> 404.
  await json(`/api/editor/annotations/nope${ws}`, { method: "PATCH", ...jsonBody({ status: "open" }) }, 404);

  // Delete clears it.
  const removed = await json(`/api/editor/annotations/${id}${ws}`, { method: "DELETE" });
  assert.equal(removed.ok, true);
  const afterDelete = await json(`/api/editor/annotations${ws}`);
  assert.deepEqual(afterDelete.annotations, []);

  // Missing workspace -> 400.
  await json("/api/editor/annotations", { method: "GET" }, 400);
});
