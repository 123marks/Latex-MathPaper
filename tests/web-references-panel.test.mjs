import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const workbenchSource = readFileSync(resolve("web/src/pages/app/Workbench.jsx"), "utf8");
const css = readFileSync(resolve("web/src/styles/pages.css"), "utf8");

test("Workbench mounts a references panel fed by the real .bib scan", () => {
  assert.match(workbenchSource, /function ReferencesPanel\(/);
  assert.match(workbenchSource, /\/api\/editor\/references\?workspace=/);
  assert.match(workbenchSource, /<ReferencesPanel/);
  // Citation locations open the actual source file.
  assert.match(workbenchSource, /onOpenFile\(loc\.file\)/);
  // Missing citations (cited but absent from .bib) are surfaced, not hidden.
  assert.match(workbenchSource, /data\.missing\.length > 0/);
  assert.match(workbenchSource, /引用了但 \.bib 里没有/);
});

test("references panel styles exist", () => {
  assert.match(css, /\.refs-panel \{/);
  assert.match(css, /\.chip\.warn \{/);
  assert.match(css, /\.ref-loc \{/);
});
