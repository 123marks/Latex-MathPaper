import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import React from "../web/node_modules/react/index.js";
import { renderToStaticMarkup } from "../web/node_modules/react-dom/server.node.js";
import { StaticRouter } from "../web/node_modules/react-router-dom/server.mjs";
import { createServer as createViteServer } from "../web/node_modules/vite/dist/node/index.js";

const webRoot = resolve("web");
const read = (p) => readFileSync(resolve(webRoot, p), "utf8");
const sessionsSource = read("src/pages/app/Sessions.jsx");
const appSource = read("src/App.jsx");
const layoutSource = read("src/pages/app/AppLayout.jsx");
const workbenchSource = read("src/pages/app/Workbench.jsx");
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
  const { default: Sessions } = await vite.ssrLoadModule("/src/pages/app/Sessions.jsx?sessions-contract=" + Date.now());
  markup = renderToStaticMarkup(
    React.createElement(StaticRouter, { location: "/app/sessions" }, React.createElement(Sessions)),
  );
});

test.after(async () => {
  await vite?.close();
});

test("Sessions page renders search and an initial empty detail", () => {
  assert.match(markup, /AI 会话/);
  assert.match(markup, /搜索提问/);
  assert.match(markup, /选择左侧一条会话查看详情/);
});

test("Sessions reads real chat history and can reuse a prompt in the Workbench", () => {
  assert.match(sessionsSource, /\/api\/chat\/history/);
  assert.match(sessionsSource, /parseFileBlocks/);
  assert.match(sessionsSource, /\/app\/workbench\?prompt=/);
});

test("Sessions is routed and reachable from the app nav", () => {
  assert.match(appSource, /import Sessions from ".\/pages\/app\/Sessions.jsx"/);
  assert.match(appSource, /path="\/app\/sessions" element=\{<Sessions \/>\}/);
  assert.match(layoutSource, /to: "\/app\/sessions"/);
});

test("Workbench prefills the AI input from a ?prompt deep link (resume)", () => {
  assert.match(workbenchSource, /get\("prompt"\)/);
});
