import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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

test("apply-blocks is transactional: stamps, conflicts, rollback", async (t) => {
  const port = await freePort();
  process.env.PAPER_OS_PORT = String(port);

  const workspaceId = `apply-tx-${process.pid}-${Date.now()}`;
  const managedRoot = join(root, "workspaces", workspaceId);
  const stateRoot = mkdtempSync(join(tmpdir(), "paperos-apply-tx-"));
  const previousDataDir = process.env.PAPER_OS_DATA_DIR;
  process.env.PAPER_OS_DATA_DIR = join(stateRoot, "data");
  const { startServer, server } = await import(`../app/server.mjs?apply-tx=${Date.now()}`);

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
  const post = (path, body, expected) => json(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }, expected);

  startServer();
  t.after(async () => {
    if (server.listening) {
      await new Promise((resolveClose) => server.close(resolveClose));
    }
    rmSync(managedRoot, { recursive: true, force: true });
    rmSync(stateRoot, { recursive: true, force: true });
    if (previousDataDir === undefined) delete process.env.PAPER_OS_DATA_DIR;
    else process.env.PAPER_OS_DATA_DIR = previousDataDir;
  });

  await json("/api/auth/bootstrap");
  await post("/api/auth/local", {});
  await post("/api/editor/projects", { id: workspaceId, name: "Apply TX", pack: "latex" }, 201);

  const blockText = (path, content) => `BEGIN_FILE: ${path}\n${content}\nEND_FILE`;

  // 1. Preview returns per-block baseline stamps (exists + mtime).
  const existingPath = "sections/existing.tex";
  await post("/api/editor/file", { workspace: workspaceId, path: existingPath, content: "original\n" }, 201);
  const preview = await post("/api/editor/apply-blocks", {
    workspace: workspaceId,
    text: `${blockText(existingPath, "updated")}\n${blockText("sections/new.tex", "fresh")}`,
    apply: false,
  });
  assert.equal(preview.preview, true);
  const stamps = new Map(preview.blocks.map((block) => [block.path, block]));
  assert.equal(stamps.get(existingPath).exists, true);
  assert.ok(stamps.get(existingPath).mtime > 0);
  assert.equal(stamps.get("sections/new.tex").exists, false);
  assert.equal(stamps.get("sections/new.tex").mtime, null);

  // 2. Apply with a matching baseline succeeds and reports written files.
  const applied = await post("/api/editor/apply-blocks", {
    workspace: workspaceId,
    text: `${blockText(existingPath, "updated")}\n${blockText("sections/new.tex", "fresh")}`,
    apply: true,
    baseline: preview.blocks.map((block) => ({ path: block.path, mtime: block.mtime })),
  });
  assert.deepEqual(applied.written.sort(), [existingPath, "sections/new.tex"].sort());
  assert.equal(readFileSync(join(managedRoot, existingPath), "utf-8"), "updated");

  // 3. A stale baseline (file modified after preview) aborts with 409
  //    before writing anything.
  const preview2 = await post("/api/editor/apply-blocks", {
    workspace: workspaceId,
    text: blockText(existingPath, "conflict overwrite"),
    apply: false,
  });
  await new Promise((resolveSleep) => setTimeout(resolveSleep, 20));
  writeFileSync(join(managedRoot, existingPath), "user edited meanwhile\n", "utf-8");
  const conflict = await post("/api/editor/apply-blocks", {
    workspace: workspaceId,
    text: blockText(existingPath, "conflict overwrite"),
    apply: true,
    baseline: preview2.blocks.map((block) => ({ path: block.path, mtime: block.mtime })),
  }, 409);
  assert.equal(conflict.code, "APPLY_CONFLICT");
  assert.deepEqual(conflict.conflicts, [existingPath]);
  assert.equal(readFileSync(join(managedRoot, existingPath), "utf-8"), "user edited meanwhile\n");

  // 4. A mid-transaction write failure rolls back every earlier block.
  //    Second block's target is a directory, so writeFileSync throws.
  mkdirSync(join(managedRoot, "blocked-dir"), { recursive: true });
  writeFileSync(join(managedRoot, "first.tex"), "before rollback\n", "utf-8");
  const rollback = await post("/api/editor/apply-blocks", {
    workspace: workspaceId,
    text: `${blockText("first.tex", "poisoned write")}\n${blockText("blocked-dir", "cannot write a directory")}`,
    apply: true,
  }, 500);
  assert.equal(rollback.code, "APPLY_ROLLBACK");
  assert.ok(rollback.rolledBack.includes("first.tex"));
  assert.equal(readFileSync(join(managedRoot, "first.tex"), "utf-8"), "before rollback\n");

  // 5. Rollback removes files that did not exist before the transaction.
  const rollback2 = await post("/api/editor/apply-blocks", {
    workspace: workspaceId,
    text: `${blockText("ghost/created.tex", "should vanish")}\n${blockText("blocked-dir", "still a directory")}`,
    apply: true,
  }, 500);
  assert.equal(rollback2.code, "APPLY_ROLLBACK");
  assert.equal(existsSync(join(managedRoot, "ghost/created.tex")), false);
});
