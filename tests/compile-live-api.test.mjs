import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync, utimesSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fakeEngine = join(root, "tests", "fixtures", "fake-latexmk.mjs");

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

function isolatedPath() {
  const nodeDir = dirname(process.execPath);
  const extras = process.platform === "win32"
    ? [process.env.SystemRoot ? join(process.env.SystemRoot, "System32") : "C:\\Windows\\System32"]
    : ["/bin", "/usr/bin"];
  const sep = process.platform === "win32" ? ";" : ":";
  return [nodeDir, ...extras].join(sep);
}

function tex(mode, body = "\\documentclass{article}\\begin{document}ok\\end{document}\n") {
  return `% PAPEROS_FAKE: ${mode}\n${body}`;
}

async function pollLast(json, workspaceId, predicate, timeoutMs = 8000) {
  const deadline = Date.now() + timeoutMs;
  let status;
  while (Date.now() < deadline) {
    status = await json(`/api/editor/compile-status?workspace=${encodeURIComponent(workspaceId)}`);
    if (status.last && predicate(status.last)) return status;
    await new Promise((r) => setTimeout(r, 80));
  }
  throw new Error(`compile-status last never matched: ${JSON.stringify(status)}`);
}

test("compile-live: no-engine, busy, cancel, fresh success, stale failure", async (t) => {
  const port = await freePort();
  const workspaceId = `compile-live-${process.pid}-${Date.now()}`;
  const managedRoot = join(root, "workspaces", workspaceId);
  const stateRoot = mkdtempSync(join(tmpdir(), "paperos-compile-live-"));

  const previous = {
    port: process.env.PAPER_OS_PORT,
    dataDir: process.env.PAPER_OS_DATA_DIR,
    path: process.env.PATH,
    latexmk: process.env.PAPER_OS_LATEXMK,
    timeout: process.env.PAPER_OS_COMPILE_TIMEOUT_MS,
  };
  process.env.PAPER_OS_PORT = String(port);
  process.env.PAPER_OS_DATA_DIR = join(stateRoot, "data");
  process.env.PAPER_OS_LATEXMK = fakeEngine;
  process.env.PATH = isolatedPath();

  const { startServer, server } = await import(`../app/server.mjs?compile-live=${Date.now()}`);

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
    rmSync(managedRoot, { recursive: true, force: true });
    rmSync(stateRoot, { recursive: true, force: true });
    if (previous.port === undefined) delete process.env.PAPER_OS_PORT;
    else process.env.PAPER_OS_PORT = previous.port;
    if (previous.dataDir === undefined) delete process.env.PAPER_OS_DATA_DIR;
    else process.env.PAPER_OS_DATA_DIR = previous.dataDir;
    if (previous.latexmk === undefined) delete process.env.PAPER_OS_LATEXMK;
    else process.env.PAPER_OS_LATEXMK = previous.latexmk;
    if (previous.timeout === undefined) delete process.env.PAPER_OS_COMPILE_TIMEOUT_MS;
    else process.env.PAPER_OS_COMPILE_TIMEOUT_MS = previous.timeout;
    process.env.PATH = previous.path;
  });

  await json("/api/auth/bootstrap");
  await json("/api/auth/local", { method: "POST", ...jsonBody({}) });
  await json("/api/editor/projects", { method: "POST", ...jsonBody({ id: workspaceId, name: "Compile Live", pack: "latex" }) }, 201);

  await json("/api/editor/file", { method: "POST", ...jsonBody({ workspace: workspaceId, path: "ok.tex", content: tex("success") }) }, 201);
  await json("/api/editor/file", { method: "POST", ...jsonBody({ workspace: workspaceId, path: "bad.tex", content: tex("fail") }) }, 201);
  await json("/api/editor/file", { method: "POST", ...jsonBody({ workspace: workspaceId, path: "hang.tex", content: tex("hang") }) }, 201);

  process.env.PAPER_OS_LATEXMK = join(stateRoot, "missing-latexmk");
  const noEngine = await json("/api/editor/compile-live", {
    method: "POST", ...jsonBody({ workspace: workspaceId, path: "ok.tex" }),
  }, 412);
  assert.equal(noEngine.code, "NO_ENGINE");
  process.env.PAPER_OS_LATEXMK = fakeEngine;

  const hanging = await json("/api/editor/compile-live", {
    method: "POST", ...jsonBody({ workspace: workspaceId, path: "hang.tex" }),
  }, 202);
  assert.equal(hanging.accepted, true);
  assert.ok(hanging.jobId);
  assert.equal(typeof hanging.timeoutMs, "number");

  const busy = await json("/api/editor/compile-live", {
    method: "POST", ...jsonBody({ workspace: workspaceId, path: "ok.tex" }),
  }, 409);
  assert.equal(busy.code, "COMPILE_BUSY");
  assert.equal(busy.active.jobId, hanging.jobId);

  const active = await json(`/api/editor/compile-status?workspace=${encodeURIComponent(workspaceId)}`);
  assert.equal(active.active.jobId, hanging.jobId);
  assert.equal(active.active.entry, "hang.tex");

  const cancelled = await json("/api/editor/compile-cancel", {
    method: "POST", ...jsonBody({ workspace: workspaceId }),
  });
  assert.equal(cancelled.ok, true);
  assert.equal(cancelled.jobId, hanging.jobId);

  const afterCancel = await pollLast(json, workspaceId, (last) => last.jobId === hanging.jobId && last.cancelled);
  assert.equal(afterCancel.active, null);
  assert.equal(afterCancel.last.cancelled, true);
  assert.equal(afterCancel.last.succeeded, false);

  const none = await json("/api/editor/compile-cancel", {
    method: "POST", ...jsonBody({ workspace: workspaceId }),
  }, 404);
  assert.equal(none.code, "NO_ACTIVE_COMPILE");

  const ok = await json("/api/editor/compile-live", {
    method: "POST", ...jsonBody({ workspace: workspaceId, path: "ok.tex" }),
  }, 202);
  const okDone = await pollLast(json, workspaceId, (last) => last.jobId === ok.jobId);
  assert.equal(okDone.last.succeeded, true);
  assert.equal(okDone.last.pdfFresh, true);
  assert.match(String(okDone.last.pdfPath), /ok\.pdf$/);
  assert.equal(existsSync(join(managedRoot, "build", "ok.pdf")), true);

  const old = new Date(Date.now() - 60_000);
  utimesSync(join(managedRoot, "build", "ok.pdf"), old, old);

  const bad = await json("/api/editor/compile-live", {
    method: "POST", ...jsonBody({ workspace: workspaceId, path: "bad.tex" }),
  }, 202);
  const badDone = await pollLast(json, workspaceId, (last) => last.jobId === bad.jobId);
  assert.equal(badDone.last.succeeded, false);
  assert.equal(badDone.last.pdfFresh, false);
  assert.equal(badDone.last.pdfPath, null);
  assert.ok(badDone.last.previousPdfPath, "failed run must name the leftover artifact");
});

test("compile-live reports timedOut when the engine exceeds PAPER_OS_COMPILE_TIMEOUT_MS", async (t) => {
  const port = await freePort();
  const workspaceId = `compile-to-${process.pid}-${Date.now()}`;
  const managedRoot = join(root, "workspaces", workspaceId);
  const stateRoot = mkdtempSync(join(tmpdir(), "paperos-compile-to-"));

  const previous = {
    port: process.env.PAPER_OS_PORT,
    dataDir: process.env.PAPER_OS_DATA_DIR,
    path: process.env.PATH,
    latexmk: process.env.PAPER_OS_LATEXMK,
    timeout: process.env.PAPER_OS_COMPILE_TIMEOUT_MS,
  };
  process.env.PAPER_OS_PORT = String(port);
  process.env.PAPER_OS_DATA_DIR = join(stateRoot, "data");
  process.env.PAPER_OS_LATEXMK = fakeEngine;
  process.env.PAPER_OS_COMPILE_TIMEOUT_MS = "700";
  process.env.PATH = isolatedPath();

  const { startServer, server } = await import(`../app/server.mjs?compile-to=${Date.now()}`);

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
    rmSync(managedRoot, { recursive: true, force: true });
    rmSync(stateRoot, { recursive: true, force: true });
    if (previous.port === undefined) delete process.env.PAPER_OS_PORT;
    else process.env.PAPER_OS_PORT = previous.port;
    if (previous.dataDir === undefined) delete process.env.PAPER_OS_DATA_DIR;
    else process.env.PAPER_OS_DATA_DIR = previous.dataDir;
    if (previous.latexmk === undefined) delete process.env.PAPER_OS_LATEXMK;
    else process.env.PAPER_OS_LATEXMK = previous.latexmk;
    if (previous.timeout === undefined) delete process.env.PAPER_OS_COMPILE_TIMEOUT_MS;
    else process.env.PAPER_OS_COMPILE_TIMEOUT_MS = previous.timeout;
    process.env.PATH = previous.path;
  });

  await json("/api/auth/bootstrap");
  await json("/api/auth/local", { method: "POST", ...jsonBody({}) });
  await json("/api/editor/projects", { method: "POST", ...jsonBody({ id: workspaceId, name: "Compile Timeout", pack: "latex" }) }, 201);
  await json("/api/editor/file", { method: "POST", ...jsonBody({ workspace: workspaceId, path: "hang.tex", content: tex("hang") }) }, 201);

  const started = await json("/api/editor/compile-live", {
    method: "POST", ...jsonBody({ workspace: workspaceId, path: "hang.tex" }),
  }, 202);
  assert.equal(started.timeoutMs, 700);
  const done = await pollLast(json, workspaceId, (last) => last.jobId === started.jobId && last.timedOut, 8000);
  assert.equal(done.last.timedOut, true);
  assert.equal(done.last.succeeded, false);
  assert.equal(done.last.cancelled, false);
});
