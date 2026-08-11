import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import React from "../web/node_modules/react/index.js";
import { renderToStaticMarkup } from "../web/node_modules/react-dom/server.node.js";
import { createServer as createViteServer } from "../web/node_modules/vite/dist/node/index.js";
import {
  buildApplyRequest,
  buildExecutionPlan,
  buildReplacementDiff,
  normalizeProviderState,
  parseFileBlocks,
  parseSSEBuffer,
} from "../web/src/lib/ai-execution.js";

const repoRoot = resolve(".");
const webRoot = resolve(repoRoot, "web");
let vite;

test.before(async () => {
  vite = await createViteServer({
    root: webRoot,
    appType: "custom",
    logLevel: "silent",
    resolve: { dedupe: ["react", "react-dom"] },
    server: { middlewareMode: true },
  });
});

test.after(async () => {
  await vite?.close();
});

test("provider state distinguishes configured source from actual runtime", () => {
  const configured = normalizeProviderState({
    active: { model: "gpt-5.4", source: "fallback", keyPresent: true },
  });
  assert.equal(configured.mode, "configured");
  assert.equal(configured.model, "gpt-5.4");
  assert.equal(configured.source, "shared");
  assert.match(configured.label, /configured/i);
  assert.doesNotMatch(configured.label, /online/i);

  const unavailable = normalizeProviderState({ active: { source: "none", keyPresent: false } });
  assert.equal(unavailable.mode, "unavailable");
  assert.equal(unavailable.source, "none");
});

test("buildExecutionPlan maps real AI lifecycle phases to timeline states", () => {
  const requesting = buildExecutionPlan({
    phase: "requesting",
    runtime: "provider",
    activePath: "paper/main.tex",
    blockCount: 0,
  });
  assert.deepEqual(requesting.map((step) => step.status), ["done", "running", "pending", "pending"]);
  assert.match(requesting[0].title, /paper\/main\.tex/);

  const ready = buildExecutionPlan({
    phase: "ready",
    runtime: "mock-local",
    activePath: "paper/main.tex",
    blockCount: 2,
  });
  assert.deepEqual(ready.map((step) => step.status), ["done", "done", "done", "running"]);
  assert.match(ready[2].description, /2/);

  const applied = buildExecutionPlan({
    phase: "applied",
    runtime: "provider",
    activePath: "",
    blockCount: 1,
  });
  assert.deepEqual(applied.map((step) => step.status), ["done", "done", "done", "done"]);
});

test("parseFileBlocks extracts complete relative file proposals only", () => {
  const text = [
    "BEGIN_FILE: paper/main.tex",
    "\\section{Updated}",
    "END_FILE",
    "noise",
    "BEGIN_FILE: references.bib",
    "@article{x}",
    "END_FILE",
    "BEGIN_FILE: incomplete.tex",
    "ignored",
  ].join("\n");
  assert.deepEqual(parseFileBlocks(text), [
    { path: "paper/main.tex", content: "\\section{Updated}" },
    { path: "references.bib", content: "@article{x}" },
  ]);
});

test("apply requests preserve preview baseline and explicit intent", () => {
  const request = buildApplyRequest({
    contest: "sample-contest",
    text: "BEGIN_FILE: paper/main.tex\nnew\nEND_FILE",
    baseline: [{ path: "paper/main.tex", mtime: 42.5 }],
    apply: true,
  });
  assert.deepEqual(request, {
    contest: "sample-contest",
    text: "BEGIN_FILE: paper/main.tex\nnew\nEND_FILE",
    baseline: [{ path: "paper/main.tex", mtime: 42.5 }],
    apply: true,
  });
});

test("replacement diff is bounded and reports calculated changes", () => {
  assert.deepEqual(buildReplacementDiff("same\nold", "same\nnew"), {
    context: ["same"],
    removed: ["old"],
    added: ["new"],
    truncated: false,
  });
});

test("SSE parser retains a fragmented event until the next network chunk", () => {
  const first = parseSSEBuffer('data: {"delta":"one"}\n\ndata: {"del');
  assert.deepEqual(first.events, [{ delta: "one" }]);
  assert.equal(first.rest, 'data: {"del');

  const second = parseSSEBuffer(first.rest + 'ta":" two"}\n\n');
  assert.deepEqual(second.events, [{ delta: " two" }]);
  assert.equal(second.rest, "");
});

test("AI assistant panel exposes truthful runtime, timeline, and explicit review actions", async () => {
  const { default: AIAssistantPanel } = await vite.ssrLoadModule(
    "/src/components/workbench/AIAssistantPanel.jsx",
  );
  const markup = renderToStaticMarkup(React.createElement(AIAssistantPanel, {
    provider: {
      mode: "configured",
      model: "gpt-5.4",
      source: "shared",
      label: "gpt-5.4 configured - shared provider",
    },
    runtime: { kind: "mock-local", label: "mock-local - deterministic fallback" },
    messages: [{
      who: "Paper OS Assistant",
      text: "BEGIN_FILE: paper/main.tex\nnew\nEND_FILE",
    }],
    input: "",
    plan: buildExecutionPlan({
      phase: "ready",
      runtime: "mock-local",
      blockCount: 1,
      activePath: "paper/main.tex",
    }),
    proposal: {
      state: "ready",
      blocks: [{
        path: "paper/main.tex",
        bytes: 3,
        exists: true,
        mtime: 42.5,
        diff: buildReplacementDiff("old", "new"),
      }],
    },
    onInput: () => {},
    onSubmit: () => {},
    onApply: () => {},
    onReject: () => {},
  }));
  assert.match(markup, /gpt-5\.4/);
  assert.match(markup, /mock-local/);
  assert.match(markup, /action-timeline/);
  assert.match(markup, /paper\/main\.tex/);
  assert.match(markup, />Apply</);
  assert.match(markup, />Reject</);
});

test("Workbench and chat server expose the T3.3 wiring", () => {
  const workbench = readFileSync(resolve(webRoot, "src/pages/app/Workbench.jsx"), "utf8");
  const styles = readFileSync(resolve(webRoot, "src/styles/pages.css"), "utf8");
  const server = readFileSync(resolve(repoRoot, "app/server.mjs"), "utf8");
  assert.match(workbench, /AIAssistantPanel/);
  assert.match(workbench, /URLSearchParams/);
  assert.match(workbench, /\/api\/editor\/apply-blocks/);
  assert.match(workbench, /buildExecutionPlan/);
  assert.match(server, /runtime:\s*["']provider["']/);
  assert.match(server, /runtime:\s*["']mock-local["']/);
  assert.match(server, /upstreamBuffer/);
  assert.match(server, /PROVIDER_STREAM_ERROR/);
  const mobileStart = styles.lastIndexOf("@media (max-width: 640px)");
  const mobileEnd = styles.indexOf("@media (prefers-reduced-motion: reduce)", mobileStart);
  const mobile = styles.slice(mobileStart, mobileEnd);
  assert.match(mobile, /\.ide-left\s*\{\s*grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(mobile, /\.file-tree\s*\{[\s\S]*?max-height: 220px/);
});
