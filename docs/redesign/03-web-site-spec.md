# 03 · 公开展示站规格（Public Web Site Spec）

> 目标：让首屏 3 秒内传达"本地优先的通用文档 IDE，Pack 驱动、AI 修改可审查、可下载验证"，并引导
> **下载桌面端** 或 **进入工作台**。视觉对齐 `UI-Design/{1,2,3,4,a,g}.png`。

现有页面：`web/src/pages/{Home,Features,Pricing,Enterprise,Market,Community,HowTo,Docs,Changelog,About,Download,Login,Register}.jsx`，
布局壳 `components/{SiteHeader,SiteFooter,SiteLayout,AuthAside}.jsx`，样式 `styles/pages.css`。
本文只规定**结构与内容**，视觉令牌/动效引用 `01`/`02`。

---

## 0. 全站骨架

### 0.1 导航（`SiteHeader.jsx`，已有，微调）

- 结构保持：左 `Logo + Paper OS + Local First · Pack Powered`；中主导航；右 `登录 / 免费开始`（未登录）或 `进入工作台 / 退出`（已登录）。
- 导航项：`产品(/) · 功能 · 定价 · 企业版 · 技能市场 · 社区 · 下载`（保持）。
- **升级**：`glass-frost` 胶囊 nav 接**滚动收缩态**（`02`§5）；当前项 `aria-current` + 底部 2px 琥珀指示；
  右侧主 CTA 文案统一为「下载桌面端」（参考图强调下载），「免费开始」降为次级。
- 移动端：`☰` 换成 `Icon name="menu"`（禁止 emoji 字形，`01`§9），抽屉从顶部下滑。

### 0.2 页脚（`SiteFooter.jsx`）

四列：产品 / 资源 / 公司 / 法务 + 底部品牌行（Logo + 版权 + Apache-2.0 + GitHub）。
背景压一条极淡 Horizon Glow。链接 hover 走 `.ulink` 下划线动效。

### 0.3 公共区块组件（沉淀，跨页复用）

`SectionHead`（eyebrow + 衬线大标题 + 引导段）、`FeatureCard`、`StatRow`（真实字符串指标；只有存在可复现数据源时才可由调用方接 count-up）、
`WorkflowRibbon`（工作流带）、`LogoWall`（信任标识占位，**不得编造真实机构名**，用中性"研究组/团队"文案）、
`FAQ`、`CtaBand`（已有 `.cta-band`）。

---

## 1. 首页 `Home.jsx`（重点，对齐 `1.png` / `a.png`）

### 1.1 Hero（黄金样例落地这一屏）

左右两栏（`.hero-inner`，已有）：

**左栏（叙事）**：
1. eyebrow：`LaTeX NATIVE · LOCAL FIRST`（等宽大写，`01`§3.2）。
2. 大标题（Display 衬线，`--fs-hero`，逐行 `fadeUp`）：
   > 从想法，<br>到可以交付的文档。
3. 英文副标（斜体 Display + `--grad-foil` 金箔扫光）：`Local first · Pack powered.`
4. 引导段（`--fs-lead`，`--text-soft`）：本地文档编辑 + 可审查 AI 修改 + Pack 驱动工作流；工作区文件留在本机，模型请求边界另行明确。
5. CTA 行：主「下载桌面端」（`.btn-primary.btn-lg` + `releases` 图标）、次「查看工作流」（`.btn-ghost-amber`，滚到工作流带）。
6. 平台行：`Windows 开发预览 · macOS/Linux 规划中 · ● 文件留在本机`。不得把规划平台写成已发布。
7. 指标行：当前使用 `4 内置 Pack` / `Preview → Apply` / `Apache-2.0`。只有具备可复现基准和真实数据源后才可接 `CountUp`；禁止为视觉效果编造编译秒数或证据类别数。

**右栏（悬浮产品预览）**：
- 当前 B 路线使用 `HeroIdeMock`；外层 `.hero-mock` 加 `--shadow-chrome`、指针视差（`02`§4）和滚动视差。reduced-motion 下三者必须静态化。
- 叠加：右上半透明 `TraceBadge`（`01`§8.3）；左侧三条 `EvidenceFlow` 静态示意线，标注 `source / citation / figure`（对齐 `1.png`）。静态线不得冒充真实证据解析结果。
- chrome 顶栏必须显示“界面示意”；不得显示未经测量的编译耗时、虚构 branch、在线状态或真实 AI 执行状态。

**底部**：`.horizon` 光带（已有）。

### 1.2 Hero 的 IDE 截图来源（重要）

参考图里的"真实 IDE"是关键的高级感来源。两条可选路径，**推荐 A**：
- **A（推荐）**：用已实现的桌面 IDE 实拍图。已有 `dist/visual-qa/desktop-workspace-*.png`，但那是 Workspace Chooser；
  需在 P3 完成 Workbench 后，用脚本（`apps/desktop/*visual-smoke.mjs` 同款 CDP）在 1440×900 拍一张
  **打开 `method.tex` + PDF + AI 面板**的工作台图，存 `web/public/hero-ide.png`（≤ 300KB，webp/png）。
- **B（truth-driven 临时界面示意，当前已完成）**：在 A 就绪前，用高保真 HTML/CSS `HeroIdeMock`（Workspace + 源码/PDF + AI 修改预览），并在可见文本和 ARIA 名称中明确它是示意。它只展示真实存在的 `math-modeling Pack` 与 Preview → Apply 契约，不呈现虚构执行步骤。A 就绪后替换为静态图以省性能。
- 截图必须与真实产品一致（禁止画不存在的功能）。

当前边界：T1.1 完成 B 路线不等于 A 完成。T3.3 已完成真实 AI `ActionTimeline`、provider/runtime truth、Preview → Reject/Apply 和冲突/回滚证据；Workbench 实拍与 `web/public/hero-ide.png` 仍属于下一严格任务 T3.6。

### 1.3 工作流带（对齐 `2.png`）

`SectionHead`：`一条贯穿全文的工作流`。
横向 5 节点 `WorkflowRibbon`：`自然语言指令 → Skills/MCP 调度 → 本地项目文件 → LaTeX 编辑(差异) → PDF 生成与证据校验`。
- 每节点一张小卡（图标 + 标题 + 一行 + mini 代码/文件示意）。
- 节点间使用克制的流程连接线；宽屏与移动单列态保持连续连接感，641–1080px 的两列重排允许隐藏 connector，但必须以编号和阅读顺序维持流程关系。四视口证据合同为 1440/1100/820/390 下 visible connectors `4/4/0/4`，可见处 reduced-motion 必须静态化。
- 下方一排证据小卡：`数据来源 / 引用依据 / 图表数据 / 结论主张`（对齐 `2.png` 底部）。

### 1.4 核心能力区（保持 `CAPS`，升级视觉）

保留现有 6 张能力卡内容（LaTeX 原生 / 证据可追溯 / 可审查 AI / Pack 驱动工作区 / 技能 MCP 生态 / 本地优先），
改为**不等宽 bento 网格**（`wide` 卡跨列），每卡：序号 + 图标 + 标题 + 说明，hover `lift`。

### 1.5 差异化对比区（新增，借 Overleaf/竞品调研）

一张对比表 `.tbl`：Paper OS vs 云端 LaTeX 工作流 vs 传统本地编辑器。
维度：项目位置 / 编译位置 / AI 写入控制 / Evidence 语义 / 扩展边界。
**客观中性**表述，不写未经可复现基准证明的速度、价格或能力优劣，不把静态首页标签冒充全局 Evidence 能力。

### 1.6 CTA Band（保持 `.cta-band`）

「把下一份严肃文档，放进一个真正懂它的编辑器。」+ 下载 / 注册双按钮。底部 Horizon Glow。

---

## 2. 功能页 `Features.jsx`（对齐 `3.png` 叙事）

- Hero 小标题：`写作，不止生成。`
- 分块深挖（每块：左文案 + 右示意图/截图片段，交替左右）：
  1. **本地 LaTeX 编译**：Tectonic/latexmk、本地离线编译、PDF 并排；任何耗时数字必须来自可复现的设备/文档基准。
  2. **可审查 AI（EditTransaction）**：草稿块预览 → 逐块 Apply、冲突 409 保护。
  3. **证据追溯与放大镜**：论断反查脚本/数据/文献（引到 `04`§放大镜）。
  4. **Skills / MCP 生态**：装技能解锁能力（引到市场）。
  5. **团队一份工作区**：看板/知识库/共享引用（引到团队页）。
- 每块配 `Reveal` 入场；截图用真实产品片段。
- 结尾锚到「下载」。

---

## 3. 定价 `Pricing.jsx`（借 new-api 计费透明度）

- 顶部说明条：本地编译不按次收费；模型 token 由用户配置的 BYOK provider 结算；同步/协作资费只描述已交付能力。当前源码中的“AI 推理都跑在你自己的机器上 / 没有按次计费的服务器成本”与 provider 架构冲突，T1.4 必须删除。
- 月/年 `.segmented` 切换（年付省 2 月，滑动高亮）。
- 四档卡（免费/专业/团队/企业），专业档 `.card` 高亮 + `推荐` 芯片 + 琥珀描边。
- 每档：价格（count-up）+ 一句定位 + 勾选特性列表（`check` 图标）+ CTA。
- **对比表**（`.tbl`）：功能 × 档位矩阵，`✓ / —`；企业档"联系我们"。
- FAQ 折叠区（BYOK、数据边界、开源与付费关系）。
- 强调 **BYOK（自带 API Key）**：付费不含模型 token，模型走用户自己的 key（诚实，见 `../PRODUCT.md` §Non-Goals）。

---

## 4. 企业版 `Enterprise.jsx`

- Hero：`把整套系统部署进你的内网。`
- 能力卡：私有化部署 / SSO 单点登录 / 审计合规 & SLA / RBAC 权限 / 数据本地边界 / 专属支持。
- 安全架构图（简）：数据不出内网 + 本地编译 + 密钥加密（AES-256-GCM）+ 发布签名（Ed25519）。真实呈现已实现的安全能力，边界以 [`../ARCHITECTURE.md`](../ARCHITECTURE.md) 和 [`../STATUS.md`](../STATUS.md) 为准。
- 「联系销售」表单（走 `/api/community/posts` 或占位，不承诺未实现的自动化）。

---

## 5. 技能市场（公开）`Market.jsx`（对齐 `e.png`，详规见 `04`§市场）

公开站的市场是"可浏览、需登录才安装"的版本：左类别树 + 卡片网格 + 排序（热门/最新/已认证/免费/开源）+ 详情抽屉。
数据来自 `/api/market/skills`。安装/试用按钮在未登录时引导登录。

---

## 6. 社区（公开）`Community.jsx`（对齐 `f.png` 精简版，详规见 `04`§社区）

信息流（最新/热门/精选/官方推荐）+ 右侧团队精选/本月之星/贡献榜。数据 `/api/community/posts`。
公开只读；发帖需登录。

---

## 7. 文档 `Docs.jsx` / 更新日志 `Changelog.jsx` / 关于 `About.jsx` / 使用 `HowTo.jsx`

- **Docs**：左侧目录树 + 右侧内容 + 代码块（`code` 令牌）。快速上手、编译、AI、证据、Pack、故障排查。可加"复制"按钮与锚点。
- **Changelog**：竖向时间线（版本 pill + 日期 + 分组条目），数据可接 `/api/releases` notes；时间线节点用 signal dot。
- **About**：产品理念（本地优先、可验证、开放生态）+ 团队/许可证。克制叙事。
- **HowTo**：90 秒工作流分步图文，可嵌演示视频占位。

---

## 8. 下载 `Download.jsx`（保持逻辑，升级视觉）

- 逻辑保持：`GET /api/releases` 拉真实版本/资产/大小/SHA-256（已实现，勿改后端）；`detectOS()` 推荐当前平台。
- 三张平台卡（Windows/macOS/Linux）：当前平台加`推荐给你`芯片 + 主按钮高亮；未就绪走 GitHub 发布页
  （`https://github.com/123marksgithub/Latex-MathPaper/releases`）。
- **新增·安装指引三步**：下载 → 安装 WebView2/Node（若需）→ 首启 onboarding（引到 `05`）。
- **新增·完整性校验**：展示 SHA-256 + Ed25519 已签名徽章（`/api/releases` 已返回 `signed/signature/publicKey`），
  提供"如何校验"折叠说明（诚实体现已实现的签名能力）。
- 版本信息卡（最新版本 + notes + 全部更新日志/文档入口，已有，保持）。

---

## 9. 登录 / 注册 `Login.jsx` / `Register.jsx`（对齐 `4.png` / `g.png`）

分屏布局（`.auth`，已有 `AuthAside`）：

**左栏 `AuthAside`（品牌叙事）**：
- Logo + `Paper OS · Local First · Pack Powered`。
- 大标题：`从想法，到可以交付的文档。` + 斜体 `Local first · Pack powered.`
- 卖点点阵（4 条：Workspace + Packs / LaTeX 原生 / 证据可追溯 / 技能生态）。
- **视觉主角**：悬浮的 code + PDF 卡片（对齐 `g.png`/`4.png`）+ 底部 Horizon Glow + 迷你 `想法→写作→校验→追溯→交付` 竖向流程。
- 现有 `points` 文案含数学建模味（"五阶段/证据账本"），**改中性**：通用文档措辞（能力门控，见 `README.md` §3）。

**右栏（玻璃表单）**：
- `.segmented` 登录|注册切换（`g.png`）。
- 字段：账号/邮箱、密码（注册加确认 + 实时策略校验：≥10 位 + ≥2 字符类，与服务端及 [`../../tests/account-api.test.mjs`](../../tests/account-api.test.mjs) 一致）。
- 主按钮 `登录并继续` / `免费开始`（`.btn-primary.btn-block`，`is-running` 态已有；当前实现已对齐）。
- SSO 行：Google / GitHub / 企业微信（真实接 `/api/auth/oauth/:provider/start`，仅为 dev 流；带 glyph，证据见 [`../../app/server.mjs`](../../app/server.mjs)）。
- 分隔线「或」+ **`离线打开本地项目`**（对齐 `4.png`/`g.png`，引导直接用桌面端离线，无需账号）。
- 底部：`● 项目文件保留在本机，登录仅同步账号与协作权限。`（signal dot）。
- 注册页移除误导性角色选择器（服务端首账号=owner 其余=member，证据见 [`../../tests/account-api.test.mjs`](../../tests/account-api.test.mjs)）。

---

## 10. 响应式与状态

- 断点：`≥1200`（Hero 双栏）、`<1200`（Hero 单列）；公共导航 `>880` 显示主导航，`≤880` 只显示菜单按钮/移动导航；`<768` 继续收紧卡片和预览。reduced-motion 禁用指针/滚动视差与持续装饰动画。
- 每个数据页有 loading（skeleton）/ empty（`.empty`）/ error（`.alert.error` + 重试）三态。
- 深链可直达（服务端 SPA fallback 已实现，证据见 [`../../tests/spa-fallback.test.mjs`](../../tests/spa-fallback.test.mjs)）。

---

## 11. 落地清单

- [x] Hero truth-driven B 路线：`Home.jsx` + `HeroIdeMock` + 四视口/导航/键盘/reduced-motion 门禁。
- [x] T3.3 真实 Web Workbench AI 面板：provider/runtime truth、真实 `ActionTimeline`、BEGIN_FILE preview/diff、Reject/Apply、409 conflict、rollback、strict Edge 桌面/移动证据。
- [ ] T3.6 完成真实 Workbench 截图 `web/public/hero-ide.png`，替换 `HeroIdeMock`。
- [x] T1.2 公共区块：`SectionHead/StatRow/WorkflowRibbon/FeatureCard/FAQ/LogoWall/CtaBand` 已沉淀到 `components/public/` 并由 Home 全部接入。
- [x] `SiteHeader` 滚动收缩、`aria-current` 2px 指示、统一下载主 CTA 与图标化菜单；T1.3 四视口/881px、820/390 首焦点/Escape、认证态 CTA、reduced-motion/阈值门禁完成。
- [x] `AuthAside` 中性文案 + 悬浮 code/PDF + 五步 trace。
- [x] Features/Pricing/Enterprise 按上文重排；Features 五段交替深挖，Pricing 使用 segmented + 对比表 + FAQ + BYOK 边界，Enterprise 使用六项可用性标签与已验证安全基础。
- [ ] Download 加安装三步 + 校验说明（不改后端）。
- [x] Login/Register 加 Segmented + 离线打开入口 + 10–256 位/两类字符/确认密码策略；开发 OAuth 与服务端角色语义保持不变。
- 验证：T1.5 使用 `npm run auth-visual-smoke` 覆盖 2 路由 × 1440×900、1100×720、820×800、390×844，含键盘 mode、密码/确认状态、44px 触控、reduced-motion、零 overflow 和 browserErrors=[]。稳定行为 SHA-256 为 `81651dc06e68a9874ab414ed8610babe81094e9edb79687a68c55a2707802df4`，报告 SHA-256 为 `f0dd5bdf2b5cd71eeb02c895359e7b5953544e9659e75cb8e79fab8608bb7a0e`；T1.2–T1.4 分数和哈希继续作为历史快照。
