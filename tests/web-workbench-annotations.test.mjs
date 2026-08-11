import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const read = (p) => readFileSync(resolve("web/src", p), "utf8");
const workbench = read("pages/app/Workbench.jsx");
const editor = read("components/LaTeXEditor.jsx");
const apiLib = read("lib/api.js");

test("api exposes a PATCH helper", () => {
  assert.match(apiLib, /patch:\s*\(path, body\)/);
});

test("LaTeXEditor reports the selected line range to its parent", () => {
  assert.match(editor, /onSelectionChange/);
  assert.match(editor, /onDidChangeCursorSelection/);
  assert.match(editor, /startLineNumber/);
});

test("Workbench wires annotations to /api/editor/annotations using the real selection", () => {
  assert.match(workbench, /const \[annotations, setAnnotations\] = useState\(\[\]\)/);
  assert.match(workbench, /const \[annoSel, setAnnoSel\] = useState\(null\)/);
  assert.match(workbench, /onSelectionChange=\{setAnnoSel\}/);
  assert.match(workbench, /\/api\/editor\/annotations/);
  assert.match(workbench, /async function addAnnotation/);
  assert.match(workbench, /async function updateAnnotation/);
  assert.match(workbench, /async function deleteAnnotation/);
  assert.match(workbench, /<AnnotationsPanel/);
  assert.match(workbench, /kind: "editor-range"/);
});

test("AnnotationsPanel scopes to the active file and offers resolve/delete", () => {
  assert.match(workbench, /function AnnotationsPanel/);
  assert.match(workbench, /a\.target\?\.path === active\.path/);
  assert.match(workbench, /onStatus\(a\.id, "resolved"\)/);
  assert.match(workbench, /onDelete\(a\.id\)/);
});

test("Workbench composes open annotations into a structured AI edit request (Epic 1c)", () => {
  assert.match(workbench, /function composeFromAnnotations/);
  assert.match(workbench, /BEGIN_FILE\/END_FILE/);
  assert.match(workbench, /setMsg\(prompt\)/);
  assert.match(workbench, /updateAnnotation\(a\.id, \{ status: "proposed" \}\)/);
  assert.match(workbench, /onCompose=\{composeFromAnnotations\}/);
  assert.match(workbench, /交给 AI 修改/);
  // Human-in-the-loop: compose fills the input, it must not auto-apply.
  assert.doesNotMatch(workbench, /composeFromAnnotations[\s\S]{0,400}applyProposal\(\)/);
});
