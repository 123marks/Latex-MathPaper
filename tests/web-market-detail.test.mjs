import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import React from "../web/node_modules/react/index.js";
import { renderToStaticMarkup } from "../web/node_modules/react-dom/server.node.js";
import { createServer as createViteServer } from "../web/node_modules/vite/dist/node/index.js";

const webRoot = resolve("web");
const source = readFileSync(resolve(webRoot, "src/pages/Market.jsx"), "utf8");
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
  const { default: Market } = await vite.ssrLoadModule(
    "/src/pages/Market.jsx?market-contract=" + Date.now(),
  );
  markup = renderToStaticMarkup(React.createElement(Market));
});

test.after(async () => {
  await vite?.close();
});

test("Market renders without crashing and exposes a detail entry point", () => {
  assert.match(markup, /技能市场/);
  assert.match(source, /onClick=\{\(\) => openDetail\(s\)\}/);
});

test("Market detail drawer has overview / permissions / MCP tabs", () => {
  for (const label of ["概览", "权限与能力", "MCP"]) {
    assert.match(source, new RegExp(`label:\\s*"${label}"`));
  }
  assert.match(source, /detailTab === "perms"/);
  assert.match(source, /detailTab === "mcp"/);
});

test("Market permissions are derived from the real execute mode, and MCP is honest", () => {
  assert.match(source, /const EXECUTE_CAPS =/);
  assert.match(source, /function capsFor\(skill\)/);
  // keyed by real execute modes, not per-skill fabricated permissions
  for (const mode of ["csv", "citation", "review", "writing", "figure", "layout", "model"]) {
    assert.match(source, new RegExp(`${mode}:\\s*\\{`));
  }
  assert.match(source, /capsFor\(detailTarget\)\.reads/);
  assert.match(source, /未声明 MCP 工具调用/);
});
