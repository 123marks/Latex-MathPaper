import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import React from "../web/node_modules/react/index.js";
import { renderToStaticMarkup } from "../web/node_modules/react-dom/server.node.js";
import { createServer as createViteServer } from "../web/node_modules/vite/dist/node/index.js";

const webRoot = resolve("web");
const viewerSource = readFileSync(resolve(webRoot, "src/components/workbench/PdfViewer.jsx"), "utf8");
const workbenchSource = readFileSync(resolve(webRoot, "src/pages/app/Workbench.jsx"), "utf8");
const css = readFileSync(resolve(webRoot, "src/styles/pages.css"), "utf8");
let vite;
let markup;

test.before(async () => {
  vite = await createViteServer({
    root: webRoot,
    appType: "custom",
    logLevel: "silent",
    resolve: { dedupe: ["react", "react-dom"] },
    server: { middlewareMode: true },
  });
  const { default: PdfViewer } = await vite.ssrLoadModule("/src/components/workbench/PdfViewer.jsx?pdfv=" + Date.now());
  markup = renderToStaticMarkup(React.createElement(PdfViewer, { url: "" }));
});

test.after(async () => {
  await vite?.close();
});

test("PdfViewer SSRs a toolbar shell without touching pdfjs", () => {
  assert.match(markup, /标注区域/);
  assert.match(markup, /问 AI（选中文本）/);
  assert.match(markup, /尚无编译产物/);
});

test("PdfViewer loads pdfjs lazily in the browser only", () => {
  // Dynamic import keeps pdf.js out of SSR and out of the main chunk.
  assert.match(viewerSource, /await import\("pdfjs-dist"\)/);
  assert.match(viewerSource, /pdf\.worker\.min\.mjs\?url/);
  assert.match(viewerSource, /GlobalWorkerOptions\.workerSrc = pdfWorkerUrl/);
  // v4+ text layer contract: TextLayer + --scale-factor on the container.
  assert.match(viewerSource, /new pdfjs\.TextLayer\(/);
  assert.match(viewerSource, /--scale-factor/);
  // Region marquee reports normalised 0..1 rects and ignores accidental clicks.
  assert.match(viewerSource, /w > 0\.01 && h > 0\.01/);
});

test("Workbench wires the viewer into ask-AI and pdf-region annotations", () => {
  assert.match(workbenchSource, /<PdfViewer/);
  assert.match(workbenchSource, /onAskSelection=/);
  assert.match(workbenchSource, /kind: "pdf-region"/);
  // Annotation list and AI compose understand pdf-region targets.
  assert.match(workbenchSource, /PDF p\.\$\{a\.target\.page\}/);
  assert.match(workbenchSource, /PDF 第 \$\{a\.target\.page\} 页选区/);
});

test("pdf viewer styles exist", () => {
  assert.match(css, /\.pdfv-toolbar \{/);
  assert.match(css, /\.pdfjs-text-layer \{/);
  assert.match(css, /\.pdfv-marquee \{/);
});
