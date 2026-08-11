import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import React from "../web/node_modules/react/index.js";
import { renderToStaticMarkup } from "../web/node_modules/react-dom/server.node.js";
import { transform } from "../web/node_modules/esbuild/lib/main.js";
import { createServer as createViteServer } from "../web/node_modules/vite/dist/node/index.js";

const webRoot = resolve("web");
const legacyTraceSource = readFileSync(
  new URL("../web/src/components/TraceBadge.jsx", import.meta.url),
  "utf8",
);
const baseCss = readFileSync(
  new URL("../web/src/styles/base.css", import.meta.url),
  "utf8",
);
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

async function loadMotif(name) {
  return vite.ssrLoadModule(`/src/components/motifs/${name}.jsx`);
}

function render(Component, props = {}, ...children) {
  return renderToStaticMarkup(React.createElement(Component, props, ...children));
}

test("motif modules expose independently renderable components", async () => {
  const modules = await Promise.all([
    loadMotif("TraceBadge"),
    loadMotif("ActionTimeline"),
    loadMotif("EvidenceFlow"),
    loadMotif("QuillMark"),
    loadMotif("CountUp"),
  ]);

  for (const module of modules) assert.equal(typeof module.default, "function");
  for (const module of modules) {
    assert.doesNotThrow(() => render(module.default));
  }

  assert.match(legacyTraceSource, /motifs\/TraceBadge\.jsx/);
});

test("TraceBadge gives equal-size instances unique ring path ids", async () => {
  const { default: TraceBadge } = await loadMotif("TraceBadge");
  const markup = renderToStaticMarkup(
    React.createElement(
      React.Fragment,
      null,
      React.createElement(TraceBadge, { size: 120 }),
      React.createElement(TraceBadge, { size: 120 }),
    ),
  );
  const ids = [...markup.matchAll(/<path id="([^"]+-ring)"/g)].map((match) => match[1]);
  const references = [...markup.matchAll(/href="#([^"]+-ring)"/g)].map((match) => match[1]);

  assert.equal(ids.length, 2);
  assert.equal(new Set(ids).size, 2);
  assert.deepEqual(references, ids);
  assert.match(markup, /aria-label="Traceable · Verifiable · Reproducible"/);
});

test("ActionTimeline renders supplied execution steps with accessible state text", async () => {
  const { default: ActionTimeline } = await loadMotif("ActionTimeline");
  const steps = [
    { id: 1, text: "读取当前工作区与打开文件上下文", status: "done" },
    { id: 2, text: "起草修改建议与 diff", status: "running" },
    { id: 3, text: "等待确认后 apply 到工作区", status: "pending" },
  ];
  const markup = render(ActionTimeline, { steps, label: "真实执行计划" });

  assert.match(markup, /<ol[^>]+aria-label="真实执行计划"/);
  assert.match(markup, /aria-current="step"/);
  assert.match(markup, />已完成</);
  assert.match(markup, />进行中</);
  assert.match(markup, />待执行</);
  assert.match(markup, /读取当前工作区与打开文件上下文/);
  assert.doesNotMatch(markup, /伪造|示例步骤/);
});

test("ActionTimeline has an honest empty state and rejects unsupported statuses", async () => {
  const { default: ActionTimeline } = await loadMotif("ActionTimeline");
  const empty = render(ActionTimeline, { steps: [] });

  assert.match(empty, /role="status"/);
  assert.match(empty, /暂无执行步骤/);
  assert.doesNotMatch(empty, /<li/);
  assert.throws(
    () => render(ActionTimeline, {
      steps: [{ id: 1, text: "未定义状态", status: "invented" }],
    }),
    /Unsupported ActionTimeline status/,
  );
});

test("EvidenceFlow converts structured points to labelled static SVG paths", async () => {
  const { default: EvidenceFlow } = await loadMotif("EvidenceFlow");
  const markup = render(EvidenceFlow, {
    animated: false,
    label: "论断到来源",
    links: [{
      id: "claim-source",
      points: [{ x: 8, y: 20 }, { x: 42, y: 20 }, { x: 80, y: 64 }],
    }],
  });

  assert.match(markup, /<svg[^>]+role="img"/);
  assert.match(markup, /<title>论断到来源<\/title>/);
  assert.match(markup, /d="M 8 20 L 42 20 L 80 64"/);
  assert.doesNotMatch(markup, /evidence-flow__path--animated/);
});

test("EvidenceFlow rejects malformed or non-finite point data", async () => {
  const { default: EvidenceFlow } = await loadMotif("EvidenceFlow");

  assert.throws(
    () => render(EvidenceFlow, {
      links: [{ id: "short", points: [{ x: 0, y: 0 }] }],
    }),
    /at least two points/,
  );
  assert.throws(
    () => render(EvidenceFlow, {
      links: [{ id: "nan", points: [{ x: 0, y: 0 }, { x: Number.NaN, y: 5 }] }],
    }),
    /finite coordinates/,
  );
});

test("QuillMark exposes idle, loading, and thinking states without generic spinner markup", async () => {
  const { default: QuillMark } = await loadMotif("QuillMark");
  const idle = render(QuillMark, { state: "idle" });
  const loading = render(QuillMark, { state: "loading" });
  const thinking = render(QuillMark, { state: "thinking" });

  assert.match(idle, /quill-mark--idle/);
  assert.doesNotMatch(idle, /aria-live=/);
  assert.match(loading, /quill-mark--loading/);
  assert.match(loading, /role="status"/);
  assert.match(thinking, /quill-mark--thinking/);
  assert.match(thinking, /aria-live="polite"/);
  assert.doesNotMatch(`${idle}${loading}${thinking}`, /spinner/i);
  assert.throws(() => render(QuillMark, { state: "unknown" }), /Unsupported QuillMark state/);
});

test("CountUp formats static values and keeps animated rendering on the shared hook", async () => {
  const { default: CountUp } = await loadMotif("CountUp");
  const staticMarkup = render(CountUp, {
    animate: false,
    decimals: 1,
    locale: "en-US",
    prefix: "$",
    suffix: "k",
    to: 1234.5,
  });
  const customMarkup = render(CountUp, {
    animate: false,
    format: (value) => String(value) + " files",
    to: 7,
  });
  const animatedMarkup = render(CountUp, { from: 3, suffix: "%", to: 42 });

  assert.match(staticMarkup, />\$1,234\.5k<\/span>/);
  assert.match(customMarkup, />7 files<\/span>/);
  assert.match(animatedMarkup, />3%<\/span>/);
  assert.throws(() => render(CountUp, { to: Number.NaN }), /finite number/);
  assert.throws(
    () => render(CountUp, { duration: 0, to: 1 }),
    /positive duration/,
  );
});

test("CountUp uses the product locale when callers omit one", async () => {
  const { default: CountUp } = await loadMotif("CountUp");
  const originalNumberFormat = Intl.NumberFormat;
  let receivedLocale;

  Intl.NumberFormat = class {
    constructor(locale) {
      receivedLocale = locale;
    }

    format(value) {
      return String(value);
    }
  };

  try {
    render(CountUp, { animate: false, to: 42 });
  } finally {
    Intl.NumberFormat = originalNumberFormat;
  }

  assert.equal(receivedLocale, "zh-CN");
});

test("motif CSS defines state motion with a reduced-motion stop", () => {
  assert.match(baseCss, /\.evidence-flow__path--animated/);
  assert.match(baseCss, /animation:\s*marchAnts/);
  assert.match(baseCss, /\.quill-mark--thinking::before/);
  assert.match(baseCss, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
});

test("base CSS parses without syntax warnings", async () => {
  const result = await transform(baseCss, { loader: "css", logLevel: "silent" });

  assert.deepEqual(result.warnings, []);
});
