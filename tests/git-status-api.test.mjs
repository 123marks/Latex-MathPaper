import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
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

test("git-status reports non-repos honestly and real branch/dirty counts for repos", async (t) => {
  const port = await freePort();
  process.env.PAPER_OS_PORT = String(port);
  const workspaceId = `gitst-${process.pid}-${Date.now()}`;
  const managedRoot = join(root, "workspaces", workspaceId);
  const stateRoot = mkdtempSync(join(tmpdir(), "paperos-gitst-"));
  const previousDataDir = process.env.PAPER_OS_DATA_DIR;
  process.env.PAPER_OS_DATA_DIR = join(stateRoot, "data");
  const { startServer, server } = await import(`../app/server.mjs?gitstatus=${Date.now()}`);

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
  await json("/api/editor/projects", { method: "POST", ...jsonBody({ id: workspaceId, name: "GitSt", pack: "latex" }) }, 201);

  // A managed workspace inside the repo's workspaces/ folder is itself inside
  // the outer git repo, so isRepo may be true here; what must hold is that we
  // never fabricate: branch must be a real string and dirtyCount a number.
  const first = await json(`/api/editor/git-status?workspace=${ws}`);
  assert.equal(typeof first.isRepo, "boolean");
  if (first.isRepo) {
    assert.equal(typeof first.branch, "string");
    assert.ok(first.branch.length > 0);
    assert.equal(typeof first.dirtyCount, "number");
  }

  // Make the workspace its own repo and assert the real branch + dirty count.
  const git = (args) => spawnSync("git", args, { cwd: managedRoot, encoding: "utf-8" });
  if (git(["--version"]).status !== 0) {
    t.diagnostic("git not available; skipping repo assertions");
    return;
  }
  assert.equal(git(["init", "-q", "-b", "paper-draft"]).status, 0);
  git(["config", "user.email", "t@example.com"]);
  git(["config", "user.name", "T"]);
  assert.equal(git(["add", "-A"]).status, 0);
  assert.equal(git(["commit", "-q", "-m", "seed"]).status, 0);

  // Under full-suite load git can exceed the route's timeout, which the route
  // reports as isRepo:false rather than guessing; retry briefly before judging.
  let clean = await json(`/api/editor/git-status?workspace=${ws}`);
  for (let i = 0; i < 3 && !clean.isRepo; i += 1) {
    await new Promise((r) => setTimeout(r, 1500));
    clean = await json(`/api/editor/git-status?workspace=${ws}`);
  }
  assert.equal(clean.isRepo, true);
  assert.equal(clean.branch, "paper-draft");
  assert.equal(clean.dirtyCount, 0);

  writeFileSync(join(managedRoot, "sections", "intro.tex"), "\\section{Changed}\n", "utf-8");
  writeFileSync(join(managedRoot, "notes.txt"), "new\n", "utf-8");
  let dirty = await json(`/api/editor/git-status?workspace=${ws}`);
  for (let i = 0; i < 3 && !dirty.isRepo; i += 1) {
    await new Promise((r) => setTimeout(r, 1500));
    dirty = await json(`/api/editor/git-status?workspace=${ws}`);
  }
  assert.equal(dirty.isRepo, true);
  assert.equal(dirty.dirtyCount, 2);
});
