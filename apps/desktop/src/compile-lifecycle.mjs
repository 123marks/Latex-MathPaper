// Desktop compile state machine.
//
// The HTTP route accepts a job (202) and the WebSocket channel reports
// start / stdout / stderr / done / error. This module is the only place
// that maps those facts onto a UI phase. It never invents a PDF: a
// failed, timed-out, or cancelled run keeps whatever freshness the
// previous success left behind and marks it stale.

export const COMPILE_PHASES = Object.freeze([
  "idle",
  "running",
  "succeeded",
  "failed",
  "timeout",
  "cancelled",
  "no-engine",
]);

const PHASE_LABELS = {
  idle: "未编译",
  running: "编译中",
  succeeded: "编译成功",
  failed: "编译失败",
  timeout: "编译超时",
  cancelled: "已取消",
  "no-engine": "无引擎",
};

export function createCompileState() {
  return {
    phase: "idle",
    jobId: null,
    entry: null,
    engine: null,
    startedAt: null,
    timeoutMs: null,
    message: "",
    pdfFresh: null,
    previousPdfPath: null,
    snapshotId: null,
    durationMs: null,
    code: null,
  };
}

export function compileIsRunning(state) {
  return state?.phase === "running";
}

export function compilePhaseLabel(phase) {
  return PHASE_LABELS[phase] || PHASE_LABELS.idle;
}

export function keepExistingPdf(event) {
  return !event?.pdf;
}

function sameFinishedJob(state, jobId) {
  return Boolean(jobId && state.jobId === jobId && state.phase !== "idle" && state.phase !== "running");
}

function markStale(state, previousPdfPath) {
  if (state.pdfFresh == null && !previousPdfPath) return null;
  return false;
}

function describeDone(event, phase) {
  if (phase === "timeout") return `编译超时${event.durationMs != null ? `（${event.durationMs}ms）` : ""}`;
  if (phase === "cancelled") return "编译已取消";
  if (phase === "succeeded") {
    return event.pdfPath ? `编译成功 ${event.pdfPath}` : "编译成功";
  }
  if (event.error) return String(event.error);
  if (event.code != null) return `编译失败 exit=${event.code}`;
  return "编译失败";
}

export function applyCompileAccepted(state, payload = {}, entry = null) {
  const jobId = payload.jobId || null;
  if (sameFinishedJob(state, jobId)) return state;
  return {
    ...state,
    phase: "running",
    jobId,
    entry: entry || payload.entry || state.entry,
    engine: payload.engine || payload.engineKind || state.engine,
    startedAt: payload.startedAt ?? state.startedAt,
    timeoutMs: payload.timeoutMs ?? state.timeoutMs,
    message: "",
  };
}

export function applyCompileHttpError(state, error) {
  const code = error?.code || error?.payload?.code || "";
  const status = error?.status;
  if (code === "NO_ENGINE" || status === 412) {
    return {
      ...state,
      phase: "no-engine",
      jobId: null,
      message: error?.message || "未检测到 LaTeX 引擎",
    };
  }
  if (code === "COMPILE_BUSY" || status === 409) {
    const active = error?.payload?.active || error?.active || {};
    return {
      ...state,
      phase: "running",
      jobId: active.jobId || state.jobId,
      entry: active.entry || state.entry,
      engine: active.engine || state.engine,
      startedAt: active.startedAt ?? state.startedAt,
      timeoutMs: active.timeoutMs ?? state.timeoutMs,
      message: error?.message || "已有编译在运行",
    };
  }
  return {
    ...state,
    phase: "failed",
    message: error?.message || "编译请求失败",
  };
}

export function applyCompileEvent(state, event) {
  if (!event || !event.event) return state;
  if (event.event === "start") {
    if (sameFinishedJob(state, event.jobId)) return state;
    return {
      ...state,
      phase: "running",
      jobId: event.jobId || state.jobId,
      entry: event.entry || state.entry,
      engine: event.engine || event.engineKind || state.engine,
      startedAt: event.startedAt ?? state.startedAt,
      timeoutMs: event.timeoutMs ?? state.timeoutMs,
      message: "",
    };
  }
  if (event.event === "error") {
    return {
      ...state,
      phase: "failed",
      message: event.message || "engine error",
    };
  }
  if (event.event !== "done") return state;

  let phase = "failed";
  if (event.timedOut) phase = "timeout";
  else if (event.cancelled) phase = "cancelled";
  else if (event.succeeded) phase = "succeeded";

  return {
    ...state,
    phase,
    jobId: event.jobId || state.jobId,
    entry: event.entry || state.entry,
    engine: event.engine || event.engineKind || state.engine,
    code: event.code ?? null,
    durationMs: event.durationMs ?? null,
    snapshotId: event.snapshotId || null,
    previousPdfPath: event.previousPdfPath || null,
    pdfFresh: event.succeeded ? true : markStale(state, event.previousPdfPath),
    message: describeDone(event, phase),
  };
}

export function applyCompileStatus(state, status) {
  if (status?.active) {
    return applyCompileAccepted(state, status.active, status.active.entry);
  }
  return state;
}
