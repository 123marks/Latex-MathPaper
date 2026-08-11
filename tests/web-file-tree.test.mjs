import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const workbenchSource = readFileSync(resolve("web/src/pages/app/Workbench.jsx"), "utf8");
const css = readFileSync(resolve("web/src/styles/pages.css"), "utf8");

test("Workbench renders the real hierarchy with folder management actions", () => {
  // Hierarchical tree component fed by /api/editor/tree nodes.
  assert.match(workbenchSource, /function FileTreeView\(/);
  assert.match(workbenchSource, /<FileTreeView/);
  assert.match(workbenchSource, /collapsedDirs/);
  // Create file and folder against the real endpoints.
  assert.match(workbenchSource, /\/api\/editor\/folder/);
  assert.match(workbenchSource, /＋文件/);
  assert.match(workbenchSource, /＋目录/);
  // Rename/move keeps tabs and the active buffer consistent.
  assert.match(workbenchSource, /api\.patch\("\/api\/editor\/file", \{ workspace: contest, from, to \}\)/);
  assert.match(workbenchSource, /t\.path\.startsWith\(`\$\{from\}\/`\)/);
  // Delete asks for confirmation and closes affected tabs.
  assert.match(workbenchSource, /window\.confirm/);
  assert.match(workbenchSource, /t\.path !== path && !t\.path\.startsWith\(`\$\{path\}\/`\)/);
});

test("file tree management styles exist", () => {
  assert.match(css, /\.file-tree \.tree-actions \{/);
  assert.match(css, /\.file-tree \.tree-rename,/);
  assert.match(css, /\.tree-create \{/);
});
