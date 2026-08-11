import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
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
      const address = probe.address();
      const port = typeof address === "object" ? address.port : 0;
      probe.close(() => resolvePort(port));
    });
  });
}

test("SPA history fallback serves index.html for client routes, 404s assets", async (t) => {
  const port = await freePort();
  process.env.PAPER_OS_PORT = String(port);
  const stateRoot = mkdtempSync(join(tmpdir(), "paperos-spa-"));
  const previousDataDir = process.env.PAPER_OS_DATA_DIR;
  process.env.PAPER_OS_DATA_DIR = join(stateRoot, "data");

  // Ensure a marker index.html exists so we can assert it was served.
  const publicDir = join(root, "app", "public");
  const indexPath = join(publicDir, "index.html");
  let createdIndex = false;
  const { existsSync, readFileSync } = await import("node:fs");
  if (!existsSync(indexPath)) {
    mkdirSync(publicDir, { recursive: true });
    writeFileSync(indexPath, '<!doctype html><div id="root"></div>', "utf-8");
    createdIndex = true;
  }
  const marker = readFileSync(indexPath, "utf-8").slice(0, 40);

  const { startServer, server } = await import(`../app/server.mjs?spa=${Date.now()}`);
  startServer();
  t.after(async () => {
    if (server.listening) await new Promise((r) => server.close(r));
    rmSync(stateRoot, { recursive: true, force: true });
    if (createdIndex) rmSync(indexPath, { force: true });
    if (previousDataDir === undefined) delete process.env.PAPER_OS_DATA_DIR;
    else process.env.PAPER_OS_DATA_DIR = previousDataDir;
  });

  // Client route -> index.html (200 with the SPA shell).
  const route = await fetch(`http://127.0.0.1:${port}/pricing`);
  assert.equal(route.status, 200);
  const body = await route.text();
  assert.ok(body.includes(marker.slice(0, 12)) || body.includes('id="root"'));

  const nested = await fetch(`http://127.0.0.1:${port}/app/account`);
  assert.equal(nested.status, 200);

  // Missing asset -> real 404 (never masked by the SPA shell).
  const asset = await fetch(`http://127.0.0.1:${port}/assets/does-not-exist.js`);
  assert.equal(asset.status, 404);

  // Unknown API -> JSON handling, not the SPA shell.
  const apiMiss = await fetch(`http://127.0.0.1:${port}/api/nope`);
  assert.notEqual(apiMiss.status, 200);
});
