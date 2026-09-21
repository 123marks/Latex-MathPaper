import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { statSync } from "node:fs";
import test from "node:test";

import {
  COMPILE_TIMEOUT_MS,
  CompileJobError,
  classifyArtifact,
  createCompileJobManager,
  selectEngine,
  spawnArgsForEngine,
} from "../app/lib/compile-jobs.mjs";

// A controllable stand-in for child_process.spawn: the test decides when the
// process prints, exits, or fails to start.
function fakeSpawnFactory() {
  const children = [];
  const spawn = (bin, args, options) => {
    const child = new EventEmitter();
    child.pid = 1000 + children.length;
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.killed = false;
    child.kill = () => { child.killed = true; return true; };
    child.spawnInfo = { bin, args, options };
    children.push(child);
    return child;
  };
  return { spawn, children };
}

function manualTimers() {
  const timers = new Map();
  let nextId = 1;
  return {
    setTimer(fn, ms) { const id = nextId++; timers.set(id, { fn, ms }); return id; },
    clearTimer(id) { timers.delete(id); },
    fire(id) { const entry = timers.get(id); timers.delete(id); entry?.fn(); },
    pending() { return [...timers.keys()]; },
  };
}

test("selectEngine prefers bundled Tectonic, then system Tectonic, then latexmk, else null", () => {
  const base = { bundledBin: "C:/data/engine/tectonic.exe", relPath: "paper/main.tex", latexmkCommand: "latexmk" };
  const bundled = selectEngine({ ...base, exists: () => true, which: () => null });
  assert.equal(bundled.kind, "tectonic-bundled");
  assert.equal(bundled.bin, base.bundledBin);
  assert.deepEqual(bundled.args, ["paper/main.tex", "--keep-intermediates", "--synctex", "--outdir", "build"]);

  const system = selectEngine({ ...base, exists: () => false, which: (cmd) => (cmd === "tectonic" ? "/usr/bin/tectonic" : null) });
  assert.equal(system.kind, "tectonic-system");
  assert.equal(system.bin, "/usr/bin/tectonic");

  const latexmk = selectEngine({ ...base, exists: () => false, which: (cmd) => (cmd === "latexmk" ? "/usr/bin/latexmk" : null) });
  assert.equal(latexmk.kind, "latexmk");
  assert.equal(latexmk.bin, "/usr/bin/latexmk");
  assert.deepEqual(latexmk.args, ["-pdf", "-synctex=1", "-interaction=nonstopmode", "-halt-on-error", "paper/main.tex"]);

  assert.equal(selectEngine({ ...base, exists: () => false, which: () => null }), null);
});

test("classifyArtifact only calls a PDF fresh when it was written after the job started", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "paperos-compile-artifact-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const pdf = join(dir, "main.pdf");
  writeFileSync(pdf, "%PDF-1.4 stale");
  const old = new Date(Date.now() - 60_000);
  utimesSync(pdf, old, old);

  const stale = classifyArtifact({ pdfPath: pdf, startedAt: Date.now() - 5_000, stat: statSync });
  assert.equal(stale.fresh, false);
  assert.equal(stale.path, pdf);

  const now = new Date();
  utimesSync(pdf, now, now);
  const fresh = classifyArtifact({ pdfPath: pdf, startedAt: Date.now() - 5_000, stat: statSync });
  assert.equal(fresh.fresh, true);

  assert.deepEqual(classifyArtifact({ pdfPath: null, startedAt: Date.now(), stat: statSync }), { path: null, fresh: false, mtimeMs: null });
  assert.equal(classifyArtifact({ pdfPath: join(dir, "missing.pdf"), startedAt: Date.now(), stat: statSync }).fresh, false);
});

test("a compile job streams output, reports a normal exit, and records the last result", async () => {
  const { spawn, children } = fakeSpawnFactory();
  const timers = manualTimers();
  const events = [];
  const manager = createCompileJobManager({ spawn, now: () => 1_000, setTimer: timers.setTimer, clearTimer: timers.clearTimer, newId: () => "job-1" });

  const job = manager.start({
    workspaceId: "ws", entry: "main.tex", engine: "latexmk", bin: "latexmk", args: ["-pdf", "main.tex"], cwd: "/ws",
    timeoutMs: 5_000,
    onEvent: (event) => events.push(event),
    onClose: (result) => ({ pdfPath: "/build/main.pdf", succeeded: result.code === 0 }),
  });
  assert.equal(job.jobId, "job-1");
  assert.equal(children[0].spawnInfo.options.cwd, "/ws");
  assert.equal(children[0].spawnInfo.options.shell, false);
  assert.deepEqual(manager.status("ws").active, {
    jobId: "job-1", entry: "main.tex", engine: "latexmk", startedAt: 1_000, timeoutMs: 5_000,
  });
  assert.equal(events[0].event, "start");
  assert.equal(events[0].jobId, "job-1");
  assert.equal(events[0].timeoutMs, 5_000);

  children[0].stdout.emit("data", Buffer.from("This is pdfTeX\n"));
  children[0].stderr.emit("data", Buffer.from("warning\n"));
  children[0].emit("close", 0, null);
  await new Promise((r) => setImmediate(r));

  assert.deepEqual(events.map((e) => e.event), ["start", "stdout", "stderr"]);
  assert.equal(timers.pending().length, 0, "timeout timer must be cleared on close");
  const status = manager.status("ws");
  assert.equal(status.active, null);
  assert.equal(status.last.jobId, "job-1");
  assert.equal(status.last.code, 0);
  assert.equal(status.last.timedOut, false);
  assert.equal(status.last.cancelled, false);
  assert.equal(status.last.succeeded, true);
  assert.equal(status.last.pdfPath, "/build/main.pdf");
  assert.match(status.last.stderrTail, /warning/);
});

test("a second start for the same Workspace is rejected with COMPILE_BUSY while the first runs", async () => {
  const { spawn, children } = fakeSpawnFactory();
  const timers = manualTimers();
  const manager = createCompileJobManager({ spawn, now: () => 1, setTimer: timers.setTimer, clearTimer: timers.clearTimer, newId: (() => { let n = 0; return () => `j${++n}`; })() });
  const common = { entry: "main.tex", engine: "latexmk", bin: "latexmk", args: [], cwd: "/ws", timeoutMs: 1000, onEvent: () => {}, onClose: () => ({}) };
  manager.start({ workspaceId: "ws", ...common });
  assert.throws(() => manager.start({ workspaceId: "ws", ...common }), (error) => {
    assert.ok(error instanceof CompileJobError);
    assert.equal(error.code, "COMPILE_BUSY");
    assert.equal(error.active.jobId, "j1");
    return true;
  });
  // A different Workspace is independent.
  manager.start({ workspaceId: "other", ...common });
  assert.equal(children.length, 2);
  children[0].emit("close", 0, null);
  await new Promise((r) => setImmediate(r));
  const third = manager.start({ workspaceId: "ws", ...common });
  assert.equal(third.jobId, "j3");
});

test("timeout kills the process and the close result says timedOut", async () => {
  const { spawn, children } = fakeSpawnFactory();
  const timers = manualTimers();
  const killed = [];
  let closeResult = null;
  const manager = createCompileJobManager({
    spawn, now: () => 0, setTimer: timers.setTimer, clearTimer: timers.clearTimer, newId: () => "t1",
    killTree: (child) => { killed.push(child.pid); child.emit("close", null, "SIGTERM"); },
  });
  manager.start({
    workspaceId: "ws", entry: "main.tex", engine: "tectonic-bundled", bin: "tectonic", args: [], cwd: "/ws", timeoutMs: 180_000,
    onEvent: () => {}, onClose: (result) => { closeResult = result; return {}; },
  });
  assert.equal(timers.pending().length, 1);
  timers.fire(timers.pending()[0]);
  await new Promise((r) => setImmediate(r));
  assert.deepEqual(killed, [children[0].pid]);
  assert.equal(closeResult.timedOut, true);
  assert.equal(closeResult.cancelled, false);
  assert.equal(closeResult.code, null);
  assert.equal(manager.status("ws").last.timedOut, true);
  assert.equal(manager.status("ws").active, null);
});

test("cancel kills the active job, reports cancelled, and is a no-op without an active job", async () => {
  const { spawn, children } = fakeSpawnFactory();
  const timers = manualTimers();
  let closeResult = null;
  const manager = createCompileJobManager({
    spawn, now: () => 0, setTimer: timers.setTimer, clearTimer: timers.clearTimer, newId: () => "c1",
    killTree: (child) => child.emit("close", null, "SIGTERM"),
  });
  assert.equal(manager.cancel("ws"), null);
  manager.start({
    workspaceId: "ws", entry: "main.tex", engine: "latexmk", bin: "latexmk", args: [], cwd: "/ws", timeoutMs: 1000,
    onEvent: () => {}, onClose: (result) => { closeResult = result; return {}; },
  });
  const cancelled = manager.cancel("ws");
  await new Promise((r) => setImmediate(r));
  assert.deepEqual(cancelled, { cancelled: true, jobId: "c1" });
  assert.equal(children.length, 1);
  assert.equal(closeResult.cancelled, true);
  assert.equal(closeResult.timedOut, false);
  assert.equal(manager.status("ws").last.cancelled, true);
});

test("a spawn failure still finishes the job with an error instead of hanging", async () => {
  const { spawn, children } = fakeSpawnFactory();
  const timers = manualTimers();
  const events = [];
  let closeResult = null;
  const manager = createCompileJobManager({ spawn, now: () => 0, setTimer: timers.setTimer, clearTimer: timers.clearTimer, newId: () => "e1" });
  manager.start({
    workspaceId: "ws", entry: "main.tex", engine: "latexmk", bin: "latexmk", args: [], cwd: "/ws", timeoutMs: 1000,
    onEvent: (event) => events.push(event), onClose: (result) => { closeResult = result; return {}; },
  });
  children[0].emit("error", new Error("spawn latexmk ENOENT"));
  await new Promise((r) => setImmediate(r));
  assert.ok(events.some((e) => e.event === "error" && /ENOENT/.test(e.message)));
  assert.equal(closeResult.code, null);
  assert.match(closeResult.error, /ENOENT/);
  assert.equal(manager.status("ws").active, null);
  assert.equal(timers.pending().length, 0);
});

test("output buffers are capped so a chatty engine cannot exhaust memory", async () => {
  const { spawn, children } = fakeSpawnFactory();
  const timers = manualTimers();
  let closeResult = null;
  const manager = createCompileJobManager({ spawn, now: () => 0, setTimer: timers.setTimer, clearTimer: timers.clearTimer, newId: () => "b1", outputCapBytes: 64 });
  manager.start({
    workspaceId: "ws", entry: "main.tex", engine: "latexmk", bin: "latexmk", args: [], cwd: "/ws", timeoutMs: 1000,
    onEvent: () => {}, onClose: (result) => { closeResult = result; return {}; },
  });
  for (let i = 0; i < 20; i += 1) children[0].stdout.emit("data", Buffer.from("0123456789"));
  children[0].emit("close", 1, null);
  await new Promise((r) => setImmediate(r));
  assert.ok(closeResult.stdout.length <= 64 + 40, `stdout buffer should be capped, got ${closeResult.stdout.length}`);
  assert.equal(closeResult.stdoutTruncated, true);
});

test("the default compile timeout is three minutes", () => {
  assert.equal(COMPILE_TIMEOUT_MS, 180_000);
});

test("JavaScript engine wrappers are launched through the current Node binary", () => {
  const script = spawnArgsForEngine("C:/tmp/fake-latexmk.mjs", ["-pdf", "main.tex"]);
  assert.equal(script.command, process.execPath);
  assert.deepEqual(script.args, ["C:/tmp/fake-latexmk.mjs", "-pdf", "main.tex"]);
  const native = spawnArgsForEngine("latexmk", ["-pdf", "main.tex"]);
  assert.equal(native.command, "latexmk");
  assert.deepEqual(native.args, ["-pdf", "main.tex"]);
});
