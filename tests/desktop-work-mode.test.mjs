import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// Slice 1 of docs/plans/2026-09-18-desktop-ide-dual-mode-plan.md: the desktop
// IDE exposes Agent/Render as a layout emphasis, not as a permission wall.
// These are source contracts for apps/desktop/src/ide.jsx; the runtime
// behaviour is verified by app/desktop-mode-visual-smoke.mjs.

const ideSource = readFileSync(new URL("../apps/desktop/src/ide.jsx", import.meta.url), "utf8");
const ideCss = readFileSync(new URL("../apps/desktop/src/assets/ide.css", import.meta.url), "utf8");
const buildScript = readFileSync(new URL("../apps/desktop/build-ide.mjs", import.meta.url), "utf8");

function slice(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.ok(start >= 0, `missing marker ${startMarker}`);
  const end = source.indexOf(endMarker, start);
  assert.ok(end > start, `missing end marker ${endMarker}`);
  return source.slice(start, end);
}

test("work mode is restored from and persisted to local storage", () => {
  assert.match(ideSource, /localStorage\.getItem\("paperos\.workMode"\)/);
  assert.match(ideSource, /localStorage\.setItem\("paperos\.workMode", next\)/);
  assert.match(ideSource, /function switchWorkMode\(nextMode\)/);
});

test("title bar exposes an accessible Agent/Render segmented control", () => {
  const switchSource = slice(ideSource, '<div className="work-mode-switch"', 'data-testid="workspace-status"');
  assert.match(switchSource, /role="group" aria-label="/);
  assert.match(switchSource, /data-testid="work-mode-switch"/);
  assert.match(switchSource, /data-testid="work-mode-agent"/);
  assert.match(switchSource, /data-testid="work-mode-render"/);
  assert.match(switchSource, /aria-pressed=\{workMode === "agent"\}/);
  assert.match(switchSource, /aria-pressed=\{workMode === "render"\}/);
  // Group label + one label per button survive the icon-only collapse.
  assert.equal((switchSource.match(/aria-label="/g) || []).length, 3);
  assert.equal((switchSource.match(/title="/g) || []).length, 2);
  assert.equal((switchSource.match(/className="mode-label"/g) || []).length, 2);
});

test("no decorative harness or readiness chip pretends an AI runtime state", () => {
  assert.doesNotMatch(ideSource, /harness ready/i);
  assert.doesNotMatch(ideSource, /className="mode-harness"/);
  assert.doesNotMatch(ideCss, /\.mode-harness/);
});

test("desktop bundle does not import web/node_modules through relative paths", () => {
  assert.doesNotMatch(ideSource, /\.\.\/\.\.\/\.\.\/web\/node_modules/);
  // Shared browser dependencies are wired through the esbuild alias table.
  assert.match(buildScript, /alias: \{/);
});

test("Render mode never replaces the Monaco editor; both modes keep editing", () => {
  const editorHost = slice(ideSource, '<div className="editor-host"', '<InlineEditBar');
  assert.match(editorHost, /\) : active \? \(\s*<Editor/);
  assert.doesNotMatch(editorHost, /workMode === "render"[\s\S]{0,400}<Editor/);
  assert.doesNotMatch(editorHost, /<LiveMathPreview/);
});

test("the Render stage appears only when no compiled PDF is on screen", () => {
  assert.match(ideSource, /const pdfVisible = Boolean\(pdfUrl && showPdf\)/);
  assert.match(ideSource, /const activeIsMedia = Boolean\(active && mediaPreview && mediaPreview\.path === active\.path\)/);
  assert.match(ideSource, /const showRenderStage = workMode === "render" && !pdfVisible && !activeIsMedia/);
  const stage = slice(ideSource, "function RenderStage(", "function IDE(");
  assert.match(stage, /data-testid="render-stage"/);
  // Honest empty states: compile entry only with the LaTeX Capability, and
  // a plain "no preview" explanation otherwise; nothing pretends to render.
  assert.match(stage, /canCompile/);
  assert.match(stage, /onCompile/);
  assert.doesNotMatch(stage, /katex|renderToString/);
});

test("current mode is repeated in the Assistant header and the status bar", () => {
  const aiHead = slice(ideSource, '<div className="ai-head">', '<div className="ai-stream">');
  assert.match(aiHead, /data-testid="ai-mode-label"/);
  const statusbar = slice(ideSource, '<div className="statusbar">', "{/* Magnifier / Evidence drawer */}");
  assert.match(statusbar, /data-testid="status-work-mode"/);
  assert.match(statusbar, /switchWorkMode\(workMode === "agent" \? "render" : "agent"\)/);
});

test("mode switching does not reset Workspace, tabs, buffers, or chat", () => {
  const fn = slice(ideSource, "function switchWorkMode(nextMode)", "useEffect(");
  for (const forbidden of ["setOpenTabs", "setActive(", "setEditor(", "setChat(", "setContest(", "resetWorkspaceSession"]) {
    assert.doesNotMatch(fn, new RegExp(forbidden.replace(/[()]/g, "\\$&")), `${forbidden} must not run on mode switch`);
  }
});

test("narrow widths collapse mode labels to icons without removing the control", () => {
  const narrow = ideCss.slice(ideCss.indexOf("@media (max-width: 920px)"));
  assert.match(narrow, /\.work-mode-switch \.mode-label\s*\{\s*display:\s*none/);
  assert.doesNotMatch(narrow, /\.work-mode-switch\s*\{[^}]*display:\s*none/);
});
