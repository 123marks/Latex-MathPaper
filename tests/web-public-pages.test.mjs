import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import React from "../web/node_modules/react/index.js";
import { renderToStaticMarkup } from "../web/node_modules/react-dom/server.node.js";
import { StaticRouter } from "../web/node_modules/react-router-dom/server.mjs";
import { createServer as createViteServer } from "../web/node_modules/vite/dist/node/index.js";

const webRoot = resolve("web");
const pagesCss = readFileSync(resolve(webRoot, "src/styles/pages.css"), "utf8");
const componentsCss = readFileSync(resolve(webRoot, "src/styles/components.css"), "utf8");
let vite;

test.before(async () => {
  vite = await createViteServer({
    root: webRoot,
    appType: "custom",
    logLevel: "silent",
    resolve: { dedupe: ["react", "react-dom"] },
    server: { middlewareMode: true },
  });
});

test.after(async () => {
  await vite?.close();
});

async function loadPage(name) {
  const module = await vite.ssrLoadModule("/src/pages/" + name + ".jsx?t1-4=" + Date.now() + "-" + name);
  return module.default;
}

function render(Page, location) {
  return renderToStaticMarkup(
    React.createElement(
      StaticRouter,
      { location },
      React.createElement(Page),
    ),
  );
}

function count(source, value) {
  return source.split(value).length - 1;
}

test("Features follows the five-band product narrative and ends at download", async () => {
  const Features = await loadPage("Features");
  const markup = render(Features, "/features");
  const visibleText = markup.replace(/<[^>]+>/g, "");

  assert.ok(visibleText.includes("写作，不止生成"));
  assert.equal((markup.match(/<h1/g) || []).length, 1);
  assert.equal((markup.match(/class="feature-deep-dive( |")/g) || []).length, 5);
  assert.ok(markup.includes("本地 LaTeX 编译"));
  assert.ok(markup.includes("Preview → Apply"));
  assert.ok(markup.includes("Evidence"));
  assert.ok(markup.includes("Skills / MCP"));
  assert.ok(markup.includes("团队工作区"));
  assert.ok(markup.includes('href="/market"'));
  assert.ok(markup.includes('href="/download"'));
  assert.ok(markup.includes("/assets/feature-workbench.png"));
  assert.equal(markup.includes("多人同时编辑"), false);
  assert.equal(markup.includes("合并冲突可视化"), false);
  assert.equal(markup.includes("敏感信息审计"), false);
});

test("Pricing exposes truthful billing, BYOK, comparison, and FAQ contracts", async () => {
  const Pricing = await loadPage("Pricing");
  const markup = render(Pricing, "/pricing");
  assert.equal((markup.match(/<h1/g) || []).length, 1);

  assert.ok(markup.includes("本地编译不按次收费"));
  assert.ok(markup.includes("BYOK"));
  assert.ok(markup.includes("OpenAI-compatible provider"));
  assert.ok(markup.includes("月付"));
  assert.ok(markup.includes("年付"));
  assert.ok(markup.includes("年付省 2 月"));
  assert.equal((markup.match(/<article class="pricing-plan( |")/g) || []).length, 4);
  assert.ok(markup.includes('class="pricing-plan-reveal"'));
  assert.ok(markup.includes("segmented"));
  assert.ok(markup.includes("tbl"));
  assert.ok(markup.includes("faq"));
  assert.ok(markup.includes("价格待发布") || markup.includes("联系确认"));
  assert.equal(markup.includes("¥39"), false);
  assert.equal(markup.includes("¥99"), false);
  assert.equal(markup.includes("AI 推理都跑在你自己的机器上"), false);
  assert.equal(markup.includes("没有按次计费的服务器成本"), false);
  assert.equal(markup.includes("云端同步"), false);
  assert.equal(markup.includes("多人同时编辑"), false);
});

test("Enterprise distinguishes current security foundations from scoped capabilities", async () => {
  const Enterprise = await loadPage("Enterprise");
  const markup = render(Enterprise, "/enterprise");
  assert.equal((markup.match(/<h1/g) || []).length, 1);

  assert.ok(markup.includes("把整套系统部署进你的内网"));
  for (const label of ["私有化部署", "SSO 单点登录", "审计合规", "RBAC 权限", "数据本地边界", "专属支持"]) {
    assert.ok(markup.includes(label));
  }
  for (const fact of ["AES-256-GCM", "Workspace", "路径", "Ed25519", "OpenAI-compatible provider"]) {
    assert.ok(markup.includes(fact));
  }
  assert.ok(markup.includes("需评估") || markup.includes("合同确认"));
  assert.ok(markup.includes("mailto:enterprise@paper-os.local"));
  assert.ok(markup.includes('class="enterprise-capability-reveal"'));
  assert.equal(markup.includes("AI 推理在员工自己的机器上完成"), false);
  assert.equal(markup.includes("数据不必经过任何第三方服务器"), false);
  assert.equal(markup.includes("员工用统一账号登录"), false);
  assert.equal(markup.includes("满足内部审计与外部合规审查"), false);
});

test("T1.4 page CSS protects responsive layout, touch targets, and reduced motion", () => {
  for (const selector of [
    ".feature-deep-dive",
    ".feature-fragment",
    ".pricing-plans",
    ".pricing-plan",
    ".enterprise-architecture",
    ".enterprise-capabilities",
  ]) {
    assert.ok(pagesCss.includes(selector), "missing CSS selector " + selector);
  }
  assert.ok(pagesCss.includes("@media (max-width: 768px)"));
  assert.ok(pagesCss.includes("feature-deep-dive"));
  assert.ok(pagesCss.includes("@media (prefers-reduced-motion: reduce)"));
  assert.ok(pagesCss.includes("min-height: 44px"));
  assert.ok(pagesCss.includes(".public-page .btn"));
  assert.ok(pagesCss.includes(".enterprise-capability-section .section-head"));
  assert.ok(pagesCss.includes(".enterprise-security .section-head"));
  assert.ok(componentsCss.includes("@container (max-width: 560px)"));
});

test("Features product capture is a repository asset", () => {
  assert.equal(existsSync(resolve(webRoot, "public/assets/feature-workbench.png")), true);
});

test("T1.4 Edge smoke covers all public pages and responsive interactions", () => {
  const smokePath = resolve("app/public-pages-visual-smoke.mjs");
  assert.equal(existsSync(smokePath), true);
  const source = readFileSync(smokePath, "utf8");

  for (const value of [
    '"/features"',
    '"/pricing"',
    '"/enterprise"',
    "[1440, 900]",
    "[1100, 720]",
    "[820, 800]",
    "[390, 844]",
    ".feature-deep-dive",
    ".pricing-plan",
    ".pricing-plan-reveal",
    ".enterprise-capability",
    ".enterprise-capability-reveal",
    "prefers-reduced-motion",
    "ArrowRight",
    "summary",
    "public-pages-behavior.json",
  ]) {
    assert.ok(source.includes(value), "smoke is missing " + value);
  }
});
