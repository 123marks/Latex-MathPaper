import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createRequire } from "node:module";

import { draftMathList, extractMathDrafts, renderMathDraft } from "../apps/desktop/src/math-drafts.mjs";

const require = createRequire(import.meta.url);
const katex = require("../web/node_modules/katex/dist/katex.js");
const ideSource = readFileSync(new URL("../apps/desktop/src/ide.jsx", import.meta.url), "utf8");
const buildScript = readFileSync(new URL("../apps/desktop/build-ide.mjs", import.meta.url), "utf8");

test("extractMathDrafts finds inline, display, bracket, and environment math without prose dollars", () => {
  const src = [
    "text $a^2$ more",
    "\\[ x=1 \\]",
    "\\begin{equation}",
    " E=mc^2 ",
    "\\end{equation}",
    "tail $$y$$ costs $5 and $6",
    "\\( z \\)",
  ].join("\n");
  const drafts = extractMathDrafts(src);
  assert.deepEqual(drafts.map((d) => [d.tex, d.display, d.kind]), [
    ["a^2", false, "$"],
    ["x=1", true, "\\[\\]"],
    ["E=mc^2", true, "equation"],
    ["y", true, "$$"],
    ["z", false, "\\(\\)"],
  ]);
  assert.equal(drafts[0].line, 1);
  assert.equal(drafts[2].line, 3);
});

test("one broken formula does not stop the others from rendering", () => {
  const render = (tex) => {
    if (tex.includes("\\oops")) throw new Error("KaTeX parse error: \\oops");
    return `<span>${tex}</span>`;
  };
  const list = draftMathList("ok $a+b$ bad $$\\oops$$ still $c$", render);
  assert.equal(list.length, 3);
  assert.equal(list[0].ok, true);
  assert.equal(list[1].ok, false);
  assert.match(list[1].error, /\\oops/);
  assert.equal(list[2].ok, true);
  assert.equal(list[2].html, "<span>c</span>");
});

test("renderMathDraft requires an injected renderer and never throws to the caller", () => {
  assert.throws(() => renderMathDraft("x"), /injected render/);
  const failed = renderMathDraft("\\nope", { render: () => { throw new Error("boom"); } });
  assert.equal(failed.ok, false);
  assert.equal(failed.html, "");
  assert.match(failed.error, /boom/);
});

test("real KaTeX renders a good formula and isolates a bad one", () => {
  const render = (tex, opts) => katex.renderToString(tex, opts);
  const good = renderMathDraft("E=mc^2", { display: true, render });
  assert.equal(good.ok, true);
  assert.match(good.html, /katex/);
  const bad = renderMathDraft("\\notacommandxyz", { render });
  assert.equal(bad.ok, false);
  assert.ok(bad.error.length > 0);
});

test("desktop IDE aliases KaTeX through esbuild and keeps the editor mounted", () => {
  assert.match(buildScript, /["']katex["']\s*:/);
  assert.match(ideSource, /LiveMathDrafts|data-testid="live-math-drafts"/);
  assert.doesNotMatch(ideSource, /\.\.\/\.\.\/\.\.\/web\/node_modules\/katex/);
  const editorHost = ideSource.slice(ideSource.indexOf('<div className="editor-host"'), ideSource.indexOf("<InlineEditBar"));
  assert.doesNotMatch(editorHost, /workMode === "render"[\s\S]{0,400}<Editor/);
});
