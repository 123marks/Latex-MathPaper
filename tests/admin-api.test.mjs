import assert from "node:assert/strict";
import { createPublicKey, verify as cryptoVerify } from "node:crypto";
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

test("admin system settings, keys overview, and signed releases", async (t) => {
  const port = await freePort();
  process.env.PAPER_OS_PORT = String(port);
  const stateRoot = mkdtempSync(join(tmpdir(), "paperos-admin-"));
  const previousDataDir = process.env.PAPER_OS_DATA_DIR;
  process.env.PAPER_OS_DATA_DIR = join(stateRoot, "data");
  const { startServer, server } = await import(`../app/server.mjs?admin=${Date.now()}`);

  const jar = new Map();
  const cookie = () => [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  async function call(path, options = {}, expected) {
    const headers = { ...(options.headers || {}) };
    const c = cookie();
    if (c) headers.Cookie = c;
    const r = await fetch(`http://127.0.0.1:${port}${path}`, { ...options, headers });
    for (const raw of r.headers.getSetCookie?.() || []) {
      const [pair] = raw.split(";");
      const i = pair.indexOf("=");
      if (i > 0) jar.set(pair.slice(0, i), pair.slice(i + 1));
    }
    const payload = await r.json().catch(() => ({}));
    if (expected != null) assert.equal(r.status, expected, `${path}: ${JSON.stringify(payload)}`);
    return { status: r.status, payload };
  }
  const post = (p, b, e) => call(p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b || {}) }, e);
  const put = (p, b, e) => call(p, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b || {}) }, e);

  startServer();
  t.after(async () => {
    if (server.listening) await new Promise((r) => server.close(r));
    rmSync(stateRoot, { recursive: true, force: true });
    if (previousDataDir === undefined) delete process.env.PAPER_OS_DATA_DIR;
    else process.env.PAPER_OS_DATA_DIR = previousDataDir;
  });

  // First account becomes owner (admin).
  await post("/api/auth/register", { username: "boss", email: "b@ex.com", password: "OwnerPass99!" }, 200);

  const sys = await call("/api/admin/system", {}, 200);
  assert.equal(sys.payload.settings.registrationOpen, true);
  assert.equal(sys.payload.build.version.length > 0, true);
  assert.equal(sys.payload.counts.users, 1);

  // Toggle registration closed; a second self-serve register is then blocked.
  await put("/api/admin/system", { registrationOpen: false, loginRateMax: 7 }, 200);
  const closed = await post("/api/auth/register", { username: "late", password: "AnotherPass9!" }, 403);
  assert.equal(closed.payload.code, "REGISTRATION_CLOSED");
  const back = await call("/api/admin/system", {}, 200);
  assert.equal(back.payload.settings.registrationOpen, false);
  assert.equal(back.payload.settings.loginRateMax, 7);

  // Keys overview lists the owner without leaking any secret.
  const keys = await call("/api/admin/keys", {}, 200);
  assert.ok(Array.isArray(keys.payload.users));
  const boss = keys.payload.users.find((u) => u.username === "boss");
  assert.equal(boss.hasProviderKey, false);
  assert.ok(!JSON.stringify(keys.payload).toLowerCase().includes("apikeyenc"));

  // Signed release manifest verifies against the served public key.
  const rel = await call("/api/releases", {}, 200);
  assert.equal(rel.payload.signed, true);
  assert.equal(rel.payload.algorithm, "ed25519");
  const payload = {
    version: rel.payload.version,
    channel: rel.payload.channel,
    publishedAt: rel.payload.publishedAt,
    notes: rel.payload.notes,
    assets: rel.payload.assets.map(({ url, ...rest }) => rest),
  };
  const pub = createPublicKey({ key: Buffer.from(rel.payload.publicKey, "base64"), format: "der", type: "spki" });
  const ok = cryptoVerify(null, Buffer.from(JSON.stringify(payload), "utf-8"), pub, Buffer.from(rel.payload.signature, "base64"));
  assert.equal(ok, true, "release signature must verify against the published key");

  const pubkey = await call("/api/releases/pubkey", {}, 200);
  assert.equal(pubkey.payload.publicKey, rel.payload.publicKey);
  assert.match(pubkey.payload.publicKeyPem, /BEGIN PUBLIC KEY/);

  // Non-admins cannot reach admin endpoints.
  await post("/api/auth/logout", {}, 200);
  await put("/api/admin/system", { registrationOpen: true }, 401);
});
