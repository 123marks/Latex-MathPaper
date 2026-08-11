import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import React from "../web/node_modules/react/index.js";
import { renderToStaticMarkup } from "../web/node_modules/react-dom/server.node.js";
import { StaticRouter } from "../web/node_modules/react-router-dom/server.mjs";
import { createServer as createViteServer } from "../web/node_modules/vite/dist/node/index.js";

const webRoot = resolve("web");
const pageSource = readFileSync(resolve(webRoot, "src/pages/app/ApiKeys.jsx"), "utf8");
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
  const [{ default: ApiKeys }, { AuthProvider }] = await Promise.all([
    vite.ssrLoadModule("/src/pages/app/ApiKeys.jsx?profiles-contract=" + Date.now()),
    vite.ssrLoadModule("/src/lib/auth.jsx"),
  ]);
  markup = renderToStaticMarkup(
    React.createElement(StaticRouter, { location: "/app/api-keys" },
      React.createElement(AuthProvider, null, React.createElement(ApiKeys))),
  );
});

test.after(async () => {
  await vite?.close();
});

test("ApiKeys page renders", () => {
  assert.match(markup, /模型 API Key/);
});

test("ApiKeys manages multiple provider profiles against the real API", () => {
  assert.match(pageSource, /\/api\/account\/providers"/);
  assert.match(pageSource, /\/api\/account\/providers\/activate/);
  assert.match(pageSource, /api\.del\(`\/api\/account\/providers\/\$\{id\}`\)/);
  assert.match(pageSource, /Provider 档案/);
  assert.match(pageSource, /provider\?\.profiles/);
  assert.match(pageSource, /使用中/);
  assert.match(pageSource, /启用/);
});

test("provider profile styles exist", () => {
  assert.match(css, /\.provider-row \{/);
  assert.match(css, /\.provider-row\.active \{/);
});

test("Workbench can pin a profile per chat request (Epic 4b)", () => {
  const workbenchSource = readFileSync(resolve(webRoot, "src/pages/app/Workbench.jsx"), "utf8");
  const panelSource = readFileSync(resolve(webRoot, "src/components/workbench/AIAssistantPanel.jsx"), "utf8");
  // Workbench loads real profiles and forwards the chosen one with the request.
  assert.match(workbenchSource, /\/api\/account\/overview/);
  assert.match(workbenchSource, /profileId: aiProfileId/);
  assert.match(workbenchSource, /onProfileChange=\{setAiProfileId\}/);
  // The panel renders a select fed by real profiles only.
  assert.match(panelSource, /workbench-ai-profile/);
  assert.match(panelSource, /profiles\.map\(/);
  assert.match(panelSource, /onProfileChange\?\.\(event\.target\.value\)/);
  assert.match(css, /\.ai-profile-row select \{/);
});
