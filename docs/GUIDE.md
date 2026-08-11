# Paper OS 使用指南

Paper OS 是本地优先的通用文档 IDE。主流程是选择 Workspace 和 Pack，然后编辑、预览、构建并审查 AI 修改。数学建模只是一个可选专业 Pack。

## 启动

Windows 当前入口是开发预览，不是零依赖 portable 安装包。先安装 Node.js 20+、
.NET 8 Desktop Runtime (x64) 和 Edge WebView2 Runtime；从 ZIP 解压后还要执行一次：

```powershell
npm --prefix app ci --omit=dev
```

然后启动：

```text
PaperOS.exe
```

开发模式：

```powershell
npm run ide:build
npm start
# 打开 http://127.0.0.1:3719/ide/
```

## 第一次使用

1. 打开 Workspace chooser。
2. 选择 Pack：`general`、`latex`、`markdown` 或 `math-modeling`。
3. 创建 managed Workspace，或注册一个已存在的文件夹。
4. 在文件树打开文档；文本在 Monaco 编辑，PDF/图片进入预览。
5. 按当前 Pack 使用构建、Evidence 或专业任务。

注册 external folder 不会复制内容。移动原目录后 entry 会显示 missing；当前版本没有 relink/unregister UI。

## Packs

| Pack | 适合 | 当前能力 |
| --- | --- | --- |
| `general` | 任意混合文本/源码目录 | 文件、搜索、预览、AI 表面 |
| `latex` | 文章、报告、书籍 | starter、LaTeX compile、PDF preview |
| `markdown` | 笔记和长文 | starter、文本编辑；rich preview 仍在路线图 |
| `math-modeling` | 数学建模竞赛 | LaTeX + stages/ledgers/scripts/verify/package |

不可用的 Pack 能力应隐藏或禁用。底部 `TASKS` 和 `paperctl` 只属于 `math-modeling`；当前没有通用交互式 Terminal。

## 编辑和保存

- `Ctrl+P`：Quick Open。
- `Ctrl+S`：保存当前文档。
- `Ctrl+Shift+S`：保存所有 dirty text buffers。
- `Ctrl+Shift+F`：Workspace 搜索。
- `Ctrl+K`：对当前选区发起 inline AI action。
- `Ctrl+Shift+B`：当前 LaTeX Pack/Workspace 的显式入口编译。

每个 text tab 有独立内存 buffer。切换 tab 不应从磁盘覆盖未保存内容；关闭 dirty tab 或切换 Workspace 会提示风险。

## LaTeX 构建

编译命令针对当前 Workspace 内显式 `.tex` 文件。运行时优先使用 bundled/system Tectonic，再尝试 `latexmk`。当前输出和 PDF 查找仍是实现切片，不代表完整 BuildJob/ArtifactSet 或真实 SyncTeX。

## AI 与 Apply

在设置/账户中配置 OpenAI-compatible provider。provider key 在本地加密存储，不应写入 Workspace 或日志。

AI 输出必须作为 proposal 预览。多文件 Apply Blocks 会返回 baseline；Apply 前若文件 mtime 已变化，会拒绝并提示冲突；中途写失败会尝试恢复旧文件并删除本次新建文件。

注意：provider 不可用时服务可能回退 `mock-local`。在 UI 没有明确显示真实模型状态前，不要把确定性 mock 响应当成真实模型结果。

## 数学建模 Pack

只有选择 `math-modeling` 时才使用证据/结果/图账本和 `paperctl.py`：

```powershell
python paperctl.py doctor
python paperctl.py init my-project
python paperctl.py status my-project
python paperctl.py verify my-project
python paperctl.py build my-project
```

该 CLI 当前操作 `contests/<id>` 兼容布局，不是通用 Workspace CLI。`verify` 有 `FAIL` 时不要提交竞赛产物。

## 数据与隐私

- 本地文件和本地编译结果是事实来源。
- external folder 内容留在原路径。
- 账户、会话、加密 provider config 和审计默认在 `app/data/`。
- 不要删除 `.paperos/`、`app/data/` 或未知 Workspace 数据。
- 备份必须同时覆盖 registry 和实际 Workspace 内容，详见 [`RUNBOOK.md`](RUNBOOK.md)。

## 故障排查

### 桌面窗口打不开

1. 确认 Node 20+、.NET 8 Desktop Runtime (x64) 和 WebView2 Runtime。
2. 从 ZIP 运行时，确认已执行 `npm --prefix app ci --omit=dev`，且 `app/node_modules/ws` 存在。
3. 运行 `node app/server.mjs`，查看终端错误。
4. 检查 `http://127.0.0.1:3719/api/health`。

### 编译不可用

检查 Tectonic 状态或系统 `latexmk`，确认入口是 Workspace 内 `.tex`，并查看 Output/Problems。

### Workspace missing

external folder 已移动或不可访问。恢复原路径；修改 registry 前先停止 runtime 并备份 `app/data`。

### AI 没有真实调用

检查 provider `base_url`、model、key 状态和网络；确认返回状态不是 `mock-local`。

