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

test("license lifecycle: issue, redeem, extend, dedupe, permissions", async (t) => {
  const port = await freePort();
  process.env.PAPER_OS_PORT = String(port);
  const stateRoot = mkdtempSync(join(tmpdir(), "paperos-licenses-"));
  const previousDataDir = process.env.PAPER_OS_DATA_DIR;
  process.env.PAPER_OS_DATA_DIR = join(stateRoot, "data");
  const { startServer, server } = await import(`../app/server.mjs?licenses=${Date.now()}`);

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

  const owner = makeClient();
  await owner.json("/api/auth/bootstrap");
  await owner.json("/api/auth/local", { method: "POST", ...jsonBody({}) });

  // Validation + issuance.
  await owner.json("/api/admin/licenses", { method: "POST", ...jsonBody({ plan: "enterprise" }) }, 400);
  const issued = await owner.json("/api/admin/licenses", {
    method: "POST",
    ...jsonBody({ plan: "pro", days: 30, count: 3 }),
  }, 201);
  assert.equal(issued.codes.length, 3);
  for (const c of issued.codes) {
    assert.match(c.code, /^PRO-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    assert.equal(c.redeemedBy, null);
  }
  const [c1, c2] = issued.codes;

  // A regular member redeems; plan lands on the account.
  const member = makeClient();
  await member.json("/api/auth/bootstrap");
  await member.json("/api/auth/register", {
    method: "POST",
    ...jsonBody({ username: "buyer1", password: "Passw0rd!xyz12", displayName: "Buyer" }),
  });
  const before = Date.now();
  const redeemed = await member.json("/api/account/redeem", { method: "POST", ...jsonBody({ code: c1.code }) });
  assert.equal(redeemed.plan, "pro");
  const expiry1 = new Date(redeemed.planExpiresAt).getTime();
  assert.ok(Math.abs(expiry1 - (before + 30 * 86400000)) < 5 * 60 * 1000, "expiry should be ~30d out");

  // Same code cannot be redeemed twice; unknown codes 404; case-insensitive input.
  await member.json("/api/account/redeem", { method: "POST", ...jsonBody({ code: c1.code.toLowerCase() }) }, 409);
  await member.json("/api/account/redeem", { method: "POST", ...jsonBody({ code: "PRO-0000-0000-0000" }) }, 404);

  // Redeeming a second code for the same active plan extends from the expiry.
  const extended = await member.json("/api/account/redeem", { method: "POST", ...jsonBody({ code: c2.code }) });
  const expiry2 = new Date(extended.planExpiresAt).getTime();
  assert.ok(Math.abs(expiry2 - (expiry1 + 30 * 86400000)) < 5 * 60 * 1000, "second redeem should extend, not reset");

  // Members cannot issue codes.
  await member.json("/api/admin/licenses", { method: "POST", ...jsonBody({ plan: "pro" }) }, 403);

  // Ledger reflects redemption with the redeemer's name.
  const ledger = await owner.json("/api/admin/licenses");
  const row = ledger.codes.find((c) => c.code === c1.code);
  assert.equal(row.redeemedByName, "Buyer");
  assert.ok(row.redeemedAt);
});
