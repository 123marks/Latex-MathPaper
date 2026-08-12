import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const paletteSource = readFileSync(resolve("web/src/components/CommandPalette.jsx"), "utf8");
const workbenchSource = readFileSync(resolve("web/src/pages/app/Workbench.jsx"), "utf8");
const sessionsSource = readFileSync(resolve("web/src/pages/app/Sessions.jsx"), "utf8");

test("command palette aggregates real content via /api/search with debounce", () => {
  assert.match(paletteSource, /\/api\/search\?q=/);
  assert.match(paletteSource, /setTimeout\(async \(\) => \{/);
  assert.match(paletteSource, /q\.trim\(\)\.length < 2/);
  // All four result groups render as actionable commands.
  assert.match(paletteSource, /hits\.workspaces/);
  assert.match(paletteSource, /hits\.files/);
  assert.match(paletteSource, /hits\.sessions/);
  assert.match(paletteSource, /hits\.posts/);
});

test("search results deep-link into the right surfaces", () => {
  assert.match(paletteSource, /workspace=\$\{encodeURIComponent\(f\.workspace\)\}&file=\$\{encodeURIComponent\(f\.path\)\}/);
  assert.match(paletteSource, /\/app\/sessions\?id=/);
  // Workbench honours ?file= once the tree is loaded; Sessions honours ?id=.
  assert.match(workbenchSource, /get\("file"\)/);
  assert.match(workbenchSource, /openedFromUrlRef/);
  assert.match(sessionsSource, /get\("id"\)/);
});
