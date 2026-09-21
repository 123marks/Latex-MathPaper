# 桌面 IDE 增量开发计划：双模式、Render/LaTeX、AI Harness

Date: 2026-09-18
Status: Complete（阶段 0 完成；切片 S1–S5 已提交 `fb8fac2` / `161d052` / `759648b` / `4cbabb6` / `a725121` / `d79e455`；切片 S6 完成并实测，证据见 `../STATUS.md` 2026-09-21 节；双模式计划到此结束，不发明 S7）
Baseline: `main` / `8c62e93` + 上一轮遗留的未提交 `apps/desktop/src/ide.jsx`、`ide.css`、`docs/README.md` 修改

本计划是 `PRODUCT_SPEC_CURSOR.md` 与 `CURSOR_DEVELOPMENT_BRIEF.md` 的执行分解。它先回答“现在真实是什么”，再给出每个切片的验收。计划本身不证明任何能力已完成；完成事实只写进 `STATUS.md`。

## 0. 阶段 0 结论：基线与源码审查

### 0.1 基线实测（2026-09-18，dirty worktree，Node v24.12.0 / npm 11.6.2 / Python 3.13.10）

| 命令 | 结果 | 说明 |
| --- | --- | --- |
| `node --test` | 270/270 pass，0 fail，107s | 含上一轮未提交的 `ide.jsx` 改动；桌面测试是源码契约（正则）测试 |
| `npm run build` | exit 0；Web 2327 modules；IDE bundle 4.6 MB | esbuild 把 `web/node_modules/katex` 字体一并打入 `app/ide/`（来自上一轮遗留 import） |
| `python -m pytest -p no:cacheprovider tests/test_paperctl_runtime.py` | 25/25 pass，85s | math-modeling Pack runtime |
| `node app/desktop-workspace-visual-smoke.mjs` | OK；1440x900 / 1100x720 无横向溢出 | 真实启动 `app/server.mjs` + 无头 Edge 打开 `/ide/` |
| 本机引擎 | `app/data/engine/tectonic.exe` 存在；系统 `latexmk`（TeX Live 2024）存在 | 阶段 2 可以做真实编译验收 |

没有把已有失败归因到本轮：基线全部通过。

### 0.2 两个前端，一个后端（最关键的结构事实）

| 表面 | 入口 | 状态 |
| --- | --- | --- |
| **桌面 IDE**（`PaperOS.exe` → WebView2 → `http://127.0.0.1:<port>/ide/`） | `apps/desktop/src/ide.jsx`（3529 行单组件）+ `ide.css`（1842 行），`apps/desktop/build-ide.mjs` 用 esbuild 打包到 `app/ide/`，React/Monaco 依赖通过 alias 指向 `web/node_modules` | 是本计划的开发目标 |
| **Web Workbench**（浏览器 `/app/workbench`） | `web/src/pages/app/Workbench.jsx`（84 KB）+ `LaTeXEditor.jsx` + `workbench/AIAssistantPanel.jsx` + `PdfViewer.jsx`（pdf.js） | Wave 1–3（KaTeX 实时公式、编译快照、终端、@file、SyncTeX、真实 git 状态栏）和 T3.3 真实 AI 时间线都只落在这里 |
| **本地服务** | `app/server.mjs`（4253 行）+ `app/lib/*.mjs` | 两个前端共用同一组 API |

结论：桌面 IDE 落后于 Web Workbench。`PRODUCT_SPEC_CURSOR.md` §2 说桌面 IDE 已有“终端”，与源码不符——桌面底部面板只有 PROBLEMS / OUTPUT / TASKS(paperctl) / LaTeX，没有通用终端。后续切片以“把服务端已有能力接到桌面 IDE”为主，不在前端另起编译器或写文件路径。

### 0.3 桌面 IDE 依赖关系

```text
ide.jsx (IDE 组件)
  ├─ 状态：contest(=workspaceId)、contestList、tree、openTabs/active/editor(text-buffer.mjs)、pdfUrl/pdfVer/showPdf、log、chat/aiPlan、engine、provider、view、bottomTab
  ├─ /api/auth/bootstrap + /api/auth/local     本地信任握手
  ├─ /api/editor/projects                       Workspace 目录 + Pack 目录（capabilities 驱动 UI gating）
  ├─ /api/editor/tree|file|raw|search           文件树/读写/媒体/搜索
  ├─ /api/editor/compile-live + WS compile:<id> 编译（start/stdout/stderr/done{code,pdf(base64),pdfPath,snapshotId}/error）
  ├─ /api/engine/status|install/tectonic(SSE)   引擎探测/安装
  ├─ /api/chat (SSE delta)                      AI 对话与 Ctrl+K 行内编辑
  ├─ /api/editor/apply-blocks (preview→apply)   BEGIN_FILE 事务：mtime 基线、409 APPLY_CONFLICT、500 APPLY_ROLLBACK
  ├─ /api/editor/evidence                       Magnifier（仅 evidence Capability）
  └─ /api/run                                   paperctl（仅 paperctl Capability）
服务端已有但桌面未接：/api/editor/terminal(SSE)、/api/editor/synctex、/api/editor/snapshots、/api/editor/git-status、/api/editor/references
```

### 0.4 能力核对（桌面 IDE 视角）

| 能力 | 状态 | 证据 / 缺口 |
| --- | --- | --- |
| Workspace Kernel、Pack、路径安全、chooser | 已实现 | `app/lib/workspaces.mjs`、`WorkspaceChooser`、`workspace-*.test.mjs` |
| 文件树、标签、独立 buffer、脏状态、保存/全部保存、外部修改提示 | 已实现 | `text-buffer.mjs`、`desktop-buffer-*.test.mjs`、mtime 轮询 |
| Monaco 编辑、LaTeX 语法、Quick Open、命令面板、搜索、大纲 | 已实现 | `ide.jsx` |
| LaTeX 编译（Tectonic/latexmk）+ 流式日志 + PDF 内嵌预览 | 部分 | 有：引擎选择、WS 流、`--synctex`、成功后编译快照。缺：`compile-live` 无超时、无取消、无并发保护；失败时 `resolveCompiledPdf` 仍会把旧 `build/*.pdf` 当作 `pdf` 广播，前端无 stale 标记；PDF 用 `<iframe>`，无页码/缩放控件 |
| 源码↔PDF 定位 | 部分 | 桌面只有按 `\section` 估算页码的 `sync-chip`；真实 SyncTeX 服务端已有（`/api/editor/synctex`），桌面未接 |
| 实时公式预览 | 未实现（桌面） | Web 端有 KaTeX 浮层；上一轮未提交代码用相对路径 `../../../web/node_modules/katex` 引入，且在 Render 模式下**用预览替换掉编辑器**，违反“Render 不是只读”约束 |
| Agent/Render 双模式 | 未实现（有半成品） | 上一轮未提交：顶栏 tablist、`localStorage` 持久化、AI 面板/状态栏显示模式；同时引入了装饰性 `harness ready` 假状态 chip |
| AI 对话（流式）、Ctrl+K 行内编辑、Apply Proposal | 部分 | Apply 走 preview→confirm()→apply，有冲突/回滚处理；但 `buildExecutionPlan` 是关键字启发式假计划、无 Diff 视图、无 Reject/Refresh 状态、无 trace 记录、runtime(provider/mock-local) 未在桌面显示 |
| 终端 | 未实现（桌面） | 服务端 `/api/editor/terminal` allowlist/argv-only/SSE 已有并有测试；桌面无入口 |
| Git 基础 | 未实现（桌面） | 服务端 `/api/editor/git-status` 已有；桌面 activity “源代码管理”只列脏 buffer |
| VS Code `.vsix` 兼容层 | 未实现 | 无任何解包/manifest/宿主代码 |
| 响应式 | 部分 | 有 1360/1180/920 断点（上一轮新增），未验证 1024/800 与 125%/150% DPI |

### 0.5 主要风险

1. **单体文件**：`ide.jsx` 单组件 2100+ 行，`server.mjs` 4253 行。任何切片都只能小步追加/抽取纯函数，必须先有源码契约或 e2e 测试护栏。
2. **假状态回流**：上一轮遗留的 `harness ready` chip、关键字启发式 `buildExecutionPlan` 都是“看起来像能力”的装饰；HEAD 提交刚在 Web 端清理过同类问题。桌面必须同样去除。
3. **编译产物真实性**：失败编译可能把旧 PDF 当新产物显示；`compile-live` 无超时与取消。这是阶段 2 的首要修复项。
4. **两前端漂移**：同一功能在 Web 与桌面各写一份。原则：纯逻辑（KaTeX 提取、SSE 解析、diff、执行计划推导）优先复用 `web/src/lib/*.js` 或抽到共享位置并用 esbuild alias 引入，不复制粘贴。
5. **无新增依赖**：KaTeX、pdf.js 已在 `web/package.json`；桌面通过 alias 复用，不改 `apps/desktop/package.json`。
6. **安全边界**：所有写入继续走 `/api/editor/file` 与 `apply-blocks`；终端只接 allowlist 服务端；不在前端拼 shell。
7. **测试形态**：桌面单测是源码正则契约，容易假阳性；每个切片必须配一个真实启动的浏览器 smoke（沿用 `desktop-workspace-visual-smoke.mjs` 的 CDP 方式），并隔离 `PAPER_OS_DATA_DIR`。
8. **文档漂移**：`STATUS.md`/`HANDOFF.md` 基线仍写 `2629f33`，落后 6 个提交；本轮起每个切片同步更新。

## 1. 分阶段计划（每个切片独立可验证）

| 阶段 | 切片 | 内容 | 关键约束 |
| --- | --- | --- | --- |
| 1 | **S1 双模式工作台** | 顶栏 Agent/Render 分段；模式只改布局重心；两模式共享全部状态；AI 面板与状态栏显示模式；`localStorage` 持久化；Render 无 PDF 时显示明确空状态 + 编译入口；窄窗口按钮收缩为图标但保留 `aria-label`/`title`；删除假 chip；移除跨包相对 import | 编辑器在两种模式下都不卸载；不新增依赖 |
| 2 | S2a 编译生命周期 | `compile-live` 加超时/取消/并发保护；`done` 事件区分“新产物”与“旧产物”；前端状态机 idle→running→succeeded/failed/timeout/no-engine；失败保留最近成功 PDF 并标 stale | 复用现有路由，不另起编译器 |
| 2 | S2b PDF 与公式 | PDF 工具条（页码/缩放/关闭恢复/版本号）；接 `/api/editor/synctex` 正反向定位并在缺失时降级；KaTeX 实时公式草稿（标 `Live`，逐公式错误，不崩面板）作为 Render 无 PDF 的主体 | KaTeX 通过 esbuild alias 复用 `web/node_modules` |
| 3 | S3 可见 AI Harness | Context（Workspace/文件/选区/Pack/错误）chips；Plan 由真实流阶段推导（复用 `web/src/lib/ai-execution.js`）；Tools 步骤与耗时；统一 Diff + Apply/Reject/Refresh/Cancel；冲突/回滚显式状态；runtime（provider/mock-local）标识；会话/运行记录写入本地 trace | 替换 `confirm()`，不替换 `apply-blocks` 事务 |
| 4 | S4 终端与 Git 基础 | 底部 TERMINAL tab 接 `/api/editor/terminal`（allowlist、abort、超时、输出上限）；状态栏接 `/api/editor/git-status`；危险命令确认 | 终端为 Capability/策略门控，不伪装完整 shell |
| 5 | S5 VS Code 兼容层基础 | `.vsix` 解包、manifest 校验、安装目录、启用/禁用/卸载/版本；扩展宿主边界与兼容矩阵；不支持 API 明确标注 | 只做第一层（主题/语言/高亮），其余标 planned |
| 6 | S6 UI/性能/交接 | 1920/1440/1280/1024/800 与 125%/150% DPI；键盘路径；长日志/大文件；更新 STATUS/HANDOFF/CAPABILITY_MAP/ADR | 每项有截图或数字证据 |

## 2. 阶段 1（S1 双模式）验收测试

自动化（`tests/desktop-work-mode.test.mjs`，源码契约）：

1. 模式状态从 `localStorage["paperos.workMode"]` 恢复，切换时写回。
2. 两个模式按钮都有 `aria-label` 与 `title`，并使用 `aria-pressed`/`aria-selected` 之一表达当前态。
3. 源码不含 `harness ready`、不含 `../../../web/node_modules` 相对 import。
4. Monaco `<Editor` 不在 `workMode === "render"` 条件分支中被替换（编辑器在两模式下都渲染）。
5. AI 面板头部与状态栏都渲染当前模式标签。
6. Render 空状态（`data-testid="render-stage"`）只在无可显示 PDF 时出现，且含编译入口（LaTeX Capability）或“无预览能力”说明。

真实启动（`app/desktop-mode-visual-smoke.mjs`，隔离 `PAPER_OS_DATA_DIR`，注册临时 LaTeX 文件夹，无头 Edge/Chrome + CDP）：

7. 打开 `/ide/`，等待 Monaco 就绪；在编辑器输入文本使标签变脏；AI 面板追加一条本地消息。
8. 点击 Render：标签数量、脏标记、编辑器内容、AI 消息数量、当前 Workspace 均不变；`render-stage` 可见；`localStorage.paperos.workMode === "render"`。
9. 刷新页面：模式仍为 render（标签内容因刷新重新加载属预期，不作为丢失判据）。
10. 切回 Agent：`render-stage` 消失，编辑器占主列。
11. 视口 1440x900、1280x800、1024x768、800x600：`document.documentElement.scrollWidth <= innerWidth`；模式按钮 `getBoundingClientRect().width > 0`；编辑列、预览列、AI 列两两不相交；截图写入 `dist/visual-qa/desktop-mode-*.png`。

人工：

12. `npm run ide:build` 后 `node app/server.mjs` 启动，浏览器打开 `/ide/` 目视核对四张截图无重叠、文字未截断。

### S1 执行记录（2026-09-18）

- 验收 1–6：`tests/desktop-work-mode.test.mjs` 9/9（改动前 2/9 预期 RED）。
- 验收 7–11：`npm run desktop-mode-visual-smoke` OK；8 张截图与 `desktop-mode-behavior.json` 位于 `dist/visual-qa/`。
- 验收 12：人工目视 render 1440/1280/1024/800 与 agent 800 无重叠截断；`PaperOS.exe` 隔离环境真实启动（健康 4.2s、主窗口、`/ide/` 200、关闭释放端口）。
- 计划外但必要：smoke 抓出两处既有布局缺陷（Monaco 网格列不可回缩；1024px 标题栏溢出），已修复并记入 `CHANGELOG.md`；标题栏折叠新增 ≤1100px 紧凑菜单。
- 全量 `node --test` 279 中 278 pass，1 项 `listen EACCES`（Windows 随机端口保留段）复跑通过。

### S2a 执行记录（2026-09-21）

- 作业管理：`app/lib/compile-jobs.mjs` + `tests/compile-jobs.test.mjs` 10/10。
- HTTP：`tests/compile-live-api.test.mjs` 2/2（412 NO_ENGINE、409 COMPILE_BUSY、cancel、新鲜成功、过期失败、700ms 超时）。
- 桌面状态机：`apps/desktop/src/compile-lifecycle.mjs` + `tests/desktop-compile-lifecycle.test.mjs` 6/6。
- 真实启动：`npm run desktop-compile-smoke` OK；成功样本标「最新」，失败样本保留 PDF 并标「过期」。
- 全量 `node --test` 297/297；`npm run ide:build` 4.4 MB。
- 验收引擎是 `tests/fixtures/fake-latexmk.mjs`，不是本机 Tectonic 排版证明。

### S2b 执行记录（2026-09-21）

- 契约：`tests/desktop-math-drafts.test.mjs`、`tests/desktop-render-preview.test.mjs`、`tests/fake-compile-artifacts.test.mjs` 与既有 compile/SyncTeX 测试合计 43/43。
- 真实启动：`npm run desktop-render-smoke` OK。Render 无 PDF 时 Live 草稿 1 好 / 1 坏且 Monaco 仍在；编译后 pdf.js 工具条 `1 / 1` · `110%` · canvas 440px；无 `.synctex` 时芯片为「估算」+ `SYNCTEX_MISSING`；写入记录后芯片变为 SyncTeX。
- 回归：`npm run desktop-compile-smoke` OK；`npm run ide:build` 4.6 MB。
- 全量 `node --test` 308/309：`git-status-api` 满载 flake（`HEAD` vs `paper-draft`），单独重跑通过。
- 计划外但必要：`.mjs` 曾被当成 `application/octet-stream`；`connect-src` 缺 `blob:` 导致 fetch(blob) 失败；pdf.js worker 无法拉取 blob URL，改为主线程读字节。
- 连续第二次编译曾在无头 Chrome 里把整页卸掉；smoke 改为在第一次成功 PDF 上写入 `.synctex` 验收正向命中，而不是连编两次。

### S3 执行记录（2026-09-21）

- 契约：`tests/desktop-ai-harness.test.mjs` 5/5；Plan 来自 `buildExecutionPlan({phase,runtime})`，源码不再有关键字启发式或 Apply 的 `confirm()`。
- 真实启动：`npm run desktop-ai-smoke` OK。Context chips 为 Workspace / Pack / File / Selection / Errors；SSE runtime=`mock-local`；unified Diff 含 `Revised note`；`window.confirm` 计数 0；Apply 后文件含 `Revised note`，trace 为 applied。
- 回归：`npm run desktop-compile-smoke` OK；`npm run ide:build` 4.6 MB。
- 全量 `node --test` 313/314：`git-status-api` 满载 flake（`HEAD` vs `paper-draft`），单独重跑 1/1。
- 计划外但必要：审查区曾被 Plan 长文挤出可视区，无头点击 Apply 落空；改为单行 Plan、提案滚入视野、Apply/Diff 必须在视口内。

### S4 执行记录（2026-09-21）

- 契约：`tests/desktop-terminal-git.test.mjs` + workspace-ui / work-mode 合计 28/28。Pack 仍不声明 `terminal` Capability。
- 真实启动：`npm run desktop-term-smoke` OK。先「非 git」；`node -e` 打出 `TERM_OK` 且 confirm=0；`rm -rf .` 报不在允许列表；`git init` 后芯片为 `paper-os-term`；`git reset --hard` confirm=1 且未执行。
- 回归：`npm run desktop-compile-smoke` OK；`npm run ide:build` 4.6 MB。
- 全量 `node --test` 319/319。

### S5 执行记录（2026-09-21）

- 契约：`tests/extensions.test.mjs` + `tests/extensions-api.test.mjs` + `tests/desktop-extensions.test.mjs` 与邻近桌面契约合计 35/35。越界/符号链接拒绝；`main` 存在但不执行；`DEFAULT_SKILLS` 已删除。
- 真实启动：`npm run desktop-vsix-smoke` OK。夹具 `Paper OS Theme+Language Fixture` 可见；无 Paper Excellence；文案为第一层主题色+语言 id；兼容矩阵含 supported/planned/unsupported；禁用后卸载到空列表。
- 回归：`npm run desktop-compile-smoke` OK；`npm run ide:build` 4.7 MB。
- 全量 `node --test` 325/326：`git-status-api` 满载 flake（`isRepo` 超时降级），单独重跑 1/1。

### S6 执行记录（2026-09-21）

- 契约：`tests/desktop-ui-budget.test.mjs` 4/4。cap 截断、2MB 门与 `FILE_TOO_LARGE` 对齐、键盘接线、1920+DPI、800 非原生窗口。
- 真实启动：`npm run desktop-ui-smoke` OK。五视口与 DPI 1.25/1.5 均 `overflowX:false`；Ctrl+Alt+M agent→render；Quick Open `huge.txt`（2 097 153 B）走 oversized 面板，API 413 `FILE_TOO_LARGE`。证据 `evidence:"cdp-css-pixel"`（ADR-0006）。
- 回归：`npm run desktop-compile-smoke` OK；`npm run ide:build` 4.7 MB。
- 全量 `node --test` 329/330：`git-status-api` 满载 flake（`isRepo` 超时降级），单独重跑 1/1（78s）。
- 计划到此结束。不要发明 S7。

## 3. 不做与假设

- 不在 S1 引入公式渲染、PDF 工具条、终端、Git；它们各有独立切片与验收。
- 不删除上一轮遗留的 `findings.md`、`progress.md`、`task_plan.md`（属于上一轮文档任务的工作记忆，删除与否由用户决定）。
- 桌面 IDE 是 `PaperOS.exe` 的真实入口；Web Workbench 保留现状，不把两者合并为一个前端。
