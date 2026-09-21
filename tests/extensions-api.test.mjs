import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  buildThemeLanguageVsix,
  buildTraversalVsix,
  FIXTURE_DISPLAY_NAME,
  FIXTURE_EXTENSION_ID,
} from "./fixtures/paperos-theme-language-vsix.mjs";

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

test("extensions API installs, toggles, and refuses traversal without executing JS", async (t) => {
  const port = await freePort();
  process.env.PAPER_OS_PORT = String(port);
  const stateRoot = mkdtempSync(join(tmpdir(), "paperos-ext-api-"));
  const previousDataDir = process.env.PAPER_OS_DATA_DIR;
  process.env.PAPER_OS_DATA_DIR = join(stateRoot, "data");
  const { startServer, server } = await import(`../app/server.mjs?extensions=${Date.now()}`);

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
  const jsonBody = (obj) => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(obj) });

  startServer();
  t.after(async () => {
    if (server.listening) await new Promise((done) => server.close(done));
    rmSync(stateRoot, { recursive: true, force: true });
    if (previousDataDir === undefined) delete process.env.PAPER_OS_DATA_DIR;
    else process.env.PAPER_OS_DATA_DIR = previousDataDir;
  });

  await json("/api/auth/bootstrap");
  await json("/api/auth/local", jsonBody({}));

  const denied = await request("/api/extensions");
  // cookie is already set from bootstrap/local; unauth is checked by dropping cookie
  const noCookie = await fetch(`http://127.0.0.1:${port}/api/extensions`);
  assert.equal(noCookie.status, 401);

  const empty = await json("/api/extensions");
  assert.equal(empty.host.executesExtensionJs, false);
  assert.equal(empty.host.claim, "not-full-vscode-compat");
  assert.equal(empty.extensions.length, 0);
  assert.ok(empty.matrix.some((row) => row.id === "grammars" && row.status === "planned"));
  assert.ok(empty.matrix.some((row) => row.id === "commands" && row.status === "unsupported"));

  const traversal = await json("/api/extensions/install", jsonBody({
    filename: "evil.vsix",
    content: buildTraversalVsix().toString("base64"),
  }), 400);
  assert.equal(traversal.code, "VSIX_TRAVERSAL");

  const installed = await json("/api/extensions/install", jsonBody({
    filename: "fixture.vsix",
    content: buildThemeLanguageVsix().toString("base64"),
  }), 201);
  assert.equal(installed.extension.id, FIXTURE_EXTENSION_ID);
  assert.equal(installed.extension.displayName, FIXTURE_DISPLAY_NAME);
  assert.equal(installed.extension.activation.executed, false);
  assert.equal(installed.themes[0].colors["editor.background"], "#1A2B3C");
  assert.equal(installed.languages[0].id, "paperos-fixture");

  const listed = await json("/api/extensions");
  assert.equal(listed.extensions.length, 1);

  const disabled = await json(`/api/extensions/${FIXTURE_EXTENSION_ID}/disable`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  assert.equal(disabled.extension.enabled, false);
  assert.equal(disabled.themes.length, 0);

  const enabled = await json(`/api/extensions/${FIXTURE_EXTENSION_ID}/enable`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  assert.equal(enabled.extension.enabled, true);
  assert.equal(enabled.themes.length, 1);

  await json(`/api/extensions/${FIXTURE_EXTENSION_ID}`, { method: "DELETE" });
  const after = await json("/api/extensions");
  assert.equal(after.extensions.length, 0);

  // silence unused in case lint flags the first authenticated GET
  assert.equal(denied.status, 200);
  assert.ok(root);
});
