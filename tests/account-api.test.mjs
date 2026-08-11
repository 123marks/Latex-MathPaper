import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

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

test("account center: profile, password, per-user encrypted key, sessions", async (t) => {
  const port = await freePort();
  process.env.PAPER_OS_PORT = String(port);
  const stateRoot = mkdtempSync(join(tmpdir(), "paperos-account-"));
  const dataDir = join(stateRoot, "data");
  const previousDataDir = process.env.PAPER_OS_DATA_DIR;
  process.env.PAPER_OS_DATA_DIR = dataDir;
  const { startServer, server } = await import(`../app/server.mjs?account=${Date.now()}`);

  const jar = new Map();
  function cookieHeader() {
    return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  }
  async function call(path, options = {}, expected) {
    const headers = { ...(options.headers || {}) };
    const cookie = cookieHeader();
    if (cookie) headers.Cookie = cookie;
    const response = await fetch(`http://127.0.0.1:${port}${path}`, { ...options, headers });
    for (const raw of response.headers.getSetCookie?.() || []) {
      const [pair] = raw.split(";");
      const idx = pair.indexOf("=");
      if (idx > 0) jar.set(pair.slice(0, idx), pair.slice(idx + 1));
    }
    const payload = await response.json().catch(() => ({}));
    if (expected != null) assert.equal(response.status, expected, `${path}: ${JSON.stringify(payload)}`);
    return { status: response.status, payload };
  }
  const post = (p, body, expected) => call(p, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}),
  }, expected);
  const put = (p, body, expected) => call(p, {
    method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}),
  }, expected);

  startServer();
  t.after(async () => {
    if (server.listening) await new Promise((r) => server.close(r));
    rmSync(stateRoot, { recursive: true, force: true });
    if (previousDataDir === undefined) delete process.env.PAPER_OS_DATA_DIR;
    else process.env.PAPER_OS_DATA_DIR = previousDataDir;
  });

  // Register (first user -> owner). Weak password rejected by policy.
  await post("/api/auth/register", { username: "alice", password: "short" }, 400);
  await post("/api/auth/register", { username: "alice", email: "a@ex.com", password: "Str0ngPass!!" }, 200);

  const overview = await call("/api/account/overview", {}, 200);
  assert.equal(overview.payload.user.username, "alice");
  assert.equal(overview.payload.user.role, "owner");
  assert.ok(Array.isArray(overview.payload.sessions));
  assert.ok(overview.payload.sessions.some((s) => s.current), "one session must be current");

  // Profile update.
  const profile = await put("/api/account/profile", { displayName: "Alice L", email: "alice@lab.io" }, 200);
  assert.equal(profile.payload.user.displayName, "Alice L");
  assert.equal(profile.payload.user.email, "alice@lab.io");

  // Password: wrong current rejected; weak new rejected; valid rotates.
  await post("/api/account/password", { current: "nope", next: "An0therGood!!" }, 400);
  await post("/api/account/password", { current: "Str0ngPass!!", next: "weak" }, 400);
  await post("/api/account/password", { current: "Str0ngPass!!", next: "An0therGood!!" }, 200);

  // Per-user provider + encrypted API key.
  await put("/api/account/provider", { base_url: "https://api.openai.com/v1", model: "gpt-4o", temperature: 0.3 }, 200);
  let prov = await call("/api/account/overview", {}, 200);
  assert.equal(prov.payload.provider.model, "gpt-4o");
  assert.equal(prov.payload.provider.hasKey, false);

  await put("/api/account/provider", { apiKey: "sk-secret-value-123" }, 200);
  prov = await call("/api/account/overview", {}, 200);
  assert.equal(prov.payload.provider.hasKey, true);
  assert.equal(prov.payload.provider.source, "user");

  // The stored key must be encrypted at rest and never returned in any response.
  const stored = readFileSync(join(dataDir, "account-providers.json"), "utf-8");
  assert.ok(!stored.includes("sk-secret-value-123"), "raw key must not be on disk");
  assert.match(stored, /"apiKeyEnc":\s*"v1\./);
  assert.ok(!JSON.stringify(prov.payload).includes("sk-secret-value-123"), "key must never be sent to client");

  // Effective provider reflected on /api/provider active.
  const gw = await call("/api/provider", {}, 200);
  assert.equal(gw.payload.active.keyPresent, true);
  assert.equal(gw.payload.active.source, "user");
  assert.equal(gw.payload.active.model, "gpt-4o");

  // Delete the key -> hasKey false again.
  await call("/api/account/provider/key", { method: "DELETE" }, 200);
  prov = await call("/api/account/overview", {}, 200);
  assert.equal(prov.payload.provider.hasKey, false);

  // Sessions: create a second session (fresh login), then revoke others.
  const jar2 = new Map();
  const login = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: "alice", password: "An0therGood!!" }),
  });
  assert.equal(login.status, 200);
  const overviewMulti = await call("/api/account/overview", {}, 200);
  assert.ok(overviewMulti.payload.sessions.length >= 2, "should see the new session");
  const revoke = await post("/api/account/sessions/revoke-others", {}, 200);
  assert.equal(revoke.payload.kept, 1, "only the caller session remains");
});

test("auth endpoints reject oversized bodies and rate-limit brute force", async (t) => {
  const port = await freePort();
  process.env.PAPER_OS_PORT = String(port);
  const stateRoot = mkdtempSync(join(tmpdir(), "paperos-sec-"));
  const previousDataDir = process.env.PAPER_OS_DATA_DIR;
  const previousMax = process.env.PAPER_OS_MAX_BODY_BYTES;
  process.env.PAPER_OS_DATA_DIR = join(stateRoot, "data");
  process.env.PAPER_OS_MAX_BODY_BYTES = "2048";
  const { startServer, server } = await import(`../app/server.mjs?sec=${Date.now()}`);

  startServer();
  t.after(async () => {
    if (server.listening) await new Promise((r) => server.close(r));
    rmSync(stateRoot, { recursive: true, force: true });
    if (previousDataDir === undefined) delete process.env.PAPER_OS_DATA_DIR;
    else process.env.PAPER_OS_DATA_DIR = previousDataDir;
    if (previousMax === undefined) delete process.env.PAPER_OS_MAX_BODY_BYTES;
    else process.env.PAPER_OS_MAX_BODY_BYTES = previousMax;
  });

  // Oversized body -> 413.
  const big = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: "x", password: "y".repeat(5000) }),
  });
  assert.equal(big.status, 413);

  // Security headers present on a normal response.
  const health = await fetch(`http://127.0.0.1:${port}/api/health`);
  assert.equal(health.headers.get("x-content-type-options"), "nosniff");
  assert.match(health.headers.get("content-security-policy") || "", /default-src 'self'/);

  // Brute-force login -> eventually 429.
  let sawRateLimit = false;
  for (let i = 0; i < 20; i++) {
    const r = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: "ghost", password: "WrongPass1!" }),
    });
    if (r.status === 429) { sawRateLimit = true; break; }
  }
  assert.ok(sawRateLimit, "login must rate-limit after repeated attempts");
});

test("releases manifest lists platforms and reports unavailable downloads", async (t) => {
  const port = await freePort();
  process.env.PAPER_OS_PORT = String(port);
  const stateRoot = mkdtempSync(join(tmpdir(), "paperos-rel-"));
  const previousDataDir = process.env.PAPER_OS_DATA_DIR;
  process.env.PAPER_OS_DATA_DIR = join(stateRoot, "data");
  const { startServer, server } = await import(`../app/server.mjs?rel=${Date.now()}`);

  startServer();
  t.after(async () => {
    if (server.listening) await new Promise((r) => server.close(r));
    rmSync(stateRoot, { recursive: true, force: true });
    if (previousDataDir === undefined) delete process.env.PAPER_OS_DATA_DIR;
    else process.env.PAPER_OS_DATA_DIR = previousDataDir;
  });

  const releases = await fetch(`http://127.0.0.1:${port}/api/releases`);
  const manifest = await releases.json();
  assert.equal(releases.status, 200);
  assert.ok(manifest.version);
  assert.ok(manifest.assets.some((a) => a.os === "windows"));
  // Public manifest must not leak server absolute paths.
  assert.ok(!JSON.stringify(manifest).toLowerCase().includes("absolutepath"));
  for (const asset of manifest.assets) {
    assert.equal(typeof asset.available, "boolean");
    assert.match(asset.url, /^\/api\/download\//);
  }
  // Windows download: if the packaged artifact exists it streams (200 + a
  // SHA-256 header); otherwise it returns a friendly not-ready 404. Accept
  // either so the test is independent of whether `npm run package:win` ran.
  const win = await fetch(`http://127.0.0.1:${port}/api/download/windows`);
  if (win.status === 200) {
    assert.ok((win.headers.get("x-checksum-sha256") || "").length >= 64);
  } else {
    assert.equal(win.status, 404);
    assert.equal((await win.json()).code, "ASSET_NOT_READY");
  }
  // macOS: the portable tar.gz may or may not have been packaged on this
  // machine. Either way the endpoint must stay honest — a real stream with a
  // checksum, or a friendly not-ready 404. Never a fabricated success.
  const mac = await fetch(`http://127.0.0.1:${port}/api/download/macos`);
  if (mac.status === 200) {
    assert.ok((mac.headers.get("x-checksum-sha256") || "").length >= 64);
    await mac.arrayBuffer(); // drain the stream
  } else {
    assert.equal(mac.status, 404);
    assert.equal((await mac.json()).code, "ASSET_NOT_READY");
  }
  // Unknown platform -> 404 UNKNOWN_OS.
  const unknown = await fetch(`http://127.0.0.1:${port}/api/download/haiku`);
  assert.equal(unknown.status, 404);
  assert.equal((await unknown.json()).code, "UNKNOWN_OS");
});
