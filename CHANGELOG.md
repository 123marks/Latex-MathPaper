# Changelog

本项目使用版本化变更记录。日期和状态以仓库证据为准；历史“第几轮”开发记录已归档到 `docs/history/`。

## [Unreleased]

### Added

- 桌面 IDE 切片 2b · PDF / SyncTeX / Live 草稿：编译预览从 `<iframe>` 换成 pdf.js（页码、缩放、版本、过期、隐藏/关闭）；`pdf.mjs` 与 worker 复制到 `/ide/`，`.mjs` 以 `text/javascript` 提供，`connect-src` 允许 `blob:`，主线程把 blob 读成字节（worker 无法 fetch `blob:`）。桌面接既有 `GET /api/editor/synctex`：Ctrl+Alt+J 与同步芯片正向定位，双击 PDF 反向跳行；没有记录时芯片标「估算」并显示 `SYNCTEX_MISSING`。Render 无 PDF 时 `LiveMathDrafts` 用 KaTeX（esbuild alias）逐条渲染公式，坏公式只标自己，编辑器保持挂载。契约测试 `tests/desktop-math-drafts.test.mjs`、`tests/desktop-render-preview.test.mjs`、`tests/fake-compile-artifacts.test.mjs`；真实启动 smoke `npm run desktop-render-smoke`。
- 桌面 IDE 切片 2a · 编译生命周期诚实：`app/lib/compile-jobs.mjs` 管理每 Workspace 一个编译任务（默认 180s 超时、显式取消、1MB 输出封顶）；`POST /api/editor/compile-live` 立即 202，进行中再提交 409 `COMPILE_BUSY`；新增 `POST /api/editor/compile-cancel` 与 `GET /api/editor/compile-status`。`done` 只在任务开始之后写出的 PDF 上带 `pdf`/`pdfFresh`，失败返回 `previousPdfPath` 且不广播旧文件当新产物。桌面 `compile-lifecycle.mjs` 状态机 idle→running→succeeded/failed/timeout/cancelled/no-engine，编译不再占用共享 `busy`；失败保留上次 PDF 并在预览头标「过期」。契约测试 `tests/compile-jobs.test.mjs`、`tests/compile-live-api.test.mjs`、`tests/desktop-compile-lifecycle.test.mjs`；真实启动 smoke `npm run desktop-compile-smoke`（假引擎夹具，成功/失败双样本）。
- 桌面 IDE 切片 1 · Agent/Render 双模式工作台（`apps/desktop/src/ide.jsx`）：顶栏 `role="group"` 分段控制（`aria-pressed`/`aria-label`/`title`，≤920px 只收缩文字标签）；模式是布局重心而非权限墙——Workspace、标签、缓冲、聊天、编译状态全部共享，编辑器在两种模式下都挂载；`localStorage["paperos.workMode"]` 持久化并在刷新后恢复；Assistant 头部与状态栏重复显示模式；命令面板新增「切换到 Agent/Render 模式」。Render 模式无 PDF 时显示诚实空状态 `RenderStage`：真实编译目标（与 `compile()` 共用 `pickCompileTarget`）、`/api/engine/status` 探测结果、编译/安装 Tectonic 入口、无 LaTeX Capability 的 Pack 说明、隐藏 PDF 的恢复入口。契约测试 `tests/desktop-work-mode.test.mjs`，真实启动 smoke `npm run desktop-mode-visual-smoke`（隔离数据目录、Monaco 真实输入、mock-local 聊天往返、刷新持久化、Agent/Render × 1440/1280/1024/800 几何断言与截图）。
- 桌面 IDE 菜单栏紧凑模式：≤1100px 时同一份菜单数据折叠进一个「≡」下拉（按菜单分节），条目与 Capability 门控不变。
- 编辑器谱系调研 `docs/redesign/10-editor-lineage-study.md`：Mimir / latex-stickies / LaTeX Editor / Pine / OverCite / KaoNotes 逐项理解、可迁移项与 Wave 路线、exe 安装包诚实边界。
- Wave 1 迁移（全部真实数据、有测试）：
  - `\cite{` 自动补全（OverCite 思路）：Monaco completion provider，键/作者/年份/标题来自 references 扫描，输入 `{` 或 `,` 触发。
  - 文档大纲面板（Mimir 思路）：活动栏新增大纲，解析 `\part…\paragraph` 层级缩进显示，点击精确跳行。
  - 公式即时预览（latex-stickies 思路）：光标停在 `$…$` / `$$…$$` / `\[…\]` / `\(…\)` / equation·align 系环境内时，编辑器右侧浮出 KaTeX 渲染；语法错误显示红色提示而非空白。
  - 编译成功自动快照 + 回滚（Mimir 思路）：`state/snapshots/` 每文件保留 20 份；PDF 工具栏「◎ 快照」手动存、下拉选择回滚；回滚前自动存「pre-restore」安全快照。`GET/POST /api/editor/snapshots`、`POST /api/editor/snapshots/:id/restore`。
  - 原子写入（latex-stickies 思路）：文件保存/创建/快照均 temp→rename，崩溃不留截断文件；Windows 文件占用时回退就地写入。
- 工作台"去摆设"审计：删除从未使用的 mock 常量（`TABS`/`STAGED`）与死渲染函数（`renderSource`，连带移除 framer-motion 引用）；状态栏**硬编码的 `⎇ main` 假分支**改为真实 `GET /api/editor/git-status`（非仓库如实显示「非 git」，仓库显示分支·脏文件数，20s 轮询）；`● 本地引擎` 改为真实 Tectonic 状态；新增 **`⌖ 证据 N`** 段实时统计当前文件的 `% evidence:` 锚点数（产品初衷：每个结果数字有出处）；未编译时的 PDF 占位从一段虚构论文改为按引擎/文件状态给出的真实引导与三条工作流提示。
- Wave 3 · SyncTeX 正反向（LaTeX Editor 思路）：Tectonic 编译启用 `--synctex`；`lib/synctex.mjs` 解析 `.synctex(.gz)`（Input 标签、页块、box/point 记录、sp→PDF pt 换算）；`GET /api/editor/synctex` 提供 forward（源码文件+行 → 页+坐标，空行取最近后续记录）与 inverse（页+坐标 → 文件+行，纵向优先最近匹配）。工作台 **Ctrl+Alt+J** 把光标行定位到 PDF（琥珀标记线 + 滚动居中），**双击 PDF** 跳到对应源码行；未编译时如实提示 `SYNCTEX_MISSING`。
- Windows 自包含安装包流水线 `npm run package:installer`：launcher 改为 `--self-contained` 发布（内嵌 .NET 8）、捆包官方 Node 22 运行时（下载后对照官方 SHASUMS256 校验、精简）、预装服务端生产依赖、自动生成 Inno Setup 脚本产出 `Setup.exe`（本机无 Inno 时回退为 `-selfcontained.zip`，解压双击即用，109 MB）。launcher 优先使用 `runtime\node`，回退系统 PATH；csproj 版本对齐 0.7.0。真机验证：解压包用捆包 Node 独立跑起服务与 Web UI。未签名，下载页如实标注。
- Wave 2 · AI 输入 `@文件` 引用（Pine 思路）：提示词里写 `@sections/intro.tex`，发送前自动把真实文件内容以代码块附带（最多 6 个、每个 20KB），聊天气泡保留简短 @ 形式；找不到的路径在输出面板如实提示。
- Wave 2 · 描述→公式（latex-stickies 思路）：选中一段自然语言，按 Ctrl+Shift+M 或 PDF 工具栏「∑ 描述→公式」，生成"只输出 `\[…\]` 公式"的请求送入 AI；结果作为可审阅回复出现，不自动插入。
- Wave 2 · 入口文件自动探测（Mimir 思路）：Kernel 不再只认 main/paper.tex，浅层扫描声明 `\documentclass` 的 .tex 作为入口（惯例名优先），`/api/editor/projects` 暴露 `texEntry`；工作台在无恢复标签、无深链时自动打开入口文件——注册已有论文目录即刻可编辑。
- Wave 2 · 集成终端（VS Code 思路，安全优先）：底部面板新增「终端」标签，`POST /api/editor/terminal` 以 SSE 流式回传 stdout/stderr/exit。策略（`lib/terminal.mjs`）：程序白名单（tectonic/latexmk/python/node/git/rg 等）、argv 直传无 shell 解释（引号外的 `| & ; < > \` $` 一律拒绝）、cwd 锁定工作区根、参数禁止 `..`/绝对路径逃逸、120s 超时、512KB 输出上限、可中断、命令历史；每次执行审计留痕。

### Fixed

- 桌面 IDE 网格列不可回缩：`.split` 的 `1fr` 隐含 `min-content` 下限，Monaco 写入自身像素宽度后编辑列无法随窗口变窄收缩，1280px 下 Assistant 面板被裁掉 160px；改为 `minmax(0, 1fr)` 并给网格项 `min-width: 0`（新 smoke 抓出）。
- 桌面 IDE 标题栏 1024px 下左组（菜单/Workspace chip/Ctrl+K）溢出压住右组：Workspace chip 可收缩带省略号，Pack 标签、`工作区` 按钮按断点隐藏，菜单折叠为紧凑模式；断点按“主区宽度 = 视口 − 侧栏”重算（≤1359 三栏收紧、≤1239 折两栏、≤1100 菜单紧凑、≤920 模式按钮仅图标）。

### Removed

- 桌面 IDE 上一轮遗留但未提交的装饰性 `harness ready` 状态 chip（无真实来源）、在 Render 模式下整体替换编辑器的 `LiveMathPreview`（违反“Render 不是只读”）以及 `../../../web/node_modules/katex` 跨包相对 import（KaTeX 字体不再误入桌面 bundle，4.6 MB → 4.4 MB）。实时公式草稿将在切片 2b 以 esbuild alias 方式重新接入。

## [0.7.0] - 2026-08-31

### Added

- 许可证/激活码体系（诚实的付费骨架）：管理员在 `/admin/licenses` 签发 pro/team 激活码（时长×数量、一次性展示+复制、全量台账含兑换人），用户在「账户设置 → 计划与许可」兑换，同计划未到期自动顺延；`publicUser` 暴露 `plan/planExpiresAt`；大小写不敏感、重复兑换 409、未知码 404、member 无签发权限，全部审计留痕。支付渠道对接需真实商户凭据，明确不伪造——渠道外收款后发码。
- 发布构建防逆向卫生：web 产物在既有"无 sourcemap"基础上剥离 console/debugger（`PAPER_OS_DEV=1` 恢复调试形态）。
- 计划容量门控（`lib/plans.mjs` 单一事实来源）：Provider 档案 free 3 / pro·team 10（超限 400 `PLAN_LIMIT` 带升级提示，兑换 Pro 码后即时解锁），AI 会话历史保留 free 200 / pro·team 1000（按用户裁剪，付费纯增量、免费不倒退）；过期计划自动回落 free；定价页同步发布相同数字，ApiKeys 显示 `已用/上限`。
- 支付通道状态骨架（`lib/payments.mjs`）：manual（渠道外收款+激活码）可用；Stripe/微信/支付宝按环境凭据如实报告"未配置"，检测到凭据也明示"结算流程尚未实现"——不伪造网关对接。许可证页新增收款通道状态条与 `GET /api/admin/payments`。
- 编辑器体验批次（真编辑器清单）：左栏工作区全文搜索（按文件分组、点击跳转到精确行）、Ctrl+S 保存（捕获阶段拦截）、脏缓冲关闭保护、标签页会话持久化（先恢复后写入）、文献/标注结果跳行、可拖拽分栏（宽度钳制+持久化）、文件树右键菜单（新建/重命名·移动/删除，目录内新建自动定位）。
- 工作区生命周期与聚合：Dashboard 新建/注册文件夹表单（Pack 来自真实目录）、一键 tar.gz 导出备份（SHA-256 校验头）、来源感知的移除（外部仅解除注册、托管需确认删除、示例受保护）；⌘K 全局聚合搜索（工作区/文件/本人会话/社区帖 + 深链）；会话线程记录所属工作区、复用自动回到原工作区；新建 LaTeX 工作区内置结构化论文骨架（真实经典文献 + 证据示例）。

- pdf.js 渲染层（09-integrations 3c-1/1d）：Workbench PDF 预览由 iframe 换成 pdfjs-dist v6 canvas 渲染（异步分包 gzip 143KB、按需 worker、SSR 安全动态加载），带缩放/页码/多页滚动与可划词文本层；「问 AI（选中文本）」把 PDF 划词内容送入 AI 输入框。
- PDF 区域标注：查看器内拖框选区 → 归一化矩形（0–1）+ 备注写入标注系统（新 `pdf-region` 目标类型，服务端校验/钳制/四位舍入）；标注面板显示 `PDF p.N`，「交给 AI 修改」的组装提示带选区位置描述。
- 已存 `pdf-region` 标注在 PDF 页面上回显为叠加框：按页过滤、百分比定位（缩放无关）、悬停显示备注、resolved 状态转绿。
- arXiv 导入（3d-2）：文献导入入口同时识别 arXiv ID / `arXiv:` 前缀 / abs|pdf 链接，经 arXiv Atom API 生成 `@misc` 条目（无版本号 key 跨版本去重 409，未知 ID 404、离线 502）。

- Dashboard 重做为控制中枢：工作区行卡直接打开、运行时体检（含 Tectonic 与修复提示）、最近 5 条 AI 会话一键复用、7 天用量迷你面板——全部来自真实端点。
- 管理台补齐 mars-admin 式两大能力（真实数据）：服务监控 `GET /api/admin/monitor`（进程 RSS/heap、系统内存/CPU/宿主时长、各数据文件体积、Workspace 数；Windows 无 load average 如实不展示）与在线会话 `GET/DELETE /api/admin/sessions`（仅 token 前缀、强制下线即刻生效、保护当前会话）；审计日志客户端分页（50/页）、Key 概览搜索与「只看已配置」。
- macOS / Linux 便携包：`npm run package:portable` 产出 `PaperOS-<v>-portable-node.tar.gz`（Node 服务 + 构建产物 + start.sh，诚实标注「需要 Node.js 20+ · 非签名原生 App」）；`releases.json` macos/linux 资产指向该文件，下载端点按磁盘存在性与 SHA-256 如实提供。
- About / HowTo 重写为当前产品的真实叙事（IDE 优先六步上手、设计谱系、本地优先声明），配色统一 Horizon amber；`Reveal` 组件支持透传 style。
- AdminUsage 新增「按工作区」排名与「24h 分布」面板、AdminOverview 新增「消耗 Top 工作区」卡（复用既有真实聚合）。

### Fixed

- strict 浏览器冒烟抓到 390px 真回归：应用顶栏右侧（切换器/徽标/头像/用户名/退出）把文档撑到 559px——窄屏现按序收敛（≤700px 隐用户名、≤480px 隐徽标与 ⌘K 文案、切换器限宽），复验 overflowX 桌面/移动均 false；冒烟的溢出诊断改为右超/超宽元素优先排序，截断列表不再被 off-canvas 菜单淹没。

### Changed

- 开始拆分 `app/server.mjs` 单体（STATUS 风险 #6）：纯函数域抽到 `app/lib/`——`usage.mjs`（定价/聚合）、`bibtex.mjs`（BibTeX 解析）、`annotations.mjs`（标注词汇与目标校验），行为零变化并新增直接单元测试。
- 发布清单测试改为动态一致性断言：每个平台的下载端点必须与 `available` 状态一致（真流 + SHA-256 校验头，或诚实的 `ASSET_NOT_READY` 404），不再硬编码平台可用性。

## [0.6.0] - 2026-08-12

### Added

- 企业级文档治理：当前状态、工程交接、开发、测试、运维、追溯和 ADR 索引。
- Horizon Atelier 重设计总览与 `docs/redesign/01`–`08` 规格集。
- 设计令牌、Horizon dynamic background 和 Home hero 三个重设计黄金样例。
- 可复用 motion hooks 及其 SSR、reduced-motion、资源清理回归测试。
- Horizon T0.3 严格浏览器行为探针、结构化环境/renderer 证据和四张截图 SHA-256 记录。
- T0.4 五个可复用母题组件及其 Vite SSR、可访问性、非法输入、唯一 SVG ID 和 CSS 解析门禁。
- 不依赖 Node 全局 `WebSocket` 的 CDP 客户端与真实 back/forward BFCache 事件取证。
- T1.1 Home Hero 四视口浏览器门禁，覆盖产品事实、导航互斥、工作流锚点、reduced-motion、移动菜单键盘/焦点与截图哈希。
- T1.2 七个公共区块组件：`SectionHead`、`StatRow`、`WorkflowRibbon`、`FeatureCard`、`FAQ`、`LogoWall`、`CtaBand`，以及独立 SSR/语义/输入合同。
- T1.3 公共导航合同与 Edge 证据：当前路由、2px 指示、40px/41px 阈值、下载主 CTA、移动账户可达、881px 桌面边界、820/390 首链接焦点/Escape、认证态主 CTA 和 reduced-motion。
- T1.4 Features/Pricing/Enterprise：五段真实产品深挖、真实 Workbench 截图资产、月/年 `Segmented`、四方案 `Table`、BYOK/模型 token 边界、FAQ、六项企业范围与安全架构块。
- T1.4 专用 Edge smoke：三路由 × 四视口截图、键盘年付、FAQ Enter/焦点、Reveal reduced-motion、触控/溢出/越界和稳定行为摘要。
- T1.5 共享 AuthPanel、通用 AuthAside code/PDF/五步 trace、登录/注册 Segmented、离线桌面入口与开发 OAuth 控件。
- T1.5 共享密码策略与专用 Edge smoke：10–256 位、两类字符、确认密码、无效提交禁用，以及两路由 × 四视口、键盘、reduced-motion 和零 overflow 门禁。
- T3.3 Web Workbench AI 审查流：provider/runtime truth、真实 `ActionTimeline`、BEGIN_FILE proposal/diff、Preview → Reject/Apply、409 conflict refresh、rollback/preview-error 状态。
- T3.3 strict Edge 证据：临时 `ai-qa` Workspace 两轮 mock-local 请求、Reject 不落盘、Apply 真实写入、1440×1200/390×844、reduced-motion、请求/响应 trace、截图 SHA-256。
- T3.4 放大镜通用化：去 `sample-contest` 硬编码，改为 `/api/editor/projects` 工作区驱动 + `?workspace=` + `evidence` 能力门控，证据抽屉覆盖 Claim/Result/Script/Dataset/Source 并用 `EvidenceFlow` 连线。
- T3.5 CommunityBoard 最新/热门信息流 + 真实贡献榜、Dashboard 速览卡、Market 详情抽屉（权限按真实 `execute` 推导 + 诚实 MCP 说明）、TeamSpace 7 天真实活动热力；全部仅用真实数据。
- T3.1 AppLayout 顶栏工作区切换（`/api/editor/projects` → 打开 Workbench）与图标化菜单按钮。
- `tests/web-ai-locality-truthfulness.test.mjs`：跨 `web/src` 扫描并阻止“本机模型推理 / 离线 AI / 数据不出本机 / 服务器零算力”表述的回归护栏。
- `app/hero-ide-visual-smoke.mjs`（`npm run hero-visual-smoke`）：T3.6 专用 CDP 采集脚本（有头 GPU），用于在合适环境产出 `web/public/hero-ide.png`。
- 09-integrations Epic 1（可视化标注 → AI 提案，Agentation 思路）：`/api/editor/annotations` CRUD（工作区 `state/annotations.json` 持久化、目标/意图/优先级/状态校验），Workbench 编辑器行范围圈选 → 标注面板（意图/优先级/解决/重开/删除），「交给 AI 修改」把打开的标注组装成结构化修改请求送入既有 Preview → Apply 人审流。
- 09-integrations Epic 2（AI 会话管理，CLI-Manager/codeg 思路）：`GET /api/chat/history` 列表/详情/搜索（真实 `chat.json`，检测 BEGIN_FILE 提案路径，详情剥离 userId）；`/app/sessions` 会话管理页（搜索、提问/回答详情、提案文件块、「在工作台复用」）+ Workbench `?prompt` 预填；Usage 页新增真实 token 输入/输出构成条。
- 09-integrations Epic 3（References Pack，Agentero 思路）：`GET /api/editor/references` 解析工作区真实 `.bib`（平衡大括号 BibTeX 解析器）+ 扫描 `\cite` 系宏输出 citation↔source 双链与 missing 检测；Workbench 可折叠文献面板（条目卡、被引位置直达源文件、缺失引用列表）。
- 09-integrations Epic 4a（多 provider）：`/api/account/providers` 档案新增/激活/删除（Key AES-256-GCM 加密、明文与密文均不回传），生效顺序 激活档案 > 单一配置 > 共享网关；ApiKeys 页档案管理 UI。
- 09-integrations Epic 4b（会话级模型选择）：chat 请求可带 `profileId` 临时指定档案（未知 id 优雅回退激活链），Workbench AI 输入区档案下拉；本地 mock OpenAI 服务端到端验证按请求路由。
- 用量归因：usage 记录新增 `workspace` 字段（chat 由 Workbench 传当前工作区、skill 从 context 读取），聚合输出按工作区 token 排名与 24h 小时桶；Usage 页新增「24h 分布」「按工作区」面板（旧记录如实归入「未标注」）。
- 09-integrations Epic 3d（DOI 导入）：`POST /api/editor/references/import` 接受裸 DOI / doi.org 链接，content negotiation 抓取 BibTeX 并追加进 `.bib`（按条目 key 去重 409；离线/上游失败如实 502/404）；文献面板内置导入框。
- Workbench 文件树全面文件夹管理：真实层级（可折叠缩进）、新建文件/文件夹（嵌套路径）、内联重命名/移动（标签页与活动缓冲区跟随，文件夹子项一并迁移）、确认后删除文件或整个文件夹；服务端新增 `POST /api/editor/folder`。

### Changed

- 交接由累积轮次日志改为“当前事实 + 历史归档 + 下一步”。
- 产品状态声明区分源码存在、本轮实测、产物存在和生产交付。
- `Reveal` 与 `Ambient` 统一使用全站 reduced-motion 门控；旧 Ambient 装饰性 orb 已移除。
- `npm run browser-visual-smoke` 现在默认 strict；显式 optional 入口仅用于非门禁环境探查。
- motion reduced-motion 首值改为 SSR/hydration 确定，并在浏览器 layout effect 阶段于绘制前收敛；CountUp 默认 locale 固定为 `zh-CN`。
- Home Hero 采用 truth-driven B 路线：以明确标注的 `HeroIdeMock` 临时界面示意承载工作流，真实 AI timeline 与 Workbench 截图分别留给 T3.3/T3.6。
- Home Hero 报告新增稳定行为 SHA-256；采集时间、逐帧截图哈希和亚像素抖动不再导致交接文档中的行为证据漂移，原始截图 SHA 仍逐次保留。
- Home 的 post-Hero 叙事改用全部七个公共组件，形成六项能力、五节点 workflow、五维中性比较、非背书场景墙、四项 FAQ 与最终 CTA；不引入 schema renderer、新 barrel 或新依赖。
- Home Edge 门禁扩展到 workflow `5/5/2/1` 列、connector `4/4/0/4`、comparison caption、FAQ 键盘、CTA Reveal、全页回顶与 reduced-motion；稳定行为摘要与原始 PNG/报告文件 SHA 保持双层证据边界。
- 公共 Header 在 `scrollY > 40` 后进入 compact `glass-frost`；`NavLink` 的 `aria-current="page"` 成为唯一当前态来源，主 CTA 统一为 `/download`“下载桌面端”。复审后的 Edge smoke 以真实 881px/390px/认证态合同关闭边界风险，没有增加第二个导航断点或测试专用生产 API。
- Features 改为五段交替叙事；Pricing 删除无来源价格和本机模型推理承诺，公开价格改为待发布；Enterprise 把 SSO、RBAC、SLA、私有部署等能力降为可配置、需评估或合同确认。
- `SectionHead` 支持显式 heading level，Features/Pricing/Enterprise 各输出一个页面级 `h1`，既有 section 默认仍为 `h2`。
- Login/Register 仅共享表单 chrome；真实 useAuth 调用、redirect state 和 API payload 仍由页面持有，confirmPassword 不发送到服务端，owner/member 继续由服务端决定。
- `/api/chat` 在真实 provider 与 mock-local 路径的首个 delta 前发送无密钥 runtime metadata；配置 provider 不再被当作本次回答来源。
- ≤640px Workbench 改为文件树、编辑器、AI 面板的垂直工作流，保留核心文件导航和 proposal 控件。
- 根、Tauri config、desktop package 和 Cargo 版本统一为 `0.5.0`，消除桌面版本漂移。
- 将初始提交之上的整个 dirty worktree 收敛为按领域分组的可审阅本地提交（gitignore 构建产物、docs、web+backend、desktop/release、working-memory 等），STATUS/HANDOFF 基线随之更新为 clean。

### Fixed

- API 错误包装器把 `WorkspaceKernelError` 映射为诚实状态码：未知工作区 404（`WORKSPACE_NOT_FOUND`）、重名 409、非法 id/路径越界 400——修复 tree/file/compile 等路由此前对未知工作区返回笼统 500 的问题。
- 视觉冒烟从已退役的 Aurora fallback 断言切换到当前 Horizon WebGL、reduced-motion、failure fallback 和 App 接线契约。
- Windows 打包在 launcher 文件集不完整时现在会失败，不再生成误导性的 EXE 启动说明。
- 指针视差不再在页面挂载后常驻 RAF，仅在指针输入后按需运行并在稳定或卸载时停止。
- 窄屏 comparison caption 不再逐字竖排；caption 在 Table card reflow 下显式占满可用宽度。
- Workflow 可见 connector 增强到 2px 并使用既有 cool-ink/jade 语义；FAQ 增加 region landmark，未增加额外状态机。
- Home 全页截图在访问 Reveal 区块后恢复 `scrollY=0`，固定导航不再出现在页面中段；820px connector 门禁按既有两列断点条件化，避免错误回归。
- Horizon 在首次 IntersectionObserver 可见结果前不再启动 RAF；隐藏、离屏和迟到回调不能重启动画。
- BFCache `pagehide` 现在暂停并保留 WebGL surface，`pageshow` 恢复；普通离开和 React 卸载才幂等释放资源。
- BFCache 门禁不再用合成 `PageTransitionEvent` 作为通过证据，改为同源导航、原生 persisted 事件、文档 token 与 CDP not-restored 诊断。
- 删除零引用且破坏 CSS 解析的孤立 `will-change`/`grainShift`，视觉冒烟改为验证有真实调用方的 `foilShimmer`/`marchAnts`。
- 删除 Hero 中未经证实的本机 AI/服务器零算力、编译秒数和证据数量承诺；统一 880px 导航断点，补齐移动菜单 ARIA、首焦点、Escape、焦点恢复及跨回桌面断点时的状态清理。
- Hero 入场/滚动视差完整服从 reduced-motion；Horizon/Aurora shader 的 `smoothstep` 边界改为有序表达式，避免未定义行为。
- ≤880px 顶栏不再因新增下载 CTA 挤压账户操作；登录/注册或工作台/退出移入现有移动导航，44px Icon menu、首焦点、Escape、焦点恢复与跨断点关闭保持可用。
- T1.4 reduced-motion smoke 不再采样无动画的内部 article，而是直接测量 Pricing/Enterprise 的 `Reveal` 包装层；Enterprise SectionHead 限宽选择器也已穿过该包装层。
- 注册页在密码策略或确认密码失败时禁用提交，合法匹配后恢复；auth smoke 的离线标题断言按可访问文本包含关系判断，不再误拒绝图标和副说明。
- provider 上游 SSE 现在跨 chunk 缓冲解析，并以 `PROVIDER_STREAM_ERROR` 明确失败边界；JSON API 响应统一 `Cache-Control: no-store`。
- Workbench 深链在生产 bundle 中恢复读取 `?workspace=...`；AI Apply 不再因过期构建产物写入错误 Workspace。
- 390px Workbench 根级横向溢出已关闭；AI diff 保留局部滚动，不再撑宽页面。
- 移除 Dashboard 与 Download/Docs 中“AI 推理在本机 / 数据不出本机 / 用你电脑 CPU 跑 AI 写作”的失真表述，统一为“文件与编译在本机、模型请求按你配置的 provider 处理”。
- TeamSpace 移除硬编码团队库计数（12/5/28/142）与虚构贡献者（Bob/Alice/Miro），改为成员/任务/已审/证据合计与按任务真实统计的贡献榜与 7 天活动热力。

### T0.5 UI primitives

- 新增十四个可复用 UI primitives、共享 selection/dialog helper、dev-only /_kitchensink 和 web-ui-primitives 回归测试。
- 新增 BackgroundVideo MIME/HTML fallback/reduced-motion 回归测试；production server 现在以 `video/mp4` 提供可选视频、以 `image/jpeg` 提供 `.jpg/.jpeg` poster，video/scrim 固定并在不透明 Horizon 上方低透明叠加。
- BackgroundVideo 在 reduced-motion 下不再探测或创建 `autoPlay loop` 视频；共享 motion hook 支持系统偏好双向切换并在卸载时清理 listener。
- Kitchensink smoke 在采集前关闭 smooth scrolling 并等待 scrollY=0，三视口行为与 viewport/full-page 证据写入 dist/visual-qa/；Drawer 的初始焦点、Tab 环绕、Escape 和焦点恢复已纳入真实 Edge 门禁。
- 独立复审后的第二轮 TDD 修复 Tabs `aria-controls` IDREF，并要求 Dialog title 与 Meter label 为非空可访问名称。
- T0.5 已完成，但企业级 redesign 仍为 Active；实体 GPU、移动真机、像素基准和桌面壳验证不属于本阶段。

### T0.6 Icon registry

- Web 与桌面端统一注册 `menu`、`template`、`git-branch`、`sync`、`magnifier`、`evidence`、`mcp`、`play`、`filter`、`export`，并导出两端 `ICON_NAMES`。
- 桌面端保留 `branch`/`refresh` 兼容别名；未知 Web 名称静默返回空，未知桌面名称保留圆形 fallback。
- 新增 `tests/icon-registry.test.mjs`，从源码正则升级为两端实际 Vite SSR/SVG 渲染断言；T0.6 聚焦 2/2、全量 Node 115/115。
- T0.6 已完成；企业级 redesign 仍为 Active，下一严格顺序为 T1/T3 页面级接入。实体 GPU、移动真机、像素基准、桌面壳和签名安装链仍未验证。

### Known limitations

- 变更已在初始提交之上形成按领域分组的本地提交且 worktree 为 clean，但尚未 push、打 tag 或形成签名 release。
- root/desktop/Cargo 版本存在漂移。
- Windows ZIP 缺少 Node 生产依赖和 self-contained .NET runtime，不能称为零依赖 portable。
- macOS/Linux 清单资产尚不存在，不能视为已发布。
- Tauri 仍依赖系统 Node 且 CSP 未启用。
- Horizon 的实体 GPU 呈现 FPS、移动端功耗/温度和降级阈值仍待真机基准；SwiftShader draw-call 采样不构成性能通过。

## [0.5.0] - 2026-07-20

> `product/releases.json` 将本版本标为 stable；仓库当前只能证明 Windows 开发预览 ZIP 存在。该包不含 Node 生产依赖和 self-contained .NET runtime，也不能证明完整跨平台发布。

### Added

- Workspace Kernel、built-in Packs、managed/external/legacy Workspace 入口。
- Windows WebView2 桌面入口、Web 站点、账户/后台和下载表面。
- 用户 provider key 加密存储、Ed25519 release manifest signing。
- Quick Open、Save All、dirty tab、explicit LaTeX compile 和 preview。

### Changed

- 产品从数学建模专用工具收敛为通用文档 IDE；数学建模保留为专业 Pack。
- AI Apply Blocks 增加 baseline mtime、冲突拒绝和写失败回滚。
- Desktop local auth 增加一次性 bootstrap。

### Security

- loopback Host/Origin/WS policy、请求体上限、登录限流和安全响应头。
- Workspace canonical containment、walker 预算和 junction escape 防护。
- 原子 JSON store、AES-256-GCM provider secret、Ed25519 manifest。

### Known limitations

- 无通用 Terminal/Git/实时协作。
- EditTransaction、BuildJob、ArtifactSet 和 Pack contribution contracts 未完整实现。
- 平台原生代码签名、自动更新和 macOS/Linux 安装包未完成。
