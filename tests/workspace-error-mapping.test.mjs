import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

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

test("kernel errors map to honest HTTP statuses instead of 500", async (t) => {
  const port = await freePort();
  process.env.PAPER_OS_PORT = String(port);
  const stateRoot = mkdtempSync(join(tmpdir(), "paperos-kernel-err-"));
  const previousDataDir = process.env.PAPER_OS_DATA_DIR;
  process.env.PAPER_OS_DATA_DIR = join(stateRoot, "data");
  const { startServer, server } = await import(`../app/server.mjs?kernel-err=${Date.now()}`);

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
    rmSync(stateRoot, { recursive: true, force: true });
    if (previousDataDir === undefined) delete process.env.PAPER_OS_DATA_DIR;
    else process.env.PAPER_OS_DATA_DIR = previousDataDir;
  });

  await json("/api/auth/bootstrap");
  await json("/api/auth/local", { method: "POST", ...jsonBody({}) });

  // Unknown workspace ids surface as 404 WORKSPACE_NOT_FOUND, not 500.
  const tree = await json("/api/editor/tree?workspace=no-such-ws", {}, 404);
  assert.equal(tree.code, "WORKSPACE_NOT_FOUND");
  const file = await json("/api/editor/file?workspace=no-such-ws&path=paper/main.tex", {}, 404);
  assert.equal(file.code, "WORKSPACE_NOT_FOUND");
  const put = await json("/api/editor/file", {
    method: "PUT",
    ...jsonBody({ workspace: "no-such-ws", path: "paper/main.tex", content: "x" }),
  }, 404);
  assert.equal(put.code, "WORKSPACE_NOT_FOUND");

  // Malformed workspace ids surface as 400 INVALID_ID.
  const bad = await json(`/api/editor/tree?workspace=${encodeURIComponent("../evil")}`, {}, 400);
  assert.equal(bad.code, "INVALID_ID");
});
