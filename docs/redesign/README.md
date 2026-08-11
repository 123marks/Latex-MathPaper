# Paper OS 重设计蓝图（Redesign Blueprint）

> Lifecycle: **Active implementation specification**. 文档集和三个黄金样例已经交付，
> 但 P0-P6 产品改造尚未整体完成。当前事实与验证以 [`../STATUS.md`](../STATUS.md)
> 和 [`../../issues/paper-os-redesign.md`](../../issues/paper-os-redesign.md) 为准。
> 当前执行点（2026-08-11）：T0.5、T0.6、T1.1–T1.5 与 T3.3 均已完成；下一严格原子任务为 T3.6 真实 Workbench Hero 产品截图。项目整体仍为 Active。

> 面向 Codex 执行的设计 + 技术规格文档集。目标：把 Paper OS 从"能用但死板"提升到
> **企业级、动态、可信赖**的产品观感与架构深度，对齐 `UI-Design/` 中已锁定的 15 张参考图。

本目录是**唯一权威**的重设计输入。所有前端/桌面端/架构改造以本目录为准；与历史文档冲突时，
以本目录为准，并在 `docs/` 主文档中回填结论。

---

## 0. 一句话目标

在不牺牲"本地优先、可验证安全"内核的前提下，交付一个**像 Cursor / 即梦 一样有电影感、
像 Overleaf 一样具备专业文档深度、像 new-api 一样数据可视化扎实**的通用文档 IDE——
展示站能"卖"，桌面端能"用"，架构能"长"。

---

## 1. 现状与差距（Gap Analysis）

### 1.1 现状（已核实）

| 层 | 位置 | 状态 |
| --- | --- | --- |
| 展示站 | `web/`（React 18 + Vite + framer-motion + ogl） | 页面齐全；T1.1 Home Hero、T1.2 首页公共区块、T1.3 公共导航、T1.4 公共页面与 T1.5 认证页已完成 |
| 应用内 IDE | `web/src/pages/app/Workbench.jsx` | 存在，密度/交互待提升 |
| 桌面 IDE | `apps/desktop/src/ide.jsx`（3000+ 行单体） | 功能多但不可维护 |
| 桌面壳 | `launcher/Program.cs`（WinForms + WebView2） | 能启动，缺原生打磨/更新/签名校验 |
| 后端 | `app/server.mjs`（3000+ 行单体路由） | API 面广；当前测试证据见 `STATUS.md`；无分层 |
| 设计令牌 | `web/src/styles/tokens.css` | 基础版，需扩展为完整系统 |
| 动态背景 | `web/src/components/HorizonBackground.jsx`（已接入 App） | T0.3 严格浏览器行为门禁已完成；实体中端 GPU 的 60fps 性能目标仍待真机验证 |
| 母题组件 | `web/src/components/motifs/` | T0.4 五个组件与 CSS/reduced-motion/SSR 门禁已完成；页面级接入仍按 T1/T3 推进 |
| UI 原子组件 | `web/src/components/ui/` | T0.5 十四个 UI primitives、dev-only `/_kitchensink`、键盘/ARIA/focus 与三视口证据已完成；页面级接入仍按 T1/T3 推进 |
| 图标注册 | `web/src/components/Icon.jsx`、`apps/desktop/src/icons.jsx` | T0.6 十个统一语义、两端 `ICON_NAMES`、未知名称兼容行为与实际 SSR 渲染测试已完成；页面级接入仍按 T1/T3 推进 |

### 1.2 差距（用户痛点 → 根因）

1. **"难看 / 人机味"** → T1.1 已用高保真 `HeroIdeMock`、悬浮 chrome、source/citation/figure
   示意与旋转追溯徽章完成 B 路线，并通过四视口门禁；但它仍明确标注为“界面示意”，不是参考图所需的
   **真实 IDE 截图**。最终替换仍归 T3.6。
2. **"死板 / 静态"** → Horizon shader 的失败、reduced-motion、后台/离屏、真实 BFCache、慢帧降级和资源释放已有严格浏览器证据，五个可复用母题组件也已落地；但它们尚未按 T1/T3 全面接入页面，实体 GPU 性能也尚未实测。参见 `02-motion-and-background.md`。
3. **"架构不够企业级"** → 三处硬伤：`ide.jsx` 单文件不可维护；无组件库 / 设计令牌分层沉淀；
   **数据可视化几乎为零**（用量、证据图谱、团队活跃、运行健康都缺图表）。参见 `06`、`07`。

---

## 2. 调研综述（已联网核实，2026-08）

| 参考 | 借鉴点 | 落到 Paper OS 的哪里 |
| --- | --- | --- |
| **Cursor** 官网 | 单一强调色；编辑体排版；重阴影**悬浮产品截图**；**AI 动作时间线**（多段 pill 表示 agent 阶段） | Hero 悬浮 chrome、AI Assistant 的"执行计划"时间线（`01`§母题、`03`§Hero） |
| **Overleaf**（成熟 LaTeX） | AI 侧栏（选区感知）、Error Assist、**Citation Reviewer**（扫描无出处论断→推荐文献）、公式/表格/标题生成器、模板画廊、实时协作+修订 | 模板画廊、AI 工具面板、**证据/引用反查**、生成器技能（`03`§模板、`04`§放大镜与 AI） |
| **new-api / one-api**（LLM 网关后台） | 统一看板、按模型/密钥/渠道用量图表、RBAC(Root/Admin/User)、配额、兑换码、日志过滤、Playground、2FA/Passkey | 升级 `admin/usage/api-keys` 的数据可视化与权限模型（`04`§用量、`07`） |
| **iwvw/API-Monitor** | 实时状态看板、日志监控、WebSocket 实时、公开状态页 | 后台"运行时/系统健康"面 + 公开状态页（`07`§状态页） |
| **即梦 / Midjourney** | 暗色电影感、动态但不喧宾夺主的背景、内容即主角 | 动态背景系统的美学基线：**克制的电影感**，不做彩虹霓虹（`02`） |

**关键判断**：Paper OS 的深炭 + 暖琥珀（Horizon Atelier）**不要**改成 Cursor 的奶油底——
暗色电影感更贴合"即梦/Midjourney"式炫酷诉求，也更能衬托 LaTeX 排版的庄重。我们借的是
Cursor 的**信息架构与母题**，不是它的配色。

---

## 3. 设计原则（Design Principles）

1. **内容即主角，动效是配角**。背景与动画服务于"看清文档/数据"，任何时候不得干扰阅读或输入。
2. **单一强调色纪律**。暖琥珀 `--amber` 是唯一"电压色"，朱砂/信号绿只用于语义（错误/成功）。
   禁止紫蓝渐变、彩虹极光、满屏玻璃。
3. **真实优先，禁止装饰性伪状态**。不显示假的 Git 分支、假的在线人数；每个状态都有真实数据源。
4. **密度分区**：展示站可"编辑体、留白、叙事"；IDE 内部必须"密集、键盘友好、专业"。
5. **性能有预算**：动态背景 ≤ 单个全屏 shader，移动端/低端 GPU/`prefers-reduced-motion` 必须降级。
6. **可访问性是硬约束**：对比度、焦点环、reduced-motion、键盘可达、`aria-*` 语义齐全。
7. **能力门控**：UI 只暴露当前 Workspace 的 Pack 能力；数学建模语义只在 `math-modeling` Pack 出现。

---

## 4. 五大视觉母题（Signature Motifs）

贯穿展示站与 IDE，是"这看起来就是 Paper OS"的识别锚点。完整规格见 `01-design-system.md`。

1. **Horizon Glow 地平线辉光**：页面下方 1/3 的暖金光带（日出感），电影级、缓慢呼吸。
2. **Quill Circle 羽笔圆环**：品牌标 / AI 思考态 / 加载态的同一母题（虚线圆环 + 琥珀核）。
3. **Traceable Badge 追溯徽章**：`TRACEABLE · VERIFIABLE · REPRODUCIBLE` 环形旋转印章。
4. **AI Action Timeline AI 动作时间线**：AI 面板"执行计划"的分步 pill（读上下文→调 MCP→改文件），
   带完成打勾 / 进行中转圈，是"可审查的 AI"的可视化。
5. **Evidence Flow 证据连线**：从源码/PDF 里的论断，用暖金虚线连到脚本/数据/文献（放大镜面核心）。

---

## 5. 阶段路线图（Phase Map）

按"先地基后上层、先展示后内部、先视觉后重构"排序，降低返工。完整原子任务见 `08-execution-plan.md`。

| 阶段 | 主题 | 主要产出 | 验证 |
| --- | --- | --- | --- |
| **P0** | 设计地基 | 扩展 `tokens.css`、`HorizonBackground`、动效工具与母题组件 | `web:build` 绿 |
| **P1** | 展示站视觉 | Home/Features/Pricing/Enterprise/Login/Register 对齐参考图 | 视觉 QA 1440/1100 |
| **P2** | 展示站功能 | Market/Community/Docs/Changelog/Download + 公开状态页 | 深链 200、构建绿 |
| **P3** | 应用内 IDE | Workbench 密度、AI 时间线、放大镜证据反查、团队看板 | `web:build`、实拍 |
| **P4** | 数据可视化 | 用量/证据图谱/团队活跃/系统健康图表 + 令牌化图表库 | 图表快照 |
| **P5** | 桌面端 | 壳原生化、onboarding、`ide.jsx` 模块化拆分、打包/更新/签名 | `ide:build`、装包 |
| **P6** | 架构收口 | 后端分层、Session/Resource/BuildJob/EditTransaction 演进 | `node --test` 全绿 |

> 视觉方向已锁定，P0–P3 可快速推进；P5/P6 是深水区，务必分小步 + 测试护栏。

---

## 6. 给 Codex 的阅读顺序

1. 本 `README.md`（全局观 + 原则）
2. `01-design-system.md`（令牌与组件是一切的词汇表）
3. `02-motion-and-background.md`（动效是"活起来"的关键）
4. 按当前任务读对应面向文档：`03`（展示站）/`04`（应用内）/`05`（桌面端）
5. `06-architecture.md`（改结构前必读）+ `07-data-viz.md`（做图表前必读）
6. `08-execution-plan.md`（逐条领取原子任务 + 验收 + 验证命令）

---

## 7. 文档 ↔ 代码映射（速查）

| 文档 | 主要落地目录/文件 |
| --- | --- |
| `01` 设计系统 | `web/src/styles/tokens.css`、`base.css`、`components.css`；`apps/desktop/src/assets/ide.css` |
| `02` 动效背景 | `web/src/components/HorizonBackground.jsx`、`Ambient.jsx`、`Reveal.jsx`、新增动效 hooks |
| `03` 展示站 | `web/src/pages/*.jsx`、`web/src/components/Site*.jsx`、`styles/pages.css` |
| `04` 应用内 | `web/src/pages/app/*.jsx`、`apps/desktop/src/ide.jsx`（拆分后 `apps/desktop/src/ide/**`） |
| `05` 桌面端 | `launcher/Program.cs`、`apps/desktop/**`、`scripts/package-release.mjs`、`.github/workflows/release.yml` |
| `06` 架构 | `app/server.mjs`（拆分为 `app/routes/**`、`app/services/**`）、`web/src` 目录规范 |
| `07` 数据可视化 | `web/src/components/charts/**`（新增）、`Usage.jsx`、`admin/AdminUsage.jsx` |

---

## 8. 全局硬约束（Non-Negotiables）

- 不改动 `app/server.mjs` 中已通过测试的**安全逻辑**（鉴权、路径包含、限流、CSP）；重构只做"搬运不改语义"，且每步 `node --test` 护栏。
- 不动 `.paperos/`、`app/data/`（含密钥/会话/审计）。
- 不新增重依赖；数据可视化优先轻量/自绘（选型见 `07`）。默认**不引入图表大库**（如 echarts）。
- 所有动效尊重 `prefers-reduced-motion`；WebGL 不可用时有 CSS 回退。
- 中文 UI 文案不得泄漏数学建模语义到通用面（能力门控）。
- 每个可交付步骤都要能过对应验证命令（见 `08`）。

## 9. T0.5/T0.6/T1.1–T1.5 当前交接（2026-08-10）

T0.5 已完成，交付的是可复用的 UI 词汇层，不是整个 redesign 的页面改造完成声明。实现集中在 `web/src/components/ui/`，公开导出为 Button、IconButton、Card、Chip、Tabs、Segmented、Table、Modal、Drawer、Toast、Tooltip、Badge、Skeleton、Meter；共享的 selection、dialog、Toast/Tooltip 辅助逻辑保持在 UI 边界内。`web/src/App.jsx` 只在 DEV 下动态导入 `pages/dev/Kitchensink.jsx`，生产构建不会携带 Kitchensink 模块或文案。

验收不只看“页面能打开”：`/_kitchensink` 展示 default、loading、disabled、empty、error、dirty、critical 等适用状态；Tabs/Segmented 完成方向键、Home/End、roving tabindex 与 IDREF 完整性；Dialog/Meter 拒绝空可访问名称；Tooltip 覆盖 focus、延迟显示和 Escape；Modal/Drawer 在真实 Edge 中覆盖初始焦点、Tab 环绕、Escape 与焦点恢复；Toast 支持可访问关闭。可选视频还通过 production `.mp4/.jpg/.jpeg` MIME、reduced-motion 零探测/零自动视频和 Horizon 上方可见层门禁；共享 motion hook 支持偏好双向切换并清理 listener。响应式验收使用 1440×900、1100×720、390×844，记录在 `dist/visual-qa/kitchensink-behavior.json` 与对应 viewport/full-page PNG。

本阶段还修复了会污染验收结果的背景回归：不存在的 `/bg-space.mp4` 会被 SPA fallback 返回的 `text/html` 误判为视频，默认 video 元素因此进入文档流；现在只接受 `video/*` MIME，并将 video/scrim 固定到视口。后续复审发现 CSS reduced-motion 不能暂停 HTMLMediaElement 的 `autoPlay loop`；BackgroundVideo 现在复用共享 motion 门控，在 reduced-motion 下不发 HEAD、不创建 video，系统偏好恢复后也可重新启用可选动效。视觉 smoke 同时在采集前关闭 smooth scrolling 并等待 `scrollY === 0`，避免滚动动画把首屏指标读成错误值。

T0.6 已完成：`web/src/components/Icon.jsx` 与 `apps/desktop/src/icons.jsx` 已统一登记 `menu`、`template`、`git-branch`、`sync`、`magnifier`、`evidence`、`mcp`、`play`、`filter`、`export`，并分别导出 `ICON_NAMES`。Web 未知语义继续静默返回空，桌面未知语义继续返回既有圆形 fallback。`tests/icon-registry.test.mjs` 先在旧实现上得到预期 RED，随后升级为两端实际 Vite SSR/SVG 渲染断言，聚焦测试 2/2；全量 Node 115/115、Python 25/25、Web 2297 modules、IDE build、visual smoke、严格 Edge 和 Kitchensink 三视口均已重新验证。

T1.1 已按 truth-driven B 路线收口：Home 使用 `4 内置 Pack`、`Preview → Apply`、`Apache-2.0` 等可核实指标；模型请求边界明确为用户配置的 OpenAI-compatible provider；`HeroIdeMock` 显式标注“界面示意”，不冒充 Workbench 截图或真实 AI timeline。Hero/Header 已覆盖 reduced-motion、880px 导航互斥、移动菜单 ARIA/首焦点/Escape/焦点恢复与打开后跨回桌面断点的自动关闭；当时报告内稳定行为 SHA-256 为 `61d18c1e1eecc118be5020530ee310530754df389c8b365df61c56d005b0f16c`。这是 T1.1 历史值，当前 T1.2 证据如下。

T1.2 已完成：`web/src/components/public/` 提供 `SectionHead/StatRow/WorkflowRibbon/FeatureCard/FAQ/LogoWall/CtaBand`，Home 已用全部七个组件重排能力区、五节点 workflow、五维中性比较、场景墙、四项 FAQ 与最终 CTA。四视口行为为 workflow columns `5/5/2/1`、visible connectors `4/4/0/4`、caption ratio ≥0.9947、`fullPageScrollY=0`，无横向溢出或浏览器错误；视觉复核 92/100、pass。当前稳定行为 SHA-256 为 `d5080b1f2451bf3725d6a497a6973ae2a32553a902841694acbf501e0db9840d`，本次报告文件 SHA-256 为 `7de8da881c40173453e355df642d32d2f4c214158ee3726ecd5a07fc0924f7ca`；原始 PNG SHA 独立保留。

T1.3 已完成：`SiteHeader` 以 `scrollY > 40` 切换透明常规态和 compact `glass-frost`，当前路由由 `NavLink` 的唯一 `aria-current="page"` 驱动 2px 指示，唯一主 CTA 为 `/download`“下载桌面端”。880px 菜单、首焦点、Escape、焦点恢复与跨断点关闭保持通过；账户操作在移动菜单内可达。复审加固后，真实 Edge 还覆盖 881px 零溢出/零重叠、820/390 菜单首链接精确获焦、认证态唯一下载主 CTA。聚焦 7/7、全量 Node 141/141、Python 25/25、Web 2308 modules、IDE/visual/Home/230.8s strict Edge 均通过，视觉复核 94/pass，独立复审 `APPROVED`。稳定行为 SHA-256 为 `117c18b46d45856afebc9447464d33ab94e4506f5e8f2d56f8f6ec1157d4b398`，报告文件 SHA-256 为 `f82f4686e4b854849d23b37f7d16e362f7f947886e78fdbc131f6d02017f0615`。

T1.4 已完成：Features/Pricing/Enterprise 的 public-pages 收口已补齐，focused 6/6、Node 147/147、Web 2310 modules、3 routes x 4 viewports、92/100、112.6s strict Edge、stable SHA `0bf75be0138cc322228586c76be9390ef182f471c2308d048c1585c062d38f5f`、report SHA `173c0fffeb941bc57d6ec3aecd6d4d0838697bc73215814b7c3b2b2cf5ce4133`，所有独立 review findings 已闭合。

T1.5 已完成：Login/Register 共用 AuthPanel，AuthAside 使用中性 Workspace/Packs/LaTeX/Evidence 叙事和 code/PDF/trace，密码策略覆盖 10–256 位、两类字符与确认密码，开发 OAuth 和 `/download` 离线入口保持真实路由。focused 19/19、Node 155/155、Python 25/25、Web 2312 modules、8 视口 auth Edge 与 88.8s strict Edge 通过；stable SHA `81651dc06e68a9874ab414ed8610babe81094e9edb79687a68c55a2707802df4`，report SHA `f0dd5bdf2b5cd71eeb02c895359e7b5953544e9659e75cb8e79fab8608bb7a0e`。

T3.3 已完成：Web Workbench 区分 configured provider 与 response runtime，真实 `ActionTimeline` 由 lifecycle 生成，BEGIN_FILE 经 preview/diff、Reject/Apply、exact baseline、409 refresh 和 rollback/error 状态闭环；Node 164/164、Python 25/25、Web 2316 modules、13/52 visual smoke 与 strict Edge 通过，ai-qa 77→197 bytes 的写入 trace 和桌面/移动截图已记录。

下一严格原子任务是 T3.6。必须基于已验证的 T3.3 真实状态生成 `web/public/hero-ide.png` 后才能移除当前示意；实体 GPU/移动真机性能、像素基准、WinForms/Tauri 真机和签名安装链仍不属于现有证据。
