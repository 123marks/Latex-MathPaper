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

test("provider profiles: add, auto-activate, switch, delete, never leak keys", async (t) => {
  const port = await freePort();
  process.env.PAPER_OS_PORT = String(port);
  const stateRoot = mkdtempSync(join(tmpdir(), "paperos-providers-"));
  const previousDataDir = process.env.PAPER_OS_DATA_DIR;
  process.env.PAPER_OS_DATA_DIR = join(stateRoot, "data");
  const { startServer, server } = await import(`../app/server.mjs?providers=${Date.now()}`);

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

  // Validation.
  await json("/api/account/providers", { method: "POST", ...jsonBody({}) }, 400);
  await json("/api/account/providers", { method: "POST", ...jsonBody({ name: "OpenRouter" }) }, 400);

  // First profile auto-activates.
  const first = await json("/api/account/providers", {
    method: "POST",
    ...jsonBody({ name: "OpenRouter", apiKey: "sk-test-1", base_url: "https://openrouter.example/v1", model: "gpt-4o-mini" }),
  }, 201);
  assert.equal(first.provider.profiles.length, 1);
  const p1 = first.provider.profiles[0];
  assert.equal(p1.active, true);
  assert.equal(p1.hasKey, true);
  assert.equal(first.provider.activeProfileId, p1.id);
  assert.equal(first.provider.source, "profile");
  // The plaintext key and the encrypted blob must never leave the server.
  const leaked = JSON.stringify(first);
  assert.ok(!leaked.includes("sk-test-1"), "plaintext key leaked");
  assert.ok(!leaked.includes("apiKeyEnc"), "encrypted key blob leaked");

  // Second profile does not steal the active slot.
  const second = await json("/api/account/providers", {
    method: "POST",
    ...jsonBody({ name: "DeepSeek", apiKey: "sk-test-2", model: "deepseek-chat" }),
  }, 201);
  assert.equal(second.provider.profiles.length, 2);
  assert.equal(second.provider.activeProfileId, p1.id);
  const p2 = second.provider.profiles.find((p) => p.name === "DeepSeek");
  assert.equal(p2.active, false);
  assert.equal(p2.base_url, "https://api.openai.com/v1"); // default applied

  // Switch the active profile.
  const switched = await json("/api/account/providers/activate", { method: "POST", ...jsonBody({ id: p2.id }) });
  assert.equal(switched.provider.activeProfileId, p2.id);
  assert.equal(switched.provider.profiles.find((p) => p.id === p1.id).active, false);

  // Unknown ids -> 404.
  await json("/api/account/providers/activate", { method: "POST", ...jsonBody({ id: "nope" }) }, 404);
  await json("/api/account/providers/nope", { method: "DELETE" }, 404);

  // Deleting the active profile clears the selection and falls back.
  const afterDelete = await json(`/api/account/providers/${p2.id}`, { method: "DELETE" });
  assert.equal(afterDelete.provider.profiles.length, 1);
  assert.equal(afterDelete.provider.activeProfileId, null);
  assert.notEqual(afterDelete.provider.source, "profile");
});
