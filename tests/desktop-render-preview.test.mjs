import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { describeSynctexError, preferSynctexHit, synctexQuery } from "../apps/desktop/src/synctex-client.mjs";

const ideSource = readFileSync(new URL("../apps/desktop/src/ide.jsx", import.meta.url), "utf8");
const ideCss = readFileSync(new URL("../apps/desktop/src/assets/ide.css", import.meta.url), "utf8");
const buildScript = readFileSync(new URL("../apps/desktop/build-ide.mjs", import.meta.url), "utf8");
const pdfSource = readFileSync(new URL("../apps/desktop/src/pdf-preview.jsx", import.meta.url), "utf8");
const serverSource = readFileSync(new URL("../app/server.mjs", import.meta.url), "utf8");

test("synctexQuery builds the existing editor route and never invents a hit", () => {
  assert.equal(
    synctexQuery({ workspace: "ws", tex: "main.tex", mode: "forward", path: "sec.tex", line: 12 }),
    "/api/editor/synctex?workspace=ws&tex=main.tex&mode=forward&path=sec.tex&line=12",
  );
  const inverse = synctexQuery({ workspace: "ws", tex: "main.tex", mode: "inverse", page: 2, x: 10.1, y: 20 });
  assert.match(inverse, /mode=inverse/);
  assert.match(inverse, /page=2/);
  assert.match(inverse, /x=10.10/);
});

test("SYNCTEX_MISSING is a degraded state the UI can explain", () => {
  const missing = describeSynctexError({ code: "SYNCTEX_MISSING", status: 404, message: "no synctex" });
  assert.equal(missing.degraded, true);
  assert.equal(missing.code, "SYNCTEX_MISSING");
  const noMatch = describeSynctexError({ code: "SYNCTEX_NO_MATCH", status: 404, message: "该行没有 synctex 记录" });
  assert.equal(noMatch.degraded, true);
  assert.equal(noMatch.code, "SYNCTEX_NO_MATCH");
  const other = describeSynctexError({ message: "network" });
  assert.equal(other.degraded, false);
});

test("a real SyncTeX hit wins over the section-page estimate", () => {
  const estimate = { page: 9, title: "Intro", kind: "section", sourceLine: 4 };
  const preferred = preferSynctexHit({ page: 2, x: 10, y: 80, path: "main.tex", line: 4 }, estimate);
  assert.equal(preferred.source, "synctex");
  assert.equal(preferred.page, 2);
  assert.equal(preferSynctexHit(null, estimate).source, "estimate");
  assert.equal(preferSynctexHit(null, null), null);
});

test("desktop PDF preview is pdf.js with page/zoom, not a bare iframe", () => {
  assert.match(buildScript, /pdfjs-dist/);
  assert.match(buildScript, /pdf\.worker\.min\.mjs/);
  assert.match(buildScript, /pdf\.mjs/);
  assert.match(pdfSource, /\/ide\/pdf\.mjs/);
  assert.match(pdfSource, /disableWorker/);
  assert.match(pdfSource, /readPdfBytes/);
  assert.match(pdfSource, /data-testid="pdf-toolbar"/);
  assert.match(pdfSource, /data-testid="pdf-page-label"/);
  assert.match(pdfSource, /data-testid="pdf-zoom-label"/);
  assert.match(pdfSource, /onInverseSync/);
  assert.doesNotMatch(ideSource, /<iframe key=\{pdfVer\} src=\{pdfUrl\}/);
  assert.match(ideSource, /<DesktopPdfPreview/);
  assert.match(ideSource, /synctexQuery/);
  assert.match(ideSource, /describeSynctexError/);
  assert.match(ideCss, /\.pdf-toolbar/);
  assert.match(ideCss, /\.live-math-drafts/);
  assert.match(serverSource, /\.mjs": "text\/javascript/);
  assert.match(serverSource, /connect-src 'self' blob:/);
});
