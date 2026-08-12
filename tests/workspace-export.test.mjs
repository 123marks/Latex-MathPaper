import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
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

test("workspace export streams a verifiable tar.gz backup", async (t) => {
  const port = await freePort();
  process.env.PAPER_OS_PORT = String(port);
  const workspaceId = `exp-${process.pid}-${Date.now()}`;
  const managedRoot = join(root, "workspaces", workspaceId);
  const stateRoot = mkdtempSync(join(tmpdir(), "paperos-export-"));
  const previousDataDir = process.env.PAPER_OS_DATA_DIR;
  process.env.PAPER_OS_DATA_DIR = join(stateRoot, "data");
  const { startServer, server } = await import(`../app/server.mjs?export=${Date.now()}`);

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
  const anon = await fetch(`http://127.0.0.1:${port}/api/editor/export-archive?workspace=x`);
  assert.equal(anon.status, 401);

  await json("/api/auth/bootstrap");
  await json("/api/auth/local", { method: "POST", ...jsonBody({}) });
  await json("/api/editor/projects", { method: "POST", ...jsonBody({ id: workspaceId, name: "Exp", pack: "latex" }) }, 201);

  // Unknown workspace -> 404.
  await json("/api/editor/export-archive?workspace=no-such", {}, 404);

  const download = await request(`/api/editor/export-archive?workspace=${encodeURIComponent(workspaceId)}`);
  assert.equal(download.status, 200);
  assert.equal(download.headers.get("content-type"), "application/gzip");
  assert.match(download.headers.get("content-disposition") || "", new RegExp(workspaceId));
  const bytes = Buffer.from(await download.arrayBuffer());
  // gzip magic bytes + checksum header integrity.
  assert.equal(bytes[0], 0x1f);
  assert.equal(bytes[1], 0x8b);
  const sha = createHash("sha256").update(bytes).digest("hex");
  assert.equal(download.headers.get("x-checksum-sha256"), sha);

  // The archive really contains the workspace scaffold.
  const archivePath = join(stateRoot, "export.tar.gz");
  writeFileSync(archivePath, bytes);
  const listing = execFileSync("tar", ["-tzf", archivePath], { encoding: "utf-8" });
  assert.match(listing, new RegExp(`${workspaceId}/main\\.tex`));
  assert.match(listing, new RegExp(`${workspaceId}/references\\.bib`));
  assert.match(listing, new RegExp(`${workspaceId}/sections/`));
});
