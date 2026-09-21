// Compile job lifecycle for the LaTeX build routes.
//
// One running job per Workspace, a hard timeout, explicit cancel, capped
// output buffers, and an honest artifact check: a PDF only counts as the
// result of a job when it was written after the job started. Failed compiles
// therefore never re-broadcast an older build/*.pdf as if it were new.
//
// This module owns process lifecycle only. Engine discovery inputs, path
// resolution, snapshots, and WebSocket broadcasting stay with the caller.

import { spawn as nodeSpawn } from "node:child_process";
import { randomBytes } from "node:crypto";

export const COMPILE_TIMEOUT_MS = 180_000;
const DEFAULT_OUTPUT_CAP_BYTES = 1024 * 1024;
const TAIL_BYTES = 4096;
const CLOCK_SKEW_MS = 2000;

export class CompileJobError extends Error {
  constructor(code, message, extra = {}) {
    super(message);
    this.name = "CompileJobError";
    this.code = code;
    Object.assign(this, extra);
  }
}

// Bundled Tectonic > system Tectonic > latexmk. `exists` and `which` are
// injected so the caller keeps its own PATH/PATHEXT semantics.
export function selectEngine({ bundledBin, relPath, exists, which, latexmkCommand = "latexmk" }) {
  const tectonicArgs = [relPath, "--keep-intermediates", "--synctex", "--outdir", "build"];
  if (bundledBin && exists(bundledBin)) {
    return { kind: "tectonic-bundled", bin: bundledBin, args: tectonicArgs };
  }
  const systemTectonic = which("tectonic");
  if (systemTectonic) {
    return { kind: "tectonic-system", bin: systemTectonic, args: tectonicArgs };
  }
  const latexmkBin = latexmkCommand && which(latexmkCommand);
  if (latexmkBin) {
    return {
      kind: "latexmk",
      bin: latexmkBin,
      args: ["-pdf", "-synctex=1", "-interaction=nonstopmode", "-halt-on-error", relPath],
    };
  }
  return null;
}

export function spawnArgsForEngine(bin, args = []) {
  if (/\.(mjs|cjs|js)$/i.test(String(bin))) {
    return { command: process.execPath, args: [bin, ...args] };
  }
  return { command: bin, args };
}

export function classifyArtifact({ pdfPath, startedAt, stat, skewMs = CLOCK_SKEW_MS }) {
  if (!pdfPath) return { path: null, fresh: false, mtimeMs: null };
  let mtimeMs = null;
  try {
    mtimeMs = stat(pdfPath).mtimeMs;
  } catch {
    return { path: pdfPath, fresh: false, mtimeMs: null };
  }
  return { path: pdfPath, fresh: mtimeMs >= startedAt - skewMs, mtimeMs };
}

function defaultKillTree(child) {
  if (!child?.pid) return;
  if (process.platform === "win32") {
    // latexmk is a Perl script that spawns pdflatex; kill the whole tree so
    // a cancelled or timed-out compile does not leave TeX running.
    const taskkill = process.env.SystemRoot
      ? `${process.env.SystemRoot}\\System32\\taskkill.exe`
      : "taskkill";
    try {
      nodeSpawn(taskkill, ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore", windowsHide: true }).unref();
    } catch { /* still try the ChildProcess handle below */ }
  }
  try { child.kill("SIGTERM"); } catch { /* already gone */ }
  setTimeout(() => { try { child.kill("SIGKILL"); } catch { /* */ } }, 500).unref?.();
}

function appendCapped(buffer, chunk, cap) {
  const next = buffer.text + chunk;
  if (next.length <= cap) return { text: next, truncated: buffer.truncated };
  return { text: next.slice(next.length - cap), truncated: true };
}

export function createCompileJobManager({
  spawn = nodeSpawn,
  now = Date.now,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
  newId = () => randomBytes(6).toString("hex"),
  killTree = defaultKillTree,
  outputCapBytes = DEFAULT_OUTPUT_CAP_BYTES,
} = {}) {
  const active = new Map();
  const last = new Map();

  function summarize(job) {
    return { jobId: job.jobId, entry: job.entry, engine: job.engine, startedAt: job.startedAt, timeoutMs: job.timeoutMs };
  }

  function start({ workspaceId, entry, engine, bin, args, cwd, timeoutMs = COMPILE_TIMEOUT_MS, onEvent, onClose }) {
    const running = active.get(workspaceId);
    if (running) {
      throw new CompileJobError("COMPILE_BUSY", "a compile is already running for this Workspace", { active: summarize(running) });
    }
    const job = {
      jobId: newId(),
      workspaceId,
      entry,
      engine,
      bin,
      args,
      startedAt: now(),
      timeoutMs,
      timedOut: false,
      cancelled: false,
      error: null,
      stdout: { text: "", truncated: false },
      stderr: { text: "", truncated: false },
      child: null,
      timer: null,
      settled: false,
    };
    active.set(workspaceId, job);

    const emit = (event) => { try { onEvent?.(event); } catch { /* subscriber errors never break the job */ } };

    const settle = async (code, signal) => {
      if (job.settled) return;
      job.settled = true;
      if (job.timer != null) clearTimer(job.timer);
      active.delete(workspaceId);
      const result = {
        jobId: job.jobId,
        workspaceId,
        entry,
        engine,
        startedAt: job.startedAt,
        finishedAt: now(),
        durationMs: now() - job.startedAt,
        code,
        signal: signal || null,
        timedOut: job.timedOut,
        cancelled: job.cancelled,
        error: job.error,
        stdout: job.stdout.text,
        stderr: job.stderr.text,
        stdoutTruncated: job.stdout.truncated,
        stderrTruncated: job.stderr.truncated,
      };
      let extra = {};
      try {
        extra = (await onClose?.(result)) || {};
      } catch (error) {
        extra = { closeError: String(error?.message || error) };
      }
      last.set(workspaceId, {
        jobId: job.jobId,
        entry,
        engine,
        startedAt: job.startedAt,
        finishedAt: result.finishedAt,
        durationMs: result.durationMs,
        code,
        signal: result.signal,
        timedOut: job.timedOut,
        cancelled: job.cancelled,
        error: job.error,
        stderrTail: job.stderr.text.slice(-TAIL_BYTES),
        ...extra,
      });
    };

    emit({ event: "start", jobId: job.jobId, engine: bin, engineKind: engine, args, entry, startedAt: job.startedAt, timeoutMs });

    let child;
    try {
      const launched = spawnArgsForEngine(bin, args);
      child = spawn(launched.command, launched.args, { cwd, shell: false, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    } catch (error) {
      job.error = String(error?.message || error);
      emit({ event: "error", jobId: job.jobId, message: job.error });
      queueMicrotask(() => settle(null, null));
      return { ...summarize(job), cancel: () => cancel(workspaceId) };
    }
    job.child = child;

    child.stdout?.on("data", (chunk) => {
      const text = chunk.toString();
      job.stdout = appendCapped(job.stdout, text, outputCapBytes);
      emit({ event: "stdout", jobId: job.jobId, text });
    });
    child.stderr?.on("data", (chunk) => {
      const text = chunk.toString();
      job.stderr = appendCapped(job.stderr, text, outputCapBytes);
      emit({ event: "stderr", jobId: job.jobId, text });
    });
    child.on("error", (error) => {
      job.error = String(error?.message || error);
      emit({ event: "error", jobId: job.jobId, message: job.error });
      settle(null, null);
    });
    child.on("close", (code, signal) => settle(code, signal));

    if (timeoutMs > 0) {
      job.timer = setTimer(() => {
        if (job.settled) return;
        job.timedOut = true;
        emit({ event: "stderr", jobId: job.jobId, text: `[paper-os] compile timed out after ${timeoutMs}ms; terminating engine\n` });
        killTree(child);
      }, timeoutMs);
    }

    return { ...summarize(job), cancel: () => cancel(workspaceId) };
  }

  function cancel(workspaceId) {
    const job = active.get(workspaceId);
    if (!job || job.settled) return null;
    job.cancelled = true;
    // Without a child the spawn already failed and settle() is queued.
    if (job.child) killTree(job.child);
    return { cancelled: true, jobId: job.jobId };
  }

  function status(workspaceId) {
    const job = active.get(workspaceId);
    return { active: job ? summarize(job) : null, last: last.get(workspaceId) || null };
  }

  return { start, cancel, status };
}
