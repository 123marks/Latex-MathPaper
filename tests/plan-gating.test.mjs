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

test("plan gating: free profile cap lifts after redeeming a pro code", async (t) => {
  const port = await freePort();
  process.env.PAPER_OS_PORT = String(port);
  const stateRoot = mkdtempSync(join(tmpdir(), "paperos-gating-"));
  const previousDataDir = process.env.PAPER_OS_DATA_DIR;
  process.env.PAPER_OS_DATA_DIR = join(stateRoot, "data");
  const { startServer, server } = await import(`../app/server.mjs?gating=${Date.now()}`);

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
  const profileBody = (i) => jsonBody({ name: `P${i}`, apiKey: `sk-${i}`, model: "gpt-4o-mini" });

  startServer();
  t.after(async () => {
    if (server.listening) await new Promise((r) => server.close(r));
    rmSync(stateRoot, { recursive: true, force: true });
    if (previousDataDir === undefined) delete process.env.PAPER_OS_DATA_DIR;
    else process.env.PAPER_OS_DATA_DIR = previousDataDir;
  });

  const owner = makeClient();
  await owner.json("/api/auth/bootstrap");
  await owner.json("/api/auth/local", { method: "POST", ...jsonBody({}) });

  const member = makeClient();
  await member.json("/api/auth/bootstrap");
  await member.json("/api/auth/register", {
    method: "POST",
    ...jsonBody({ username: "gated1", password: "Passw0rd!xyz12", displayName: "Gated" }),
  });

  // Free plan: three profiles fit, the fourth hits the published cap.
  for (let i = 1; i <= 3; i += 1) {
    const r = await member.json("/api/account/providers", { method: "POST", ...profileBody(i) }, 201);
    assert.equal(r.provider.profileLimit, 3);
  }
  const blocked = await member.json("/api/account/providers", { method: "POST", ...profileBody(4) }, 400);
  assert.equal(blocked.code, "PLAN_LIMIT");
  assert.equal(blocked.limit, 3);
  assert.match(blocked.error, /升级 Pro/);

  // Redeem a pro code -> the cap lifts to 10 immediately.
  const issued = await owner.json("/api/admin/licenses", { method: "POST", ...jsonBody({ plan: "pro", days: 30, count: 1 }) }, 201);
  await member.json("/api/account/redeem", { method: "POST", ...jsonBody({ code: issued.codes[0].code }) });
  const unlocked = await member.json("/api/account/providers", { method: "POST", ...profileBody(4) }, 201);
  assert.equal(unlocked.provider.profiles.length, 4);
  assert.equal(unlocked.provider.profileLimit, 10);

  // Payment channel status: manual only, honestly reported; member gets 403.
  const pay = await owner.json("/api/admin/payments");
  assert.equal(pay.providers.find((p) => p.id === "manual").available, true);
  assert.equal(pay.providers.filter((p) => p.available).length >= 1, true);
  await member.json("/api/admin/payments", {}, 403);
});
