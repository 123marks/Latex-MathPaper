import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import React from "../web/node_modules/react/index.js";
import { renderToStaticMarkup } from "../web/node_modules/react-dom/server.node.js";
import { StaticRouter } from "../web/node_modules/react-router-dom/server.mjs";
import { createServer as createViteServer } from "../web/node_modules/vite/dist/node/index.js";

const webRoot = resolve("web");
const source = readFileSync(resolve(webRoot, "src/pages/app/AppLayout.jsx"), "utf8");
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
  const [{ default: AppLayout }, { AuthProvider }] = await Promise.all([
    vite.ssrLoadModule("/src/pages/app/AppLayout.jsx?applayout-contract=" + Date.now()),
    vite.ssrLoadModule("/src/lib/auth.jsx"),
  ]);
  markup = renderToStaticMarkup(
    React.createElement(
      StaticRouter,
      { location: "/app" },
      React.createElement(AuthProvider, null, React.createElement(AppLayout)),
    ),
  );
});

test.after(async () => {
  await vite?.close();
});

test("AppLayout menu toggle is icon-based, not a raw glyph", () => {
  assert.match(source, /<Icon name="menu"/);
  assert.doesNotMatch(source, /☰/);
  assert.match(markup, /aria-label="菜单"[^>]*><svg/);
  assert.doesNotMatch(markup, /☰/);
});

test("AppLayout has a real workspace switcher backed by /api/editor/projects", () => {
  assert.match(source, /\/api\/editor\/projects/);
  assert.match(source, /className="workspace-switch"/);
  assert.match(source, /\/app\/workbench\?workspace=/);
  assert.match(source, /setWorkspaces\(d\.projects/);
});
