import assert from "node:assert/strict";
import { resolve } from "node:path";
import test from "node:test";
import React from "../web/node_modules/react/index.js";
import { renderToStaticMarkup } from "../web/node_modules/react-dom/server.node.js";
import { createServer as createViteServer } from "../web/node_modules/vite/dist/node/index.js";

const webRoot = resolve("web");
const desktopRoot = resolve("apps/desktop");
const requiredNames = [
  "menu",
  "template",
  "git-branch",
  "sync",
  "magnifier",
  "evidence",
  "mcp",
  "play",
  "filter",
  "export",
];
let webVite;
let desktopVite;

test.before(async () => {
  [webVite, desktopVite] = await Promise.all(
    [webRoot, desktopRoot].map((root) => createViteServer({
      root,
      appType: "custom",
      logLevel: "silent",
      resolve: { dedupe: ["react", "react-dom"] },
      server: { middlewareMode: true },
    })),
  );
});

test.after(async () => {
  await Promise.all([webVite?.close(), desktopVite?.close()]);
});

test("web Icon registers every T0.6 semantic and preserves unknown-name silence", async () => {
  const { default: Icon, ICON_NAMES } = await webVite.ssrLoadModule(
    "/src/components/Icon.jsx?icon-registry=" + Date.now(),
  );

  assert.ok(Array.isArray(ICON_NAMES), "web Icon must expose its semantic registry");
  for (const name of requiredNames) {
    assert.ok(ICON_NAMES.includes(name), "missing web icon registration: " + name);
    const markup = renderToStaticMarkup(React.createElement(Icon, { name }));
    assert.match(markup, /^<svg/, "registered icon must render SVG: " + name);
  }
  assert.equal(renderToStaticMarkup(React.createElement(Icon, { name: "__unknown__" })), "");
});

test("desktop Icon renders every T0.6 semantic and preserves its unknown-name fallback", async () => {
  const { Icon, ICON_NAMES } = await desktopVite.ssrLoadModule(
    "/src/icons.jsx?icon-registry=" + Date.now(),
  );

  assert.ok(Array.isArray(ICON_NAMES), "desktop Icon must expose its semantic registry");
  for (const name of requiredNames) {
    assert.ok(ICON_NAMES.includes(name), "missing desktop icon registration: " + name);
    const markup = renderToStaticMarkup(React.createElement(Icon, { name }));
    assert.match(markup, /^<svg/, "registered desktop icon must render SVG: " + name);
  }

  const fallback = renderToStaticMarkup(React.createElement(Icon, { name: "__unknown__" }));
  assert.match(fallback, /^<svg/);
  assert.match(fallback, /<circle cx="12" cy="12" r="9"/);
});
