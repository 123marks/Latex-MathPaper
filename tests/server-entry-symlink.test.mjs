import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, symlinkSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import test from "node:test";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const serverSource = join(repoRoot, "app", "server.mjs");

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

async function waitForHealth(port, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/health`);
      if (response.ok) return await response.json();
    } catch { /* server is still starting */ }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 100));
  }
  throw new Error(`health timeout on port ${port}`);
}

test("server starts when launched through a directory junction", async () => {
  const tempRoot = mkdtempSync(join(tmpdir(), "paperos-server-entry-"));
  const port = await freePort();
  const dataDir = join(tempRoot, "data");
  mkdirSync(dataDir, { recursive: true });
  symlinkSync(join(repoRoot, "app"), join(tempRoot, "app"), "junction");

  const child = spawn(process.execPath, ["app/server.mjs"], {
    cwd: tempRoot,
    env: { ...process.env, PAPER_OS_PORT: String(port), PAPER_OS_DATA_DIR: dataDir },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  let stderr = "";
  child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });

  try {
    const health = await waitForHealth(port);
    assert.equal(health.ok, true);
  } catch (error) {
    const exit = await new Promise((resolveExit) => {
      child.once("exit", (code, signal) => resolveExit({ code, signal }));
      setTimeout(() => resolveExit({ code: child.exitCode, signal: null }), 500);
    });
    throw new Error(`${error.message}; child=${JSON.stringify(exit)}; stderr=${stderr}`);
  } finally {
    if (!child.killed && child.exitCode == null) {
      child.kill();
      await Promise.race([
        new Promise((resolveExit) => child.once("exit", resolveExit)),
        new Promise((resolveDelay) => setTimeout(resolveDelay, 1500)),
      ]);
    }
    rmSync(tempRoot, { recursive: true, force: true });
  }
});
