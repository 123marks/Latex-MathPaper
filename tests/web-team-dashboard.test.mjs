import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import React from "../web/node_modules/react/index.js";
import { renderToStaticMarkup } from "../web/node_modules/react-dom/server.node.js";
import { StaticRouter } from "../web/node_modules/react-router-dom/server.mjs";
import { createServer as createViteServer } from "../web/node_modules/vite/dist/node/index.js";

const webRoot = resolve("web");
const dashboardSource = readFileSync(resolve(webRoot, "src/pages/app/Dashboard.jsx"), "utf8");
const teamSource = readFileSync(resolve(webRoot, "src/pages/app/TeamSpace.jsx"), "utf8");
let vite;
let dashboardMarkup;

test.before(async () => {
  vite = await createViteServer({
    root: webRoot,
    appType: "custom",
    logLevel: "silent",
    resolve: { dedupe: ["react", "react-dom"] },
    server: { middlewareMode: true },
  });
  const [{ default: Dashboard }, { AuthProvider }] = await Promise.all([
    vite.ssrLoadModule("/src/pages/app/Dashboard.jsx?truth-contract=" + Date.now()),
    vite.ssrLoadModule("/src/lib/auth.jsx"),
  ]);
  dashboardMarkup = renderToStaticMarkup(
    React.createElement(
      StaticRouter,
      { location: "/app" },
      React.createElement(AuthProvider, null, React.createElement(Dashboard)),
    ),
  );
});

test.after(async () => {
  await vite?.close();
});

test("Dashboard does not claim local AI inference or data never leaving the machine", () => {
  assert.doesNotMatch(dashboardSource, /AI 推理都(跑|在).*机器上/);
  assert.doesNotMatch(dashboardSource, /数据不出本机/);
  assert.match(dashboardSource, /模型请求按你配置的 provider 处理/);
  assert.match(dashboardMarkup, /模型请求按你配置的 provider 处理/);
});

test("Dashboard shows an at-a-glance summary strip from real runtime/workspace data", () => {
  assert.match(dashboardSource, /const workspaceCount =/);
  assert.match(dashboardSource, /const readyCount =/);
  assert.match(dashboardMarkup, /运行时就绪 · Python \/ LaTeX \/ Tectonic/);
  assert.match(dashboardMarkup, /工作区/);
});

test("TeamSpace shows only real derived metrics, never fabricated counts or people", () => {
  assert.doesNotMatch(teamSource, /"Bob"|"Alice"|"Miro"/);
  assert.doesNotMatch(teamSource, /常用模板|已发布技能|共享引用|最近论断/);
  assert.doesNotMatch(teamSource, /42 - i \* 11/);
  assert.match(teamSource, /const contributions = useMemo/);
  assert.match(teamSource, /const evidenceTotal = useMemo/);
  assert.match(teamSource, /data\.tasks/);
});

test("TeamSpace 7-day activity heatmap is built only from real task.createdAt", () => {
  assert.match(teamSource, /const activity = useMemo/);
  assert.match(teamSource, /t\.createdAt/);
  assert.match(teamSource, /近 7 天活动/);
  assert.match(teamSource, /className="heat-cell"/);
  assert.match(teamSource, /data-level=\{Math\.min\(4, cell\.count\)\}/);
});
