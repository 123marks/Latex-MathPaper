---
title: Paper OS engineering handoff
status: active
as_of: 2026-08-31
baseline_commit: 2629f33
worktree: clean
owner: next maintainer
---

# Paper OS 工程交接

这是一份给下一位开发者或 Codex 的工作入口。它回答“过去做了什么、现在真实是什么、未来往哪里走、接手后先做什么”。当前状态以 [`STATUS.md`](STATUS.md) 为准，历史全文保存在 [`history/`](history/README.md)，不要再把历史轮次追加到本文件。

## 1. 一句话方向

Paper OS 要成为一个**本地优先、Workspace Kernel 驱动、Pack 可扩展、AI 修改可审查、运行边界可验证的通用文档 IDE**。目标体验参考 Cursor 的编辑器效率与 AI 工作流，同时保留 LaTeX、Markdown、数学建模等专业文档能力。

数学建模是第一方 `math-modeling` Pack，不是产品内核。通用界面不得默认出现 contest、claim ledger、paperctl 等专业语义；这些能力必须通过 Pack capability 暴露。

## 2. 交接基线

- 日期：2026-08-12。
- 分支：`main`。
- `HEAD`：`2629f33`；在初始提交 `1546dab` 之上：领域分组基线 + T3.x 切片 + 09-integrations Epic 1–4b 全部（标注→AI 含 PDF 区域、会话管理、References + DOI/arXiv 导入、多 provider + 会话级选择）+ v0.6.0 发布与本地 tag + pdf.js 渲染层 + 文件树文件夹管理 + Dashboard 控制中枢 + 管理台服务监控/在线会话 + mac/linux 便携包 + strict 冒烟抓到并修复的 390px 顶栏溢出。
- 根版本：`0.7.0`（根、desktop、Cargo、tauri.conf 对齐；Web UI 经 Vite `define` 注入）。v0.7.0 内容：pdf.js 审阅层、DOI/arXiv 导入、真编辑器套件（全文搜索/跳行/Ctrl+S/关闭保护/标签恢复/分栏拖拽/右键菜单）、⌘K 聚合搜索、工作区全生命周期（新建/注册/导出/移除）、管理台监控与在线会话、许可证/激活码 + 计划容量门控、mac/linux 便携包。
- 工作区：clean；构建产物（`app/public`、`app/ide`、`src-tauri/target`、根 launcher 二进制、`runtimes/`）按 `.gitignore` 排除。仍禁止整体回滚、批量格式化或清理不明文件。
- 当前主入口：根目录 `PaperOS.exe`，WinForms + WebView2 调用本地 Node 服务。
- Tauri：已有 v2 脚手架和构建产物，仍是过渡方案。
- 当前最新实测：T3.3 聚焦 Web AI 合同、Node 164/164、Python 25/25、Web 2316 modules、Desktop IDE build、13 keyframes/52 assets visual smoke 与 strict Edge 全部通过；`dist/visual-qa/horizon-behavior.json` 为 schema 2 / `verdict: pass` / `strict: true`，Workbench AI ready/applied/mobile 截图和 Apply trace 已写入报告。T0.3–T1.5 的计数与哈希继续保留为历史快照。

这意味着：本轮已把 dirty worktree 收敛为可审阅的领域分组提交，并复跑通过 Node 164/164、Python 25/25、`npm run build`（Web 2316 modules + IDE bundle）、`node --check app/server.mjs` 与 `visual-smoke`（13 keyframes/52 assets）。仍缺 PR 审阅、版本 tag 和签名安装包；接手第一目标是补齐这些发布治理，再继续 T3.6。

## 3. 产品与架构地图

```text
PaperOS.exe / Tauri scaffold / browser
                |
                v
     app/server.mjs (loopback HTTP + WS)
        |        |         |        |
        v        v         v        v
  Workspace   Build     AI/provider  Account/admin
   Kernel     runtime      gateway      stores
        |
        v
 workspaces/ + registered external folders + contests/ adapter
        |
        v
 general / latex / markdown / math-modeling Packs
```

主要代码：

| 责任 | 路径 | 说明 |
| --- | --- | --- |
| Node 本地服务 | `app/server.mjs` | HTTP/WS、静态站、IDE、API；当前是 3000+ 行单体 |
| Workspace Kernel | `app/lib/workspaces.mjs` | Workspace、Pack、路径安全、registry |
| 数据/安全库 | `app/lib/*.mjs` | store、auth、secret box、signer、modeling status |
| 桌面 IDE | `apps/desktop/src/ide.jsx` | React/Monaco 主界面；当前是 3000+ 行单体 |
| Buffer 模型 | `apps/desktop/src/text-buffer.mjs` | 每 tab 内容、saved snapshot、dirty 生命周期 |
| 当前 Windows 壳 | `launcher/Program.cs` | 启动 Node、WebView2 窗口、端口选择与生命周期 |
| Tauri 壳 | `apps/desktop/src-tauri/` | 跨平台过渡脚手架，仍调用外部 Node |
| 展示站/控制面 | `web/src/` | 官网、账户、应用内工作台、后台页面 |
| Pack 资产 | `product/`、`templates/` | manifests、runtime、agents、skills、工作流、模板 |
| 测试 | `tests/`、`app/*smoke*.mjs` | Node、Python、浏览器/视觉冒烟 |

## 4. 过去做了什么

### 4.0 本轮交接与文档治理

本轮没有把交接继续写成一份不断累加、前后互相覆盖的开发日志，而是建立了可以长期维护的文档体系：

- 新建 `docs/README.md`，定义文档阅读顺序、权威范围、冲突处理和更新责任。
- 新建 `docs/STATUS.md`，把当前实现、验证日期、基线 SHA、dirty/clean 状态和未测项放在同一张事实快照中。
- 重写本交接文档，按“过去、现在、未来、接手步骤”组织；旧的逐轮记录归档到 `docs/history/`，不再参与当前状态判断。
- 新建 `docs/DEVELOPMENT.md`、`docs/TESTING.md` 和 `docs/RUNBOOK.md`，分别承担开发环境、验证矩阵和运行维护职责。
- 新建 `docs/TRACEABILITY.md`，建立 Requirement -> Decision -> Plan -> Code -> Test -> Release 的追溯链。
- 新建 `CHANGELOG.md`，把版本变化和已知限制从交接日志中分离出来。
- 新建 `docs/adr/README.md` 并补充 ADR-0002 至 ADR-0005，记录本地认证、AI Apply、发布签名和桌面壳等关键决策边界。
- 新建 `product/README.md`，明确 `product/` 是运行时消费资产，不是普通说明文档。
- 统一 `README.md`、PRODUCT、ARCHITECTURE、CAPABILITY_MAP、GUIDE 和 redesign 文档中的产品定位与状态措辞，修复不存在的 redesign `00` 引用。
- 更新 `app/visual-smoke.mjs`，让视觉门禁验证当前 Horizon 背景、reduced-motion、失败降级和 App 接线的静态契约，不再检查已退役的 Aurora 实现。
- 增加发布脚本回归测试；`package-release.mjs` 现在会拒绝 EXE/DLL/deps/runtimeconfig 不完整的 launcher 文件集，避免生成错误启动说明。

这些文件当前仍位于 dirty worktree，尚未绑定正式提交。因此它们是本次交接的完整工作成果，但还不是可发布、可审计的 release 基线；下一位维护者必须先审阅 diff、复跑验证，再按领域拆分提交。

### 4.1 从数学建模工具收敛为通用文档 IDE

- 确立 Workspace Kernel + Packs，接受 [`ADR-0001`](adr/0001-general-workspace-kernel.md)。
- 定义 `general`、`latex`、`markdown`、`math-modeling` 四个内置 Pack。
- managed Workspace、外部目录注册、legacy `contests/` adapter 已接入统一 Workspace API。
- 菜单、命令面板、Evidence、编译、底部任务和 activity bar 已做 capability gating。
- 移除首启自动创建数学建模 demo 和标题栏 `prompt()` 建项目。

### 4.2 编辑器安全和稳定性

- 引入独立 text buffer 模型，tab 切换不再从磁盘覆盖内存内容。
- Save/Save All 按各自 snapshot 提交；保存期间继续输入会保持 dirty。
- Workspace 切换会清理 editor/media/PDF/buffer 状态并提示未保存风险。
- `loadTree()` 和 `openFile()` 使用 request token 丢弃旧 Workspace/旧文件响应。
- Apply Blocks 已有 preview baseline、mtime 冲突、失败回滚和明确错误码。

### 4.3 本地信任与文件系统边界

- HTTP/WS 增加 loopback Host/Origin 检查。
- desktop local auth 使用一次性 bootstrap cookie，再消费 `/api/auth/local`。
- Workspace path 统一做绝对路径/遍历拒绝和 canonical containment。
- walker 有深度/条目预算，并避免跟随 Workspace 外 junction。
- account provider key 使用 AES-256-GCM 本地加密；发布清单使用 Ed25519 签名。

### 4.4 产品闭环和视觉重设计

- 展示站已具备首页、定价、企业、登录、账户、后台、下载等页面和对应 API 表面。
- Windows 开发预览 ZIP 和 SHA-256 文件存在；release manifest/public-key endpoint 已实现，但压缩包缺少 Node 生产依赖和 self-contained .NET runtime。
- `docs/redesign/` 已完成总览与 `01`–`08` 规格，`tokens.css`、`HorizonBackground.jsx`、`Home.jsx` 三个黄金样例已落地。
- Horizon Atelier 方向锁定：深炭、暖琥珀、地平线辉光、Quill Circle、Traceable Badge、AI Action Timeline、Evidence Flow。
- 2026-08-04 已完成 T0.2 motion hooks 的自动化验收：SSR 安全、reduced-motion 静态降级、指针视差按需 RAF 与资源清理。
- 2026-08-05 已把 T0.3 BFCache 门禁升级为真实同源导航：原生 pagehide/pageshow.persisted=true、同一文档 token、冻结期 0 draw、notRestored=[]，不再用合成事件充当证据。
- 2026-08-05 已完成 T0.5 UI primitives：十四个公开组件、共享 selection/dialog helper、dev-only Kitchensink、ARIA/键盘/focus/弹层/反馈状态门禁和三视口截图证据；同时修复 BackgroundVideo 的 HTML fallback 误判、reduced-motion 下仍探测/自动播放视频的问题，以及视觉 smoke 的 smooth-scroll 竞态。
- 2026-08-06 已完成 T0.6 Icon 注册补全：Web 与桌面端统一登记 `menu`、`template`、`git-branch`、`sync`、`magnifier`、`evidence`、`mcp`、`play`、`filter`、`export`；两端分别导出 `ICON_NAMES`。未知 Web 语义仍静默返回空，未知桌面语义仍返回既有圆形 fallback；回归测试从源码正则升级为两端实际 Vite SSR/SVG 渲染断言。
- 2026-08-05 已完成 T0.4 五个母题组件：`TraceBadge`、`ActionTimeline`、`EvidenceFlow`、`QuillMark`、`CountUp`；组件只接真实调用方数据，不内置伪步骤。
- T0.4 同时补齐 SSR/hydration 首值一致、浏览器绘制前 reduced-motion、确定 `zh-CN` locale、CSS 解析零 warning 和旧 TraceBadge 转发兼容；独立复审已 APPROVE。
- 当前性能样本来自强制 SwiftShader 的 draw-call 采样；它不证明实体 GPU 60fps，真机基准仍是明确待办。

### 4.5 T1.1 Home Hero：历史基础、完成边界、后续替换

过去：T1.1 规格同时写了 count-up、编译秒数、五类证据、AI 动作时间线和真实 IDE 截图，其中部分没有可审计数据源，部分实际属于后续 T3.3/T3.6。旧 Hero 还可能让“本地优先”被误读成模型推理也在本机。为了不把路线图伪装成现状，本轮选择 truth-driven B 路线，而不是为满足旧展示稿制造数字或执行状态。

T1.1 收口时：`web/src/pages/Home.jsx` 使用可核实的 `4 内置 Pack`、`Preview → Apply`、`Apache-2.0`，明确 Windows 是开发预览、macOS/Linux 仍在规划，并说明模型请求由用户配置的 OpenAI-compatible provider 处理。`web/src/components/HeroIdeMock.jsx` 是带“界面示意”标签的临时三栏产品预览，展示真实存在的 `math-modeling Pack`，不冒充截图或真实 AI 运行记录。Hero 与 Header 已接入 reduced-motion、880px 单一紧凑断点、移动菜单 ARIA/首焦点/Escape/焦点恢复，并在离开紧凑断点时卸载已打开的移动导航；两套 shader 的 `smoothstep` 边界改为有序表达式。当时四视口报告内稳定行为 SHA-256 为 `61d18c1e1eecc118be5020530ee310530754df389c8b365df61c56d005b0f16c`。这是 T1.1 历史快照；当前 T1.2 报告和哈希见下一节。

后续替换：T1.2、T1.3 与 T1.4 已在本节之后完成，不再是下一任务。T3.3 仍需用真实 `/api/provider`、`buildExecutionPlan` 和 apply-blocks 接入 AI 面板；T3.6 仍需在 Workbench 完成后拍摄 `web/public/hero-ide.png` 并替换 `HeroIdeMock`。在这两项完成前，不得把当前示意写成真实 AI timeline 或产品截图，也不要在 T1.5 中顺手重开 T1.1 Hero 几何。

### 4.6 T1.2 公共区块组件：过去、现在、未来

过去：T1.1 只收口首屏，Home 下半页仍混有页面内重复结构、三节点 workflow 和不完整的叙事链；没有可复用 FAQ、LogoWall、StatRow 或可信对比区。原规格还容易把 count-up、客户 Logo、机构背书、Evidence 和竞争优势写成默认展示能力。T1.2 因此不是简单抽 wrapper，而是要在不伪造事实的前提下建立公共区块边界，并用 Home 的完整 post-Hero 故事证明这些边界确实可复用。

现在：`web/src/components/public/` 已包含 `SectionHead`、`StatRow`、`WorkflowRibbon`、`FeatureCard`、`FAQ`、`LogoWall`、`CtaBand` 和内部 `_utils.js`。Home 直接导入全部七个组件，完成六项非等宽能力区、五节点 ordered workflow、五维中性比较、非客户背书式场景墙、四项产品边界 FAQ 与最终 CTA。实现有意保持小而明确：不增加依赖、不建立 schema-driven renderer、不新增 barrel；FAQ 使用原生 `details/summary`，wrapper 提供 `role="region"`；比较区复用共享 `ui/Table`；`StatRow` 接受真实字符串并保持 `dt → dd` 文档顺序；LogoWall 只写中性受众，不虚构客户或机构；Evidence 仍由 Pack capability 决定是否出现。

响应式和采集合同已经锁定。四视口 workflow 列数是 `5/5/2/1`，可见 connector 是 `4/4/0/4`，可见处厚度 2px；820px 使用既有两列 `2+2+1` 编排并有意隐藏 connector，390px 重启纵向连接线。comparison caption 宽度比为 `0.9984/0.9982/0.9975/0.9947`，全页截图前四视口均恢复 `scrollY=0`；浏览器错误、横向溢出、裁切和越界均为 0，CTA opacity ≥0.992。移动 caption 逐字竖排、workflow 连接感和固定导航中段伪影均已有回归合同和浏览器证据。

当前验证是 Node 134/134、Python 25/25、Web 2308 modules + Desktop IDE bundle、visual smoke 13 keyframes/51 assets、Home smoke 与 strict Edge 通过；视觉复核迭代为 78 → 84 → 92，最终 pass。`dist/visual-qa/home-hero-behavior.json` 的 `evidenceSha256=d5080b1f2451bf3725d6a497a6973ae2a32553a902841694acbf501e0db9840d` 是规范化的稳定行为摘要，不包含逐帧 PNG SHA；本次报告文件 SHA 为 `7de8da881c40173453e355df642d32d2f4c214158ee3726ecd5a07fc0924f7ca`，每个原始 PNG 仍在报告中保留自己的 point-in-time SHA。这是有意的双层证据合同，不是完整性遗漏。

未来（T1.2 收口时的历史判断）：当时下一任务是 T1.3/T1.4/T1.5，且 T3.3/T3.6 尚未完成。当前 T1.3–T1.5 与 T3.3 均已关闭，下一严格任务见 4.9 节的 T3.6。

### 4.7 T1.3 公共导航：过去、现在、未来

过去：T1.1 已完成 880px 导航互斥、Icon menu、移动菜单 ARIA/焦点生命周期，但 Header 始终是 glass pill，没有批准规格中的 40px 收缩状态；当前路由只有 React Router 默认 active surface，没有 2px 指示；未登录主按钮仍是 `/register`“免费开始”，已登录状态没有稳定下载入口。

现在：`SiteHeader.jsx` 新增一个独立的 passive scroll effect，以严格 `scrollY > 40` 切换 `nav--scrolled` 与 `glass-frost`，并在卸载时清理同一 callback。CSS 使用 `--dur-3/--ease` 和小幅 transform 表达收缩，不动画布局尺寸。所有 public `NavLink` 继续自动提供唯一 `aria-current="page"`，2px 指示直接选择该语义；没有新增 `useLocation` 或第二份 pathname 状态。

右侧唯一主 CTA 现在始终是 `/download`“下载桌面端”，登录/免费开始或工作台/退出降为次级。≤880px 时顶栏只保留品牌、下载和 44px Icon menu，账户操作放入原有移动导航。820px 与 390px 都真实打开菜单并证明首个链接精确获焦、Escape 关闭和焦点恢复；820→1000→820 状态迁移继续通过。真实 Edge 在 40px 记录透明 58px 常规态，在 41px 记录 57.13px compact、rgba(20,20,23,.7)、既有 chrome shadow 和 scale .985/translateY -2px；881px 桌面边界无容器溢出或子项重叠，brand/nav 与 nav/actions gap 均为 18px。通过页面加载前 auth fetch stub 触发现有 `AuthProvider` 后，认证态仍只有一个 `/download` 主按钮。reduced-motion transition 为 `1e-06s`，状态信息不丢失。

验证：聚焦 7/7、全量 Node 141/141、Python 25/25、Web 2308 modules、IDE build、visual smoke、Home 四视口/881px 与 230.8s strict Edge 全绿；`browserErrors=[]`，视觉判定 94/pass。当前稳定行为摘要为 `117c18b46d45856afebc9447464d33ab94e4506f5e8f2d56f8f6ec1157d4b398`，报告文件 SHA 为 `f82f4686e4b854849d23b37f7d16e362f7f947886e78fdbc131f6d02017f0615`。独立复审已确认原 2 个 Medium 与 1 个 Low 均关闭，结论为 `APPROVED`。

未来（T1.3 收口时的历史判断）：当时下一严格原子任务是 T1.5，T3.3/T3.6 尚未完成。当前 T1.5 与 T3.3 已关闭，T3.6 仍开放；不要复制导航断点、手写 pathname 当前态或把“下载桌面端”换回注册主按钮。

### 4.8 T1.4 Features / Pricing / Enterprise：过去、现在、未来

过去：三个公开页虽然路由齐全，但没有形成可审计的产品合同。Features 由重复卡片墙组成，并把多人同时编辑、冲突可视化和敏感信息审计写成现状；Pricing 硬编码了无来源的 `¥39/¥99`，把云同步、协作、SSO、SLA 和本机模型推理当成已交付权益；Enterprise 又把私有部署、RBAC、合规和“数据不经过第三方”写成确定承诺。这些表述与当前 OpenAI-compatible provider、Preview → Apply、部分团队 API 和仍在规划的企业能力不一致。

现在：Features 已重排为五段交替深挖，分别说明本地 LaTeX、Preview → Apply、Evidence、Skills/MCP 和团队边界；第一段使用真实 Workbench 截图，其余片段明确是界面表达，不冒充运行记录。Pricing 复用 `Segmented`、`Table`、`FAQ` 和 `CtaBand`，保留四类方案的信息架构，但金额统一写“待发布/联系确认”；BYOK、provider 请求边界和“订阅不包含模型 token”均在首屏与 FAQ 明示。Enterprise 保留六个主题入口，但每项都标记“可配置/需评估/合同确认”，安全区只陈述 AES-256-GCM、Workspace 路径边界、Ed25519 与可配置 provider 等已有事实，联系入口仍是明确的人工邮件。

可访问性与运行时边界也已收口：三个页面各有一个页面级 `h1`；Pricing/Enterprise 的 reduced-motion smoke 直接采样真实 `Reveal` 包装层，而不是无动画的内部 article；Enterprise 的 SectionHead 限宽选择器已穿过 Reveal 包装。独立复审最初提出 1 个 Important 和 2 个 Minor，三项都先得到预期 RED，再以最小改动修复并回到 GREEN。

当前证据：T1.4 聚焦 6/6、Node 147/147、Python 25/25、Web 2310 modules + Desktop IDE build、static visual smoke 13 keyframes/52 assets、Home 回归与 112.6s strict Edge 全绿。专用 Edge smoke 覆盖 Features/Pricing/Enterprise × `1440×900 / 1100×720 / 820×800 / 390×844` 共 12 张截图，`browserErrors=[]`、最小触控目标 44px、`scrollY=0`，横向溢出、文本溢出和越界均为 0；方向键切到年付、Enter 展开 FAQ 并保持焦点，三页 reduced-motion 采样均通过。最终同环境稳定行为 SHA-256 为 `0bf75be0138cc322228586c76be9390ef182f471c2308d048c1585c062d38f5f`，最新报告 SHA-256 为 `173c0fffeb941bc57d6ec3aecd6d4d0838697bc73215814b7c3b2b2cf5ce4133`。视觉方向沿用同一实现的 92/100 pass；本轮 Windows 图片查看器故障没有产生新的人工视觉评分。

未来：下一严格原子任务是 T1.5 Login/Register。正式价格、同步/实时协作、SSO、RBAC、SLA、私有部署和专属支持仍不能从 T1.4 页面推导为已交付；只有产品、架构、状态与合同证据同时变化时，才能升级这些标签。后续若没有 failing regression，不应重开 T1.1–T1.4 的已验收几何和行为。

### 4.9 T3.3 Web Workbench AI 面板：过去、现在、未来

过去：Workbench 的聊天传输和 Apply Blocks 后端已经存在，但前端把配置 provider、实际回答 runtime 和静态演示步骤混在一起；BEGIN_FILE 只作为聊天文本显示，用户看不到真实执行阶段，也不能在写入前核对文件基线。这会让“AI 已在线”和“即将改哪些文件”产生错误信任。

现在：新增纯 helper web/src/lib/ai-execution.js 和展示组件 AIAssistantPanel.jsx。Workbench 负责请求和生命周期：挂载时读取 provider，提交后消费带 metadata 的跨 chunk SSE，按 requesting → streaming → previewing → ready → applying → applied/rejected/failed 推导 ActionTimeline；完整 BEGIN_FILE 块通过 apply-blocks 先 preview，返回 path/mtime/bytes 后形成 bounded replacement diff，Apply 复用同一 baseline，Reject 直接丢弃提案。409 APPLY_CONFLICT 保留提案并要求刷新预览，APPLY_ROLLBACK 保留检查状态并说明没有部分写入，preview/network/provider 错误不启用 Apply。

真实运行时与配置状态严格分离：provider chip 只描述 GET /api/provider 的 configured/unavailable；回答旁的 runtime metadata 明确 provider 或 mock-local。当前 mock-local 是 provider 未配置时的确定性 fallback，文字会写出 deterministic fallback 和原因，绝不继承配置模型名。服务端 JSON 使用 no-store，provider 上游错误进入明确的 PROVIDER_STREAM_ERROR 路径。移动端将文件树、编辑器、AI 面板改为纵向工作流，保留文件树和 Apply/Reject 功能。

当前证据：node --test 164/164、Python 25/25、Web build 2316 modules、Desktop IDE bundle、visual smoke 13 keyframes/52 assets、strict Edge exit 0。horizon-behavior.json 为 schema 2 / pass / strict；ai-qa 由 77 bytes 预览前内容变为 197 bytes，Apply trace 返回 HTTP 200 且写入 paper/main.tex；1440×1200 与 390×844 无横向溢出，reduced-motion 为 none / 0.001ms / 1。ready/applied/mobile 截图、请求/响应 trace 和 SHA-256 均在 dist/visual-qa/horizon-behavior.json 及对应 PNG 中。

未来：T3.3 已关闭，下一严格任务为 T3.6 真实 Workbench 产品截图。接手者应先复跑 T3.3 证据，再在同一真实 workspace/file、runtime 和 Apply 边界下拍摄 web/public/hero-ide.png；不得用 HeroIdeMock、静态 timeline、configured provider 名称或 SwiftShader draw-call 采样冒充真实截图、模型运行或实体 GPU 性能。

### T0.5/T0.6 交接细节：现在、过去、未来

过去：先按 T0.5 合同建立十四个独立 UI primitives 和 components.css 扩展，再用 Kitchensink 把所有适用状态放在一个可复现入口；没有把示例状态接入 Home/Workbench，也没有新增依赖。实现过程中发现不存在的 bg-space.mp4 会被 SPA fallback 伪装成成功响应，导致 video 进入文档流；发现 smooth scrolling 会让 smoke 在 scrollTo 后立即读到旧 scrollY。两项都先写回归测试得到 RED，再做最小修复。独立收口复审随后发现生产静态服务器未声明 `.mp4` MIME、视频层位于不透明 Horizon canvas 下方、Tabs 的非活动项 `aria-controls` 指向不存在的面板，以及 Dialog/Meter 允许空可访问名称；这些问题已通过第二轮 RED→GREEN 修复，Drawer 的初始焦点、Tab 环绕、Escape 和焦点恢复也已加入真实 Edge 门禁。第三轮复审又发现可见 `<video autoPlay loop>` 没有服从 `prefers-reduced-motion`，且 poster 的 JPEG MIME 未映射；新测试在旧实现上准确得到 `fetchCalls=1` 和两个 `application/octet-stream`，随后复用共享 motion 查询实现“零 HEAD 探测 + 不渲染视频”，并补齐 `.jpg/.jpeg -> image/jpeg`。复审还指出共享 hook 会把 reduced 永久锁存；第四轮测试先复现 `false → true → false` 无法恢复，再把 media-query listener 改为双向同步并验证卸载清理。

现在：UI 入口是 `web/src/components/ui/index.js`；Tabs/Segmented、Modal/Drawer、Tooltip/Toast 等交互约束已经自动化。浏览器证据覆盖 1440×900、1100×720、390×844，行为 JSON 记录 scrollY、kitchenTop、headerTop、溢出和控件几何；最新报告 `browserErrors=[]`，三个视口均无横向溢出、裁切文本或小于 31px 的可见控件，SHA-256 为 `05343db351993f966542c041e1e06b60a97615d948125eb302900cb985af15cc`。生产 Web build 已确认不含 Kitchensink 文案；全 Node 115/115、Python 25/25、T0.6 icon registry 2/2、BackgroundVideo 7/7、motion 9/9、Web/IDE build、visual smoke 和严格 Edge browser smoke 均通过。工作区仍 dirty、尚未形成 commit，因此这些是本轮实测事实，不是发布基线。

未来（T0.6 收口时的历史判断）：当时下一顺序是 T1/T3 页面级接入；其中 T1.1 的当前结论已由上方 4.5 节更新。其余接入仍必须传真实业务数据、保持 Pack capability gating，并重复 keyboard/ARIA/reduced-motion/三视口验证。实体 GPU/移动真机、像素基准、WinForms/Tauri 真机和签名更新链另开验证任务，不得被源码/SwiftShader 证据覆盖。
历史逐轮记录见 [`history/2026-07-legacy-handoff.md`](history/2026-07-legacy-handoff.md)。它保留审计价值，但其中旧待办和测试数字均已失效。

## 5. 现在真实是什么

### 已经可以依赖

- Workspace/Pack 基础模型、managed/external/legacy 三类 Workspace。
- 文件树、文本编辑、保存、搜索、PDF/图片预览和显式 `.tex` 编译。
- Buffer safety、stale response guard、Pack gating 和 desktop bootstrap。
- Apply Blocks 的预览、mtime 冲突检测和失败回滚。
- 本地账户/会话、provider key 加密、管理 API、审计/usage store。
- 发布清单签名和 Windows 开发预览产物；产物存在不代表可在干净机直接运行。
- Horizon T0.3 行为契约及其结构化证据；运行时门禁默认 strict，失败不能再静默降为 SKIP。
- T0.4 母题组件及其自动化契约；页面级使用必须继续接真实业务数据。
- T0.5 UI primitives、dev-only Kitchensink、交互/可访问性门禁与 T0.6 两端统一 Icon registry。
- T1.1 Home Hero truth-driven B 路线、四视口门禁与可访问移动导航；`HeroIdeMock` 只能作为临时界面示意依赖。
- T1.2 七个公共区块组件、Home post-Hero 完整组合、FAQ/比较/workflow/CTA 四视口门禁与稳定行为摘要；820px connector 隐藏是已锁定的响应式特例。
- T1.3 公共导航的唯一当前项、下载主 CTA、40px/41px compact、880px 菜单和焦点生命周期。
- T1.4 Features/Pricing/Enterprise 的真实能力边界、页面级 h1、共享 Segmented/Table/FAQ/CtaBand、12 视口 Edge 与 Reveal reduced-motion 合同。
- T1.5 共享 AuthPanel、密码边界、开发 OAuth/离线入口和两路由四视口认证门禁。
- T3.3 Web AI 面板的 provider/runtime truth、真实 ActionTimeline、BEGIN_FILE preview/diff、Reject/Apply、冲突/回滚和桌面/移动证据。

### 只能称为部分完成

- AI：真实 provider 路径和 Web 审查流已实现，失败时明确落到 `mock-local`；仍没有本机模型推理、通用 hunk editor、持久 transaction/undo 或生产 provider SLA。
- EditTransaction：已有事务化兼容路径，但没有持久 transaction/undo、通用资源版本或 hunk UI。
- LaTeX build：能编译和流式输出，但没有通用 BuildProfile/BuildJob/ArtifactSet，SyncTeX 只是估算路径。
- Team/community/admin：有 API 和页面，不等于生产级实时协作、任务执行器或云服务。
- 跨平台：CI/manifest 有意图，实际仓库仅能证明 Windows 开发预览 ZIP；它不是 self-contained，Tauri/tarball 也不是完整签名安装包。
- 企业级重设计：规格、样例、T0.3 行为门禁、T0.4 母题组件、T0.5 UI primitives、T0.6 Icon 注册、T1.1–T1.5 和 T3.3 已完成；T3.6 真实 Hero 产品截图、其余页面/桌面/架构任务与实体 GPU 性能仍在执行中。

### 明确没有交付

- 真正的通用交互式 Terminal。
- 真正的 Git/SCM 集成。
- 实时多人协作和冲突合并。
- 第三方 Pack 安装、权限、签名、回滚和 marketplace 信任链。
- 已签名的 macOS/Windows 原生安装包和自动更新验证闭环。
- 零外部依赖的内嵌 Node/Tectonic runtime。

## 6. 不可破坏的决策

1. Workspace 是安全和生命周期边界；任何文件操作都必须经 Workspace-relative resolution。
2. Pack 只能贡献能力，不能分叉一套编辑器，也不能获得无限文件/进程权限。
3. 本地文件和本地编译结果是事实来源；AI 输出是 proposal。
4. AI/批量写入必须 preview，再显式 Apply；不能绕过路径、冲突和失败报告。
5. `math-modeling` 的 stages、ledgers、paperctl、submission 只在对应 Pack 中出现。
6. UI 不显示假的 Git branch、在线人数、模型或任务进度。
7. 不删除 `.paperos/`、`app/data/` 或无法证明所有权的 Workspace 数据。
8. 不在没有回归测试时重写 `app/server.mjs` 或 `ide.jsx`；模块化只能小步搬运。
9. `evidenceSha256` 是跨次运行稳定的行为摘要；逐帧 PNG SHA 与报告文件 SHA 负责 point-in-time 完整性。除非新增或重命名内容哈希字段，不要把原始 PNG SHA 混回稳定摘要。
10. 展示站不得虚构客户、机构或默认 Evidence 能力；LogoWall 只能使用中性场景，Evidence 必须服从 Pack capability。

## 7. 当前数据和安全注意事项

`app/data/` 当前包含本地密钥、用户、会话、审计、帖子和用量数据。不要把它当 fixture，不要提交，也不要在验证时复用生产数据。测试应设置隔离的 `PAPER_OS_DATA_DIR`。

关键密钥：

- `app/data/.secret-key` 或 `PAPER_OS_SECRET`：解密 provider key；丢失后旧密文无法恢复。
- `app/data/.signing-key.pem` 或 `PAPER_OS_SIGNING_KEY`：签 release manifest；轮换会改变公钥信任根。

只复制 registry 不是 Workspace 内容备份。external Workspace 的内容仍在用户原路径；备份必须同时覆盖 registry 和真实目录。

## 8. 接下来怎么做

### P0：把当前工作区变成可审阅、可复现的基线

1. 先运行全量验证，记录失败，不凭旧 HANDOFF 判断。
2. 按领域审阅 dirty diff：docs、Workspace/editor、安全/API、web redesign、release artifacts。
3. 修正根/Tauri/desktop/Cargo 的版本漂移。
4. 修正 release manifest：不存在的 macOS/Linux 资产不得标 stable 可下载。
5. 保持 T3.3 的 provider/runtime truth contract；任何新增 runtime 都必须在 API、UI、测试和截图中可区分。
6. 继续审计 T1.5 与其余公开页的产品承诺；T1.4 已删除无来源价格、本机模型推理、同步/协作和企业能力的超前承诺，这些边界不得在后续文案中回退。
7. 形成小而有边界的提交；提交信息遵循仓库 Lore protocol，记录 Tested/Not-tested。

验收：每个提交可独立审阅、测试与回滚；`STATUS.md` 绑定新的 SHA，不再写 `worktree: dirty` 作为发布基线。

### P1：完成视觉重设计的地基和关键路径

按 [`redesign/08-execution-plan.md`](redesign/08-execution-plan.md) 从 P1 继续。T0.2–T0.6、T1.1–T1.5 与 T3.3 已完成；下一严格原子任务为 T3.6。复用已有 public/UI/motif/Icon 组件和真实 Workbench AI 状态，截图不得用示意数据顶替。实体 GPU 性能作为独立未完成项保留，不能被 SwiftShader 采样冒充。每次迭代至少检查 1440×900、1100×720、820×800 和一个手机视口，reduced-motion 必须有静态降级。

验收：build 通过、关键页面无溢出/遮挡、键盘和焦点可用、截图与 `UI-Design/` 参考对照有记录。

### P1：桌面部署和信任链

- 决定并记录 WinForms 与 Tauri 的主入口策略。
- 内嵌/sidecar Node runtime，避免依赖系统 PATH。
- 启用和验证 WebView CSP，明确 loopback origin。
- 落盘日志、单实例、崩溃恢复、窗口状态和可读启动错误。
- launcher 验证 Ed25519 manifest + SHA-256；Windows 再做 Authenticode，macOS 做 notarization。

### P1：模块化但不改语义

先写回归护栏，再按 route/service 拆 `server.mjs`，按 Workspace/editor/preview/assistant/layout 拆 `ide.jsx`。每次只搬运一个边界，禁止一次性重写。

### P2：完成领域契约

- versioned Resource/TextDocument 和持久 WorkspaceSession。
- 通用 EditTransaction：内容版本、transaction ID、hunk review、undo record。
- BuildProfile/BuildJob/ArtifactSet/ToolRuntimeService。
- Workspace ACL、native picker、可撤销 folder capability。
- Pack contribution registry 和第三方 Pack 信任模型。

## 9. 接手后的前 30 分钟

```powershell
git status --short
git log -5 --oneline --decorate
Get-Content -Encoding utf8 CONTEXT.md
Get-Content -Encoding utf8 docs\STATUS.md
Get-Content -Encoding utf8 docs\CAPABILITY_MAP.md
Get-Content -Encoding utf8 docs\redesign\08-execution-plan.md
node --check app/server.mjs
node --test tests/icon-registry.test.mjs
node --test tests/web-public-sections.test.mjs
node --test
npm run build
npm run home-hero-visual-smoke
npm run browser-visual-smoke
```

然后只选择一个边界明确的任务。不要先重排目录、格式化全仓或删除生成物；dirty worktree 中的文件可能是用户资产或尚未归档的实现。

## 10. 交付验证

最低门禁：

```powershell
git diff --check
node --check app/server.mjs
node --test
npm run build
python -m pytest tests/test_paperctl_runtime.py
```

按变更范围追加：

- 后端/安全：对应 `server-*`、`workspace-*`、account/admin/apply tests。
- Web：`npm run web:build` + DOM/visual smoke + 默认 strict 的 `npm run browser-visual-smoke`。
- Desktop IDE：`npm run ide:build` + desktop tests + 两个视口实拍。
- WinForms：`powershell -File .\build-launcher.ps1`。
- Tauri：`cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml` 和 `tauri:build`。
- 发布：`npm run package:win`、SHA-256、Ed25519 独立验签和安装/启动实测。

完整矩阵见 [`TESTING.md`](TESTING.md)。测试结果必须记录日期、SHA、dirty/clean、命令、退出码和未覆盖范围。

本次 2026-08-03 已按上述最低门禁完成：`git diff --check`、server syntax、Node 60/60、Python 25/25、Web+IDE build、Windows 开发预览 ZIP/SHA、API/DOM/visual/timeout 和 desktop two-viewport smoke 均通过。`browser-visual-smoke` 明确 SKIP；WinForms/Tauri 真机、安装包、签名更新链和 macOS/Linux 产物未测。完整原始摘要见 [`STATUS.md`](STATUS.md)。

2026-08-04 较早的增量批次完成 T0.2：专项 motion 测试 6/6、当时全量 Node 66/66、`web:build` 与 `visual-smoke` 通过；`browser-visual-smoke` 在 69.1s 后明确 SKIP。该记录描述修复前状态，保留用于审计。

同日后续 T0.3 批次已取得严格浏览器通过证据：专项 browser/Horizon 测试 10/10、全量 Node 76/76、Python 25/25、`web:build`、`ide:build`、`visual-smoke` 与默认 strict `browser-visual-smoke` 全部通过。证据 JSON 为 schema 2 / `verdict: pass` / `strict: true`，四张截图 SHA-256 已独立复算一致。

2026-08-05 历史批次完成 T0.3 真实 BFCache 复验与 T0.4：motif 11/11、motion 8/8、全量 Node 91/91、Python 25/25、Web 2297 modules、IDE build、visual smoke 与 165.5s strict Edge 门禁均通过。最新 BFCache 是原生 persisted 事件和同一文档 token 证据；T0.4 已独立复审通过。该段记录当时下一顺序为 T0.5，当前 T0.5 收口见上方和 STATUS.md。

2026-08-06 当前批次完成 T0.6：先让 `tests/icon-registry.test.mjs` 在旧实现上得到 Web 注册缺失和桌面 `menu` case 缺失的预期 RED，再补齐两端十个语义。随后将测试强化为 Web/桌面实际 Vite SSR/SVG 渲染、`ICON_NAMES` 注册和未知名称行为断言。最新矩阵为 icon registry 2/2、全量 Node 115/115、Python 25/25、`node --check` 两项、`git diff --check`、Web 2297 modules、IDE build、visual-smoke、生产包精确检索 `NO_KITCHENSINK_IN_PRODUCTION`、Kitchensink 三视口和严格 Edge browser smoke 全部通过。该批次不包含页面级 T1/T3 接入，也不证明实体 GPU、移动真机、桌面壳或签名安装链。

2026-08-07 T1.1 历史批次完成 truth-driven B 路线：聚焦 Hero/shader 10/10、当时全量 Node 125/125、Python 25/25、Web 2298 modules、IDE build、visual-smoke、严格 Edge 与 Home Hero 四视口均通过；当时稳定行为 SHA-256 为 `61d18c1e1eecc118be5020530ee310530754df389c8b365df61c56d005b0f16c`。该段是 T1.1 历史快照，不是当前测试总数或当前报告哈希。

2026-08-07 T1.2 当前批次完成七个公共区块组件与 Home post-Hero 重排：聚焦响应式/可访问性合同 14/14、全量 Node 134/134、Python 25/25、Web 2308 modules、Desktop IDE build、visual smoke 13 keyframes/51 assets、Home 四视口和 strict Edge 均通过。报告记录 workflow columns `5/5/2/1`、visible connectors `4/4/0/4`、caption ratio ≥0.9947、`fullPageScrollY=0`、`browserErrors=[]` 和零横向溢出；稳定行为 SHA-256 为 `d5080b1f2451bf3725d6a497a6973ae2a32553a902841694acbf501e0db9840d`，本次报告文件 SHA-256 为 `7de8da881c40173453e355df642d32d2f4c214158ee3726ecd5a07fc0924f7ca`，视觉复核 92/100、pass。T3.3/T3.6、实体 GPU、移动真机、桌面壳和签名安装链未包含在本结论内。

2026-08-07 T1.3 当前批次完成公共导航收口：40px/41px 阈值、ARIA 当前项、2px 指示、统一下载主 CTA、移动账户可达与既有焦点/断点生命周期均已锁定。聚焦 7/7、全量 Node 141/141、Python 25/25、Web 2308 modules、IDE build、visual smoke、Home 四视口/881px 和 230.8s strict Edge 通过；新增真实合同证明 881px 零溢出/零重叠、820/390 菜单首链接精确获焦和认证态唯一下载主 CTA。稳定行为 SHA-256 为 `117c18b46d45856afebc9447464d33ab94e4506f5e8f2d56f8f6ec1157d4b398`，报告文件 SHA-256 为 `f82f4686e4b854849d23b37f7d16e362f7f947886e78fdbc131f6d02017f0615`，视觉复核 94/100、pass，独立复审 `APPROVED`。

2026-08-10 T1.4 历史批次完成 Features/Pricing/Enterprise 收口：五段产品深挖、真实 Workbench 资产、BYOK/价格待发布、四方案对比、FAQ、六项企业范围和已验证安全边界均已落地；无来源价格、同步/协作、本机模型推理、SSO/RBAC/SLA/私有部署等超前承诺已删除或降为评估/合同状态。独立复审的 Reveal reduced-motion 采样、页面 h1 和 Enterprise 死 CSS 三项已通过 RED→GREEN 关闭。最终矩阵为聚焦 6/6、Node 147/147、Python 25/25、Web 2310 modules、IDE build、13/52 static visual、12 视口 public Edge、Home 回归和 112.6s strict Edge 全绿；稳定行为 SHA-256 `0bf75be0138cc322228586c76be9390ef182f471c2308d048c1585c062d38f5f`，最新报告 SHA-256 `173c0fffeb941bc57d6ec3aecd6d4d0838697bc73215814b7c3b2b2cf5ce4133`，视觉复核 92/100、pass。在该快照时 T1.5/T3.3/T3.6 尚未完成；当前 T1.5/T3.3 已关闭。

2026-08-10 T1.5 历史批次完成 Login/Register 收口：新增共享 AuthPanel 和 password-policy，AuthAside 改为中性 Workspace/Packs/LaTeX/Evidence 叙事，注册补确认密码并保持服务端 owner/member 与 API payload 权威。最终矩阵为聚焦 19/19、Node 155/155、Python 25/25、Web 2312 modules、IDE build、13/52 static visual、8 视口 auth Edge 和 88.8s strict Edge 全绿；稳定行为 SHA-256 `81651dc06e68a9874ab414ed8610babe81094e9edb79687a68c55a2707802df4`，报告 SHA-256 `f0dd5bdf2b5cd71eeb02c895359e7b5953544e9659e75cb8e79fab8608bb7a0e`。详细文件/数据流/续作边界见 `history/2026-08-10-t1-5-auth-pages-handoff.md`。在该快照时下一选择是 T3.3 或 T3.6；当前 T3.3 已关闭，T3.6 是下一严格任务。

2026-08-11 T3.3 当前批次完成 Web Workbench 真实 AI 审查流：provider 配置与回答 runtime 分离，mock-local 明示，真实生命周期 ActionTimeline、BEGIN_FILE preview/diff、Reject/Apply、409 conflict refresh、rollback/preview error 和 workspace 深链均已接入。最终矩阵为 Node 164/164、Python 25/25、Web 2316 modules、IDE build、13/52 static visual 与 strict Edge 全绿；ai-qa 从 77 bytes 变为 197 bytes，Apply trace 为 HTTP 200 且 written:[paper/main.tex]，1440×1200/390×844 均 overflowX:false，reduced-motion 为 none / 0.001ms / 1。三张当前截图 SHA 见 STATUS/TESTING；整体 redesign 仍为 Active，下一严格任务为 T3.6。

上面的 2026-08-03 `SKIP`、60/60，以及 2026-08-04 的 66/66、76/76 都是历史快照，不是当前基线。

边界仍然明确：SwiftShader 的 `drawCallsPerSecond` 不是呈现 FPS；实体中端 GPU 60fps、移动端 ≥30fps、温度/功耗、真机降级阈值以及更广视口的人工视觉对照仍未完成。

## 11. 文档和变更治理

- 当前能力变化：更新 `STATUS.md` 和 `CAPABILITY_MAP.md`。
- 产品承诺变化：更新 `PRODUCT.md`。
- 架构边界变化：新增/替代 ADR，再更新 `ARCHITECTURE.md`。
- 操作变化：更新 `DEVELOPMENT.md`、`TESTING.md` 或 `RUNBOOK.md`。
- 版本可见变化：更新 `CHANGELOG.md`。
- 计划完成：更新 plan front matter、结果提交和验证，不只在 issue 打勾。

追溯规则和矩阵见 [`TRACEABILITY.md`](TRACEABILITY.md)。

## 12. 完成定义

一个任务只有同时满足以下条件才算完成：

1. 行为与产品/架构契约一致，没有把 Pack 语义泄漏到 Kernel。
2. 有与风险匹配的自动化测试，且在当前基线实际运行。
3. build 和受影响 smoke/visual 检查通过。
4. 安全、数据、回滚和兼容风险已说明。
5. 文档状态、能力矩阵、变更日志和 ADR（如需要）已同步。
6. 结果绑定 commit/PR/release；已知未测项明确记录。

## 13. 关键入口

| 需要了解 | 入口 |
| --- | --- |
| 术语和不变量 | [`../CONTEXT.md`](../CONTEXT.md) |
| 当前事实 | [`STATUS.md`](STATUS.md) |
| 产品边界 | [`PRODUCT.md`](PRODUCT.md) |
| 架构和实现映射 | [`ARCHITECTURE.md`](ARCHITECTURE.md) |
| 能力状态 | [`CAPABILITY_MAP.md`](CAPABILITY_MAP.md) |
| 开发 | [`DEVELOPMENT.md`](DEVELOPMENT.md) |
| 测试 | [`TESTING.md`](TESTING.md) |
| 运维 | [`RUNBOOK.md`](RUNBOOK.md) |
| 重设计 | [`redesign/README.md`](redesign/README.md) |
| 追溯 | [`TRACEABILITY.md`](TRACEABILITY.md) |
| 决策 | [`adr/README.md`](adr/README.md) |

