import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import React from "../web/node_modules/react/index.js";
import { renderToStaticMarkup } from "../web/node_modules/react-dom/server.node.js";
import { StaticRouter } from "../web/node_modules/react-router-dom/server.mjs";
import { createServer as createViteServer } from "../web/node_modules/vite/dist/node/index.js";

const webRoot = resolve("web");
const homeSource = readFileSync(resolve(webRoot, "src/pages/Home.jsx"), "utf8");
const pagesCss = readFileSync(resolve(webRoot, "src/styles/pages.css"), "utf8");
const smokeSource = readFileSync(resolve("app/home-hero-visual-smoke.mjs"), "utf8");
let vite;
let markup;
let headerMarkup;

test.before(async () => {
  vite = await createViteServer({
    root: webRoot,
    appType: "custom",
    logLevel: "silent",
    resolve: { dedupe: ["react", "react-dom"] },
    server: { middlewareMode: true },
  });

  const { default: Home } = await vite.ssrLoadModule(
    "/src/pages/Home.jsx?hero-contract=" + Date.now(),
  );
  const [{ default: SiteHeader }, { AuthProvider }] = await Promise.all([
    vite.ssrLoadModule("/src/components/SiteHeader.jsx?hero-contract=" + Date.now()),
    vite.ssrLoadModule("/src/lib/auth.jsx"),
  ]);
  markup = renderToStaticMarkup(
    React.createElement(
      StaticRouter,
      { location: "/" },
      React.createElement(Home),
    ),
  );
  headerMarkup = renderToStaticMarkup(
    React.createElement(
      StaticRouter,
      { location: "/" },
      React.createElement(AuthProvider, null, React.createElement(SiteHeader)),
    ),
  );
});

test.after(async () => {
  await vite?.close();
});

test("Home hero states current product truth and links to the workflow", () => {
  assert.match(markup, /Local first · Pack powered\./);
  assert.match(markup, /href="#workflow"/);
  assert.match(markup, /id="workflow"/);
  assert.match(markup, /<dt>内置 Pack<\/dt><dd><b>4<\/b><\/dd>/);
  assert.match(markup, /Preview → Apply/);
  assert.match(markup, /Windows 开发预览/);
  assert.match(markup, /macOS\/Linux 便携包/);
  assert.doesNotMatch(markup, /macOS\/Linux 规划中/);
  assert.doesNotMatch(markup, /仍在规划/);
  assert.match(markup, /模型请求按你配置的 provider 处理/);
  assert.doesNotMatch(
    markup,
    /Team first|团队空间|技能市场|编辑、编译、协作|AI 推理都跑在你的机器上|数据不出本机|服务器零算力|compiled 1\.2s|1–5s/,
  );
});

test("Home hero mock exposes an honest document workflow preview", () => {
  assert.match(markup, /aria-label="Paper OS IDE 工作流示意"/);
  assert.match(markup, /界面示意/);
  assert.match(markup, /class="hero-mock-pdf"/);
  assert.match(markup, /class="hero-mock-assistant"/);
  assert.match(markup, /AI 修改预览/);
  assert.match(markup, />source</);
  assert.match(markup, />citation</);
  assert.match(markup, />figure</);
  assert.match(markup, /math-modeling Pack/);
  assert.doesNotMatch(markup, /Evidence Pack/);
});

test("public header uses the stable local-first Pack descriptor", () => {
  assert.match(headerMarkup, /Local First · Pack Powered/);
  assert.doesNotMatch(headerMarkup, /Team First|Editorial LaTeX/);
  assert.match(headerMarkup, /aria-label="菜单"[^>]*><svg/);
  assert.match(headerMarkup, /aria-expanded="false"/);
  assert.match(headerMarkup, /aria-controls="mobile-site-nav"/);
  assert.doesNotMatch(headerMarkup, /☰/);
});

test("Home hero disables JavaScript motion for reduced-motion users", () => {
  assert.match(homeSource, /const reducedMotion = useReducedMotion\(\);/);
  assert.match(homeSource, /data-motion=\{reducedMotion \? "static" : "active"\}/);
  assert.match(homeSource, /y: reducedMotion \? 0 : mockY/);
  assert.match(homeSource, /opacity: reducedMotion \? 1 : mockOpacity/);
});

test("compact public navigation uses one breakpoint", () => {
  const compactStart = pagesCss.indexOf("@media (max-width: 880px)");
  const mobileStart = pagesCss.indexOf("@media (max-width: 640px)", compactStart);
  assert.notEqual(compactStart, -1);
  assert.notEqual(mobileStart, -1);
  const compactRules = pagesCss.slice(compactStart, mobileStart);
  assert.match(compactRules, /\.nav-links\s*\{\s*display:\s*none;/);
});

test("Home browser smoke covers T1.2 public sections and interactions", () => {
  assert.match(smokeSource, /async function verifyPublicSections\(cdp\)/);
  assert.match(smokeSource, /workflow-ribbon__node/);
  assert.match(smokeSource, /faq__item > summary/);
  assert.match(smokeSource, /workflow-ribbon__connector/);
  assert.match(smokeSource, /workflowConnectorThickness/);
  assert.match(smokeSource, /workflowVisibleConnectorCount/);
  assert.match(
    smokeSource,
    /const expectedVisibleWorkflowConnectors = width <= 640 \|\| width > 1080 \? 4 : 0;/,
  );
  assert.match(smokeSource, /comparisonCaptionWidthRatio/);
  assert.match(
    smokeSource,
    /CTA Reveal visibility[\s\S]*window\.scrollTo\(0,\s*0\)[\s\S]*full-page capture top baseline[\s\S]*Page\.getLayoutMetrics/,
  );
  assert.match(smokeSource, /const publicSections = await verifyPublicSections\(cdp\)/);
  assert.match(smokeSource, /publicSections,/);
});
