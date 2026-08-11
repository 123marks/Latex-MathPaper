import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import React from "../web/node_modules/react/index.js";
import { renderToStaticMarkup } from "../web/node_modules/react-dom/server.node.js";
import { StaticRouter } from "../web/node_modules/react-router-dom/server.mjs";
import { transform } from "../web/node_modules/esbuild/lib/main.js";
import { createServer as createViteServer } from "../web/node_modules/vite/dist/node/index.js";

const webRoot = resolve("web");
const publicNames = [
  "SectionHead",
  "StatRow",
  "WorkflowRibbon",
  "FeatureCard",
  "FAQ",
  "LogoWall",
  "CtaBand",
];
const pagesCss = readFileSync(resolve(webRoot, "src/styles/pages.css"), "utf8");
const componentsCss = readFileSync(resolve(webRoot, "src/styles/components.css"), "utf8");
const homeSource = readFileSync(resolve(webRoot, "src/pages/Home.jsx"), "utf8");
let vite;

const workflowNodes = [
  { id: "intent", icon: "compose", title: "自然语言指令", description: "描述目标", code: "revise method" },
  { id: "tools", icon: "mcp", title: "Skills/MCP 调度", description: "按 Capability 调用", code: "skill.invoke" },
  { id: "files", icon: "local", title: "本地项目文件", description: "读取 Workspace", code: "method.tex" },
  { id: "diff", icon: "latex", title: "LaTeX 编辑（差异）", description: "先预览再写入", code: "Preview → Apply" },
  { id: "verify", icon: "evidence", title: "PDF 与证据校验", description: "检查 Artifact", code: "verify · package" },
];

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

async function loadPublic(name) {
  try {
    return await vite.ssrLoadModule(`/src/components/public/${name}.jsx`);
  } catch (error) {
    assert.fail(`${name} is unavailable: ${error.code || error.message}`);
  }
}

function render(Component, props = {}, ...children) {
  return renderToStaticMarkup(React.createElement(Component, props, ...children));
}

test("T1.2 exposes seven independently renderable public section components", async () => {
  const modules = await Promise.all(publicNames.map(loadPublic));
  const fixtures = [
    { eyebrow: "工作流", title: "一条贯穿全文的工作流", description: "从目标到 Artifact。" },
    { label: "可信指标", items: [{ id: "packs", value: "4", label: "内置 Pack" }] },
    { label: "文档工作流", nodes: workflowNodes, evidence: [{ id: "source", label: "数据来源" }] },
    { number: "01", icon: "latex", title: "LaTeX 原生", description: "本地编译。" },
    { label: "常见问题", items: [{ id: "provider", question: "模型在哪里处理？", answer: "由你配置的 provider 处理。" }] },
    { label: "适用场景", items: [{ id: "research", label: "研究组", icon: "users" }] },
    { eyebrow: "本地优先", title: "开始下一份文档", description: "下载桌面端。", actions: React.createElement("a", { href: "/download" }, "下载") },
  ];

  assert.equal(modules.length, 7);
  modules.forEach((module, index) => {
    assert.equal(typeof module.default, "function");
    assert.doesNotThrow(() => render(module.default, fixtures[index]));
  });
});

test("SectionHead and StatRow provide real section and definition-list semantics", async () => {
  const [{ default: SectionHead }, { default: StatRow }] = await Promise.all([
    loadPublic("SectionHead"),
    loadPublic("StatRow"),
  ]);
  const head = render(SectionHead, {
    align: "center",
    eyebrow: "产品事实",
    title: React.createElement(React.Fragment, null, "可审查的", React.createElement("em", null, "文档工程")),
    description: "每一项都来自当前实现。",
  });
  const stats = render(StatRow, {
    label: "当前可核实指标",
    items: [
      { id: "packs", value: "4", label: "内置 Pack" },
      { id: "apply", value: "Preview → Apply", label: "AI 写入" },
    ],
  });

  assert.match(head, /^<header/);
  assert.match(head, /section-head--center/);
  assert.match(head, /<h2>可审查的<em>文档工程<\/em><\/h2>/);
  assert.match(stats, /^<dl/);
  assert.match(stats, /aria-label="当前可核实指标"/);
  assert.equal((stats.match(/<dt>/g) || []).length, 2);
  assert.equal((stats.match(/<dd>/g) || []).length, 2);
  assert.match(stats, /<div><dt>内置 Pack<\/dt><dd><b>4<\/b><\/dd><\/div>/);
  assert.throws(() => render(SectionHead, { align: "right", title: "无效" }), /alignment/i);
});

test("WorkflowRibbon renders supplied ordered steps and Pack-scoped evidence labels", async () => {
  const { default: WorkflowRibbon } = await loadPublic("WorkflowRibbon");
  const markup = render(WorkflowRibbon, {
    label: "从指令到交付",
    nodes: workflowNodes,
    evidence: [
      { id: "source", label: "数据来源" },
      { id: "citation", label: "引用依据" },
      { id: "figure", label: "图表数据" },
      { id: "claim", label: "结论主张" },
    ],
  });

  assert.match(markup, /<ol[^>]+aria-label="从指令到交付"/);
  assert.equal((markup.match(/workflow-ribbon__node/g) || []).length, 5);
  assert.equal((markup.match(/workflow-ribbon__evidence-item/g) || []).length, 4);
  assert.match(markup, /Skills\/MCP 调度/);
  assert.match(markup, /Preview → Apply/);
  assert.doesNotMatch(markup, /在线|已执行|1–5s/);
});

test("FeatureCard, LogoWall, and CtaBand keep content semantic and truthful", async () => {
  const [
    { default: FeatureCard },
    { default: LogoWall },
    { default: CtaBand },
  ] = await Promise.all([
    loadPublic("FeatureCard"),
    loadPublic("LogoWall"),
    loadPublic("CtaBand"),
  ]);
  const feature = render(FeatureCard, {
    wide: true,
    number: "04",
    icon: "skills",
    title: "Pack 驱动的工作区",
    description: "领域能力按 Capability 启用。",
  });
  const wall = render(LogoWall, {
    label: "适用的严肃文档场景",
    description: "面向不同的严肃文档场景。",
    items: [
      { id: "research", icon: "users", label: "研究组" },
      { id: "engineering", icon: "terminal", label: "工程团队" },
    ],
  });
  const cta = render(CtaBand, {
    eyebrow: "本地优先 · 开源",
    title: "把下一份严肃文档放进 Paper OS",
    description: "Windows 开发预览。",
    actions: React.createElement("a", { href: "/download" }, "下载桌面端"),
  });

  assert.match(feature, /^<article/);
  assert.match(feature, /feature wide/);
  assert.match(wall, /^<section/);
  assert.match(wall, /<ul/);
  assert.match(wall, /研究组/);
  assert.doesNotMatch(wall, /客户|合作机构|trusted by/i);
  assert.match(cta, /^<aside/);
  assert.match(cta, /href="\/download"/);
  assert.match(cta, /cta-band__glow[^>]+aria-hidden="true"/);
});

test("FAQ uses native keyboard disclosure semantics and validates its content", async () => {
  const { default: FAQ } = await loadPublic("FAQ");
  const items = [
    { id: "provider", question: "模型请求留在本机吗？", answer: "模型请求由你配置的 OpenAI-compatible provider 处理。" },
    { id: "platform", question: "支持哪些平台？", answer: "Windows 是开发预览；macOS/Linux 仍在规划。" },
  ];
  const markup = render(FAQ, { label: "产品边界常见问题", items });

  assert.match(markup, /<div[^>]+class="faq"[^>]+role="region"[^>]+aria-label="产品边界常见问题"/);
  assert.equal((markup.match(/<details/g) || []).length, 2);
  assert.equal((markup.match(/<summary/g) || []).length, 2);
  assert.match(markup, /OpenAI-compatible provider/);
  assert.throws(
    () => render(FAQ, { items: [{ id: "empty", question: "有答案吗？", answer: " " }] }),
    /answer/i,
  );
});

test("Home composes every T1.2 component and preserves current product boundaries", async () => {
  for (const name of publicNames) {
    assert.match(homeSource, new RegExp(`components/public/${name}\\.jsx`));
  }
  assert.doesNotMatch(homeSource, /function HeroStat/);

  const { default: Home } = await vite.ssrLoadModule(`/src/pages/Home.jsx?public-sections=${Date.now()}`);
  const markup = renderToStaticMarkup(
    React.createElement(
      StaticRouter,
      { location: "/" },
      React.createElement(Home),
    ),
  );

  assert.match(markup, /class="[^" ]*stat-row[^" ]* hero-meta|class="hero-meta stat-row"/);
  assert.equal((markup.match(/workflow-ribbon__node/g) || []).length, 5);
  assert.match(markup, /Paper OS 与常见文档工具的工作方式/);
  for (const dimension of [
    "项目位置",
    "编译位置",
    "AI 写入控制",
    "Evidence 语义",
    "扩展边界",
  ]) {
    assert.match(markup, new RegExp(`<td[^>]*>${dimension}</td>`));
  }
  assert.match(markup, /<td[^>]*>Preview → Apply<\/td>/);
  assert.match(markup, /<td[^>]*>Pack \/ Capability \/ MCP<\/td>/);
  assert.match(markup, /产品边界常见问题/);
  assert.match(markup, /适用的严肃文档场景/);
  assert.doesNotMatch(markup, /AI 推理都跑在你的机器上|服务器零算力|合作机构|Trusted by/);
});

test("public section CSS defines responsive reflow, touch targets, and motion fallback", async () => {
  for (const selector of [
    ".stat-row",
    ".workflow-ribbon",
    ".workflow-ribbon__node",
    ".workflow-ribbon__evidence",
    ".logo-wall",
    ".faq",
    ".faq__item",
    ".cta-band__glow",
  ]) {
    assert.match(pagesCss, new RegExp(`\\${selector}`));
  }
  assert.match(pagesCss, /\.faq__item\s*>\s*summary[\s\S]*min-height:\s*44px/);
  assert.match(pagesCss, /@media\s*\(max-width:\s*1080px\)[\s\S]*workflow-ribbon__track/);
  assert.match(pagesCss, /@media\s*\(max-width:\s*640px\)[\s\S]*workflow-ribbon__track/);
  assert.match(pagesCss, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*workflow-ribbon__connector/);

  const result = await transform(pagesCss, { loader: "css", logLevel: "silent" });
  assert.deepEqual(result.warnings, []);
});

test("narrow shared tables keep captions readable at full container width", () => {
  assert.match(
    componentsCss,
    /@container\s*\(max-width:\s*560px\)\s*\{[\s\S]*?\.tbl caption\s*\{[^}]*display:\s*block;[^}]*width:\s*100%;[^}]*\}/,
  );
});
