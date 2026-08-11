const PHASES_AFTER_RESPONSE = new Set([
  "previewing",
  "ready",
  "applying",
  "applied",
  "rejected",
  "complete",
  "failed",
]);

export function normalizeProviderState(payload) {
  const active = payload?.active || null;
  const model = String(active?.model || "").trim();
  const source = active?.source === "user"
    ? "user"
    : active?.source === "fallback"
      ? "shared"
      : "none";
  const configured = Boolean(model && active?.keyPresent && source !== "none");

  if (!configured) {
    return {
      mode: "unavailable",
      model: model || "No model",
      source,
      label: model ? model + " unavailable" : "Provider unavailable",
    };
  }

  const sourceLabel = source === "user" ? "user key" : "shared provider";
  return {
    mode: "configured",
    model,
    source,
    label: model + " configured - " + sourceLabel,
  };
}

function executionStatus(phase, step) {
  if (step === "context") return "done";

  if (step === "request") {
    return PHASES_AFTER_RESPONSE.has(phase) ? "done" : "running";
  }

  if (step === "preview") {
    if (phase === "previewing") return "running";
    if (["ready", "applying", "applied", "rejected"].includes(phase)) return "done";
    return "pending";
  }

  if (phase === "applied" || phase === "rejected") return "done";
  if (phase === "ready" || phase === "applying") return "running";
  return "pending";
}

export function buildExecutionPlan({
  phase = "requesting",
  runtime = "unknown",
  activePath = "",
  blockCount = 0,
} = {}) {
  const contextTitle = activePath
    ? "Read workspace context - " + activePath
    : "Read workspace context";
  const runtimeLabel = runtime === "provider"
    ? "configured provider"
    : runtime === "mock-local"
      ? "mock-local fallback"
      : "resolved chat runtime";

  const steps = [
    {
      id: "context",
      title: contextTitle,
      description: "Uses the currently selected workspace and file.",
      status: executionStatus(phase, "context"),
    },
    {
      id: "request",
      title: "Request proposal from " + runtimeLabel,
      description: "The runtime label is confirmed by chat stream metadata.",
      status: executionStatus(phase, "request"),
    },
  ];

  if (phase === "complete" && blockCount === 0) return steps;

  steps.push(
    {
      id: "preview",
      title: "Parse and preview file blocks",
      description: blockCount > 0
        ? String(blockCount) + " file block" + (blockCount === 1 ? "" : "s") + " returned."
        : "No complete file block has been previewed yet.",
      status: executionStatus(phase, "preview"),
    },
    {
      id: "apply",
      title: phase === "rejected"
        ? "Proposal rejected without writing"
        : "Confirm and apply to workspace",
      description: "Apply uses the exact path and mtime baseline returned by preview.",
      status: executionStatus(phase, "apply"),
    },
  );

  return steps;
}

export function parseFileBlocks(text) {
  const blocks = [];
  const pattern = /BEGIN_FILE:\s*([^\r\n]+)\r?\n([\s\S]*?)END_FILE/g;
  let match;

  while ((match = pattern.exec(String(text || ""))) !== null) {
    const path = match[1].trim().replace(/^\/+/, "").replace(/\\/g, "/");
    if (!path) continue;
    blocks.push({
      path,
      content: match[2].replace(/\r\n/g, "\n").replace(/\n$/, ""),
    });
  }

  return blocks;
}

export function parseSSEBuffer(buffer) {
  const source = String(buffer || "");
  const events = [];
  const separator = /\r?\n\r?\n/g;
  let consumed = 0;
  let match;

  while ((match = separator.exec(source)) !== null) {
    const frame = source.slice(consumed, match.index);
    consumed = separator.lastIndex;
    const data = frame
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n")
      .trim();

    if (!data || data === "[DONE]") continue;
    try {
      events.push(JSON.parse(data));
    } catch {
      // A complete malformed frame is ignored; incomplete frames remain below.
    }
  }

  return {
    events,
    rest: source.slice(consumed),
  };
}

export function buildApplyRequest({
  contest,
  workspace,
  text,
  baseline = [],
  apply = false,
} = {}) {
  const request = {
    text: String(text || ""),
    baseline: baseline.map((entry) => ({
      path: String(entry.path),
      mtime: entry.mtime == null ? null : Number(entry.mtime),
    })),
    apply: apply === true,
  };

  if (workspace) request.workspace = workspace;
  else if (contest) request.contest = contest;

  return request;
}

function bounded(lines, limit) {
  if (lines.length <= limit) return lines;
  const head = Math.ceil(limit / 2);
  const tail = Math.floor(limit / 2);
  return [...lines.slice(0, head), "...", ...lines.slice(-tail)];
}

export function buildReplacementDiff(before, after, { maxLines = 80 } = {}) {
  const previous = String(before || "").replace(/\r\n/g, "\n").split("\n");
  const proposed = String(after || "").replace(/\r\n/g, "\n").split("\n");

  let prefix = 0;
  while (
    prefix < previous.length
    && prefix < proposed.length
    && previous[prefix] === proposed[prefix]
  ) {
    prefix += 1;
  }

  let suffix = 0;
  while (
    suffix < previous.length - prefix
    && suffix < proposed.length - prefix
    && previous[previous.length - 1 - suffix] === proposed[proposed.length - 1 - suffix]
  ) {
    suffix += 1;
  }

  const removedAll = previous.slice(prefix, previous.length - suffix);
  const addedAll = proposed.slice(prefix, proposed.length - suffix);
  const context = [
    ...previous.slice(Math.max(0, prefix - 2), prefix),
    ...previous.slice(previous.length - suffix, Math.min(previous.length, previous.length - suffix + 2)),
  ];

  return {
    context,
    removed: bounded(removedAll, maxLines),
    added: bounded(addedAll, maxLines),
    truncated: removedAll.length > maxLines || addedAll.length > maxLines,
  };
}
