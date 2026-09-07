# 10 · 编辑器谱系调研与迁移路线（Mimir / latex-stickies / LaTeX Editor / Pine / OverCite / KaoNotes）

> 状态：调研完成，迁移按 Wave 推进。每条"迁移"都必须走真实数据、有测试、进 CHANGELOG。
> 调研日期：2026-09-07。来源：官网/README 直接抓取 + 用户提供的公众号截图（LaTeX 工作室 / texhub）。

## 1. 逐项目理解

### 1.1 Mimir（smartlarkai）— "一站式科研工作台"
九视图同项目流转：LaTeX Studio（大纲/源码/PDF 三栏、编译成功自动快照回滚）、arXiv Library（订阅+AI 打分+Zotero）、实验追踪、图表归纳、组会 PPT、GPU 编排、项目导入、记录与进展报告、会议 DDL。技术：dsh 插件、SSE 实时推送。
**可迁移（高价值、低依赖）**：
- **编译成功自动快照 + 回滚**：我们已有事务化 Apply 与 mtime 基线，缺"编译成功即存快照"。→ Wave 1
- **大纲视图**：解析 `\section/\subsection` 生成可点击大纲，跳行。→ Wave 1
- **本地 LaTeX 工程一键导入**：我们的"注册文件夹"已覆盖 80%，补"自动识别入口文件"。→ Wave 2
- **会议 DDL / GPU / PPT / Zotero**：超出本产品边界或需外网/凭据，不做。

### 1.2 latex-stickies（kev-nj）— "边写边渲染的桌面便签"
KaTeX 即时渲染（光标进入还原源码，无编辑/预览模式切换）、Markdown+数学混排、代码块高亮+复制、**右键公式复制为图片/复制 LaTeX**、**自然语言→LaTeX（Cmd+Shift+M，本地 Ollama）**、幽灵补全（Tab 接受）、原子保存（temp→fsync→rename）、单实例、严格 CSP（`default-src 'none'`，本地打包不走 CDN）。
**可迁移**：
- **公式即时预览**：光标停在 `$…$`/`\[…\]`/equation 环境内时，编辑器旁弹出 KaTeX 渲染浮层。→ Wave 1（最直观的"编辑器像不像"）
- **原子保存**：服务端文件写入改为 temp→rename，防崩溃截断。→ Wave 1（工程质量，零 UI）
- **自然语言→公式**：走我们已有的 provider（不是 Ollama），选中描述文字→AI 生成 LaTeX 公式→Preview。→ Wave 2
- **公式复制为图片**：KaTeX 渲染→canvas→clipboard。→ Wave 2

### 1.3 LaTeX Editor（公众号截图，GitHub 开源，Windows）
Ctrl+K 命令面板、Tectonic 内置、SyncTeX 正反向、内置 Git、Bib 管理、自动补全、快照。
**可迁移**：SyncTeX 正反向（我们的编译已带 `-synctex=1` 参数，未消费 `.synctex.gz`）。→ Wave 3（需解析 synctex 格式）

### 1.4 Pine（Codex CLI 驱动的 LaTeX 编辑器，本地 http://127.0.0.1:3000）
本地优先、`@` 引用文件、AI Suggest/Plan/Apply 三态、diff 预览。与我们的 Preview→Apply 同构，**已覆盖**；差异是"@文件引用"。→ Wave 2 小项

### 1.5 OverCite（VS Code 插件）
`\cite{` 内的补全、hover 显示文献信息、从 Zotero/Wandeley 导入。
**可迁移**：**`\cite{` 自动补全**——我们的 references API 已有全部 key/title/author，接入 Monaco `registerCompletionItemProvider` 即可。→ Wave 1（最省力的高感知项）

### 1.6 KaoNotes（多语言宽边注释学术笔记模板）
是 LaTeX 模板而非编辑器。可作为 latex pack 的**第二个模板选项**（笔记类）。→ Wave 3

### 1.7 VS Code 结构（用户明示参考）
活动栏/侧栏/标签页/面包屑/编辑器/底部面板/状态栏/命令面板——**已全部就位**（v0.7.0 + `202a279`）。缺：**集成终端**（在工作区目录里跑命令）。→ Wave 2（服务端已有 `/api/editor/run` 白名单执行，需要扩展为通用命令 + 输出流；安全边界：仅 loopback、仅工作区 cwd、命令白名单/超时）。

## 2. 迁移路线

| Wave | 项 | 来源 | 依赖 | 状态 |
|---|---|---|---|---|
| 1 | `\cite{` 自动补全（Monaco completion provider，数据来自 references API） | OverCite | 无 | ✅ 2026-09-07 |
| 1 | 文档大纲面板（section 树，点击跳行） | Mimir | 无 | ✅ 2026-09-07 |
| 1 | 公式即时预览（KaTeX 浮层，光标在数学环境内触发） | latex-stickies | katex 依赖 | ✅ 2026-09-07 |
| 1 | 编译成功自动快照 + 一键回滚 | Mimir | 服务端快照存储 | ✅ 2026-09-07 |
| 1 | 原子写入（temp→rename） | latex-stickies | 无 | ✅ 2026-09-07 |
| 2 | 集成终端（工作区 cwd、白名单+超时、SSE 输出） | VS Code | 服务端 | ✅ 2026-09-07 |
| 2 | 自然语言→LaTeX 公式（Ctrl+Shift+M / ∑ 按钮 → 走 provider → 回答可审阅） | latex-stickies | 无 | ✅ 2026-09-07 |
| 2 | AI 输入 `@文件` 引用（发送前展开为真实文件内容块） | Pine | 无 | ✅ 2026-09-07 |
| 2 | 入口 .tex 自动探测（`\documentclass` 扫描）+ 首次打开自动加载 | Mimir | 无 | ✅ 2026-09-07 |
| 3 | SyncTeX 正反向 | LaTeX Editor | synctex 解析 | ⏳ |
| 3 | KaoNotes 风格笔记模板 | KaoNotes | 模板 | ⏳ |
| — | 安装包 exe（自包含 .NET + Node sidecar；签名需证书） | 用户需求 | 打包 | ⏳ 见 §3 |

## 3. exe 安装包路线（诚实边界）— 2026-09-07 已落地 1–2，3 有回退，4 待证书
`npm run package:installer`（`scripts/package-installer.mjs`）四步流水线：
1. ✅ `dotnet publish -r win-x64 --self-contained`：.NET 8 运行时打入包，用户免装 .NET。
2. ✅ Node 22.12 官方 win-x64 zip 下载 + **对照官方 SHASUMS256.txt 校验** + 精简后放入 `runtime\node`；launcher 优先使用捆包 Node，回退系统 PATH。服务端生产依赖预装，首启无需 npm。
3. ⚠️ Inno Setup：脚本会自动生成 `.iss`（安装向导/开始菜单/桌面图标/卸载）并调用 ISCC；**本机未安装 Inno Setup（winget 亦不可用）**，因此当前回退产出 `PaperOS-<v>-windows-x64-selfcontained.zip`（109 MB，解压双击即用）。装上 Inno Setup 6 重跑即得 `Setup.exe`。
4. ⏳ 代码签名：需购买证书；未签名前 SmartScreen 会提示"未知发布者"。下载页已如实标注。

真机验证（2026-09-07）：自包含 zip 解压到临时目录，用捆包 Node 启动服务 → health 200 / v0.7.0 / node v22.12.0 / Web UI 200，全程不依赖项目目录与系统 Node。

## 4. 不变量（迁移时不可破坏）
- 所有面板只显示真实数据；无数据显示诚实空态。
- AI 只提案，人 Apply；快照回滚同样需要确认。
- 服务只监听 loopback；终端/命令执行限定工作区 cwd + 白名单 + 超时。
- 每个迁移项：测试先行 → 全量绿 → 提交 → CHANGELOG。
