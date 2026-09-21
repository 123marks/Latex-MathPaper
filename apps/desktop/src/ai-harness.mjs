// Desktop AI harness helpers. Plan/diff/SSE parsing live in web/src/lib/ai-execution.js
// and are imported through the esbuild alias `ai-execution`. This file only
// adds desktop-specific context chips, runtime labels, and a local trace.

export const HARNESS_TRACE_KEY = "paperos.aiTrace";
export const HARNESS_TRACE_LIMIT = 40;

export function buildHarnessContext({
  workspaceId = "",
  workspaceName = "",
  pack = "",
  path = "",
  selection = "",
  errorCount = 0,
} = {}) {
  const excerpt = String(selection || "").replace(/\s+/g, " ").trim();
  return [
    { id: "workspace", label: "Workspace", value: workspaceName || workspaceId || "none" },
    { id: "pack", label: "Pack", value: pack || "none" },
    { id: "file", label: "File", value: path || "none" },
    {
      id: "selection",
      label: "Selection",
      value: excerpt ? `${excerpt.slice(0, 40)}${excerpt.length > 40 ? "…" : ""}` : "none",
    },
    { id: "errors", label: "Errors", value: String(Number(errorCount) || 0) },
  ];
}

export function describeChatRuntime(meta) {
  if (!meta) return null;
  if (meta.runtime === "provider") {
    return {
      kind: "provider",
      label: `${meta.model || "Configured model"} · provider`,
    };
  }
  return {
    kind: "mock-local",
    label: `mock-local · deterministic fallback${meta.reason ? ` (${meta.reason})` : ""}`,
  };
}

export function appendHarnessTrace(entries, event, { limit = HARNESS_TRACE_LIMIT } = {}) {
  const next = [
    {
      at: event.at || new Date().toISOString(),
      workspace: event.workspace || "",
      runtime: event.runtime || "unknown",
      phase: event.phase || "",
      blockCount: Number(event.blockCount) || 0,
      durationMs: event.durationMs == null ? null : Number(event.durationMs),
    },
    ...(Array.isArray(entries) ? entries : []),
  ];
  return next.slice(0, limit);
}

export function loadHarnessTrace() {
  try {
    const parsed = JSON.parse(localStorage.getItem(HARNESS_TRACE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveHarnessTrace(entries) {
  try {
    localStorage.setItem(HARNESS_TRACE_KEY, JSON.stringify((entries || []).slice(0, HARNESS_TRACE_LIMIT)));
  } catch { /* private mode */ }
}

export function stampDuration(startedAt, endedAt = Date.now()) {
  if (!startedAt) return null;
  return Math.max(0, endedAt - startedAt);
}

export function annotatePlanDurations(plan, timings = {}) {
  return (plan || []).map((step) => {
    const ms = timings[step.id];
    if (ms == null) return step;
    const extra = `${ms}ms`;
    return {
      ...step,
      durationMs: ms,
      description: step.description ? `${step.description} · ${extra}` : extra,
    };
  });
}
