---
title: Paper OS current status
status: active
as_of: 2026-09-21
branch: main
baseline_commit: 759648b
worktree: dirty
product_version: 0.7.0
---

# Paper OS 当前状态

本页最新一节是 2026-09-21 的桌面 IDE 切片 3（可见 AI Harness）实测快照；HEAD 为 `759648b`（切片 2b PDF / SyncTeX / Live 草稿已提交），工作区 **dirty**（切片 3 尚未提交）。更早的 2026-09-18 / 2026-08 章节是历史快照。它仍不是发布证明：没有 PR、tag 或签名安装包。任何接手者都应先运行本页的基线命令，再相信能力声明。

## 状态口径

| 标记 | 含义 |
| --- | --- |
| **本轮实测** | 2026-08-10 在当前工作区运行命令并取得结果 |
| **源码核对** | 已检查实现和测试，但本轮尚未运行完整验证 |
| **产物存在** | 仓库中存在构建产物，不等于可重复构建或已发布 |
| **未验证** | 只有规格、配置或历史记录，不能作当前交付声明 |

## 基线

| 项目 | 当前事实 |
| --- | --- |
| 产品方向 | 本地优先、Workspace Kernel + Packs 的通用文档 IDE |
| 当前分支/提交 | `main` / `759648b`（切片 1 + 2a + 2b 已提交；其上是 Wave 1–3 与 Windows 自包含打包管线） |
| 工作区 | dirty：切片 3 可见 AI Harness（`apps/desktop/src/{ai-harness,ai-harness-panel}.*`、`ide.jsx`/`ide.css`、`build-ide.mjs` alias `ai-execution`、`app/desktop-ai-harness-smoke.mjs`、`tests/desktop-ai-harness.test.mjs`），以及上一轮遗留的 `findings.md`/`progress.md`/`task_plan.md`（未删除，由用户决定） |
| 两个前端 | 桌面 IDE（`PaperOS.exe` → `/ide/`，源码 `apps/desktop/src/ide.jsx`）与 Web Workbench（`/app/workbench`，源码 `web/src/pages/app/Workbench.jsx`）共用 `app/server.mjs`；桌面已接编译生命周期、pdf.js 预览、SyncTeX、Live 公式草稿与可见 AI Harness；终端/git 状态栏仍未接入桌面 |
| 根版本 | `package.json` 为 `0.7.0` |
| 桌面版本 | 根、Tauri config、desktop package、Cargo 均为 `0.7.0`（2026-08-31 随 0.7.0 发布统一 bump），Web UI 版本号由 Vite `define` 注入单一来源 |
| 当前 Windows 入口 | 根目录 `PaperOS.exe`，WinForms + WebView2 + 本地 Node 服务 |
| Tauri | 已有脚手架和构建产物，但不是 README 声明的稳定主入口 |
| Windows 发布产物 | ZIP 和 `.sha256` 存在；ZIP 排除 `app/node_modules`，launcher 依赖系统 .NET 8 Desktop Runtime，不是 self-contained/零依赖 portable |
| macOS/Linux 发布产物 | `product/releases.json` 有声明，但仓库中对应 DMG/AppImage 不存在 |

## 能力快照

| 能力 | 状态 | 证据 | 当前边界 |
| --- | --- | --- | --- |
| Workspace Kernel 与 Pack catalog | Implemented | `app/lib/workspaces.mjs`、`product/workspace-packs.json`、`tests/workspace-kernel.test.mjs` | 仍有 `contest` 兼容字段 |
| managed Workspace / existing folder / legacy contest | Implemented | Workspace API、desktop chooser、Workspace tests | external registration 尚无 native picker/ACL/relink |
| Workspace 路径安全 | Implemented | canonical containment、walker 边界与专项测试 | symlink swap TOCTOU/hardlink 仍需威胁建模 |
| Pack capability gating | Implemented | `apps/desktop/src/ide.jsx`、desktop UI tests | `math-modeling` 保持兼容 adapter，尚未完全贡献点化 |
| 每 tab 独立 Buffer / Save All | Implemented | `text-buffer.mjs`、buffer tests | 尚无通用 versioned `TextDocument` 服务 |
| stale tree/open response guard | Implemented | `treeRequestRef`、`openRequestRef` | 仅覆盖当前 desktop 请求路径 |
| local auth bootstrap | Implemented | `/api/auth/bootstrap`、desktop boot、auth test | 本地信任模型仍需正式威胁模型和桌面 CSP 收口 |
| Apply blocks 冲突与回滚 | Partial | baseline mtime、409 `APPLY_CONFLICT`、500 `APPLY_ROLLBACK`、transaction test、Web 与桌面 Preview/Reject/Apply | 尚无持久 transaction ID、通用内容版本、用户级 undo/hunk UI |
| LaTeX compile/PDF preview | Partial | compile routes、Tectonic/latexmk、IDE preview、`--synctex` + 编译快照（服务端）；切片 2a：超时/取消/COMPILE_BUSY、done 只在新鲜产物上带 `pdf`；切片 2b：桌面 pdf.js 页码/缩放 + SyncTeX + KaTeX Live 草稿 | 验收用假引擎夹具，不是本机 Tectonic 排版证明；BuildProfile/BuildJob/ArtifactSet 未完成 |
| 桌面 IDE Agent/Render 双模式（切片 1） | Implemented（布局重心，非权限墙） | `apps/desktop/src/ide.jsx` 顶栏 `role="group"` 分段控制 + 状态栏/Assistant 模式标签 + 命令面板两条命令；`localStorage["paperos.workMode"]`；`RenderStage` 诚实空状态；`tests/desktop-work-mode.test.mjs` 9/9；`npm run desktop-mode-visual-smoke` | 编辑器在两模式下都挂载；1240px 以下 Render 折叠为两栏；实时公式草稿、PDF 工具条、SyncTeX 接入属切片 2b；标签页不跨刷新持久化 |
| 桌面编译生命周期（切片 2a） | Implemented | `app/lib/compile-jobs.mjs`（超时 180s、取消、每 Workspace 一任务、输出封顶、`classifyArtifact`）；`POST /api/editor/compile-live` 202 + `compile-cancel` + `compile-status`；桌面 `compile-lifecycle.mjs` 状态机 idle→running→succeeded/failed/timeout/cancelled/no-engine；失败保留上次 PDF 并标过期；`tests/compile-jobs.test.mjs` 10/10、`tests/compile-live-api.test.mjs` 2/2、`tests/desktop-compile-lifecycle.test.mjs` 6/6；`npm run desktop-compile-smoke` | 验收用假引擎夹具（`tests/fixtures/fake-latexmk.mjs`），不是本机 Tectonic 排版证明 |
| 桌面 PDF / SyncTeX / Live 草稿（切片 2b） | Implemented | 桌面 `DesktopPdfPreview`（pdf.js 页码/缩放/版本/过期）；`GET /api/editor/synctex` 正反向，缺失标 `估算` + `SYNCTEX_MISSING`；Render 无 PDF 时 `LiveMathDrafts`（KaTeX esbuild alias，逐公式错误）；`npm run desktop-render-smoke` | 公式草稿不是光标浮层；章节估算在无 SyncTeX 时仍可用且标明「估算」；pdf.js 在主线程读 blob 字节（worker 无法 fetch `blob:`） |
| AI provider 与审查流 | Partial | OpenAI-compatible provider path、账户密钥加密、`/api/chat` runtime metadata、Web `ActionTimeline`、桌面切片 3 `AiHarnessPanel`（真实阶段 Plan、Diff、Apply/Reject、`paperos.aiTrace`） | provider 失败会回退并明确标识 `mock-local`；仍不是本机模型推理，也没有通用 undo/hunk 编辑器 |
| Team/community/admin API | Partial | server routes 与部分测试 | 不是生产级实时协作、队列或多代理编排 |
| Ed25519 发布清单 | Implemented | `app/lib/signer.mjs`、release endpoints、signer/admin tests | 不替代 Authenticode/notarization；launcher 尚未验证更新链 |
| 企业级视觉重设计 | Active implementation | docs/redesign、tokens/motion/Horizon、五个 motif、十四个 UI primitives、两端统一 Icon registry、T1.1–T1.5、T3.3 Web AI 面板、T3.4 放大镜通用化、T3.5 团队/市场/社区/总览；Home/公共页/认证页/Workbench 的响应式、键盘、reduced-motion 和浏览器证据已完成 | `HeroIdeMock` 仍是临时界面示意；T3.6 Workbench 实拍、实体 GPU、移动真机、像素基准、桌面壳与 P0-P6 整体仍未完成 |

更细的能力状态见 [`CAPABILITY_MAP.md`](CAPABILITY_MAP.md)。

## 2026-08-03 验证证据

基线：`main` / `1546dab` / dirty worktree；Windows；Node v24.12.0；Python 3.13.10。

| 命令 | 结果 | 证明范围 |
| --- | --- | --- |
| `git diff --check` | exit 0 | 当前 tracked diff 无空白错误；仅有 Git LF/CRLF 警告 |
| `node --check app/server.mjs` | exit 0 | server 语法可解析 |
| `node --test` | 60/60 pass，0 fail | 全 Node suite，含 partial launcher artifact 回归 |
| `npm run build` | exit 0；Web 2296 modules；IDE bundle 完成 | Web + Desktop IDE production build |
| `npm run package:win` | exit 0；7.0 MB；SHA-256 `3c756d19ec64d4734edec325decbe65fde3575659d86e2de7e3440b3eda4e62b` | Windows 开发预览 ZIP；已核对 START、lockfile、完整 launcher 文件集与 hash；未证明干净机启动 |
| `python -m pytest tests/test_paperctl_runtime.py` | 25/25 pass | math-modeling runtime；有 `.pytest_cache` 权限警告 |
| `npm run smoke` | pass | 应用/API 冒烟 |
| `npm run dom-ui-smoke` | pass | DOM UI 冒烟 |
| `npm run visual-smoke` | pass；13 keyframes，51 assets | Horizon Atelier 源码/产物门禁 |
| `npm run runtime-timeout-smoke` | pass | runtime timeout 失败路径 |
| `node app/desktop-workspace-visual-smoke.mjs` | pass | 1440x900、1100x720；无横向溢出；截图位于 `dist/visual-qa/` |

额外关键路径命令 `node --test tests/desktop-buffer-state.test.mjs tests/desktop-buffer-wiring.test.mjs tests/desktop-workspace-ui.test.mjs tests/editor-apply-transaction.test.mjs` 在同一基线下为 26/26 pass，覆盖 Buffer、Workspace chooser/capability、desktop bootstrap 和 Apply transaction。

`npm run browser-visual-smoke` 退出 0 但明确 **SKIP**：当前环境中的 Edge/Chrome 截图进程无法完成。它不是通过证据；严格浏览器截图、WinForms/Tauri 真机、安装包、平台代码签名、自动更新和 macOS/Linux 产物仍未验证。

完整验证口径见 [`TESTING.md`](TESTING.md)，运行维护见 [`RUNBOOK.md`](RUNBOOK.md)。

## 2026-08-04 增量验证证据

本批次只推进重设计 T0.2，不重写稳定设计输入。专项测试先在旧实现上得到 2 个预期失败，再完成实现并转绿。

| 命令 | 结果 | 证明范围 |
| --- | --- | --- |
| `node --test tests/web-motion.test.mjs` | 6/6 pass | hook SSR 渲染；reduced-motion 静态值且零 RAF/Observer/事件监听；CountUp/InView 首次触发；指针视差按需启动与清理；Reveal/Ambient 接线 |
| `node --test` | 66/66 pass，0 fail | 全 Node suite，包含新增 motion 回归 |
| `npm run web:build` | exit 0；2296 modules | Web production build 与现有 Home/Reveal 调用集成 |
| `npm run visual-smoke` | pass；13 keyframes，51 assets | Horizon Atelier 静态源码/构建门禁 |
| `npm run browser-visual-smoke` | exit 0 但明确 **SKIP**；69.1s | Edge/Chrome 截图进程在当前环境失败；不构成视觉通过证据 |
| `git diff --check` | exit 0 | tracked diff 无空白错误；仅有现有 LF/CRLF 警告 |

本批次没有取得真实浏览器 reduced-motion、帧率、后台/离屏暂停或 WebGL 资源释放的新证据；这些仍属于 T0.3，不能用上述 Node/源码门禁代替。

## 2026-08-04 T0.3 增量验证证据

本批次在 T0.2 之后继续按 `redesign/08-execution-plan.md` 收口 T0.3。先新增 6 个预期失败的回归门禁，再完成 BFCache 生命周期、首次可见启动、默认 strict 和结构化证据链；没有改变 Horizon Atelier 或 Local First / Workspace Kernel + Packs 的稳定方向。

| 命令 | 结果 | 证明范围 |
| --- | --- | --- |
| `node --test tests/browser-visual-smoke.test.mjs` | 10/10 pass | 默认 strict、T0.3 探针覆盖、BFCache/首次可见/teardown 源码护栏、证据元数据契约 |
| `npm run web:build` | exit 0；2296 modules | 最新 Horizon 源码进入 production bundle |
| `npm run browser-visual-smoke` | exit 0；100.3s；Edge `151.0.4129.59`；strict | 1440x1200 真实浏览器中的单 context/canvas、可见/隐藏/离屏/BFCache、慢帧降级、reduced-motion、WebGL fallback、终止销毁与 Workbench 截图 |
| `node --test` | 76/76 pass，0 fail | 全 Node 回归，包含 10 项 browser/Horizon 门禁 |
| `python -m pytest tests/test_paperctl_runtime.py` | 25/25 pass；`.pytest_cache` 权限警告 | math-modeling Pack runtime 未回归 |
| `npm run ide:build` | exit 0 | Desktop IDE bundle |
| `npm run visual-smoke` | pass；13 keyframes，51 assets | Horizon Atelier 静态源码/构建门禁 |

结构化证据位于 `dist/visual-qa/horizon-behavior.json`：schema 2、`verdict: pass`、`strict: true`，记录 Node/OS/Edge/Git、SwiftShader renderer、命令、行为快照和四张截图 SHA-256；四个哈希均已从文件独立复算并一致。隐藏、离屏和 BFCache 暂停样本均为 0 draw delta；BFCache 保留 canvas/context 并恢复绘制；reduced-motion 总计 1 次 draw；终止销毁只调用 1 次 `loseContext` 并移除 canvas。

**性能边界**：证据中的正常样本 `drawCallsPerSecond=6.6` 是禁用 GPU、强制 SwiftShader 时的 `drawArrays` 调用频率，不是浏览器呈现 FPS。T0.3 行为门禁可以标记完成，但实体中端 GPU 60fps、移动端 ≥30fps、温度/功耗和降级阈值仍未验证。

上方同日较早批次的 `browser-visual-smoke SKIP` 是历史失败记录，已被本节后续 strict 通过证据取代；保留它用于说明修复前状态，不再作为当前结论。

## 2026-08-05 T0.3/T0.4 复验证据

本批次先把 T0.3 的 BFCache 证据从合成事件升级为真实同源 `/ → /features → history.back()` 导航，再按顺序完成 T0.4。稳定设计输入、Local First / Workspace Kernel + Packs 和 Horizon Atelier 方向没有改写。

| 命令 | 结果 | 证明范围 |
| --- | --- | --- |
| `node --test tests/web-motifs.test.mjs` | 11/11 pass | 五个 motif 独立 SSR 渲染、真实数据/空态/非法输入、ARIA、唯一 SVG ID、确定 locale 与 CSS 零 warning |
| `node --test tests/web-motion.test.mjs` | 8/8 pass | SSR/hydration 首值一致、浏览器 layout effect 绘制前 reduced-motion、零持久动作与资源清理 |
| `node --test` | 91/91 pass，0 fail | 全 Node 回归；含 browser/CDP、motif、motion 与既有安全/Workspace/desktop 契约 |
| `python -m pytest -p no:cacheprovider tests/test_paperctl_runtime.py` | 25/25 pass，0 warning | math-modeling Pack runtime 未回归 |
| `npm run web:build` | exit 0；2297 modules；无 CSS syntax warning | 最新 motif/motion 进入 production bundle |
| `npm run ide:build` | exit 0 | Desktop IDE bundle 未回归 |
| `npm run visual-smoke` | pass；12 keyframes；51 assets | 静态门禁验证实际使用的 `foilShimmer`/`marchAnts`，不再依赖零引用 `grainShift` |
| `npm run browser-visual-smoke` | exit 0；165.5s；Edge `151.0.4129.59`；strict | 1440x1200 真实浏览器的 Horizon 全状态与四张截图 |

最新 `dist/visual-qa/horizon-behavior.json` 为 schema 2 / `verdict: pass` / `strict: true`。BFCache 的原生 `pagehide.persisted=true` 与 `pageshow.persisted=true` 使用同一文档 token，冻结期 `drawDelta=0`、context/canvas 均保持 1、`loseContext=0`、`notRestored=[]`，返回后继续绘制。reduced-motion 样本 `drawDelta=0`，fallback 无 canvas 且静态背景可见。

T0.4 已由独立只读复审确认无阻塞问题。本段是 T0.4 快照；当时的下一原子任务为 T0.5，当前完成事实与证据见下方 T0.5 收口章节。阶段完成不等于页面级集成完成：Home/Workbench 的大面积接入仍属于后续 T1/T3。

**仍未验证**：实体中端 GPU 60fps、移动端 ≥30fps、温度/功耗、真机降级阈值、多设备像素基准、WinForms/Tauri 真机与签名安装/更新链。SwiftShader 的 `drawCallsPerSecond` 仍不得写成呈现 FPS。

## 2026-08-05 T0.5 UI primitives 收口证据（历史快照）

本批次按 TDD 先为 BackgroundVideo MIME 守卫、固定背景层和 Kitchensink scroll reset 写出 RED，再完成最小实现并转 GREEN。独立复审又发现 production `.mp4` MIME、背景可见层级、Tabs IDREF、Dialog/Meter 空命名和 Drawer 浏览器焦点覆盖缺口；第二轮先得到 5 个预期 RED，再完成最小修复并转为 20/20 GREEN。第三轮复审发现 BackgroundVideo 的自动循环视频忽略 reduced-motion，且 poster 缺少 JPEG MIME；旧实现真实失败为 1 次不应发生的 HEAD 和两个 `application/octet-stream`。修复后 reduced-motion 不探测、不渲染视频，`.jpg/.jpeg` 均返回 `image/jpeg`。最终复审继续发现 motion 偏好只能开启、不能恢复；第四轮 RED→GREEN 让 `false → true → false` 双向切换和 listener cleanup 进入回归。它只推进 UI 词汇层，不改变 Local First / Workspace Kernel + Packs / Horizon Atelier 的稳定方向。

| 命令 | 结果 | 证明范围 |
| --- | --- | --- |
| node --test tests/web-background-video.test.mjs | 7/7 pass | reduced-motion 零视频 HEAD/零 video 渲染；production `.mp4/.jpg/.jpeg` MIME；HTML fallback/失败响应拒绝；video/scrim 可见层级；scroll reset 顺序 |
| node --test tests/web-motion.test.mjs | 9/9 pass | SSR/hydration 首值、绘制前收敛、reduced-motion 双向切换与 listener cleanup、静态值及资源清理 |
| node --test tests/web-ui-primitives.test.mjs | 14/14 pass | 十四个 primitive、Tabs IDREF 完整性、Dialog/Meter 空命名拒绝、selection/dialog helper、CSS parser、DEV 动态路由 |
| node app/kitchensink-visual-smoke.mjs http://127.0.0.1:5174/_kitchensink | exit 0；20.4s | 三视口无溢出/裁切/小控件；browserErrors=[]；Modal 与 Drawer 的初始焦点、Tab 环绕、Escape、焦点恢复均进入行为 JSON |
| npm run web:build | exit 0；2297 modules | Web production build；随后精确检索得到 NO_KITCHENSINK_IN_PRODUCTION |
| npm run ide:build | exit 0 | Desktop IDE bundle 未回归 |
| node --test | 113/113 pass，0 fail | 全 Node 回归，包含 T0.5 与既有安全/Workspace/desktop/browser 契约 |
| python -m pytest -p no:cacheprovider | 25/25 pass | math-modeling Pack runtime 未回归 |
| npm run visual-smoke | pass | Horizon Atelier 静态视觉门禁 |
| npm run browser-visual-smoke | exit 0；89.1s；strict Edge 151.0.4129.59 | 正式首页/Workbench 真实浏览器视觉与 Horizon 状态证据 |

Kitchensink 证据位于 dist/visual-qa/kitchensink-behavior.json、kitchensink-1440x900-viewport.png、kitchensink-1100x720-viewport.png、kitchensink-390x844-viewport.png 及对应全页 PNG。本段历史行为 JSON SHA-256 为 `a9b614f4950dc112d1256d7a2a6e2a99ae439ab73b3d5416036c2a4ac2f5b157`；当前 T0.6 批次已重新生成证据，见下方 2026-08-06 章节。该历史证据证明浏览器布局、键盘、焦点、弹层和反馈状态；不证明实体 GPU 60fps、移动功耗/温度、像素基准、多设备完整矩阵、WinForms/Tauri 真机或签名安装链。

本历史快照的完成定义：T0.5 UI primitives 已完成；当时下一严格原子任务为 T0.6。当前结论见 2026-08-06 T0.6 章节。

## 2026-08-06 T0.6 Icon 注册补全收口证据

本批次按 TDD 先新增 `tests/icon-registry.test.mjs`。旧实现准确得到 Web 缺少 `ICON_NAMES` 和桌面缺少 `menu` case 的预期 RED；最小实现补齐两端十个目标语义，并保留既有 `branch`/`refresh` 兼容别名。独立复审指出桌面正则测试可能假阳性后，测试升级为两端实际 Vite SSR/SVG 渲染、`ICON_NAMES` 注册和未知名称行为断言；强化后的聚焦测试为 2/2。

| 命令 | 结果 | 证明范围 |
| --- | --- | --- |
| `node --test tests/icon-registry.test.mjs` | 2/2 pass，0 fail | Web/桌面十个语义真实 SSR 渲染；Web 未知语义静默空；桌面未知语义圆形 fallback |
| `node --test` | 115/115 pass，0 fail | 全 Node 回归，包含 T0.6 与既有安全/Workspace/desktop/browser 契约 |
| `python -m pytest -p no:cacheprovider` | 25/25 pass | math-modeling Pack runtime 未回归 |
| `npm run web:build` | exit 0；2297 modules | Web production build |
| `npm run ide:build` | exit 0 | Desktop IDE bundle |
| `npm run visual-smoke` | pass；13 keyframes；51 assets | Horizon Atelier 静态视觉门禁 |
| `npm run browser-visual-smoke` | exit 0；strict Edge | 主页/Workbench 无横向溢出；Horizon 全状态行为证据重新生成 |
| `node app/kitchensink-visual-smoke.mjs` | exit 0 | 1440×900、1100×720、390×844；无溢出/裁切/小控件；`browserErrors=[]` |
| `git diff --check`、两项 `node --check` | exit 0 | 补丁空白、server 与 Kitchensink 脚本语法 |
| 生产包精确检索 | `NO_KITCHENSINK_IN_PRODUCTION` | `app/public` 不包含 dev-only Kitchensink 文案 |

最新 Kitchensink 行为 JSON 为 `dist/visual-qa/kitchensink-behavior.json`，SHA-256 为 `05343db351993f966542c041e1e06b60a97615d948125eb302900cb985af15cc`；viewport/full-page PNG 与 report 同步更新。严格 Edge 证据生成 `browser-homepage.png`、`browser-app.png`、reduced-motion 与 WebGL fallback 截图，并在 `horizon-behavior.json` 写入 `verdict: pass`。这些证据证明 T0.6 图标注册和 T0.5 验收面没有回归，不证明实体 GPU FPS、移动真机、像素基准、WinForms/Tauri 真机或签名安装链。

本阶段完成定义：T0.6 Icon registry 已完成；企业级 redesign 仍为 Active，下一严格顺序为 T1/T3 页面级接入。

## 2026-08-07 T1.1 Home Hero truth-driven B 路线收口证据（历史快照）

本批次完成的是 T1.1 的 **B 路线**：用高保真 `HeroIdeMock` 承载首屏产品工作流示意，并显式标注“界面示意”；它不是 Workbench 实拍，也不代表 T3.3 AI 面板已经完成。A 路线的 `web/public/hero-ide.png` 仍归 T3.6，真实 `ActionTimeline` 仍归 T3.3。

为保持产品事实，Hero 删除了“AI 推理都在本机 / 数据不出本机 / 服务器零算力”、未经基准证明的“编译 1–5s / 5 类证据”等承诺。当前指标只使用可核实的 `4 内置 Pack`、`Preview → Apply` 和 `Apache-2.0`；文案明确工作区文件与编译留在本机，而模型请求由用户配置的 OpenAI-compatible provider 处理。`math-modeling Pack` 是真实内置 Pack 名称，不再使用虚构的 `Evidence Pack`。

| 命令 | 结果 | 证明范围 |
| --- | --- | --- |
| `node --test tests/home-hero-evidence.test.mjs tests/web-home-hero.test.mjs tests/web-horizon-palette.test.mjs` | 10/10 pass | 稳定行为哈希、Hero 产品事实、Pack 示意、Header ARIA、880px 单一导航断点、Hero reduced-motion、两套 shader 的有序 `smoothstep` |
| `node --test` | 125/125 pass，0 fail | 全 Node 回归，包含 T1.1 与既有安全、Workspace、desktop、motion、motif、UI primitives 契约 |
| `python -m pytest -p no:cacheprovider` | 25/25 pass | math-modeling Pack runtime 未回归 |
| `npm run web:build` | exit 0；2298 modules | 最新 Home/Header/shader 进入 production bundle |
| `npm run ide:build` | exit 0 | Desktop IDE bundle 未回归 |
| `npm run visual-smoke` | pass；12 keyframes；51 assets | Horizon Atelier 静态源码与产物门禁 |
| `npm run home-hero-visual-smoke` | exit 0；Edge；四视口 | 1440×900、1100×720、820×800、390×844 无溢出/裁切/越界/文案与 mock 重叠；预览首屏可见；导航互斥与 820→1000→820 跨断点状态；锚点、reduced-motion、移动菜单键盘/焦点与浏览器错误门禁 |
| `npm run browser-visual-smoke` | exit 0；strict Edge | 首页/Workbench 与 Horizon 生命周期、降级和 fallback 未回归 |

最新 Home Hero 报告位于 `dist/visual-qa/home-hero-behavior.json`，报告内稳定行为 SHA-256 为 `61d18c1e1eecc118be5020530ee310530754df389c8b365df61c56d005b0f16c`，`browserErrors=[]`；四张对应 PNG 与报告同步生成。稳定行为哈希排除 `generatedAt`、逐帧截图字节/SHA 和小于 0.1px 的采集抖动，重复采集已验证一致；原始 PNG SHA 仍保留在报告中。移动菜单证据还记录打开后跨到 1000px 自动卸载、主导航恢复，缩回 820px 后保持关闭。人工复核了 820×800 与 390×844 关键视口，导航、标题、CTA、可信指标和产品示意无可见重叠或裁切。该证据不证明真实 Workbench 截图、真实 AI 执行 timeline、实体 GPU FPS、移动真机功耗或跨设备像素一致性。

本历史阶段的完成定义：T1.1 的 truth-driven B 路线已完成，项目整体仍为 Active；在该快照时 T1.2 尚未开始。T1.2 的当前完成事实与新证据见下一节，不能再用本节的 `125/125`、2298 modules 或 `61d18c...` 作为当前基线。

## 2026-08-07 T1.2 公共区块组件收口证据（历史快照）

T1.2 已完成七个公共组件：`SectionHead`、`StatRow`、`WorkflowRibbon`、`FeatureCard`、`FAQ`、`LogoWall` 与 `CtaBand`，实现位于 `web/src/components/public/`。Home 已实际接入全部组件，形成六项非等宽能力区、五节点工作流、五维中性对比表、非客户背书式场景墙、四项产品边界 FAQ 和最终 CTA。组件保持原生文档语义：workflow 使用有序列表，`StatRow` 保持 `dt → dd` 顺序，FAQ 使用 `details/summary` 并提供 region landmark；没有引入新依赖、schema renderer 或虚构客户/机构。

本阶段延续 T1.1 的事实边界：`StatRow` 接受真实字符串，不恢复虚假 CountUp；LogoWall 只描述中性使用场景；Evidence 仅在 Pack 明示 capability 时出现；共享 `ui/Table` 继续负责 caption/header 语义。移动端对比 caption 的逐字竖排已通过 full-width block 修复；workflow 连接线增强到 2px，既有响应式合同为 1440/1100/820/390 下可见 connector `4/4/0/4`，其中 820px 是有意的两列 `2+2+1` 重排；全页采集在截图前恢复 `scrollY=0`，不再把固定导航捕获到页面中段。

| 命令/门禁 | 结果 | 证明范围 |
| --- | --- | --- |
| T1.2 响应式/可访问性聚焦合同 | 14/14 pass；条件化 connector 合同 6/6 pass | 七组件、Home 组合、FAQ landmark、窄屏 caption、connector 断点与采集回顶 |
| `node --test` | 134/134 pass，0 fail | 全 Node 回归，包含 T1.1/T1.2 与既有安全、Workspace、desktop、motion、motif、UI primitives 契约 |
| `python -m pytest -p no:cacheprovider` | 25/25 pass | math-modeling Pack runtime 未回归 |
| `npm run build` | exit 0；Web 2308 modules；Desktop IDE bundle 完成 | Web 与 Desktop IDE production build |
| `npm run visual-smoke` | pass；13 keyframes；51 assets | Horizon Atelier 静态源码与构建资产门禁 |
| `npm run home-hero-visual-smoke` | exit 0；Edge；四视口 | workflow `5/5/2/1` 列、connector `4/4/0/4`、caption 宽度比 ≥0.9947、`fullPageScrollY=0`、FAQ 键盘/reduced-motion、零溢出/越界/浏览器错误 |
| `npm run browser-visual-smoke` | exit 0；strict Edge；263s | 首页/Workbench、Horizon 生命周期、降级和 fallback 未回归 |
| 视觉复核 | 92/100，pass | 1440 workflow、390 workflow/caption/FAQ/CTA、820 两列流程与 1100 Hero 首屏露出均人工复核 |

当前结构化报告为 `dist/visual-qa/home-hero-behavior.json`。报告内 `evidenceSha256` 是稳定行为摘要 `d5080b1f2451bf3725d6a497a6973ae2a32553a902841694acbf501e0db9840d`：它有意排除 `generatedAt`、逐帧 PNG 字节/SHA 和亚像素采集抖动，用于跨次运行比较行为。对应这一次报告文件的 point-in-time SHA-256 是 `7de8da881c40173453e355df642d32d2f4c214158ee3726ecd5a07fc0924f7ca`，每张原始 PNG 的 SHA 仍单独保留在报告中。稳定行为哈希与原始产物完整性是两层证据；后续维护者不得把逐帧 PNG SHA 塞回 `evidenceSha256` 后仍称其为稳定行为摘要，如需聚合内容完整性应新增或明确重命名独立字段。

独立代码复审未发现 FAQ、Table、workflow 断点或 smoke 的阻断问题。独立视觉代理因 Windows 图片查看链路故障只能给出元数据保守意见，属于证据访问受限，不是相反的图像判定；可用的内存图像链路已复核其提出的 820 workflow、1100 Hero 露出、390 caption、固定导航和 CTA 风险，最终视觉结论保持 92/pass。

本历史阶段只完成 T1.2；T1.3 事实见下一节。在该 2026-08-07 快照时 T3.3/T3.6 尚未完成；当前 T3.3 完成事实见 2026-08-11 节，T3.6 仍开放。

## 2026-08-07 T1.3 公共导航收口证据（历史快照）

T1.3 只改公共导航边界：`SiteHeader` 在 `scrollY > 40` 后进入 `glass-frost` 收缩态；React Router `NavLink` 继续作为唯一当前路由来源并提供 `aria-current="page"`，CSS 增加 2px 琥珀指示；唯一主按钮统一为真实 `/download` 的“下载桌面端”。登录/免费开始或工作台/退出保持次级，≤880px 时进入现有移动菜单，Icon menu、首焦点、Escape、焦点恢复和 820→1000→820 自动关闭合同未重写。

滚动 effect 只注册一个 passive listener，挂载时同步状态并用同一回调清理；不劫持滚动、不新增 RAF、路由状态或依赖。收缩只动画 transform/颜色/边框/阴影，不动画高度或 padding。reduced-motion 仍保留状态切换，但实测 transition duration 收敛为 `1e-06s`。

| 命令/门禁 | 结果 | 证明范围 |
| --- | --- | --- |
| `node --test tests/web-public-navigation.test.mjs` | 7/7 pass | 原四项导航合同，以及 881px 桌面边界、390px 菜单首焦点、认证态唯一主 CTA 的 smoke 接线 |
| `node --test` | 141/141 pass，0 fail | 全 Node 回归，包含 T1.3 与既有安全、Workspace、desktop、motion、motif、UI primitives、T1.1/T1.2 契约 |
| `python -m pytest -p no:cacheprovider` | 25/25 pass | math-modeling Pack runtime 未回归 |
| Web + IDE build | Web 2308 modules；Desktop IDE bundle 完成 | 公共 Header/CSS 与桌面共享构建边界 |
| `npm run visual-smoke` | pass；13 keyframes；51 assets | Horizon Atelier 静态源码与构建资产门禁 |
| `npm run home-hero-visual-smoke` | exit 0；Edge；四视口 + 881px | 40px/41px 状态、881px 零溢出/零重叠且两侧 gap 均 18px、820/390 打开菜单后首链接精确获焦、Escape/焦点恢复、认证态唯一 `/download` 主 CTA、`browserErrors=[]` |
| `npm run browser-visual-smoke` | exit 0；strict Edge；230.8s | 首页/Workbench 均 `overflowX=false`，Horizon 生命周期、降级和 fallback 未回归 |
| 视觉复核 | 94/100，pass | 1440/1100 桌面层级、881px 密度与 390 品牌/CTA/44px 菜单均无碰撞；记录于 `.omx/state/t1-3-public-navigation/ralph-progress.json` |

当前结构化报告仍为 `dist/visual-qa/home-hero-behavior.json`。稳定行为摘要是 `117c18b46d45856afebc9447464d33ab94e4506f5e8f2d56f8f6ec1157d4b398`；对应本次报告文件 point-in-time SHA-256 是 `f82f4686e4b854849d23b37f7d16e362f7f947886e78fdbc131f6d02017f0615`。T1.2 的 `d5080b...` / `7de8da...` 保留为上一阶段历史快照，不再是当前报告。独立复审最初提出 881px、390px/首焦点和认证态三个证据缺口；补齐真实 Edge 合同后复审为 `APPROVED`，且 881px 实测证明无需增加 CSS 断点或隐藏导航项。

本阶段完成定义：**T1.3 完成，企业级 redesign 继续 Active**。当时下一严格顺序是 T1.4 Features/Pricing/Enterprise，再推进 T1.5 Login/Register；在该历史快照时 T3.3/T3.6 尚未完成。当前 T3.3 已关闭，T3.6 仍开放。

## 2026-08-10 T1.4 公共页面收口证据（历史快照）

本批次完成 Features、Pricing 和 Enterprise 的真实公共页面收口：五段式 Features、带月/年 Segmented 的 Pricing、以及具备安全边界说明与人工联系路径的 Enterprise。页面只使用已实现能力与受控边界，不把 provider、BYOK、SSO、RBAC、SLA 或私有化部署写成未验证承诺。

| 命令/门禁 | 结果 | 证明范围 |
| --- | --- | --- |
| `tests/web-public-pages.test.mjs` | 6/6 pass | Features/Pricing/Enterprise 源码、SSR、语义和受限文案合同 |
| `node --test` | 147/147 pass，0 fail | 全 Node 回归，含 T1.4 及既有安全、Workspace、desktop、motion、motif、UI primitives 契约 |
| `python -m pytest -p no:cacheprovider` | 25/25 pass | math-modeling Pack runtime 未回归 |
| `npm run build` | exit 0；Web 2310 modules；Desktop IDE bundle 完成 | Web 与 Desktop IDE production build |
| `npm run visual-smoke` | pass；13 keyframes；52 assets | Horizon Atelier 静态源码与构建资产门禁 |
| `npm run public-pages-visual-smoke` | exit 0；3 routes x 4 viewports | public-pages 浏览器证据：`browserErrors=[]`、44px 最小触控、`scrollY=0`、零横向/文本/out-of-bounds overflow、yearly + FAQ keyboard、reduced-motion pass |
| `npm run public-pages-visual-smoke` 运行前置 | 需要 Vite `5174` + backend `3719` 同时在线 | Vite 只启动前端会因 `/api` 代理到 `3719` 而返回 `500`/`ECONNREFUSED`，不能把单独 Vite 结果当作通过证据 |

最新 T1.4 结构化证据位于 `dist/visual-qa/public-pages-behavior.json`。稳定行为 SHA-256 为 `0bf75be0138cc322228586c76be9390ef182f471c2308d048c1585c062d38f5f`，最新报告 SHA-256 为 `173c0fffeb941bc57d6ec3aecd6d4d0838697bc73215814b7c3b2b2cf5ce4133`。视觉判定保持 92/100 pass。最终 strict Edge 运行用时 112.6s 并通过。独立复审的 1 个 Important 和 2 个 Minor 问题已通过 RED/GREEN 收口：修正 Reveal 的真实 motion 节点、保证每个 public page 只有一个 `h1`、并让 Enterprise 的 `SectionHead` 样式在实际页面中生效。

本阶段完成定义：**T1.4 完成，企业级 redesign 继续 Active**。在该历史快照时，下一严格原子任务是 T1.5，T3.3/T3.6 尚未完成。当前 T3.3 已关闭，T3.6 仍开放。

## 2026-08-10 T1.5 登录/注册收口证据（历史快照）

T1.5 已完成 Login/Register 的共享认证页收口。AuthPanel 统一承载登录/注册 Segmented、首页入口、错误区、提交状态、Google/GitHub/企业微信开发 OAuth、离线桌面入口和本地文件边界；Login/Register 继续各自持有表单状态、真实 useAuth 调用与重定向语义。AuthAside 已改为通用 Workspace/Packs/LaTeX/Evidence 叙事，并加入 code/PDF 与五步 trace。注册密码策略与服务端对齐为 10–256 位、至少两类字符，新增确认密码；confirmPassword 不进入 API payload。后端认证、session、角色分配和 OAuth 路由均未修改。

| 命令/门禁 | 结果 | 证明范围 |
| --- | --- | --- |
| `node --test tests/web-auth-pages.test.mjs tests/browser-visual-smoke.test.mjs` | 19/19 pass | Segmented/ARIA、共享文案、OAuth/离线入口、密码边界、确认密码、role selector 缺席、CSS 和 smoke 接线 |
| `node --test` | 155/155 pass，0 fail | 全 Node 回归，含 T1.5 与既有 auth/security/Workspace/desktop/public/navigation 契约 |
| `python -m pytest -p no:cacheprovider` | 25/25 pass | math-modeling Pack runtime 未回归 |
| `npm run build` | exit 0；Web 2312 modules；Desktop IDE bundle 完成 | Web 与 Desktop IDE production build |
| `npm run visual-smoke` | pass；13 keyframes；52 assets | Horizon Atelier 静态源码与构建资产门禁 |
| `npm run auth-visual-smoke` | exit 0；2 routes x 4 viewports | 8 个 Edge 视口、44px 最小触控、零横向/文本/越界 overflow、键盘切换、invalid/mismatch/valid 提交状态、reduced-motion 和 browserErrors=[] |
| `npm run browser-visual-smoke` | exit 0；strict Edge；88.8s | Home 与 authenticated Workbench 均 overflowX=false，Horizon 生命周期未回归 |

最新 T1.5 结构化证据位于 `dist/visual-qa/auth-pages-behavior.json`。稳定行为 SHA-256 为 `81651dc06e68a9874ab414ed8610babe81094e9edb79687a68c55a2707802df4`，最新报告文件 SHA-256 为 `f0dd5bdf2b5cd71eeb02c895359e7b5953544e9659e75cb8e79fab8608bb7a0e`。visual verdict 为 92/100、pass，但本地参考 PNG 查看仍受 Windows 图像 helper 启动故障限制，因此不声称完成像素级参考对照；真实浏览器几何、状态和截图产物是本轮权威证据。

本阶段完成定义：**T1.5 完成，企业级 redesign 继续 Active**。在该 2026-08-10 历史快照时，下一选择是 T3.3 或 T3.6；当前 T3.3 已关闭，下一严格任务为 T3.6。实体 GPU、移动真机、像素基准、桌面壳与签名安装链仍未完成。详细 T1.5 记录见 `history/2026-08-10-t1-5-auth-pages-handoff.md`。

## 2026-08-11 T3.3 Web Workbench AI 面板证据（当前）

过去：Workbench 已经能发起聊天和调用 Apply Blocks，但 UI 没有区分“已配置 provider”和“本次回答实际由谁生成”，也没有把 AI 回答变成可审查的执行计划和文件提案。BEGIN_FILE 文本停留在聊天气泡中，用户无法在写入前确认路径、mtime 基线、diff、Reject、冲突或回滚结果；这正是 T3.3 要关闭的信任缺口。

现在：web/src/lib/ai-execution.js 提供 provider 状态归一化、真实生命周期 buildExecutionPlan、跨 chunk SSE 缓冲、BEGIN_FILE 解析、bounded replacement diff 和 baseline Apply 请求。AIAssistantPanel 只负责展示 provider/runtime、ActionTimeline、proposal/diff、Preview → Reject/Apply 及 conflict/rollback/preview-error 状态；Workbench.jsx 继续拥有 workspace、editor 和 mutations，并接入 /api/provider、/api/chat runtime metadata、/api/editor/apply-blocks、409 刷新预览和成功后的 tree/buffer refresh。服务端同时统一 no-store JSON 响应，并在 provider 上游错误时明确发送 PROVIDER_STREAM_ERROR 后使用 mock-local。

关键决策：configured provider 与 response runtime 永远分离；mock-local 是确定性 fallback，不能继承配置模型名，也不能显示为 online。Apply 必须复用 Preview 返回的 path/mtime baseline；Reject 不发写请求；冲突保留提案并禁用陈旧 Apply；rollback 保留提案供检查，但声明没有保留部分写入。移动端 390px 使用文件树 → 编辑器 → AI 面板的垂直工作流，不隐藏核心文件树。

当前证据：node --test 164/164、python -m pytest -p no:cacheprovider 25/25、npm run build exit 0（Web 2316 modules，Desktop IDE bundle）、npm run visual-smoke 13 keyframes/52 assets、npm run browser-visual-smoke strict Edge exit 0。dist/visual-qa/horizon-behavior.json 为 schema 2 / verdict: pass / strict: true；临时 ai-qa Workspace 由 77 bytes 变为 197 bytes，Apply trace HTTP 200 且 written:[paper/main.tex]。1440×1200 与 390×844 均 overflowX:false；reduced-motion 计算样式为 animation-name:none、animation-duration:0.001ms、animation-iteration-count:1。当前截图 SHA-256：ready 69e4b2dcbb605b31c96e1b549807755b195ca17627f1fc82c3266b3f3e9ec3aa，applied f1cde38b737ce9b931842a5c6f113708d84d10b6c9d7ef832df7bfa105e36192，mobile 6c322b746266f42213dd88d85892ae58a79f8f39d67b7f79f0bcef55ddafd850。这仍是 dirty worktree 证据，不是发布基线。

未来：T3.3 现在关闭；下一严格任务是 T3.6 真实 Workbench 产品截图，将已验证的 AI 面板、真实 workspace/file 状态和 PDF/编辑器组合拍成 web/public/hero-ide.png，再做产品截图替换与独立截图审查。不要在 T3.6 中重写 T3.3 的 runtime truth、Preview → Apply 事务边界或把 SwiftShader 采样写成实体 GPU 性能。

## 2026-09-18 阶段 0 基线 + 切片 1 桌面双模式证据（当前）

基线：`main` / `8c62e93` + dirty worktree；Windows 10.0.26200；Node v24.12.0；npm 11.6.2；Python 3.13.10；本机 `latexmk`（TeX Live 2024）在 PATH，`app/data/engine/tectonic.exe` 存在。计划、审查与验收定义见 [`plans/2026-09-18-desktop-ide-dual-mode-plan.md`](plans/2026-09-18-desktop-ide-dual-mode-plan.md)。

### 阶段 0：改动前基线（上一轮遗留的未提交 `ide.jsx`/`ide.css` 已在工作区）

| 命令 | 结果 | 证明范围 |
| --- | --- | --- |
| `node --test` | 270/270 pass，107s | 全 Node suite，没有既有失败可归因 |
| `npm run build` | exit 0；Web 2327 modules；IDE bundle 4.6 MB | 当时 bundle 因遗留的 `../../../web/node_modules/katex` 相对 import 而把 KaTeX 字体打入 `app/ide/` |
| `python -m pytest -p no:cacheprovider tests/test_paperctl_runtime.py` | 25/25 pass，85s | math-modeling Pack runtime |
| `node app/desktop-workspace-visual-smoke.mjs` | OK；1440x900 / 1100x720 | 真实启动 server + 无头 Edge 打开 `/ide/` |

### 切片 1：做了什么

- 先写 `tests/desktop-work-mode.test.mjs`，在遗留实现上得到 7/9 预期 RED，再实现到 9/9。
- 删除遗留的装饰性 `harness ready` chip 和把编辑器整体替换掉的 `LiveMathPreview`（它违反“Render 不是只读”）；移除跨包相对 import。
- 新增 `RenderStage`：Render 模式且屏幕上没有 PDF/媒体时的诚实空状态，显示真实编译目标（`pickCompileTarget`，与 `compile()` 共用）、`/api/engine/status` 探测结果、编译/安装 Tectonic 入口，或“当前 Pack 没有编译预览”说明；隐藏 PDF 时提供恢复入口。
- 顶栏 `role="group"` 分段控制（`aria-pressed`、`aria-label`、`title`，窄窗口只收缩文字标签）；Assistant 头部与状态栏重复显示模式；命令面板新增两条切换命令；`localStorage["paperos.workMode"]` 持久化。
- MenuBar 新增 ≤1100px 紧凑模式：同一份菜单数据折叠进一个 `≡` 下拉（按菜单分节），不丢任何条目。
- 修复两处 smoke 抓出的既有布局缺陷：(1) `.split` 使用 `1fr` 隐含 `min-content` 下限，Monaco 写入自身像素宽度后网格列无法回缩，1280px 下 AI 面板被裁掉 160px——改为 `minmax(0, 1fr)` + 网格项 `min-width: 0`；(2) 标题栏左组子元素在 1024px 下溢出并压住右组——Workspace chip 可收缩、Pack 标签/工作区按钮按断点隐藏。
- 断点按“主区宽度 = 视口 − 侧栏”重算：≤1359 收紧三栏最小值（940px），≤1239 折两栏，≤1100 菜单紧凑，≤920 模式按钮仅图标。

### 切片 1：验证

| 命令 | 结果 | 证明范围 |
| --- | --- | --- |
| `node --test tests/desktop-work-mode.test.mjs` | 9/9 pass（改动前 2/9） | 持久化、可访问分段控制、无假 chip、无相对 import、编辑器不被替换、Render stage 条件、双处模式标签、切换不重置状态、窄窗口收缩 |
| `node --test` | 279 tests：278 pass，1 环境失败 | 失败项 `workspace export streams a verifiable tar.gz backup` 为 `listen EACCES 127.0.0.1:57738`（随机端口落入 Windows 保留段）；单独复跑 1/1 pass，与本次改动无关 |
| `npm run build` | exit 0；Web 2327 modules；IDE bundle 4.4 MB | 去掉相对 import 后 KaTeX 字体不再进入桌面 bundle |
| `npm run desktop-mode-visual-smoke` | OK | 隔离 `PAPER_OS_DATA_DIR`；注册临时 LaTeX 外部文件夹；Monaco 中真实输入使标签变脏；通过 `/api/chat` 完成一次 mock-local 往返（3 条消息）；切到 Render 后 Workspace/标签/脏标记/聊天/首行内容全部不变，`localStorage=render`，Render stage 命名 `main.tex` 并显示“latexmk 就绪（系统 TeX）”；刷新后仍为 Render；切回 Agent 后 stage 消失；Agent/Render × 1440/1280/1024/800 共 8 张截图，`scrollWidth<=innerWidth`，编辑/预览/Assistant 列两两不相交，标题栏 menubar/Workspace chip/Ctrl+K/模式开关/右组两两不相交且不出视口，≤1100 出现紧凑菜单；无 JS 对话框 |
| `node app/desktop-workspace-visual-smoke.mjs` | OK | 既有 Workspace chooser 双视口未回归 |
| `git diff --check`、`node --check app/desktop-mode-visual-smoke.mjs` | exit 0 | 空白与语法 |
| 真实桌面入口 `PaperOS.exe`（`PAPER_OS_PORT=3733`、隔离 `PAPER_OS_DATA_DIR`） | `/api/health` 4.2s 内 200（version 0.7.0）；主窗口标题 `Paper OS`、句柄非零；`/ide/` 200；`CloseMainWindow` 后端口释放，无孤儿 Node | WinForms + WebView2 启动契约仍成立。整屏抓图因包含无关个人窗口已删除，不作为证据 |

证据文件：`dist/visual-qa/desktop-mode-{agent,render}-{1440x900,1280x800,1024x768,800x600}.png` 与 `dist/visual-qa/desktop-mode-behavior.json`（含切换前后/刷新后/恢复后的快照与 8 组几何数据）。人工目视核对了 render 1440/1280/1024/800 与 agent 800：无重叠、无截断。

### 切片 1：未做与边界

- 切片 2b 已补 PDF 工具条、SyncTeX 桌面接入与 KaTeX Live 草稿；可见 AI Harness 仍是切片 3。
- 桌面 IDE 标签页不跨刷新持久化（smoke 依赖 IDE 自身的 `main.tex` 自动打开）。
- 1240px 以下 Render 模式隐藏编辑列（一键切回 Agent 可编辑）；这是折叠优先级，不是能力限制。
- 125%/150% DPI 与 1920x1080 尚未实测（属阶段 6）；Windows 真机窗口尺寸 ≥ `MinimumSize 1100x720`，800px 视口只在浏览器中验证。

## 2026-09-21 切片 2a 编译生命周期证据（当前）

基线：`main` / `fb8fac2` + dirty worktree；Windows 10.0.26200；Node v24.12.0。计划见 [`plans/2026-09-18-desktop-ide-dual-mode-plan.md`](plans/2026-09-18-desktop-ide-dual-mode-plan.md) §1 S2a。

### 做了什么

- 抽出 `app/lib/compile-jobs.mjs`：每 Workspace 一个运行任务、默认 180s 超时（`PAPER_OS_COMPILE_TIMEOUT_MS` 可测）、显式 cancel、输出 1MB 封顶、`classifyArtifact` 只把“任务开始之后写出的 PDF”算作本次产物。
- `POST /api/editor/compile-live` 立即 202；进行中再提交返回 409 `COMPILE_BUSY`；新增 `POST /api/editor/compile-cancel` 与 `GET /api/editor/compile-status`。`done` 只在 `succeeded && pdfFresh` 时带 base64 `pdf`，失败带 `previousPdfPath`。
- 桌面 `apps/desktop/src/compile-lifecycle.mjs` 状态机 idle → running → succeeded / failed / timeout / cancelled / no-engine；编译不再占用共享 `busy`。失败/超时/取消保留上次 blob URL，PDF 头显示「过期」。
- 验收双样本走 `tests/fixtures/fake-latexmk.mjs`（`% PAPEROS_FAKE: success|fail|hang`），不依赖本机 TeX 发行版。`.mjs` 引擎经 `spawnArgsForEngine` 用当前 Node 启动。

### 验证

| 命令 | 结果 | 证明范围 |
| --- | --- | --- |
| `node --test tests/compile-jobs.test.mjs tests/compile-live-api.test.mjs tests/desktop-compile-lifecycle.test.mjs tests/desktop-work-mode.test.mjs tests/desktop-workspace-ui.test.mjs tests/workspace-kernel.test.mjs` | 54/54 pass | 引擎选择、新鲜/过期产物、忙/取消/超时、HTTP 412/409/202、桌面状态机与接线契约 |
| `node --test` | 297/297 pass，150s | 全 Node suite，无回归 |
| `npm run ide:build` | exit 0；IDE bundle 4.4 MB | 桌面包含 `compile-lifecycle.mjs` |
| `npm run desktop-compile-smoke` | OK | 隔离 PATH + 假引擎；成功 `.tex` → 状态「编译成功」+ `pdf-fresh-badge`；改写为失败后再编译 → 状态「编译失败」+ `pdf-stale-badge` 且 PDF 仍在 |
| `git diff --check` | exit 0 | 仅有既有 LF/CRLF 警告 |

证据文件：`dist/visual-qa/desktop-compile-success.png`（109403 B）、`dist/visual-qa/desktop-compile-stale.png`（108601 B）、`dist/visual-qa/desktop-compile-behavior.json`。

### 未做与边界

- 没有用本机 Tectonic 排版真实论文；夹具只证明生命周期与产物诚实，不证明排版质量。
- PDF 工具条 / SyncTeX / Live 草稿已在切片 2b 落地（见下一节）。
- Web Workbench 仍用 30s 回退清 `compiling`；本次未改 Workbench。
- 通用 `BuildJob` / `ArtifactSet` 仍是契约，不是完整作业模型。

## 2026-09-21 切片 2b PDF / SyncTeX / Live 草稿证据（当前）

基线：`main` / `161d052` + dirty worktree；Windows 10.0.26200；Node v24.12.0。计划见 [`plans/2026-09-18-desktop-ide-dual-mode-plan.md`](plans/2026-09-18-desktop-ide-dual-mode-plan.md) §1 S2b。

### 做了什么

- 桌面编译预览从 `<iframe>` 换成 `apps/desktop/src/pdf-preview.jsx`：pdf.js 页码、缩放、版本、过期徽章、隐藏/关闭。`pdf.mjs` 与 worker 复制到 `app/ide/`，`.mjs` 以 `text/javascript` 提供；`connect-src` 允许 `blob:`，主线程把 blob 读成字节再交给 pdf.js（worker 对 `blob:` 会报 response 0）。
- 桌面接既有 `GET /api/editor/synctex`。Ctrl+Alt+J / 同步芯片正向定位；双击 PDF 反向跳行。没有记录时芯片标「估算」，并显示 `SYNCTEX_MISSING`，不假装命中。
- Render 无 PDF 时 `LiveMathDrafts` 作为主体：KaTeX 经 esbuild alias 复用 `web/node_modules`，逐公式渲染，坏公式只标自己。编辑器在 Render 模式保持挂载。
- 假引擎写出可被 pdf.js 打开的最小 PDF；`success-nosync` 专门用来验收缺失降级。

### 验证

| 命令 | 结果 | 证明范围 |
| --- | --- | --- |
| `node --test tests/desktop-math-drafts.test.mjs tests/desktop-render-preview.test.mjs tests/desktop-work-mode.test.mjs tests/fake-compile-artifacts.test.mjs tests/desktop-compile-lifecycle.test.mjs tests/compile-jobs.test.mjs tests/compile-live-api.test.mjs tests/synctex.test.mjs` | 43/43 pass | 公式提取/隔离、SyncTeX 客户端、pdf.js 接线、假 PDF/SyncTeX 夹具、编译生命周期未回归 |
| `node --test` | 308/309 pass；`tests/git-status-api.test.mjs` 在满载下 85s 后读到 `HEAD` 而非 `paper-draft`；单独重跑 1/1 pass（26s） | 全 Node suite；该失败与 2b 无关，是满载下 git 路由超时后的分支名 flake |
| `npm run ide:build` | exit 0；IDE bundle 4.6 MB | KaTeX 打入 bundle；pdf.js 运行时加载 `/ide/pdf.mjs` |
| `npm run desktop-render-smoke` | OK | Live 草稿 1 好 / 1 坏且编辑器仍在；pdf.js `1 / 1` · `110%` · canvas 440px；先 `SYNCTEX_MISSING`+估算，写入 `.synctex` 后芯片变为 SyncTeX |
| `npm run desktop-compile-smoke` | OK | 2a 回归：成功最新 / 失败过期且 PDF 仍在 |
| `git diff --check` | exit 0 | 仅有既有 LF/CRLF 警告 |

证据文件：`dist/visual-qa/desktop-render-drafts.png`（132631 B）、`desktop-render-pdf.png`（129132 B）、`desktop-render-synctex.png`（147682 B）、`desktop-render-behavior.json`。

### 未做与边界

- 没有用本机 Tectonic 排版真实论文；夹具只证明预览、定位与草稿，不证明排版质量。
- Live 草稿是公式列表，不是 Web Workbench 那种光标浮层。
- 桌面 PDF 没有「问 AI」和区域标注（仍属 Web Workbench）。
- 可见 AI Harness 已在切片 3 落地（见下一节）。桌面终端/Git（切片 4）、`.vsix`（切片 5）未做。

## 2026-09-21 切片 3 可见 AI Harness 证据（当前）

基线：`main` / `759648b` + dirty worktree；Windows 10.0.26200；Node v24.12.0。计划见 [`plans/2026-09-18-desktop-ide-dual-mode-plan.md`](plans/2026-09-18-desktop-ide-dual-mode-plan.md) §1 S3。

### 做了什么

- 桌面 Assistant 去掉关键字启发式 `buildExecutionPlan(userText)` 和 Apply 的 `confirm()`。Plan 由 `web/src/lib/ai-execution.js`（esbuild alias `ai-execution`）按 `aiPhase` / SSE `meta.runtime` 推导。
- Context chips：Workspace、Pack、文件、选区、错误。Provider 标签与 `mock-local` / provider runtime 分开显示。
- 流结束后走 `apply-blocks` 预览，统一 Diff + Apply / Reject / Refresh / Cancel。`APPLY_CONFLICT` / `APPLY_ROLLBACK` 显式状态。运行记录写入 `localStorage["paperos.aiTrace"]`（最多 40 条，新的在前）。
- 工作区切换、删除文件、脏标签关闭的 `confirm()` 保留。`apply-blocks` 事务未改。

### 验证

| 命令 | 结果 | 证明范围 |
| --- | --- | --- |
| `node --test tests/desktop-ai-harness.test.mjs tests/desktop-work-mode.test.mjs` | 14/14 pass | 真实阶段机、无关键字启发式、Apply 无 `confirm()`、双模式契约未回归 |
| `node --test` | 313/314 pass；`tests/git-status-api.test.mjs` 满载读到 `HEAD` 而非 `paper-draft`；单独重跑 1/1 pass（26s） | 全 Node suite；该失败与 S3 无关 |
| `npm run ide:build` | exit 0；IDE bundle 4.6 MB | `ai-execution` alias 打入桌面 bundle |
| `npm run desktop-ai-smoke` | OK | chips 为 Workspace/Pack/File；runtime=`mock-local`；Diff 含 Revised note；confirm=0；Apply 后文件含 Revised note；Apply/Diff 在视口内 |
| `npm run desktop-compile-smoke` | OK | 2a 回归：成功最新 / 失败过期且 PDF 仍在 |
| `git diff --check` | exit 0 | 仅有既有 LF/CRLF 警告 |

证据文件：`dist/visual-qa/desktop-ai-ready.png`（121548 B）、`desktop-ai-applied.png`（138270 B）、`desktop-ai-behavior.json`。

### 未做与边界

- 没有配置真实 provider；smoke 验收的是诚实的 `mock-local` 兜底，不是模型推理。
- 不是 hunk 级编辑器，也没有持久 transaction / undo。
- 桌面终端/Git（切片 4）、`.vsix`（切片 5）未做。

## 已知风险

0. **切片 3 未提交**：`ai-harness` 模块、桌面接线、`desktop-ai-smoke`、文档仍在 dirty worktree。
1. **尚无 PR / tag / 签名发布**：重设计、文档、09-integrations Epic 1–4b、文件夹管理与 0.6.0 版本对齐均已在 `1546dab` 之上分组提交，dirty worktree 风险已消除；仍缺少 PR 审阅、git tag 和签名安装包，结果尚未绑定 tag/release。
2. **发布版本治理**：根、Tauri config、desktop package、Cargo 已统一 bump 为 `0.6.0`（2026-08-12），Web UI 版本号改由 Vite `define` 从根 `package.json` 注入；打 tag 仍待执行。
3. **发布声明超前**：Windows ZIP 缺少 Node 生产依赖和 self-contained .NET runtime；macOS/Linux 清单与实际产物不一致；原生代码签名未完成。
4. **桌面部署依赖**：WinForms/Tauri 都启动外部 Node；WinForms 还依赖系统 .NET 8 Desktop Runtime，尚未证明零依赖 sidecar 交付。
5. **桌面 WebView CSP**：Tauri config 当前为 `csp: null`。
6. **单体维护风险**：`app/server.mjs` 和 `apps/desktop/src/ide.jsx` 均超过 3000 行。已开始拆分：纯函数域（用量定价/聚合 `lib/usage.mjs`、BibTeX 解析 `lib/bibtex.mjs`、标注词汇/目标校验 `lib/annotations.mjs`）已抽出并有直接单元测试；路由域拆分待续。
7. **AI 真实性**：T3.3 已在 Web UI、SSE metadata、测试和交接文档中明确 mock-local；后续新增 runtime 或截图仍必须保留这层标识，不能把 configured provider 当作本次回答的事实来源。
8. **权限模型**：Workspace CRUD、外部文件夹注册、team/admin 表面仍需完整 AuthZ/ACL 复审。
9. **密钥生命周期**：密钥文件存在本地数据目录，轮换、迁移、备份和恢复流程尚未自动化验证。
10. **营销表述需持续审计**：T1.4 已修正 Pricing/Enterprise 的 provider、BYOK、SSO/RBAC/SLA 边界，T1.5 已移除认证页 Team First/数学建模专用文案；2026-08-11 又修正 Dashboard/Download/Docs 的“本机模型推理/离线 AI”表述，并新增 `tests/web-ai-locality-truthfulness.test.mjs` 作为跨 `web/src` 的回归护栏。其余公开页与新增功能仍不得把实时协作、同步、本机模型推理或企业合同能力写成已交付事实。

## 当前优先级

| 优先级 | 工作 | 完成判据 |
| --- | --- | --- |
| P0 | 提交切片 3 并进入切片 4（桌面终端 + git 状态栏） | 见 `plans/2026-09-18-desktop-ide-dual-mode-plan.md` §1 |
| P0 | 形成可审阅提交和完整验证基线 | dirty 变更分组审阅；全测试/构建结果绑定 SHA |
| P0 | 修正版本和发布资产一致性 | 单一版本源；清单不声明缺失资产；签名边界明确 |
| P1 | 完成 T3.6 真实 Workbench 产品截图 | 以真实 AI 面板和 Workspace/file 状态拍摄 web/public/hero-ide.png，并通过桌面/移动截图审查 |
| P1 | 桌面信任与部署加固 | CSP、内嵌 runtime、日志、退出/崩溃恢复、签名更新链 |
| P1 | 完成重设计 P0-P1 | T0.3、T0.4、T0.5、T0.6、T1.1–T1.5、T3.3、T3.4、T3.5 已完成；下一严格顺序为 T3.6；项目整体仍为 Active |
| P1 | 模块化 server/IDE | 小步搬运、每步测试护栏，不改变安全语义 |
| P2 | 泛化 EditTransaction/BuildJob | 有版本、冲突、撤销、作业生命周期和 typed artifacts |
| P2 | Workspace ACL/native picker | 外部目录授权可解释、最小权限、可撤销 |
