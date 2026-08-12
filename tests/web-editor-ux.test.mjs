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

test("open tabs persist per workspace and restore before persisting", () => {
  assert.match(workbenchSource, /paperos\.tabs\.\$\{contest\}/);
  assert.match(workbenchSource, /tabsRestoredRef/);
  // The persist effect refuses to run until restore happened.
  assert.match(workbenchSource, /if \(!tabsRestoredRef\.current \|\| typeof window === "undefined"\) return;/);
});
