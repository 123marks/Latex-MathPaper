import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { createServer as createViteServer } from "../web/node_modules/vite/dist/node/index.js";

const webRoot = resolve("web");
const editorSource = readFileSync(resolve(webRoot, "src/components/LaTeXEditor.jsx"), "utf8");
const workbenchSource = readFileSync(resolve(webRoot, "src/pages/app/Workbench.jsx"), "utf8");
const css = readFileSync(resolve(webRoot, "src/styles/pages.css"), "utf8");
let vite;
let mathAtOffset;
let buildOutline;

test.before(async () => {
  vite = await createViteServer({
    root: webRoot,
    appType: "custom",
    logLevel: "silent",
    resolve: { dedupe: ["react", "react-dom"] },
    server: { middlewareMode: true },
  });
  ({ mathAtOffset } = await vite.ssrLoadModule("/src/components/LaTeXEditor.jsx?lineage=" + Date.now()));
  ({ buildOutline } = await vite.ssrLoadModule("/src/pages/app/Workbench.jsx?lineage=" + Date.now()));
});

test.after(async () => {
  await vite?.close();
});

test("mathAtOffset finds inline, display, bracket, and environment math around the caret", () => {
  const src = "text $a^2$ more \\[ x=1 \\] and \\begin{equation}\n E=mc^2 \n\\end{equation} tail $$y$$ costs $5 and $6";
  assert.deepEqual(mathAtOffset(src, src.indexOf("a^2") + 1), { tex: "a^2", display: false });
  assert.deepEqual(mathAtOffset(src, src.indexOf("x=1") + 1), { tex: "x=1", display: true });
  assert.deepEqual(mathAtOffset(src, src.indexOf("E=mc") + 2), { tex: "E=mc^2", display: true });
  assert.deepEqual(mathAtOffset(src, src.indexOf("$$y$$") + 2), { tex: "y", display: true });
  // Prose dollars: caret in "text" is outside any math.
  assert.equal(mathAtOffset(src, 1), null);
});

test("buildOutline extracts section hierarchy with line numbers", () => {
  const tex = "\\documentclass{article}\n\\section{Intro}\n text\n\\subsection*{Aim}\n\\section[short]{Method}\n\\paragraph{Note}";
  const outline = buildOutline(tex);
  assert.deepEqual(outline.map((o) => [o.kind, o.title, o.line, o.level]), [
    ["section", "Intro", 2, 2],
    ["subsection", "Aim", 4, 3],
    ["section", "Method", 5, 2],
    ["paragraph", "Note", 6, 5],
  ]);
});

test("editor wires cite completion, live math preview, and the host passes real keys", () => {
  assert.match(editorSource, /registerCompletionItemProvider\("latex"/);
  assert.match(editorSource, /citeKeysRef\.current/);
  assert.match(editorSource, /katex\.renderToString/);
  assert.match(editorSource, /onDidChangeCursorPosition/);
  assert.match(editorSource, /math-preview/);
  // Keys come from the references API scan, never hardcoded.
  assert.match(workbenchSource, /\/api\/editor\/references\?workspace=\$\{encodeURIComponent\(contest\)\}`\)\s*\.then\(\(d\) => setCiteKeys/);
  assert.match(workbenchSource, /citeKeys=\{citeKeys\}/);
});

test("integrated terminal streams /api/editor/terminal into the bottom panel", () => {
  assert.match(workbenchSource, /bottomTab === "terminal"/);
  assert.match(workbenchSource, /fetch\("\/api\/editor\/terminal"/);
  assert.match(workbenchSource, /workspace: contest, command/);
  // SSE frames: stdout/stderr/exit handled; abort supported; history on ArrowUp.
  assert.match(workbenchSource, /ev === "stdout"/);
  assert.match(workbenchSource, /ev === "exit"/);
  assert.match(workbenchSource, /termAbortRef\.current\?\.abort\(\)/);
  assert.match(workbenchSource, /e\.key === "ArrowUp"/);
  assert.match(css, /\.terminal-body \{/);
});

test("@file mentions attach real file content; describe-to-formula routes through the reviewable chat", () => {
  // Pine: @path expands via the real file API into the outgoing message only.
  assert.match(workbenchSource, /async function expandFileMentions/);
  assert.match(workbenchSource, /\/api\/editor\/file\?workspace=\$\{encodeURIComponent\(contest\)\}&path=\$\{encodeURIComponent\(rel\)\}/);
  assert.match(workbenchSource, /content: mention\.expanded/);
  assert.match(workbenchSource, /未找到 @ 引用的文件/);
  // latex-stickies: Ctrl+Shift+M fills the prompt; nothing is auto-inserted.
  assert.match(workbenchSource, /event\.shiftKey && event\.key\.toLowerCase\(\) === "m"/);
  assert.match(workbenchSource, /function describeToFormula/);
  assert.match(workbenchSource, /只输出公式本身/);
  assert.match(workbenchSource, /描述→公式/);
  const panelSource = readFileSync(resolve(webRoot, "src/components/workbench/AIAssistantPanel.jsx"), "utf8");
  assert.match(panelSource, /@sections\/intro\.tex/);
});

test("outline rail and snapshot controls are wired to real endpoints", () => {
  assert.match(workbenchSource, /railMode === "outline"/);
  assert.match(workbenchSource, /openFileAt\(active\.path, o\.line\)/);
  assert.match(workbenchSource, /\/api\/editor\/snapshots\?workspace=/);
  assert.match(workbenchSource, /\/api\/editor\/snapshots\/\$\{id\}\/restore/);
  assert.match(workbenchSource, /pre-restore/);
  assert.match(workbenchSource, /msg\.snapshotId/);
  assert.match(css, /\.outline-item \{/);
  assert.match(css, /\.math-preview \{/);
  assert.match(css, /\.snapshot-select \{/);
});
