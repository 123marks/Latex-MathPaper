import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import React from "../web/node_modules/react/index.js";
import { renderToStaticMarkup } from "../web/node_modules/react-dom/server.node.js";
import { transform } from "../web/node_modules/esbuild/lib/main.js";
import { createServer as createViteServer } from "../web/node_modules/vite/dist/node/index.js";

const webRoot = resolve("web");
const componentNames = [
  "Button",
  "IconButton",
  "Card",
  "Chip",
  "Tabs",
  "Segmented",
  "Table",
  "Modal",
  "Drawer",
  "Toast",
  "Tooltip",
  "Badge",
  "Skeleton",
  "Meter",
];
const componentsCss = readFileSync(
  new URL("../web/src/styles/components.css", import.meta.url),
  "utf8",
);
const appSource = readFileSync(new URL("../web/src/App.jsx", import.meta.url), "utf8");
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

async function loadUi(name) {
  return vite.ssrLoadModule(`/src/components/ui/${name}.jsx`);
}

function render(Component, props = {}, ...children) {
  return renderToStaticMarkup(React.createElement(Component, props, ...children));
}

test("T0.5 exposes fourteen independently renderable UI primitives", async () => {
  const modules = await Promise.all(componentNames.map(loadUi));

  for (const module of modules) {
    const component = module.default;
    const isFunctionComponent = typeof component === "function";
    const isForwardRefComponent = typeof component === "object" && component?.$$typeof;
    assert.ok(isFunctionComponent || isForwardRefComponent);
  }
  assert.equal(modules.length, 14);
});

test("Button and IconButton expose native loading, disabled, and naming semantics", async () => {
  const [{ default: Button }, { default: IconButton }] = await Promise.all([
    loadUi("Button"),
    loadUi("IconButton"),
  ]);
  const button = render(Button, { loading: true, variant: "ghostAmber" }, "保存 Workspace");
  const iconButton = render(IconButton, { icon: "search", label: "搜索 Resource" });

  assert.match(button, /^<button/);
  assert.match(button, /type="button"/);
  assert.match(button, /disabled=""/);
  assert.match(button, /aria-busy="true"/);
  assert.match(button, /btn-ghost-amber/);
  assert.match(iconButton, /^<button/);
  assert.match(iconButton, /aria-label="搜索 Resource"/);
  assert.throws(() => render(IconButton, { icon: "search" }), /accessible label/i);
});

test("Card and Chip preserve the existing additive class API", async () => {
  const [{ default: Card }, { default: Chip }] = await Promise.all([
    loadUi("Card"),
    loadUi("Chip"),
  ]);

  assert.match(render(Card, { as: "section", variant: "app", lift: true }, "内容"), /^<section/);
  assert.match(render(Card, { variant: "app", lift: true }, "内容"), /card app lift/);
  assert.match(render(Chip, { tone: "signal" }, "已验证"), /chip signal/);
  assert.throws(() => render(Chip, { tone: "invented" }, "未知"), /Unsupported Chip tone/);
});

test("Tabs and Segmented emit real selection semantics", async () => {
  const [{ default: Tabs }, { default: Segmented }] = await Promise.all([
    loadUi("Tabs"),
    loadUi("Segmented"),
  ]);
  const items = [
    { id: "source", label: "源码", content: "main.tex" },
    { id: "preview", label: "预览", content: "PDF", dirty: true },
  ];
  const tabs = render(Tabs, { items, value: "preview", ariaLabel: "编辑器视图" });
  const segmented = render(Segmented, {
    ariaLabel: "计费周期",
    value: "year",
    options: [
      { value: "month", label: "按月" },
      { value: "year", label: "按年" },
    ],
  });

  assert.match(tabs, /role="tablist"/);
  assert.match(tabs, /aria-label="编辑器视图"/);
  assert.match(tabs, /role="tab"[^>]+aria-selected="true"/);
  assert.match(tabs, /role="tabpanel"/);
  assert.match(tabs, /tab__dirty/);
  assert.match(segmented, /role="radiogroup"/);
  assert.match(segmented, /role="radio"[^>]+aria-checked="true"/);
});

test("every Tabs aria-controls reference resolves to a rendered panel", async () => {
  const { default: Tabs } = await loadUi("Tabs");
  const markup = render(Tabs, {
    value: "source",
    items: [
      { id: "source", label: "Source", content: "main.tex" },
      { id: "preview", label: "Preview", content: "PDF" },
    ],
  });
  const controlledIds = [...markup.matchAll(/aria-controls="([^"]+)"/g)]
    .map((match) => match[1]);
  const renderedIds = new Set(
    [...markup.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]),
  );

  assert.equal(controlledIds.length, 2);
  for (const id of controlledIds) {
    assert.ok(renderedIds.has(id), 'aria-controls target must exist: ' + id);
  }
});

test("selection keyboard helper wraps, skips disabled items, and supports Home and End", async () => {
  const { moveSelection } = await vite.ssrLoadModule("/src/components/ui/_selection.js");
  const items = [
    { id: "a" },
    { id: "b", disabled: true },
    { id: "c" },
  ];

  assert.equal(moveSelection(items, "a", "ArrowRight"), "c");
  assert.equal(moveSelection(items, "c", "ArrowRight"), "a");
  assert.equal(moveSelection(items, "a", "End"), "c");
  assert.equal(moveSelection(items, "c", "Home"), "a");
  assert.equal(moveSelection(items, "a", "ArrowDown", "horizontal"), null);
});

test("Table renders native headers, numeric cells, and an honest empty state", async () => {
  const { default: Table } = await loadUi("Table");
  const columns = [
    { key: "resource", header: "Resource" },
    { key: "size", header: "大小", numeric: true },
  ];
  const populated = render(Table, {
    caption: "Workspace Resources",
    columns,
    rows: [{ id: "main", resource: "main.tex", size: 2048 }],
  });
  const empty = render(Table, { columns, rows: [], emptyMessage: "暂无 Resource" });

  assert.match(populated, /^<div[^>]+tbl-wrap/);
  assert.match(populated, /<table[^>]+class="tbl"/);
  assert.match(populated, /<caption>Workspace Resources<\/caption>/);
  assert.match(populated, /<th scope="col"/);
  assert.match(populated, /tbl__numeric/);
  assert.match(empty, /colSpan="2"/i);
  assert.match(empty, /暂无 Resource/);
});

test("Modal and Drawer provide labelled modal dialog structure", async () => {
  const [{ default: Modal }, { default: Drawer }] = await Promise.all([
    loadUi("Modal"),
    loadUi("Drawer"),
  ]);
  const modal = render(Modal, { open: true, title: "删除 Artifact", onClose() {} }, "内容");
  const drawer = render(Drawer, { open: true, title: "Evidence Links", onClose() {} }, "内容");

  for (const markup of [modal, drawer]) {
    assert.match(markup, /role="dialog"/);
    assert.match(markup, /aria-modal="true"/);
    assert.match(markup, /aria-labelledby=/);
    assert.match(markup, /aria-label="关闭/);
  }
  assert.match(drawer, /drawer__panel/);
});

test("Modal and Drawer reject missing accessible titles", async () => {
  const [{ default: Modal }, { default: Drawer }] = await Promise.all([
    loadUi("Modal"),
    loadUi("Drawer"),
  ]);

  assert.throws(
    () => render(Modal, { open: true, onClose() {} }, "content"),
    /non-empty title/i,
  );
  assert.throws(
    () => render(Drawer, { open: true, title: "   ", onClose() {} }, "content"),
    /non-empty title/i,
  );
});

test("dialog keyboard helper traps Tab and closes on Escape", async () => {
  const { handleDialogKeyDown } = await vite.ssrLoadModule("/src/components/ui/_dialog.js");
  const first = { focusCalls: 0, focus() { this.focusCalls += 1; } };
  const last = { focusCalls: 0, focus() { this.focusCalls += 1; } };
  const container = { querySelectorAll: () => [first, last] };
  let closed = 0;

  handleDialogKeyDown(
    { key: "Tab", shiftKey: false, target: last, preventDefault() {} },
    container,
    () => { closed += 1; },
  );
  handleDialogKeyDown(
    { key: "Tab", shiftKey: true, target: first, preventDefault() {} },
    container,
    () => { closed += 1; },
  );
  handleDialogKeyDown(
    { key: "Escape", preventDefault() {} },
    container,
    () => { closed += 1; },
  );

  assert.equal(first.focusCalls, 1);
  assert.equal(last.focusCalls, 1);
  assert.equal(closed, 1);
});

test("Toast, Tooltip, Badge, Skeleton, and Meter expose accessible state", async () => {
  const [
    { default: Toast },
    { default: Tooltip },
    { default: Badge },
    { default: Skeleton },
    { default: Meter },
    { default: Button },
  ] = await Promise.all([
    loadUi("Toast"),
    loadUi("Tooltip"),
    loadUi("Badge"),
    loadUi("Skeleton"),
    loadUi("Meter"),
    loadUi("Button"),
  ]);
  const toast = render(Toast, { open: true, tone: "error", onDismiss() {} }, "编译失败");
  const tooltip = render(
    Tooltip,
    { content: "打开命令面板" },
    React.createElement(Button, null, "命令"),
  );
  const meter = render(Meter, { label: "本地存储", value: 82, max: 100, criticalAt: 80 });

  assert.match(toast, /role="alert"/);
  assert.match(toast, /aria-label="关闭通知"/);
  assert.match(tooltip, /role="tooltip"/);
  assert.match(tooltip, /aria-describedby=/);
  assert.match(render(Badge, { status: "verified" }), /已验证/);
  assert.match(render(Badge, { status: "compiling" }), /编译中/);
  assert.throws(() => render(Badge, { status: "invented" }), /Unsupported Badge status/);
  assert.match(render(Skeleton, { label: "正在加载 Resource" }), /aria-busy="true"/);
  assert.match(meter, /role="meter"/);
  assert.match(meter, /aria-valuenow="82"/);
  assert.match(meter, /meter--critical/);
});

test("Meter rejects a missing accessible label", async () => {
  const { default: Meter } = await loadUi("Meter");

  assert.throws(() => render(Meter, { value: 50 }), /non-empty label/i);
  assert.throws(() => render(Meter, { label: "   ", value: 50 }), /non-empty label/i);
});

test("components CSS defines the T0.5 surfaces and parses without warnings", async () => {
  const selectors = [
    ".btn-ghost-amber",
    ".icon-btn",
    ".segmented",
    ".tabs",
    ".tab",
    ".tbl",
    ".tooltip",
    ".modal",
    ".drawer",
    ".toast",
    ".badge",
    ".skeleton",
    ".meter",
  ];

  for (const selector of selectors) assert.match(componentsCss, new RegExp(`\\${selector}`));
  assert.match(componentsCss, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  const result = await transform(componentsCss, { loader: "css", logLevel: "silent" });
  assert.deepEqual(result.warnings, []);
});

test("the kitchensink route is dynamically imported behind Vite's development gate", () => {
  assert.match(appSource, /import\.meta\.env\.DEV/);
  assert.match(appSource, /lazy\(\(\)\s*=>\s*import\("\.\/pages\/dev\/Kitchensink\.jsx"\)\)/);
  assert.match(appSource, /path="\/_kitchensink"/);
  assert.doesNotMatch(appSource, /^import Kitchensink/m);
});
