import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const workbenchSource = readFileSync(resolve("web/src/pages/app/Workbench.jsx"), "utf8");
const css = readFileSync(resolve("web/src/styles/pages.css"), "utf8");

test("workspace-wide text search lives in the file rail", () => {
  assert.match(workbenchSource, /railMode/);
  assert.match(workbenchSource, /\/api\/editor\/search\?workspace=/);
  // Results group by file and open the file on click.
  assert.match(workbenchSource, /search-file-head/);
  assert.match(workbenchSource, /search-hit/);
  assert.match(css, /\.search-results \{/);
});

test("Ctrl+S saves through a capture-phase handler", () => {
  assert.match(workbenchSource, /event\.key\.toLowerCase\(\) === "s"/);
  assert.match(workbenchSource, /event\.preventDefault\(\)/);
  assert.match(workbenchSource, /addEventListener\("keydown", onKey, true\)/);
  assert.match(workbenchSource, /saveRef\.current = save/);
});

test("dirty buffers block accidental page close", () => {
  assert.match(workbenchSource, /beforeunload/);
  assert.match(workbenchSource, /dirtyRef\.current = Boolean\(dirty\) \|\| openTabs\.some\(\(t\) => t\.dirty\)/);
});

test("search, references, and annotations jump to the exact line", () => {
  const editorSource = readFileSync(resolve("web/src/components/LaTeXEditor.jsx"), "utf8");
  // The editor exposes its Monaco instance to the host.
  assert.match(editorSource, /editorRef\.current = editor/);
  // openFileAt reveals + focuses the target line with a retry.
  assert.match(workbenchSource, /revealLineInCenter\(line\)/);
  assert.match(workbenchSource, /setPosition\(\{ lineNumber: line, column: 1 \}\)/);
  // All three surfaces feed it.
  assert.match(workbenchSource, /onClick=\{\(\) => openFileAt\(file, r\.line\)\}/);
  assert.match(workbenchSource, /onOpenFile\(loc\.file, loc\.line\)/);
  assert.match(workbenchSource, /openFileAt\(a\.target\.path, a\.target\.startLine\)/);
  assert.match(workbenchSource, /annotation-loc-jump/);
});

test("panes resize by drag with clamped, persisted widths", () => {
  assert.match(workbenchSource, /startPaneDrag/);
  assert.match(workbenchSource, /"--tree-w": `\$\{paneW\.tree\}px`/);
  assert.match(workbenchSource, /Math\.min\(420, Math\.max\(160/);
  assert.match(workbenchSource, /Math\.min\(640, Math\.max\(280/);
  assert.match(workbenchSource, /paperos\.panes/);
  assert.match(css, /\.pane-handle \{/);
  assert.match(css, /grid-template-columns: var\(--tree-w, 220px\) 1fr/);
  // Handles disappear where the layout collapses.
  assert.match(css, /@media \(max-width: 900px\) \{\s*\.pane-handle \{ display: none; \}/);
});

test("file tree has a context menu wired to real actions", () => {
  assert.match(workbenchSource, /openTreeMenu/);
  assert.match(workbenchSource, /onContextMenu=\{\(e\) => onMenu\?\.\(e, n\)\}/);
  assert.match(workbenchSource, /新建文件夹/);
  assert.match(workbenchSource, /重命名 \/ 移动/);
  assert.match(workbenchSource, /menuDirPrefix/);
  assert.match(css, /\.tree-menu \{/);
});

test("open tabs persist per workspace and restore before persisting", () => {
  assert.match(workbenchSource, /paperos\.tabs\.\$\{contest\}/);
  assert.match(workbenchSource, /tabsRestoredRef/);
  // The persist effect refuses to run until restore happened.
  assert.match(workbenchSource, /if \(!tabsRestoredRef\.current \|\| typeof window === "undefined"\) return;/);
});
