# Paper OS 运行与恢复手册

本文覆盖本地服务、当前 Windows 桌面入口、运行数据、备份恢复、密钥和发布故障。任何会删除或覆盖用户数据的动作都必须先确认绝对路径和备份。

## 启动与健康检查

开发/诊断启动：

```powershell
$env:PAPER_OS_PORT = '3719'
node app/server.mjs
```

健康检查：

```powershell
Invoke-RestMethod http://127.0.0.1:3719/api/health
```

Desktop：运行 `PaperOS.exe`。launcher 优先使用 `PAPER_OS_PORT`，否则尝试 3719；若端口已有健康 Paper OS 可复用，否则选择空闲 loopback 端口。关闭由 launcher 启动的窗口应终止它拥有的 Node 子进程，不应终止复用的外部健康服务。

## 端口和启动故障

1. 检查 `PAPER_OS_PORT` 是否为有效端口。
2. `Get-NetTCPConnection -LocalPort 3719` 检查占用者。
3. 直接运行 `node app/server.mjs` 获取 stdout/stderr。
4. 检查 Node 20+、工作目录、`app/ide/` 和 `app/public/` 是否存在。
5. WebView 空白时直接访问 `/api/health` 和 `/ide/`，区分 server、静态资源和 WebView 问题。

当前 launcher 没有持久日志文件；在日志落盘能力完成前，诊断必须保留终端输出。日志不得打印 session cookie、provider key、master secret 或 signing private key。

## 运行数据清单

默认目录：`app/data/`；可用 `PAPER_OS_DATA_DIR` 覆盖。

| 数据 | 作用 | 备份级别 |
| --- | --- | --- |
| `.secret-key` | provider key 本地加密根 | 机密；必须与密文成套备份 |
| `.signing-key.pem` | Ed25519 发布私钥 | 高机密；建议离线/secret manager |
| `users.json` | 账户 | 必须 |
| `sessions.json` | 会话 | 可重建；恢复后建议全部撤销 |
| `audit.json` | 审计记录 | 必须按合规策略保留 |
| `usage.json` | 用量 | 按业务要求 |
| `posts.json` | 社区内容 | 按业务要求 |
| `workspaces.json` | external Workspace registry（创建后） | 必须，但不包含目录内容 |
| `system.json` | 运行策略（创建后） | 必须 |
| `account-providers.json` | 加密 provider 配置（创建后） | 必须与 `.secret-key` 成套 |

managed Workspace 默认在 `workspaces/`，legacy math-modeling 在 `contests/`，external Workspace 在用户注册的绝对路径。

## 备份

一致性优先的流程：

1. 停止 Paper OS runtime，避免 JSON 更新与复制并发。
2. 记录版本、commit、平台、`PAPER_OS_DATA_DIR` 和 Workspace registry。
3. 备份整个 data 目录，保持密钥文件权限和机密级别。
4. 备份 `workspaces/`、需要保留的 `contests/` 和每个 external Workspace 的真实目录。
5. 对备份生成 SHA-256，保存在不同介质。
6. 定期在隔离目录做恢复演练；未演练的备份不算可靠。

不要只备份 `workspaces.json`。它只保存指针，不保存 external folder 内容。

## 恢复

1. 在隔离机器/目录准备相同或兼容版本。
2. 保持 runtime 停止，将 data 和 Workspace 内容恢复到预期位置。
3. 确认 `.secret-key` 与 `account-providers.json` 匹配。
4. 设置隔离端口并启动，先检查 `/api/health`。
5. 验证账户、Workspace list、文件读取、provider key 状态和编译。
6. 恢复会话数据时主动撤销旧会话；生产恢复后轮换敏感凭据。
7. external folder 路径变化时，当前没有 relink/unregister API；先备份 registry，再受控修复或恢复原路径。

原子 store 遇到损坏 JSON 会回退初始结构，这能避免进程崩溃，但不等于数据已恢复。发现空结构时保留损坏文件副本和日志，从最近已验证备份恢复。

## 密钥生命周期

### Provider master secret

- `PAPER_OS_SECRET` 或 `.secret-key` 用于 AES-256-GCM。
- 丢失 secret 后旧 provider 密文不可解密。
- 当前没有自动 re-encrypt 轮换脚本；不要直接替换后重启。
- 轮换前应导出/重新输入 provider key，设计受控迁移并验证旧/新密文。

### Release signing key

- `PAPER_OS_SIGNING_KEY` 或 `.signing-key.pem` 用于 Ed25519 manifest。
- 私钥不得进入 Git、日志、ZIP 或前端 bundle。
- 轮换要发布新公钥信任变更，旧客户端更新链必须有迁移策略。
- Ed25519 证明 manifest 完整性；平台执行文件仍需 Authenticode/notarization。

### 事件响应

怀疑密钥泄露时：停止发布/相关 runtime，保留审计证据，吊销/轮换上游 provider key，撤销 sessions，生成新 signing trust root，并明确标记受影响版本。不要为“恢复运行”而删除 audit。

## 发布与回滚

当前可证明的本地产物仅为 Windows 开发预览 ZIP；它不包含 `app/node_modules`，
launcher 也不是 self-contained .NET 发布，因此不能标为零依赖 portable。发布前：

```powershell
npm ci --prefix app
npm ci --prefix web
npm ci --prefix apps/desktop
npm run build
node --test
python -m pytest tests/test_paperctl_runtime.py
powershell -File .\build-launcher.ps1
npm run package:win
```

随后：

1. 检查版本在 root、desktop、Tauri config、Cargo、release manifest 一致。
2. 检查 manifest 中每个资产真实存在，缺失平台不得发布为 available。
3. 独立验证 ZIP SHA-256 和 API 返回的 Ed25519 signature。
4. 在干净目标机启动、创建/注册 Workspace、编辑、保存、编译和退出。
5. 平台代码签名验证通过后再发布。
6. 保留上一稳定产物、校验值、public key 和兼容说明，用于回滚。

在当前打包方式下，干净机还必须安装 Node.js 20+、.NET 8 Desktop Runtime (x64)
和 WebView2，并在解压目录执行 `npm --prefix app ci --omit=dev`。若产品要声明
portable/self-contained，发布流程必须改为携带生产 Node 依赖或独立 server bundle，
并生成 self-contained launcher，然后重新执行干净机验收。

回滚不能降级或覆盖用户 Workspace。需要 schema 迁移时必须先提供向前/向后兼容和数据备份方案。

## 安全边界

- 服务只应绑定 loopback；Host/Origin/WS policy 不得在诊断时临时放宽。
- 不允许用 browser 页面直接传任意 external path 绕过 Workspace registration。
- `math-modeling` tool 命令必须经过 capability gating。
- Tauri 当前 `csp: null` 是已知风险，不应当作生产安全默认。
- provider base URL 属于出站信任边界；生产化前需要 SSRF/allowlist/代理策略复审。

## 升级路径

当前缺少正式 schema migration 和自动 updater。升级前备份数据与 Workspaces，阅读 `CHANGELOG.md`，在副本上验证，再替换运行产物。任何改变 data JSON、secret 格式、Pack manifest 或 Workspace registry 的版本都必须提供迁移与回滚说明。

