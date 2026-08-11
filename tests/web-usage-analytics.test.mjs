import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import React from "../web/node_modules/react/index.js";
import { renderToStaticMarkup } from "../web/node_modules/react-dom/server.node.js";
import { StaticRouter } from "../web/node_modules/react-router-dom/server.mjs";
import { createServer as createViteServer } from "../web/node_modules/vite/dist/node/index.js";

const webRoot = resolve("web");
const usageSource = readFileSync(resolve(webRoot, "src/pages/app/Usage.jsx"), "utf8");
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
  const [{ default: Usage }, { AuthProvider }] = await Promise.all([
    vite.ssrLoadModule("/src/pages/app/Usage.jsx?usage-contract=" + Date.now()),
    vite.ssrLoadModule("/src/lib/auth.jsx"),
  ]);
  markup = renderToStaticMarkup(
    React.createElement(StaticRouter, { location: "/app/usage" },
      React.createElement(AuthProvider, null, React.createElement(Usage))),
  );
});

test.after(async () => {
  await vite?.close();
});

test("Usage renders the analytics page shell", () => {
  assert.match(markup, /API 用量/);
});

test("Usage shows a real prompt/completion token composition", () => {
  assert.match(usageSource, /Token 构成/);
  assert.match(usageSource, /data\.promptTokens/);
  assert.match(usageSource, /data\.completionTokens/);
  assert.match(usageSource, /token-comp-bar/);
  // Composition is derived from real aggregated tokens, not fabricated.
  assert.match(usageSource, /data\.promptTokens \+ data\.completionTokens/);
});
