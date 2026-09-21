import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  applyCompileAccepted,
  applyCompileEvent,
  applyCompileHttpError,
  applyCompileStatus,
  compileIsRunning,
  compilePhaseLabel,
  createCompileState,
  keepExistingPdf,
} from "../apps/desktop/src/compile-lifecycle.mjs";

const ideSource = readFileSync(new URL("../apps/desktop/src/ide.jsx", import.meta.url), "utf8");
const ideCss = readFileSync(new URL("../apps/desktop/src/assets/ide.css", import.meta.url), "utf8");
const pdfSource = readFileSync(new URL("../apps/desktop/src/pdf-preview.jsx", import.meta.url), "utf8");

function slice(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.ok(start >= 0, `missing marker ${startMarker}`);
  const end = source.indexOf(endMarker, start);
  assert.ok(end > start, `missing end marker ${endMarker}`);
  return source.slice(start, end);
}

test("HTTP 202 moves idle → running and a late 202 cannot un-finish the same job", () => {
  const running = applyCompileAccepted(createCompileState(), {
    jobId: "j1", engine: "tectonic", startedAt: 10, timeoutMs: 180000,
  }, "main.tex");
  assert.equal(running.phase, "running");
  assert.equal(running.jobId, "j1");
  assert.equal(running.entry, "main.tex");
  assert.equal(compileIsRunning(running), true);

  const done = applyCompileEvent(running, { event: "done", jobId: "j1", succeeded: true, pdf: "JVBERi0=", pdfPath: "/build/main.pdf" });
  assert.equal(done.phase, "succeeded");
  assert.equal(done.pdfFresh, true);

  const late = applyCompileAccepted(done, { jobId: "j1", engine: "tectonic" }, "main.tex");
  assert.equal(late.phase, "succeeded");
  assert.equal(late.pdfFresh, true);
});

test("HTTP errors map onto no-engine, busy, and failed without dropping a previous PDF flag", () => {
  const fresh = { ...createCompileState(), pdfFresh: true, phase: "succeeded" };
  const missing = applyCompileHttpError(fresh, { code: "NO_ENGINE", status: 412, message: "no LaTeX engine available" });
  assert.equal(missing.phase, "no-engine");
  assert.equal(missing.pdfFresh, true);

  const busy = applyCompileHttpError(fresh, {
    code: "COMPILE_BUSY", status: 409, message: "already running",
    payload: { active: { jobId: "j9", entry: "paper.tex", engine: "latexmk" } },
  });
  assert.equal(busy.phase, "running");
  assert.equal(busy.jobId, "j9");
  assert.equal(busy.entry, "paper.tex");

  const boom = applyCompileHttpError(fresh, { message: "network down" });
  assert.equal(boom.phase, "failed");
  assert.match(boom.message, /network down/);
});

test("done events distinguish succeeded / failed / timeout / cancelled and stale leftovers", () => {
  const running = applyCompileAccepted(createCompileState(), { jobId: "a", timeoutMs: 1000 }, "ok.tex");

  const ok = applyCompileEvent(running, {
    event: "done", jobId: "a", succeeded: true, code: 0, pdf: "AAA", pdfPath: "/build/ok.pdf", durationMs: 12,
  });
  assert.equal(ok.phase, "succeeded");
  assert.equal(ok.pdfFresh, true);
  assert.equal(keepExistingPdf({ pdf: "AAA" }), false);

  const failed = applyCompileEvent(ok, {
    event: "done", jobId: "b", succeeded: false, code: 1, pdf: null, previousPdfPath: "/build/ok.pdf",
  });
  assert.equal(failed.phase, "failed");
  assert.equal(failed.pdfFresh, false);
  assert.equal(failed.previousPdfPath, "/build/ok.pdf");
  assert.equal(keepExistingPdf({ pdf: null }), true);

  const timed = applyCompileEvent(ok, { event: "done", timedOut: true, succeeded: false, pdf: null });
  assert.equal(timed.phase, "timeout");
  assert.equal(timed.pdfFresh, false);

  const cancelled = applyCompileEvent(ok, { event: "done", cancelled: true, succeeded: false, pdf: null });
  assert.equal(cancelled.phase, "cancelled");
  assert.equal(cancelled.pdfFresh, false);

  const firstFail = applyCompileEvent(createCompileState(), {
    event: "done", succeeded: false, code: 1, pdf: null,
  });
  assert.equal(firstFail.phase, "failed");
  assert.equal(firstFail.pdfFresh, null, "no previous PDF means nothing to mark stale");
});

test("compile-status only restores an in-flight job, never a finished PDF we no longer hold", () => {
  const restored = applyCompileStatus(createCompileState(), {
    active: { jobId: "live", entry: "main.tex", engine: "latexmk", startedAt: 1, timeoutMs: 100 },
  });
  assert.equal(restored.phase, "running");
  assert.equal(restored.jobId, "live");

  const ignored = applyCompileStatus(createCompileState(), {
    last: { jobId: "old", succeeded: true, pdfPath: "/build/main.pdf" },
  });
  assert.equal(ignored.phase, "idle");
});

test("phase labels stay honest Chinese copy", () => {
  assert.equal(compilePhaseLabel("idle"), "未编译");
  assert.equal(compilePhaseLabel("running"), "编译中");
  assert.equal(compilePhaseLabel("succeeded"), "编译成功");
  assert.equal(compilePhaseLabel("failed"), "编译失败");
  assert.equal(compilePhaseLabel("timeout"), "编译超时");
  assert.equal(compilePhaseLabel("cancelled"), "已取消");
  assert.equal(compilePhaseLabel("no-engine"), "无引擎");
});

test("desktop IDE wires the state machine, cancel route, and stale PDF badge", () => {
  assert.match(ideSource, /from "\.\/compile-lifecycle\.mjs"/);
  assert.match(ideSource, /useState\(createCompileState\)/);
  assert.match(ideSource, /applyCompileAccepted/);
  assert.match(ideSource, /applyCompileHttpError/);
  assert.match(ideSource, /applyCompileEvent/);
  assert.match(ideSource, /\/api\/editor\/compile-cancel/);
  assert.match(ideSource, /\/api\/editor\/compile-status/);
  assert.match(ideSource, /data-testid="compile-run"/);
  assert.match(ideSource, /data-testid="compile-cancel"/);
  assert.match(ideSource, /data-testid="status-compile"/);
  assert.match(pdfSource, /data-testid="pdf-stale-badge"/);
  assert.match(pdfSource, /data-testid="pdf-fresh-badge"/);
  assert.match(ideSource, /stale=\{compileJob\.pdfFresh === false\}/);

  const compileFn = slice(ideSource, "async function compile()", "async function cancelCompile(");
  assert.match(compileFn, /compileIsRunning\(compileJob\)/);
  assert.doesNotMatch(compileFn, /setBusy\(true\)/);
  assert.doesNotMatch(compileFn, /finally \{ setBusy\(false\)/);
  assert.match(ideSource, /if \(msg\.pdf && !keepExistingPdf\(msg\)\)/);
  assert.match(ideSource, /setCompileJob\(\(prev\) => applyCompileEvent\(prev, msg\)\)/);

  assert.match(ideCss, /\.pdf-pane\.is-stale/);
  assert.match(ideCss, /\.badge\.stale/);
});
