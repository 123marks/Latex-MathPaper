# 05 · 桌面端（exe）规格（Desktop App Spec）

> 目标：把 `PaperOS.exe` 从"能启动的 WebView2 壳"升级为**有原生质感、开箱即用、可安全更新**的桌面应用，
> 并把 144KB 的 `ide.jsx` 拆成可维护模块。

---

## 1. 当前契约（已核实，勿误述）

- 入口：`PaperOS.exe`，由 `launcher/Program.cs`（WinForms + WebView2）构建（`build-launcher.ps1`）。
- 流程：找 `node.exe`（PATH）→ 校验 Node ≥ 20 → 选端口（`PAPER_OS_PORT` → 3719 → 空闲口）→
  若无健康实例则 `node app/server.mjs`（`PAPER_OS_DESKTOP=1`）→ 等 `/api/health` ≤ 20s → WebView2 打开 `http://127.0.0.1:<port>/ide/`。
- 关窗杀掉本进程启动的 server；复用的健康实例不杀（`README.md` §Operations）。
- 打包：`scripts/package-release.mjs`（`npm run package:win`）产出开发预览 zip + `.sha256`；它排除 `app/node_modules`，launcher 依赖系统 .NET 8 Desktop Runtime，当前不是 self-contained portable；`/api/releases` 用 Ed25519 签名清单。
- **Tauri 是 roadmap**（`apps/desktop` 有 tauri devDeps 与 `src-tauri`，但 README/ARCH 明确当前壳是 WinForms/WebView2）。**不得**把 Tauri 说成当前启动方式。

### 1.1 现状缺陷

1. 启动等待期窗口空白（无 splash），首启体验差。
2. 依赖机器已装 Node、.NET 8 Desktop Runtime 和 WebView2，解压后还需安装 `app` 生产依赖；缺失时只有启动失败/错误框，没有完整自愈。
3. 无自定义标题栏/菜单/托盘/深链；就是一个裸 WebView2。
4. 无自动更新；无 Authenticode 签名；launcher 未校验下载包的 Ed25519 签名（当前风险见 [`../STATUS.md`](../STATUS.md)）。
5. `ide.jsx` 单文件 144KB 不可维护。

---

## 2. 原生壳升级（`launcher/Program.cs`）

保持"WinForms + WebView2 + 本地 Node"契约，做以下增强（每项独立、可回退）：

### 2.1 启动 Splash（首要体验项）

- server 启动 + 健康等待期间，先显示一个**无边框 Splash 窗**：深炭底 + `Logo` + Quill 旋转 + "正在启动本地运行时…"。
- `/api/health` 通过后淡出 Splash、淡入主窗（WebView 导航到 `/ide/`）。
- 20s 超时：Splash 转为可读错误 + "重试 / 打开日志 / 反馈" 按钮（而非直接抛异常框）。

### 2.2 依赖自愈引导

- **Node 缺失/过旧**：不再只弹错误框。选项：① 引导下载 Node LTS（打开官网）；② **推荐**：随包内嵌可移植 Node（见 §4.1），launcher 优先用内嵌 Node，PATH 兜底。
- **WebView2 缺失**：检测 Evergreen Runtime；缺失时引导下载 Bootstrapper（或随包携带 Fixed Version Runtime，见 §4.1），给出明确链接与一键。

### 2.3 窗口与系统集成

- 窗口状态持久化（尺寸/位置/最大化，存 `%LOCALAPPDATA%/PaperOS/window.json`）。
- 单实例（Mutex）：再次启动时激活已有窗（避免多个 server）。
- 系统托盘图标：显示/隐藏、状态（运行时端口/健康）、退出。
- 深链 `paperos://`：注册协议（HKCU\Software\Classes），点击 `paperos://open?workspace=...` 激活并路由。
- 原生菜单（可选）：文件/编辑/视图/帮助；或保持 WebView 内菜单栏（`MenuBar` 已有），二选一，避免双菜单。
- 关于/日志：菜单加"打开日志目录"（配合 §5 日志文件）。

### 2.4 标题栏（可选进阶）

- 选项 A（低风险）：保留系统标题栏，`BackColor` 深炭（已有）。
- 选项 B（高质感）：无边框 + WebView 内自绘标题栏（拖拽区 + 最小/最大/关 + Workspace 名），需处理拖拽与双击最大化。
  建议 P5 先做 A，B 作为后续增强（风险/收益权衡后再定）。

---

## 3. 首启 Onboarding（WebView 内，非原生）

首次无 Workspace 时（`WorkspaceChooser` 当前证据见 [`../CAPABILITY_MAP.md`](../CAPABILITY_MAP.md)），做成 3 步引导：

1. **欢迎**：品牌 + 一句话价值 + "本地优先，数据留在本机"。
2. **打开/创建 Workspace**：原生文件夹选择器（见 §3.1）注册现有文件夹，或从 LaTeX/Markdown/数学建模模板创建。
3. **（可选）配置模型 Key**：BYOK 输入（加密存储），或"稍后在账户里配置 / 先离线使用"。
- 完成后进入 Workbench，右下角一次性 tour 气泡（编译按钮、AI 面板、放大镜、命令面板 ⌘K）。
- 全程可跳过；`prefers-reduced-motion` 下无花哨动效。

### 3.1 原生文件夹选择器

当前 Workspace 注册靠手输路径。桌面端应经 WebView2 `host object` 或 launcher IPC 调 Windows 文件夹对话框，
返回绝对路径给前端注册。避免手输错误路径。权限：opaque folder capability（只授权所选目录）。

---

## 4. 零依赖与离线

### 4.1 内嵌运行时（真正开箱即用）

- **内嵌 Node**：随包带 `node-v20-win-x64`（可移植版，~30MB），launcher 优先用它，去掉"机器必须装 Node"。
- **内嵌 Tectonic**：`app/data/engine` 已有引擎目录与 `/api/engine/install/tectonic`。桌面包应预置或首启后台拉取 Tectonic，
  实现真正本地零依赖 LaTeX 编译（`Download.jsx` 文案已承诺"后续内嵌 Tectonic"，兑现它）。
- **内嵌 WebView2 Fixed Runtime**（可选，体积换稳定）：避免用户环境缺 Evergreen。
- 体积权衡：当前开发预览 archive 约 7MB；真正 self-contained portable 预计增至约 100MB。若提供“精简开发版（需外部 runtime）”与“完整 portable（内嵌）”两种资产，下载页和 manifest 必须明确区分。

### 4.2 离线态

- 无网络时：编译/AI（本地模型）仍可用；云同步/社区/市场显示"离线可用"降级态（`04`§状态模型）。
- 明确区分"本地功能"（永远可用）与"云功能"（需登录/联网）。

---

## 5. 日志与诊断

- 当前 server 只写 stdout/stderr，launcher 不落盘（`README.md` §Operations）。桌面端应：
  - launcher 把 server stdout/stderr 重定向到 `%LOCALAPPDATA%/PaperOS/logs/server-<date>.log`（滚动、限量）。
  - 菜单/托盘"打开日志目录"；崩溃/超时对话框附最近日志尾部。
- 不记录敏感信息（密钥、明文内容）。

---

## 6. 打包 · 更新 · 签名

### 6.1 打包（在现有基础上扩展）

- 保持 `package-release.mjs` 开发预览 zip 作为过渡产物；在补齐 Node 依赖与 self-contained .NET runtime 前不得标为 portable。
- 新增 **安装器**：Windows MSI 或 NSIS（写开始菜单/桌面快捷方式、注册 `paperos://`、装 WebView2 依赖检测）。
  可用 `.github/workflows/release.yml` 在 CI 产出；当前仅能证明本地 Windows 开发预览 zip 存在。
- mac/Linux 资产在 workflow/manifest 中有声明，但仓库中不存在对应可验证产物；桌面壳当前仅 Windows。

### 6.2 自动更新

- 客户端启动时查 `/api/releases`（含版本/资产/`signed/signature/publicKey`）比对本地版本。
- 有新版：提示 → 下载 → **校验 SHA-256 + 用 `/api/releases/pubkey` 验 Ed25519 清单签名** → 再安装/替换。
- 校验失败一律拒绝安装并告警。更新流程可回退（保留旧版本目录）。

### 6.3 代码签名

- **Authenticode**（Windows exe/MSI）+ macOS **notarization**，与 Ed25519 清单签名互补。
- 证书与私钥走 CI secrets，绝不入库（`app/data/.signing-key.pem` 已 0600 持久化，勿动）。

---

## 7. `ide.jsx` 模块化拆分（144KB → 模块，架构收口关键）

现状：`apps/desktop/src/ide.jsx` = 单文件，含 1 个 ~2000 行 `IDE()` 巨组件 + 30+ 辅助/子组件（已探明结构）。
目标目录 `apps/desktop/src/ide/`（构建入口仍是 `ide.jsx` 或新 `main`，经 `build-ide.mjs`）：

```
apps/desktop/src/ide/
  IDE.jsx                      # 编排容器（状态 store + 布局），从巨组件瘦身
  state/                       # useWorkspace, useBuffers(已有 text-buffer.mjs), useCompile, useAI, useWorkspaceSession
  layout/                      # Workbench, ActivityBar, StatusBar, PanelGroup, Splitter
  explorer/                    # TreeNode(已有), OutlinePanel(已有), SearchModal(已有), SourceControlPanel(已有)
  editor/                      # MonacoHost, setupLatex(已有), InlineEditBar(已有), tabs, diff
  preview/                     # PdfPreview, MediaPreview, Magnifier(证据反查)
  assistant/                   # AiPanel, ActionTimeline, ApplyDiff, SkillsPanel(已有)
  command/                     # CommandPalette(已有), QuickOpenModal(已有), fuzzyScore(已有)
  chooser/                     # WorkspaceChooser(已有), Onboarding
  lib/                         # parseOutline/parseProblems/parseFileBlocks/mediaKind/monacoLanguage/templateFor(均已有)
  settings/                    # SettingsModal(已有)
```

### 7.1 拆分原则（低风险）

- **搬运不改语义**：先把已有的独立函数/子组件原样移到新文件 + 建 barrel 导出，`ide.jsx` 变薄壳 `import`。
- 每移一块跑 `npm run ide:build` + 相关 `node --test tests/desktop-*.test.mjs`（buffer/ui 用例已有），绿了再移下一块。
- 巨组件 `IDE()` 的状态用自定义 hooks 抽离（`useBuffers` 复用 `text-buffer.mjs`；`useCompile` 包 `/api/editor/compile*`；`useAI` 包 apply-blocks）。
- 保持 CSS：`apps/desktop/src/assets/ide.css`（52KB）同步按区块拆或保留单文件（低风险先保留）。
- 网页版 `web/src/pages/app/Workbench.jsx` 与桌面 IDE 尽量共享纯组件（提到共享包/复制关键组件，二选一在 `06` 定）。

### 7.2 顺序（见 `08` P5）

lib → command → explorer → editor → preview → assistant → chooser → layout → 最后瘦身 `IDE()`。

---

## 8. 落地清单

- [ ] Splash 窗 + 超时可读错误；单实例 Mutex；窗口状态持久化；托盘；`paperos://` 注册。
- [ ] 依赖自愈（内嵌 Node/WebView2 引导）；原生文件夹选择器接 Workspace 注册。
- [ ] Onboarding 3 步 + 一次性 tour；离线降级态。
- [ ] server 日志落盘 + "打开日志目录"。
- [ ] 安装器（MSI/NSIS）+ 自动更新（含 SHA-256 + Ed25519 校验）+ Authenticode 签名（CI）。
- [ ] 内嵌 Tectonic 兑现零依赖编译。
- [ ] `ide.jsx` 按 §7 拆分，每步构建+测试护栏。
- 验证：`build-launcher.ps1` 出 exe；`npm run package:win` 出 zip+sha；`npm run ide:build` 绿；`node --test tests/desktop-*.test.mjs` 绿；真机装包冒烟。
