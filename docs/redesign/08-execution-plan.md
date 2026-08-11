---
title: Paper OS enterprise redesign execution plan
status: active
owner: next maintainer
created: 2026-08-03
updated: 2026-08-10
tracking_issue: ../../issues/paper-os-redesign.md
result_evidence: ../STATUS.md and ../../dist/visual-qa/
---

# 08 · 执行计划（给 Codex 的原子任务清单）

> 逐条领取。每条 = 目标 + 涉及文件 + 验收 + 验证命令。**顺序执行**（后阶段依赖前阶段地基）。
> 规则：小步提交、每步过验证再下一步；改后端只搬运不改语义并跑 `node --test`；
> 尊重 [`README.md` §8](README.md#8-全局硬约束non-negotiables) 的硬约束。

## 通用验证命令（Windows PowerShell）

```powershell
npm run web:build           # 展示站 + app 前端构建
npm run ide:build           # 桌面 IDE 构建
node --check app/server.mjs # 后端语法
node --test tests/*.test.mjs
python -m pytest            # 如可用
node app/smoke.mjs; node app/dom-ui-smoke.mjs; node app/visual-smoke.mjs
.\build-launcher.ps1        # 出 PaperOS.exe（改桌面壳时）
npm run package:win         # 出开发预览 zip + sha；不证明 self-contained/干净机可运行
```

视觉 QA 视口：`1440×900`、`1100×720`（截图存 `dist/visual-qa/`）。

---

## P0 · 设计地基（Design Foundations）

> 依据 `01`、`02`。这是所有视觉的词汇表，最先做。黄金样例已给：`tokens.css` / `HorizonBackground.jsx` / `Home.jsx`(Hero)。

- **T0.1 扩展设计令牌** — `web/src/styles/tokens.css`
  补 `--bg-elev`、`--ink-line-3`、`--info`、`--fs-*`、`--sp-*`、`--z-*`、`--shadow-chrome`、`--grad-foil`、`--dur-*`、`--chart-1..6/grid/axis`（`01`§2/§4/§5，`07`§2）。
  验收：无未定义变量引用；`web:build` 绿。（黄金样例已含，按其为准。）

- **T0.2 动效工具** — 新增 `web/src/lib/motion.js`
  `useReducedMotion / useCountUp / usePointerParallax / useInViewOnce`；统一 `Reveal.jsx`/`Ambient.jsx` 用之（`02`§6）。
  验收：hook 在 reduced-motion 下返回静态值、不注册 RAF。
  状态（2026-08-05 复验）：源码与自动化验收完成；`tests/web-motion.test.mjs` 9/9、`web:build` 绿；SSR/hydration 首值一致，浏览器在 layout effect 阶段解析 reduced-motion，不注册 RAF/Observer/输入监听，并支持系统偏好双向切换与 media-query listener cleanup。

- **T0.3 动态背景（行为门禁完成；实体 GPU 性能待真机）** — `web/src/components/HorizonBackground.jsx` 已由 `App.jsx` 接入；默认 `npm run browser-visual-smoke` 以 strict 模式验证单 WebGL context/canvas、首次可见启动、后台/离屏/BFCache 暂停恢复、慢帧降级、reduced-motion 单帧、WebGL fallback 与幂等 teardown。
  状态（2026-08-05 复验）：browser/CDP 专项 12/12、全量 Node 91/91、`web:build`、`ide:build`、`visual-smoke` 和严格 Edge 门禁均通过；BFCache 证据来自真实同源导航与原生 persisted 事件，不是合成事件。结构化证据与截图哈希见 `dist/visual-qa/horizon-behavior.json`。
  性能边界：当前 `drawCallsPerSecond` 是强制 SwiftShader 下的 `drawArrays` 调用采样，不是呈现 FPS；实体中端 GPU 60fps、移动端 ≥30fps、温度/功耗和降级阈值仍待真机基准。
  迁移约束：只有 motif 目录正式落地时，才把现有组件小步迁移到 `components/motifs/` 并同步 import。
  验收：行为门禁已满足；真机性能项保持未完成，不得用软件渲染采样替代。

- **T0.4 母题组件** — 新增 `web/src/components/motifs/{TraceBadge,ActionTimeline,EvidenceFlow,QuillMark,CountUp}.jsx`（`01`§8）
  验收：各组件独立可渲染；`base.css` 补 `marchAnts`/`foilShimmer` 关键帧。
  状态（2026-08-05 历史快照）：完成。组件只接收调用方真实数据，不内置伪执行步骤；覆盖空态/非法输入/ARIA、TraceBadge 多实例唯一 ID、EvidenceFlow 结构化点路径、CountUp 确定 locale 与 SSR/reduced-motion。`tests/web-motifs.test.mjs` 11/11、`tests/web-motion.test.mjs` 8/8、全量 Node 91/91、Web/IDE build、visual smoke 与 strict browser smoke 均通过；独立复审 APPROVE。T0.5 已完成；当时下一严格顺序是 T0.6，不提前大面积接入 Home/Workbench。当前结论见下方 T0.6。

- **T0.5 UI 原子组件库（已完成，2026-08-05，历史快照）** — 新增 web/src/components/ui/ 下的十四个公开 primitive：Button、IconButton、Card、Chip、Tabs、Segmented、Table、Modal、Drawer、Toast、Tooltip、Badge、Skeleton、Meter；扩展 components.css，并以 dev-only /_kitchensink 集中展示。
  实现边界：共享 selection/dialog helper；原生 button、table、meter 与 ARIA dialog/tooltip/radio/tab 语义；键盘方向键/Home/End、roving tabindex、focus trap、Escape、焦点恢复、loading/disabled/empty/error/dirty/critical 状态；旧 Button/Card/Chip class API 保持兼容。
  回归护栏：tests/web-ui-primitives.test.mjs 14/14；tests/web-background-video.test.mjs 7/7；tests/web-motion.test.mjs 9/9。背景专项先在旧实现上 RED，再验证 production `.mp4/.jpg/.jpeg` MIME、HTML SPA fallback 拒绝、reduced-motion 零探测/零自动视频、可见背景层和 smoke scroll reset；共享 motion 偏好可 `false → true → false` 双向切换并清理 listener。独立复审后的 Tabs IDREF、Dialog/Meter 命名和 Drawer 浏览器焦点缺口也已完成第二轮 RED→GREEN。
  浏览器验收：node app/kitchensink-visual-smoke.mjs http://127.0.0.1:5174/_kitchensink；1440×900、1100×720、390×844 均 scrollY=0、kitchenTop=0、无横向溢出、无控件裁切或小于 31px；行为 JSON 和 viewport/full-page PNG 位于 dist/visual-qa/。
  生产边界：npm run web:build 通过，2297 modules；精确检索正式包得到 NO_KITCHENSINK_IN_PRODUCTION。T0.5 只完成组件词汇层，不等于 Home/Workbench/桌面页面级接入。
  历史验收结论：以上命令已通过并已领取、完成 T0.6；实体 GPU/移动真机性能、像素基准和桌面壳仍按独立待办处理。

- **T0.6 Icon 注册补全（已完成，2026-08-06）** — `web/src/components/Icon.jsx` + `apps/desktop/src/icons.jsx`
  两端统一补齐 `menu/template/git-branch/sync/magnifier/evidence/mcp/play/filter/export`，分别导出 `ICON_NAMES`；桌面保留旧 `branch`/`refresh` 别名，未知 Web 名称静默空，未知桌面名称保留圆形 fallback。
  TDD 先在旧实现上得到 Web `ICON_NAMES` 缺失和桌面 `menu` case 缺失的预期 RED，再完成最小实现。复审后测试升级为两端实际 Vite SSR/SVG 渲染断言，`node --test tests/icon-registry.test.mjs` 为 2/2；全量 Node 115/115、Python 25/25、Web 2297 modules、IDE build、visual-smoke、严格 Edge、Kitchensink 三视口和生产包 `NO_KITCHENSINK_IN_PRODUCTION` 均通过。
  约束：T0.6 只完成语义注册，不提前改写页面信息架构；下一严格顺序是 T1/T3 页面级接入。页面接入必须复用注册表和 UI primitives，保持 Pack capability gating，并重复 keyboard/ARIA/reduced-motion/三视口验证。实体 GPU/移动真机、像素基准、桌面壳与签名安装链仍为独立未完成项。

---

## P1 · 展示站视觉（Public Site Visual）

> 依据 `03`。对齐 `UI-Design/{1,2,3,4,a,g}.png`。

- **T1.1 Hero 重构（truth-driven B 路线已完成，2026-08-07）** — `web/src/pages/Home.jsx` + `HeroIdeMock.jsx` + `styles/pages.css`
  左叙事使用可核实的 `4 内置 Pack`、`Preview → Apply`、`Apache-2.0` 与平台状态；右侧 `HeroIdeMock` 显式标注“界面示意”，配 `--shadow-chrome`、受 reduced-motion 门控的指针/滚动视差、`TraceBadge` 与静态 `EvidenceFlow` 标注。
  有意调整：删除未经证实的 count-up/编译秒数/证据数量，不把 provider 请求描述为本机推理，不把静态 mock 伪装成真实 AI timeline。真实 timeline 留在 T3.3，真实 `web/public/hero-ide.png` 留在 T3.6。
  T1.1 历史验收：Hero/shader/稳定哈希 10/10、当时全量 Node 125/125、Python 25/25、Web 2298 modules、IDE/visual/strict Edge 通过；Home Hero 1440×900、1100×720、820×800、390×844 与 820→1000→820 导航状态迁移通过，当时稳定行为 SHA-256 `61d18c1e1eecc118be5020530ee310530754df389c8b365df61c56d005b0f16c`。当前基线见 T1.2。

- **T1.2 公共区块组件（已完成，2026-08-07）** — `SectionHead/StatRow/WorkflowRibbon/FeatureCard/FAQ/LogoWall/CtaBand`
  Home 已用全部七组件重排六项能力区、五节点工作流、五维中性对比、场景墙、四项 FAQ 与最终 CTA（`03`§1.3–1.6）；原生 `details/summary`、`dt → dd`、共享 `ui/Table`、中性 LogoWall 与 Pack capability 边界均已锁定。
  验收：聚焦合同 14/14、全量 Node 134/134、Python 25/25、Web 2308 modules + IDE bundle、visual smoke 13 keyframes/51 assets、Home 与 strict Edge 通过；四视口 workflow columns `5/5/2/1`、visible connectors `4/4/0/4`、caption ratio ≥0.9947、`fullPageScrollY=0`、零横向溢出/浏览器错误；视觉复核 92/100、pass。稳定行为 SHA-256 为 `d5080b1f2451bf3725d6a497a6973ae2a32553a902841694acbf501e0db9840d`，报告文件 SHA-256 为 `7de8da881c40173453e355df642d32d2f4c214158ee3726ecd5a07fc0924f7ca`。

- **T1.3 导航滚动态 + 图标菜单（已完成，2026-08-07）** — `web/src/components/SiteHeader.jsx`
  滚动收缩 `glass-frost`、`aria-current`、主 CTA=「下载桌面端」、`☰`→`Icon menu`（`03`§0.1）。
  状态：严格 `scrollY > 40` compact、2px ARIA 当前项、统一 `/download` 主 CTA、移动账户可达均完成；既有 880px 互斥、跨断点关闭、`aria-expanded`/`aria-controls`、首焦点、Escape 与焦点恢复保持通过。复审加固覆盖 881px 零溢出/重叠、820/390 首链接精确获焦、认证态唯一主 CTA；无需新增 CSS 断点。聚焦 7/7、Node 141/141、Python 25/25、Web 2308 modules、IDE/visual/Home/230.8s strict Edge 通过；视觉 94/pass、独立复审 `APPROVED`，稳定行为 SHA-256 `117c18b46d45856afebc9447464d33ab94e4506f5e8f2d56f8f6ec1157d4b398`，报告文件 SHA-256 `f82f4686e4b854849d23b37f7d16e362f7f947886e78fdbc131f6d02017f0615`。

- **T1.4 Features/Pricing/Enterprise（已完成，2026-08-10）** — `pages/*.jsx`
  完成事实：Features、Pricing、Enterprise 已以真实公共页面收口，见 `STATUS.md` 与 `dist/visual-qa/public-pages-behavior.json`。
  验收：focused 6/6、Node 147/147、Python 25/25、Web 2310 modules + Desktop IDE build、13 keyframes/52 assets、public Edge 3 routes x 4 viewports、`browserErrors=[]`、44px 最小触控、`scrollY=0`、零 overflow、yearly + FAQ keyboard、reduced-motion pass、strict Edge 112.6s、visual verdict 92/100 pass；stable SHA `0bf75be0138cc322228586c76be9390ef182f471c2308d048c1585c062d38f5f`，report SHA `173c0fffeb941bc57d6ec3aecd6d4d0838697bc73215814b7c3b2b2cf5ce4133`。
  约束：页面只陈述已实现边界，不把 provider、BYOK、SSO、RBAC、SLA 或私有化部署写成未验证承诺。

- [x] **T1.5 登录/注册** — `pages/{Login,Register}.jsx` + `components/{AuthAside,AuthPanel}.jsx` + `lib/password-policy.js`
  顺序：在 T1.4 之后推进，避免 AuthAside 与公共组件/导航样式分叉。
  `Segmented` 切换 + 离线打开入口 + 悬浮 code/PDF + 中性文案 + 密码策略对齐（≥10 位/≥2 类）+ 移除误导角色选择器（`03`§9）。
  验收：`/login` `/register` 渲染正常、SSO 按钮接真实开发端点、策略校验生效。完成证据：focused 19/19、Node 155/155、Python 25/25、Web 2312 modules、8 视口 auth Edge 与 strict Edge 通过。该数字是 T1.5 历史快照；T3.3 已在后文关闭。

---

## P2 · 展示站功能（Public Site Function）

> 依据 `03`§5–8。

- **T2.1 Market 公开版** — `pages/Market.jsx`：类别树 + 卡片网格 + 排序筛选 + 详情抽屉；未登录引导登录。数据 `/api/market/skills`。
- **T2.2 Community 公开版** — `pages/Community.jsx`：信息流 Tab + 右栏精选/榜。数据 `/api/community/posts`。
- **T2.3 Docs/Changelog/About/HowTo** — 目录树+锚点+复制；Changelog 时间线接 `/api/releases` notes。
- **T2.4 Download 升级** — `pages/Download.jsx`：安装三步 + SHA-256/Ed25519 校验说明（不改后端；逻辑保持）。
  验收：`/api/releases` 正常、深链 200、`web:build` 绿。

---

## P3 · 应用内 IDE（App / Workbench）

> 依据 `04`。对齐 `UI-Design/{5,b,c,d,e,f}.png`。

- **T3.1 App 外壳** — `pages/app/AppLayout.jsx`：图标化侧栏 + 工作区/团队切换 + 通知 + 图标菜单（`04`§0）。
- **T3.2 Workbench 布局与状态** — `pages/app/Workbench.jsx`：布局契约、真实状态模型、tab dirty/关闭、命令面板/QuickOpen/搜索（`04`§1）。
- **T3.3 AI 面板（已完成，2026-08-11）** — AI Assistant 已接真实 `/api/provider` 与 `/api/chat` runtime metadata，configured provider 和 response runtime 分离；`ActionTimeline` 由真实生命周期 `buildExecutionPlan` 生成；BEGIN_FILE 提案经 apply-blocks Preview、bounded diff、显式 Reject/Apply、exact path/mtime baseline、409 refresh 和 rollback/error 状态闭环。移动端为文件树 → 编辑器 → AI 的垂直工作流。证据：Node 164/164、Python 25/25、Web 2316 modules、IDE build、13/52 visual smoke、strict Edge pass；ai-qa 77→197 bytes，Apply HTTP 200 写入 paper/main.tex，1440×1200/390×844 均无根级横向溢出，reduced-motion 为 none / 0.001ms / 1。
- **T3.4 放大镜通用化（已完成，2026-08-11）** — `pages/app/Magnifier.jsx`：已去 `sample-contest` 硬编码，改为 `/api/editor/projects` 工作区驱动 + `?workspace=` + `evidence` 能力门控；证据抽屉覆盖 Claim/Result/Script/Dataset/Source 并用 `EvidenceFlow` 连线（`04`§3）。commit e745f7f。
- **T3.5 团队/市场/社区/总览（已完成，2026-08-11）** — TeamSpace 看板 + 7 天真实活动热力；Market 详情抽屉（权限按真实 `execute` 模式推导 + 诚实 MCP 说明）；CommunityBoard 最新/热门流 + 真实贡献榜；Dashboard 速览卡（`04`§4–7）。全部仅用真实数据，无伪造；commits 3855ea9/7454918/e1762c9。
- **T3.6 Hero 真实截图（下一严格任务）** — 用 CDP 冒烟脚本拍已验证的真实 Workbench AI 状态 → `web/public/hero-ide.png`，替 T1.1 `HeroIdeMock` 临时示意（`03`§1.2）。T3.3 的浏览器证据是截图输入条件，不自动完成 Hero 资产替换和产品截图审查。
  验收：`web:build`/`ide:build` 绿；1440/1100 实拍；深链 200；能力门控无泄漏。

---

## P4 · 数据可视化（Data Viz）

> 依据 `07`。

- **T4.1 图表组件库** — 新增 `web/src/components/charts/*`（`NumberStat/AreaTrend/BarDaily/StackedBar/Donut/RankBars/Sparkline/Heatmap/Gauge/EvidenceGraph/UptimeTimeline/LatencyChart`）；迁移 `Chart.jsx`。
- **T4.2 接入用量** — `Usage.jsx`/`AdminUsage.jsx`/`AdminOverview.jsx`：概览 count-up + 趋势 + 拆分 + 排行 + 明细 + 导出（`07`§5）。
- **T4.3 接入团队/证据/配额/速览** — `TeamSpace`(热力/榜)、`Magnifier`(证据图)、`ApiKeys`(配额 Meter)、`Dashboard`(Sparkline)。
- **T4.4 公开状态页** — 新增 `/status`（或后台健康面）：UptimeTimeline + 事件时间线（`07`§6）。
  验收：三态齐全、`role=img`+aria-label、reduced-motion 静态；`web:build` 绿。

---

## P5 · 桌面端（Desktop / exe）

> 依据 `05`。改壳每步 `.\build-launcher.ps1`；拆 IDE 每步 `ide:build`+`node --test tests/desktop-*.test.mjs`。

- **T5.1 IDE 模块化拆分** — `apps/desktop/src/ide.jsx` → `apps/desktop/src/ide/**`
  顺序：lib → command → explorer → editor → preview → assistant → chooser → layout → 瘦身 `IDE()`（`05`§7）。每步搬运不改语义 + 构建/测试护栏。
- **T5.2 Splash + 依赖自愈** — `launcher/Program.cs`：Splash 窗、超时可读错误、单实例 Mutex、窗口状态持久化（`05`§2.1–2.3）。
- **T5.3 Onboarding + 原生文件夹选择器** — WebView 内 3 步引导 + host 对象调 Windows 文件夹对话框注册 Workspace（`05`§3）。
- **T5.4 内嵌运行时** — 随包 Node（+可选 WebView2 Fixed）+ 内嵌/首启拉取 Tectonic，兑现零依赖（`05`§4.1）。
- **T5.5 日志落盘** — launcher 重定向 server 输出到 `%LOCALAPPDATA%/PaperOS/logs/`，菜单"打开日志目录"（`05`§5）。
- **T5.6 安装器 + 自动更新 + 签名** — MSI/NSIS；启动查 `/api/releases`→下载→SHA-256+Ed25519 校验→安装；Authenticode（CI secrets）（`05`§6）。
  验收：`build-launcher.ps1` 出 exe；`package:win` 出 zip+sha；真机装包冒烟；更新校验失败被拒。

---

## P6 · 架构收口（Architecture）

> 依据 `06`。深水区，最后做，全程测试护栏，**不一次性重写**。

- **T6.1 前端分层** — 抽 `routes/layouts/features/components{ui,motifs,charts}`；`@/` 别名；组件归位。
- **T6.2 状态 hooks** — `useWorkspaceSession/useCompile/useAI/useUsage`。
- **T6.3 两端共享** — 抽共用纯组件/函数（先相对 import，必要时升 npm workspaces `packages/shared`）。
- **T6.4 后端分层** — `app/http/{router,middleware,respond}` + `routes/*` + `services/*`；逐组迁移端点，**语义字节不变**，每组跑对应 `tests/server-*`/`workspace-*`/`account-api`/`admin-api`/`editor-apply-transaction`。
- **T6.5 领域契约（起步）** — 按 `06`§3.4：Session → Resource/TextDocument → Provider 注册表 → BuildProfile/Job/ArtifactSet → EditTransaction → ToolRuntime → math-modeling Pack 化。每项独立 PR + 测试。
- **T6.6 密钥轮换迁移脚本** — `PAPER_OS_SECRET` 轮换的 re-encrypt（见 [`../RUNBOOK.md`](../RUNBOOK.md) 的 Provider master secret 说明）。
  验收：`node --check` + `node --test tests/*.test.mjs` 全绿；`pytest` 如可用；`web:build`/`ide:build` 绿；无行为回归。

---

## 里程碑验收（每阶段收口）

| 阶段 | 收口标准 |
| --- | --- |
| P0 | `web:build` 绿；`/_kitchensink` 展示全组件；背景动态且可降级 |
| P1 | Home/Pricing/Login 三页 1440/1100 对齐参考图；深链 200 |
| P2 | Market/Community/Docs/Download 可用；`/api/releases` 校验展示 |
| P3 | Workbench/Magnifier/Team 实拍达标；能力门控无泄漏；`ide:build` 绿 |
| P4 | 各数据页图表 + 三态 + a11y；状态页可用 |
| P5 | exe 首启有 Splash/onboarding；装包 + 更新校验；`ide.jsx` 已拆分 |
| P6 | 后端分层 + 领域契约起步；全测试绿；安全不变量未削弱 |

---

## 风险与红线（Codex 必读）

- Windows sandbox 可能拒绝现有文件 patch；保持小 diff、使用唯一旧文本保护替换，并在每次修改后检查 diff。
- 不删 `.paperos/`；不清 `app/data/` 历史；不动安全逻辑语义；不新增重依赖；不把 `math-modeling` 设为全局默认。
- 不声称未实现的能力（真实 Terminal/Git/协作/SyncTeX 未完成前按 partial/planned 标注）。
- 每次改动后跑对应验证命令；失败先修再进。
