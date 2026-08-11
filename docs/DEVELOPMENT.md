# Paper OS 开发指南

本文面向在当前仓库开发 Web、Desktop IDE、本地 Node 服务、Pack 或发布管线的维护者。用户操作见 [`GUIDE.md`](GUIDE.md)，生产/本地运维见 [`RUNBOOK.md`](RUNBOOK.md)。

## 环境

| 工具 | 必需范围 | 约束 |
| --- | --- | --- |
| Node.js | 所有主流程 | 20+，以根 `package.json` 为准 |
| npm | Web/IDE/app 依赖与构建 | 优先使用各目录 lockfile 的 `npm ci` |
| Python 3 | `paperctl.py` 与 Python tests | 数学建模 Pack 必需，通用编辑可选 |
| .NET 8 Desktop Runtime (x64) | 当前 WinForms launcher 运行 | framework-dependent EXE 必需；.NET SDK 已包含开发机运行时 |
| .NET SDK 8 | 当前 WinForms launcher 构建 | 仅构建 `PaperOS.exe` 时需要 |
| Edge WebView2 Runtime | 当前 Windows 桌面运行 | Windows 11 通常自带 |
| Rust/Cargo | Tauri scaffold | 仅 Tauri 检查/构建需要 |
| Tectonic 或 latexmk | 本地 LaTeX | 按运行时探测结果选择 |
| Chromium/Chrome | browser/visual smoke | 有头验证需要可用浏览器 |

## 安装依赖

从仓库根目录执行：

```powershell
npm --prefix app ci
npm --prefix web ci
npm --prefix apps/desktop ci
```

根 `package.json` 当前没有根依赖锁；不要用根 `npm install` 假装安装了三个子项目。禁止在没有明确评审时新增依赖。

## 常用流程

构建 Web 和 Desktop IDE 静态资源：

```powershell
npm run build
```

只构建一个表面：

```powershell
npm run web:build
npm run ide:build
```

启动本地服务：

```powershell
npm start
# health: http://127.0.0.1:3719/api/health
# IDE:    http://127.0.0.1:3719/ide/
```

Web 独立开发：

```powershell
npm run web:dev
```

构建当前 Windows launcher：

```powershell
powershell -File .\build-launcher.ps1
.\PaperOS.exe
```

Tauri 仅作为过渡/实验入口：

```powershell
npm --prefix apps/desktop run tauri:dev
cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml
```

## 目录职责

| 路径 | 责任 | 修改时的门禁 |
| --- | --- | --- |
| `app/server.mjs` | 本地 HTTP/WS API 和静态服务 | syntax + 受影响 Node tests + security regression |
| `app/lib/` | Workspace/store/auth/secret/signing 深模块 | 单元/集成测试，不绕过调用边界 |
| `apps/desktop/src/` | React/Monaco Desktop IDE | desktop tests + `ide:build` + visual QA |
| `launcher/` | 当前 WinForms/WebView2 壳 | .NET build + 真机启动/退出 |
| `apps/desktop/src-tauri/` | Tauri scaffold | cargo check + tauri build + CSP/sidecar review |
| `web/src/` | 展示站、账户、Web workbench、admin | `web:build` + DOM/browser/visual QA |
| `product/` | 运行时消费的 Packs/workflows/agents/skills/config | schema/loader 兼容和 Pack 范围检查 |
| `templates/` | managed Workspace 模板 | create Workspace integration test |
| `tests/` | Node/Python 回归 | 不得复用真实 `app/data` |
| `docs/` | 契约、状态、操作、计划、历史 | 相对链接、状态和代码事实同步 |

## 数据隔离

不要在开发或测试中清理、覆盖或提交：

- `.paperos/`
- `app/data/`
- 用户 external Workspace
- `contests/` 下无法证明是 fixture 的内容
- 根目录现有二进制/发布产物

需要启动隔离服务时设置独立目录：

```powershell
$env:PAPER_OS_DATA_DIR = (Join-Path $env:TEMP 'paper-os-dev-data')
$env:PAPER_OS_PORT = '3720'
node app/server.mjs
```

不要把 `$HOME`、`$home` 或工作区根作为临时/清理变量。测试结束前确认目标绝对路径属于预期临时目录。

## 环境变量

| 变量 | 用途 | 默认/注意 |
| --- | --- | --- |
| `PAPER_OS_PORT` | loopback 端口 | `3719` |
| `PAPER_OS_DATA_DIR` | runtime data 根 | `app/data`；测试必须隔离 |
| `PAPER_OS_SECRET` | provider key master secret | 未设置时使用本地 `.secret-key` |
| `PAPER_OS_SIGNING_KEY` | Ed25519 PKCS#8 PEM | 未设置时使用本地 signing key |
| `PAPER_OS_PYTHON` | Python 命令 | `python` |
| `PAPER_OS_LATEXMK` | latexmk 命令 | `latexmk` |
| `PAPER_OS_MAX_BODY_BYTES` | 请求体上限 | 8 MiB |
| `PAPER_OS_WALKER_MAX_DEPTH` | walker 深度预算 | 24 |
| `PAPER_OS_WALKER_MAX_ENTRIES` | walker 条目预算 | 20000 |
| `PAPER_OS_RUNTIME_PROBE_TIMEOUT_MS` | runtime 探测超时 | 2500ms |
| `PAPER_OS_SERVER_DEBUG` | server debug | `1` 开启；避免输出 secret |

## 变更流程

1. 读 `CONTEXT.md`、受影响 ADR、`CAPABILITY_MAP.md` 和对应测试。
2. 用测试锁住现有行为；修 bug/加能力优先 test-first。
3. 小步修改，复用现有 helper，不在同一变更做无关重构。
4. 按 [`TESTING.md`](TESTING.md) 运行与风险匹配的验证。
5. 更新 `STATUS.md`、能力地图、操作文档、ADR 和 `CHANGELOG.md` 中受影响部分。
6. 提交必须遵循 Lore protocol，至少记录 `Confidence`、`Scope-risk`、`Tested`、`Not-tested`。

## Definition of Done

- 用户行为、错误和失败模式明确。
- 自动化测试覆盖主路径和关键失败路径。
- build/static/smoke/visual 按范围通过。
- 不削弱 loopback、Workspace path、secret、Apply preview 等安全不变量。
- 没有把计划能力写成已交付能力。
- 文档和追溯矩阵同步，证据绑定当前 SHA。

