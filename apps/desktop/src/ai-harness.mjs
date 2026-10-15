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
    { id: "workspace", label: "工作区", value: workspaceName || workspaceId || "未选择工作区" },
    { id: "pack", label: "文档类型", value: pack === "Mathematical modeling" ? "数学建模" : pack || "未指定" },
    { id: "file", label: "当前文件", value: path || "未打开文件" },
    {
      id: "selection",
      label: "选中文本",
      value: excerpt || "未选中文本",
      selected: Boolean(excerpt),
    },
    { id: "errors", label: "错误", value: String(Number(errorCount) || 0) },
  ];
}

export function describeChatRuntime(meta) {
  if (!meta) return null;
  if (meta.runtime === "provider") {
    return {
      kind: "provider",
      label: `${meta.model || "模型服务"} · 模型回复`,
    };
  }
  if (meta.runtime === "mock-local") {
    const reasons = {
      "provider-not-configured": "尚未配置模型",
      "provider-unavailable": "模型服务不可用",
      "provider-error": "模型请求失败",
      "no-key": "未配置 API 密钥",
    };
    return {
      kind: "mock-local",
      label: `本地模拟 · 非模型生成${meta.reason ? `（${reasons[meta.reason] || meta.reason}）` : ""}`,
    };
  }
  return {
    kind: meta.runtime || "unknown",
    label: meta.runtime ? `未知响应来源（${meta.runtime}）` : "响应来源未知",
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
