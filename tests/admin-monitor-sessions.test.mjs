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

test("admin monitor reports real process facts and sessions can be revoked", async (t) => {
  const port = await freePort();
  process.env.PAPER_OS_PORT = String(port);
  const stateRoot = mkdtempSync(join(tmpdir(), "paperos-admin-mon-"));
  const previousDataDir = process.env.PAPER_OS_DATA_DIR;
  process.env.PAPER_OS_DATA_DIR = join(stateRoot, "data");
  const { startServer, server } = await import(`../app/server.mjs?admin-mon=${Date.now()}`);

  function makeClient() {
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
    return { request, json };
  }
  const jsonBody = (obj) => ({ headers: { "Content-Type": "application/json" }, body: JSON.stringify(obj) });

  startServer();
  t.after(async () => {
    if (server.listening) await new Promise((r) => server.close(r));
    rmSync(stateRoot, { recursive: true, force: true });
    if (previousDataDir === undefined) delete process.env.PAPER_OS_DATA_DIR;
    else process.env.PAPER_OS_DATA_DIR = previousDataDir;
  });

  const admin = makeClient();
  await admin.json("/api/auth/bootstrap");
  await admin.json("/api/auth/local", { method: "POST", ...jsonBody({}) });

  // Monitor: real process/system/store readings.
  const mon = await admin.json("/api/admin/monitor");
  assert.equal(mon.process.node, process.version);
  assert.ok(mon.process.rssBytes > 0);
  assert.ok(mon.system.cpus >= 1);
  assert.ok(Array.isArray(mon.stores) && mon.stores.some((f) => f.name === "users.json"));
  assert.equal(typeof mon.workspaceCount, "number");

  // Sessions: the caller's own session is listed and protected.
  const first = await admin.json("/api/admin/sessions");
  const mine = first.sessions.find((s) => s.current);
  assert.ok(mine, "current session missing from the list");
  await admin.json(`/api/admin/sessions/${mine.id}`, { method: "DELETE" }, 400);

  // A second login session can be force-revoked and dies immediately.
  // Probe with a strictly-authenticated endpoint (/api/summary is public).
  const second = makeClient();
  await second.json("/api/auth/bootstrap");
  await second.json("/api/auth/local", { method: "POST", ...jsonBody({}) });
  await second.json("/api/chat/history"); // alive
  const listed = await admin.json("/api/admin/sessions");
  const other = listed.sessions.find((s) => !s.current);
  assert.ok(other, "second session not listed");
  await admin.json(`/api/admin/sessions/${other.id}`, { method: "DELETE" });
  const dead = await second.request("/api/chat/history");
  assert.equal(dead.status, 401, "revoked session should be unauthorized");

  // Unknown prefix -> 404.
  await admin.json("/api/admin/sessions/zzzzzzzzzzzz", { method: "DELETE" }, 404);
});
