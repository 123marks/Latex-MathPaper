import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import React from "../web/node_modules/react/index.js";
import { renderToStaticMarkup } from "../web/node_modules/react-dom/server.node.js";
import { StaticRouter } from "../web/node_modules/react-router-dom/server.mjs";
import { createServer as createViteServer } from "../web/node_modules/vite/dist/node/index.js";

const webRoot = resolve("web");
const source = readFileSync(resolve(webRoot, "src/pages/app/Magnifier.jsx"), "utf8");
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
  const { default: Magnifier } = await vite.ssrLoadModule(
    "/src/pages/app/Magnifier.jsx?magnifier-contract=" + Date.now(),
  );
  markup = renderToStaticMarkup(
    React.createElement(
      StaticRouter,
      { location: "/app/magnifier" },
      React.createElement(Magnifier),
    ),
  );
});

test.after(async () => {
  await vite?.close();
});

test("Magnifier is workspace-driven, not sample-contest hardcoded", () => {
  assert.doesNotMatch(source, /\[\s*"sample-contest"\s*\]/);
  assert.doesNotMatch(source, /const CONTESTS/);
  assert.match(source, /\/api\/editor\/projects/);
  assert.match(source, /useSearchParams/);
  assert.match(source, /get\("workspace"\)/);
});

test("Magnifier gates evidence reverse-lookup on the evidence capability", () => {
  assert.match(source, /capabilities\??\.\s*includes\(\s*"evidence"\s*\)/);
  // SSR initial state has no loaded projects, so the capability gate renders.
  assert.match(markup, /放大镜 · 证据反查/);
  assert.match(markup, /未启用 Evidence 能力/);
  assert.match(markup, /evidence<\/code>/);
});

test("Magnifier traces the five evidence categories through EvidenceFlow", () => {
  assert.match(source, /EvidenceFlow/);
  assert.match(source, /links=\{flowLinks\}/);
  for (const category of ["Claim", "Result", "Script", "Dataset", "Source"]) {
    assert.match(source, new RegExp(`title:\\s*"${category}"`));
  }
});
