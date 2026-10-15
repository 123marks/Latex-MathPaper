import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  annotatePlanDurations,
  appendHarnessTrace,
  buildHarnessContext,
  describeChatRuntime,
} from "../apps/desktop/src/ai-harness.mjs";
import { buildExecutionPlan, parseFileBlocks } from "../web/src/lib/ai-execution.js";

const ideSource = readFileSync(new URL("../apps/desktop/src/ide.jsx", import.meta.url), "utf8");
const buildScript = readFileSync(new URL("../apps/desktop/build-ide.mjs", import.meta.url), "utf8");
const panelSource = readFileSync(new URL("../apps/desktop/src/ai-harness-panel.jsx", import.meta.url), "utf8");

function slice(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.ok(start >= 0, `missing marker ${startMarker}`);
  const end = source.indexOf(endMarker, start);
  assert.ok(end > start, `missing end marker ${endMarker}`);
  return source.slice(start, end);
}

test("context chips name real Workspace, Pack, file, selection, and errors", () => {
  const chips = buildHarnessContext({
    workspaceId: "ws-1",
    workspaceName: "Thesis",
    pack: "latex",
    path: "main.tex",
    selection: "E = mc^2 is the relation",
    errorCount: 2,
  });
  assert.deepEqual(Object.fromEntries(chips.map((c) => [c.id, c.value])), {
    workspace: "Thesis",
    pack: "latex",
    file: "main.tex",
    selection: "E = mc^2 is the relation",
    errors: "2",
  });
  assert.equal(buildHarnessContext({}).find((c) => c.id === "file").value, "未打开文件");
});

test("runtime labels distinguish mock-local from a configured provider", () => {
  assert.equal(describeChatRuntime({ runtime: "mock-local", reason: "no-key" }).kind, "mock-local");
  assert.match(describeChatRuntime({ runtime: "mock-local", reason: "no-key" }).label, /本地模拟.*非模型生成.*未配置 API 密钥/);
  assert.equal(describeChatRuntime({ runtime: "provider", model: "gpt-test" }).kind, "provider");
  assert.match(describeChatRuntime({ runtime: "provider", model: "gpt-test" }).label, /gpt-test.*模型回复/);
  assert.equal(describeChatRuntime({ runtime: "future-runtime" }).kind, "future-runtime");
  assert.match(describeChatRuntime({ runtime: "future-runtime" }).label, /未知响应来源.*future-runtime/);
  assert.equal(describeChatRuntime({}).kind, "unknown");
  assert.equal(describeChatRuntime(null), null);
});

test("the desktop plan is the shared phase machine, not a keyword heuristic", () => {
  const plan = buildExecutionPlan({
    phase: "ready",
    runtime: "mock-local",
    activePath: "main.tex",
    blockCount: 1,
  });
  assert.deepEqual(plan.map((s) => s.id), ["context", "request", "preview", "apply"]);
  assert.equal(plan.find((s) => s.id === "request").status, "done");
  assert.equal(plan.find((s) => s.id === "apply").status, "running");
  const timed = annotatePlanDurations(plan, { request: 42 });
  assert.match(timed.find((s) => s.id === "request").description, /42ms/);
  assert.doesNotMatch(ideSource, /引用\|cite\|文献\|bib/);
  assert.doesNotMatch(ideSource, /function buildExecutionPlan\(userText\)/);
});

test("a local trace keeps newest runs and drops the tail", () => {
  let store = [];
  for (let i = 0; i < 3; i += 1) {
    store = appendHarnessTrace(store, { phase: `p${i}`, runtime: "mock-local", durationMs: i }, { limit: 2 });
  }
  assert.equal(store.length, 2);
  assert.equal(store[0].phase, "p2");
  assert.equal(store[1].phase, "p1");
});

test("desktop IDE aliases ai-execution and reviews applies without window.confirm", () => {
  assert.match(buildScript, /["']ai-execution["']\s*:/);
  assert.match(ideSource, /from "ai-execution"/);
  assert.match(ideSource, /<AiHarnessPanel/);
  assert.match(panelSource, /data-testid="ai-context"/);
  assert.match(panelSource, /data-testid="ai-runtime"/);
  assert.match(panelSource, /data-testid="ai-proposal"/);
  assert.match(panelSource, /data-testid="ai-apply"/);
  assert.match(panelSource, /data-testid="ai-reject"/);
  const applyFn = slice(ideSource, "async function applyProposal(", "function rejectProposal(");
  assert.doesNotMatch(applyFn, /confirm\(/);
  assert.match(applyFn, /apply-blocks/);
  assert.match(applyFn, /APPLY_CONFLICT/);
  assert.doesNotMatch(ideSource, /确认 Apply/);
  const blocks = parseFileBlocks("BEGIN_FILE: main.tex\nok\nEND_FILE\n");
  assert.equal(blocks[0].path, "main.tex");
});
