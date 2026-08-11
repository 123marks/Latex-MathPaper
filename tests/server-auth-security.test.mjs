import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createConnection, createServer as createNetServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import test from "node:test";

function freePort() {
  return new Promise((resolvePort, reject) => {
    const probe = createNetServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      probe.close(() => resolvePort(address.port));
    });
  });
}

function rawHttp(port, request) {
  return new Promise((resolveResponse, reject) => {
    const socket = createConnection({ host: "127.0.0.1", port });
    let response = "";
    socket.setEncoding("utf8");
    socket.once("error", reject);
    socket.on("data", (chunk) => { response += chunk; });
    socket.on("end", () => resolveResponse(response));
    socket.once("connect", () => socket.end(request));
  });
}

test("loopback authority and one-time local bootstrap protect owner provisioning", async (t) => {
  const port = await freePort();
  const stateRoot = mkdtempSync(join(tmpdir(), "paperos-auth-security-"));
  const previousPort = process.env.PAPER_OS_PORT;
  const previousDataDir = process.env.PAPER_OS_DATA_DIR;
  process.env.PAPER_OS_PORT = String(port);
  process.env.PAPER_OS_DATA_DIR = join(stateRoot, "data");

  const { server, startServer } = await import(`../app/server.mjs?auth-security=${Date.now()}`);
  t.after(async () => {
    if (server.listening) await new Promise((resolveClose) => server.close(resolveClose));
    rmSync(stateRoot, { recursive: true, force: true });
    if (previousPort === undefined) delete process.env.PAPER_OS_PORT;
    else process.env.PAPER_OS_PORT = previousPort;
    if (previousDataDir === undefined) delete process.env.PAPER_OS_DATA_DIR;
    else process.env.PAPER_OS_DATA_DIR = previousDataDir;
  });
  startServer();
  if (!server.listening) await once(server, "listening");

  const base = `http://127.0.0.1:${port}`;
  async function json(path, options = {}, expected = 200) {
    const response = await fetch(`${base}${path}`, options);
    const payload = await response.json();
    assert.equal(response.status, expected, `${path}: ${JSON.stringify(payload)}`);
    return { response, payload };
  }

  const health = await json("/api/health");
  assert.equal(health.payload.ok, true);
  await json("/api/health", { headers: { Origin: `http://localhost:${port}` } });

  for (const host of ["evil.test", `localhost.:${port}`, `user@localhost:${port}`]) {
    const response = await rawHttp(
      port,
      `GET /api/health HTTP/1.1\r\nHost: ${host}\r\nConnection: close\r\n\r\n`,
    );
    assert.match(response, /^HTTP\/1\.1 421 /);
    assert.match(response, /"code": "INVALID_HOST"/);
  }
  for (const request of [
    "GET /api/health HTTP/1.1\r\nConnection: close\r\n\r\n",
    `GET /api/health HTTP/1.1\r\nHost: localhost:${port}\r\nHost: 127.0.0.1:${port}\r\nConnection: close\r\n\r\n`,
  ]) {
    const response = await rawHttp(port, request);
    assert.match(response, /^HTTP\/1\.1 421 /);
  }

  for (const origin of ["https://evil.test", "null", `http://localhost.:${port}`]) {
    const rejected = await json("/api/health", { headers: { Origin: origin } }, 403);
    assert.equal(rejected.payload.code, "INVALID_ORIGIN");
  }
  const plainMutation = await json("/api/auth/local", {
    method: "POST",
    headers: { Origin: "https://evil.test", "Content-Type": "text/plain" },
    body: "{}",
  }, 403);
  assert.equal(plainMutation.payload.code, "INVALID_ORIGIN");
  const crossSiteMutation = await json("/api/auth/local", {
    method: "POST",
    headers: { "Sec-Fetch-Site": "cross-site" },
  }, 403);
  assert.equal(crossSiteMutation.payload.code, "CROSS_SITE_REQUEST");
  const crossSiteBootstrap = await json("/api/auth/bootstrap", {
    headers: { "Sec-Fetch-Site": "cross-site" },
  }, 403);
  assert.equal(crossSiteBootstrap.payload.code, "CROSS_SITE_REQUEST");

  const malformedCookie = await rawHttp(
    port,
    `POST /api/auth/local HTTP/1.1\r\nHost: evil.test\r\nCookie: broken=%\r\nContent-Length: 0\r\nConnection: close\r\n\r\n`,
  );
  assert.match(malformedCookie, /^HTTP\/1\.1 421 /);

  const bootstrap = await json("/api/auth/bootstrap");
  const bootstrapCookie = bootstrap.response.headers
    .getSetCookie()
    .find((value) => value.startsWith("paper_os_local_bootstrap="));
  assert.ok(bootstrapCookie);
  assert.match(bootstrapCookie, /; Path=\/api\/auth\/local(?:;|$)/);
  assert.match(bootstrapCookie, /; HttpOnly(?:;|$)/);
  assert.match(bootstrapCookie, /; SameSite=Strict(?:;|$)/);
  const cookiePair = bootstrapCookie.split(";", 1)[0];
  const encodedToken = cookiePair.slice(cookiePair.indexOf("=") + 1);
  const token = decodeURIComponent(encodedToken);
  assert.equal(Buffer.from(token, "base64url").length, 32);
  assert.doesNotMatch(JSON.stringify(bootstrap.payload), new RegExp(token));

  const missing = await json("/api/auth/local", { method: "POST" }, 403);
  assert.equal(missing.payload.code, "LOCAL_BOOTSTRAP_REQUIRED");
  const local = await json("/api/auth/local", {
    method: "POST",
    headers: { Cookie: cookiePair },
  });
  assert.equal(local.payload.mode, "local");
  assert.doesNotMatch(JSON.stringify(local.payload), new RegExp(token));
  const successCookies = local.response.headers.getSetCookie();
  assert.ok(successCookies.some((value) => value.startsWith("paper_os_session=")));
  assert.ok(successCookies.some((value) =>
    value.startsWith("paper_os_local_bootstrap=;") && value.includes("Max-Age=0")));

  const reused = await json("/api/auth/local", {
    method: "POST",
    headers: { Cookie: cookiePair },
  }, 403);
  assert.equal(reused.payload.code, "LOCAL_BOOTSTRAP_REQUIRED");

  const wsRejected = await rawHttp(
    port,
    [
      "GET /ws/test HTTP/1.1",
      `Host: localhost:${port}`,
      "Upgrade: websocket",
      "Connection: Upgrade",
      "Sec-WebSocket-Version: 13",
      "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==",
      "Origin: https://evil.test",
      "",
      "",
    ].join("\r\n"),
  );
  assert.match(wsRejected, /^HTTP\/1\.1 403 /);
  assert.match(wsRejected, /INVALID_ORIGIN/);
});
