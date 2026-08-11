# Paper OS 历史交接记录（2026-07）

> 历史快照：旧待办和测试数字不代表当前状态。请以 [STATUS](../STATUS.md) 和 [当前交接](../HANDOFF.md) 为准。

更新时间：2026-07-21（第六轮：logo 重做 v2 + Ed25519 发布签名 + 后台管理扩展 + 打包管线 + 数据层加固）  
项目定位：本地优先、Pack 驱动的通用文档 IDE，目标体验对齐 Cursor 级别的专业编辑器。

---

## -4. 第六轮（2026-07-21）已完成：签名 / 后台 / 打包 / 数据层

用户反馈"logo 没映射好"，并要求后台管理、多平台打包、完成度/可用性、前后端数据协调、签名算法。本轮以架构者主导 + 2 个并行子代理（隔离新文件/隔离既有文件），全部构建+测试+实拍验证。

### 1) Logo 重做 v2（上一轮的笔尖标在小尺寸像"下载箭头"）
- 重新生成清晰的 app 图标：amber 圆角方 + 衬线 "P" 镂空（`assets/paperos-logo.png` → `web/public/` + `app/public/`，favicon/OG/apple-touch）。
- 重写 `web/src/components/Logo.jsx` 与 IDE 的 `BrandLogo`（`icons.jsx`）为同一"徽章+P"矢量，任意尺寸清晰。子代理把 Workbench 等页残留的 "Q" 也换成 `Logo`。IDE 实拍确认新标渲染正确。

### 2) 签名算法：Ed25519 发布签名（`app/lib/signer.mjs`）
- 私钥取 `PAPER_OS_SIGNING_KEY`（PKCS#8 PEM）或持久化到 `app/data/.signing-key.pem`（0600）。
- `/api/releases` 现返回 `signed/algorithm/signature/publicKey`：对 canonical payload（版本+各资产 filename/size/sha256）做 Ed25519 签名；新增 `/api/releases/pubkey`。
- 实拍验证：用服务返回的公钥独立 `crypto.verify` 通过。测试 `tests/signer.test.mjs`（签/验/篡改/持久化/env 覆盖）+ `tests/admin-api.test.mjs` 端到端验签。

### 3) 后台管理扩展（3 个新 API + 3 个新页面）
- API：`GET/PUT /api/admin/system`（注册开关、登录限流阈值、构建信息、计数）；`GET /api/admin/keys`（各用户是否配置自有 Key——仅布尔+模型名，绝不含密文）；`GET /api/admin/releases`（签名清单）。
- 登录限流改为读 `system.json` 的可配置阈值；注册开关关闭后阻止自助注册（但始终放行首个 owner）。
- 页面（子代理产出，路由/nav 我接）：`AdminSystem`/`AdminKeys`/`AdminReleases`，已加入 `/admin/system|keys|releases` 与侧栏。

### 4) 打包管线（真实产物，端到端打通下载）
- `scripts/package-release.mjs`（`npm run package:win`）：把 app + web 构建 + IDE + launcher(若已 build) 打成 `dist/release/PaperOS-<ver>-windows-x64.zip` + `.sha256`。本轮实跑产出 7.0MB zip；`/api/download/windows` 实测 200 且带 `X-Checksum-SHA256`。
- `.github/workflows/release.yml`：Windows 出原生 exe + 便携 zip，mac/linux 出便携 tarball，tag `v*` 自动发布 GitHub Release。
- `product/releases.json` 的 windows 资产指向该 zip。

### 5) 数据层加固（"前后端数据库协调"）
- `app/lib/store.mjs` 改为原子写（写临时文件 + `rename` 覆盖），杜绝写一半导致的 JSON 损坏；读到损坏/空文件回退初始结构不抛错。测试 `tests/store-atomic.test.mjs`（round-trip、损坏回退、串行 update、无残留 tmp）。

### 第六轮验证证据
- `node --test tests/*.test.mjs`：**59/59 pass**（新增 signer/store-atomic/admin-api，并修正 releases 下载测试兼容"已打包/未打包"两态）。
- 4 个冒烟全过；`web:build`/`ide:build`/`package:win` 通过；lint 全绿。
- 3719 重启实测：releases 已签名且验签通过、windows 下载 200 + 校验和头、`/admin/system`·`/app/api-keys`·`/pricing` 深链 200、logo 200；IDE workspace chooser 实拍显示新 P 徽章。

---

## -3. 第五轮（2026-07-20 深夜）已完成：品牌与 bug 修复

用户反馈"仍有 bug、不美观、logo 难看"。本轮做真实审计并修复，不靠猜。

### 品牌 logo 全面重做
- 生成企业级 app 图标（`assets/paperos-logo.png`，放入 `web/public/` + `app/public/`，作 favicon/OG image；Vite `emptyOutDir` 会清 `app/public`，所以源在 `web/public/` 由 Vite 自动拷贝）。
- 新建可无损缩放的 SVG 组件：`web/src/components/Logo.jsx`（页面/CSS）与 `apps/desktop/src/icons.jsx` 的 `BrandLogo`（IDE）。二者视觉一致：页轮廓 + 上升金色笔尖 + amber 渐变。
- 替换全部旧的文字 "Q" logo：站点页头/页脚、登录/注册的 `AuthAside`、`AppLayout` 侧栏、Home hero、以及 IDE 的标题栏(2 处)、登录卡、空编辑器、AI 面板、Workspace chooser、空工作区。清理了对应 CSS（去掉 conic-gradient 圆圈占位）。

### 修复的真实 bug（均已截图/构建验证）
1. **登录页崩溃（P0）**：`Login.jsx` 用了 `useState` 但从未 `import`——`/login` 一打开就 ReferenceError 整页崩。已补 import；截图确认登录页正常渲染。
2. **路由器类型错误**：`main.jsx` 用 `HashRouter`，与服务端 SPA history fallback（第四轮加的 `/pricing` 等深链）不匹配、URL 出现 `/#/`。改为 `BrowserRouter` + Vite `base:"/"`，深链 `/app/account` 直达返回 200。
3. **密码提示不一致**：登录/注册页写"至少 8 位"，但服务端策略是"≥10 位 + ≥2 字符类"。注册页现按同一策略做客户端即时校验与提示。
4. **误导性角色选择器**：注册页让用户选 owner/admin/member，但服务端忽略（首个账号=owner，其余=member）。已移除，避免误导。
5. **假 SSO 按钮**：登录页三个 SSO 按钮无 onClick（纯装饰）。已接 `/api/auth/oauth/:provider/start`（dev 流程跟随 callback→refresh），重设计为带 glyph 的真实按钮 + 分隔线。
6. **首页乱码**：hero 的 LaTeX 示例是重复错乱的 JSX（`\\(\\(`、行号与内容错位）与假文案"0 用户已安装"。重写为整洁的逐行代码块 + 真实文案。
7. **stale 测试标记**：`browser-visual-smoke.mjs` 仍断言旧产品名 "Model Gateway for Competition Papers"（改名后永不存在）。改为断言 "Paper OS" + SPA shell，并加 `--virtual-time-budget` 让 SPA 渲染后再截图。
8. **文案泄漏**：Dashboard 的"赛题工作区/接入赛题/paperctl 后端"等数学建模味文案改为通用文档措辞，快速入口接上 `/app/api-keys`、`/docs`。

### 第五轮验证证据
- `node --test tests/*.test.mjs`：**52/52 pass**；4 个冒烟（smoke/dom-ui/visual/runtime-timeout）全过（visual-smoke 已更新为断言新 Logo 组件）。
- `web:build` / `ide:build` 通过；lint 全绿。
- 3719 重启后 CDP 实拍：home / login / pricing 三页渲染正确（新 logo、极光背景、hero 代码块整洁、登录卡 + 真实 SSO 按钮、定价四档卡片）；IDE workspace chooser 显示新 logo；`/app/account` 深链 200、logo 200。

---

## -2. 第四轮（2026-07-20 晚）已完成：企业级产品闭环

目标是把"官网展示 → 注册登录 → 配置 API Key → 下载客户端 → 社区 → 后台管控"做成完整闭环，企业级安全标准。以架构者身份主导，安全关键与共享文件自己实现，两个边界清晰的前端页面组交给 2 个并行子代理（不碰共享文件）。

### 安全核心（后端，均带测试）
1. **每用户 API Key 加密存储**：新增 `app/lib/secret-box.mjs`（AES-256-GCM，master key 取 `PAPER_OS_SECRET` 或持久化到 `app/data/.secret-key`，0600 权限）。`account-providers.json` 只存密文 `apiKeyEnc`（`v1.<iv>.<tag>.<ct>`）；明文永不落盘、永不回传。`/api/chat` 经 `resolveEffectiveProvider()` 优先用调用者自己的 key，回退共享配置。
2. **账户中心 API**：`GET /api/account/overview`、`PUT /api/account/profile`、`POST /api/account/password`（校验旧密码+密码策略+会话轮换）、`PUT /api/account/provider`、`DELETE /api/account/provider/key`、`POST /api/account/sessions/revoke-others`。会话新增 `createdAt`/`label`（按 UA 识别设备）。
3. **安全加固**：登录限流（15 分钟 15 次）、注册限流；`readBody` 请求体上限（默认 8MB，`PAPER_OS_MAX_BODY_BYTES` 可调）→ 413；全站安全响应头（CSP/X-Content-Type-Options/X-Frame-Options/Referrer-Policy/COOP）；密码策略（≥10 位、≥2 字符类）；改密后轮换其它会话；错误信息不泄露内部细节。
4. **发布/下载**：`product/releases.json` + `GET /api/releases`（按磁盘产物计算真实 size/sha256，产物不存在则标 `available:false`）+ `GET /api/download/:os`（流式下发 + `X-Checksum-SHA256`，未就绪返回友好 404）。公开清单已剥离服务器绝对路径。
5. **SPA history fallback**：服务端对无扩展名、非 `/assets/` 的未知路由回退 `index.html`，深链（`/pricing`、`/app/account`）可直达；资产缺失仍返回真实 404。

### 前端（页面 + 共享 wiring）
- 子代理 A 产出营销页：`Pricing`（4 档 + 对比表）、`Enterprise`（能力卡 + 安全架构）、`Docs`（快速上手）、`Changelog`（版本时间线）。
- 子代理 B 产出账户页：`Account`（资料/改密/会话）、`ApiKeys`（网关配置 + 加密 Key 管理）。
- 我做共享 wiring：`App.jsx` 8 条新路由、`api.js` 透传错误 code、`SiteHeader`/`SiteFooter`/`AppLayout` 导航、`Download.jsx` 改接 `/api/releases`（真实版本/校验和/可用性）。
- 抗逆向构建：`web` 生产 minify + 默认关 sourcemap（`PAPER_OS_DEV=1` 开）；IDE 打包默认 minify + 默认关 sourcemap（`--dev` 开）。

### 第四轮验证证据
- `node --test tests/*.test.mjs`：**52/52 pass**（新增 secret-box、account-api、spa-fallback 等）。
- `npm run web:build` / `ide:build` 通过（IDE CSS 3xx KB，无 `.map`）；`node --check app/server.mjs` 通过。
- smoke / dom-ui / visual / runtime-timeout 全过。
- 3719 重启后实测：`/api/releases` 200（版本 0.5.0，不泄露路径）、bootstrap→local→`/api/account/overview` 正常、CSP 头存在、`/pricing` 深链返回 SPA、bundle 含全部新页面文案。

---

## -1. 第三轮（2026-07-20 下午）已完成

上一轮 §3.2 "下一批事项" 中的 1、3、5 项落地，另补齐多项 Cursor 级交互：

1. **EditTransaction v1（`/api/editor/apply-blocks`）**
   - 预览返回逐块 baseline stamp：`{ path, bytes, exists, mtime }`。
   - Apply 可带 `baseline`（客户端回传预览时的 mtime）；任一目标在预览后被修改 → **409 APPLY_CONFLICT**，一个字节都不写。
   - 写入走 journal：先快照旧内容再写；中途失败 → 逆序回滚（旧文件恢复、新建文件删除），返回 **500 APPLY_ROLLBACK**。
   - 前端 `applyBlocksFromText` 回传 baseline；409/回滚都有明确 toast；确认框区分"新建/改写"。
   - 测试：`tests/editor-apply-transaction.test.mjs`（stamps、冲突 409、目录写失败回滚、新建文件回滚删除）。

2. **Walker 性能边界**
   - `tree`/`search`/`export` 三个 walker 增加 `PAPER_OS_WALKER_MAX_DEPTH`（默认 24）与 `PAPER_OS_WALKER_MAX_ENTRIES`（默认 20000）上限，超限停止并返回 `truncated: true`；前端在 OUTPUT 提示"目录过大已截断"。
   - 测试：`tests/server-walker-bounds.test.mjs`（用环境变量收紧上限验证三个端点都尊重预算）。

3. **WebSocket 加固（发现并修复一个真实崩溃 bug）**
   - 原 `wss on message` 的条件 `msg.op === "subscribe" && typeof msg.channel === "string" && msg.channel.startsWith("compile:") || msg.channel.startsWith("team:")` 因运算符优先级，遇到 `{"op":"unsubscribe"}`（无 channel）等帧会直接 TypeError —— **任何已登录客户端一条畸形帧即可打崩整个服务进程**。已修复并整体套 try/catch。
   - 测试：`tests/server-ws-hardening.test.mjs`（连发 6 类畸形帧，socket 存活、HTTP 仍可响应）。

4. **AI 面板去伪**
   - 新增 `GET /api/provider`（脱敏：不回传 key，只回传 `keyPresent` 布尔）。
   - 前端删掉写死的 GPT-5.4/GPT-4o/Claude 假下拉，改为真实 model chip（显示已配置模型与 Key 状态，点击进设置）；Settings 打开时预填真实配置、保存后刷新 chip。

5. **Cursor 级交互补齐**
   - **Ctrl+P Quick Open**：模糊匹配（子序列 + 连击/词边界/basename 加权）、键盘导航、命令面板与"转到"菜单入口。
   - **Ctrl+Shift+S** 全部保存。
   - **dirty tab 可关闭**：原来 dirty 圆点会替换掉关闭按钮导致 dirty tab 无法关闭；现在 hover 时圆点换成 ×（固定 16px 槽位不抖动），中键点击可关 tab，dirty 关闭有确认。
   - **修复 CommandPalette 潜在崩溃**：`useRef`/`useEffect` 位于 `if (!open) return null` 之后，违反 Hooks 规则，首次打开命令面板即 hook 数量不匹配崩溃；已把 hooks 全部移到 early return 之前。

### 第三轮验证证据

- `node --test tests/*.test.mjs`：**45/45 pass**（新增 4 个测试文件场景）。
- `python -m pytest`：**25/25 pass**。
- `npm run build`、`node --check app/server.mjs`、smoke / dom-ui / visual / runtime-timeout / desktop-workspace-visual 全部通过。
- 3719 已重启并验证：`GET /api/provider` 200（active model gpt-5.4, keyPresent false）、bundle 含 QuickOpenModal/model-chip/APPLY_CONFLICT 处理。

---

## 0. 本轮（2026-07-20 第二轮）已完成

原 §3.2 的六个优先事项全部落地，验证证据见 §0.7：

1. **Buffer Safety wiring 完成**（`apps/desktop/src/ide.jsx`）
   - `openFile()` 优先从内存 buffer 恢复（`createTextBuffer`/`loadTextBuffer`），切 tab 不再被磁盘覆盖。
   - Monaco onChange / inline edit / 替换 / 片段插入统一走 `updateActiveBufferContent()` 单写入口（`editTextBuffer`）。
   - `save()` 保存启动时的 snapshot，`markTextBufferSaved` 保证保存期间继续输入的内容保持 dirty；保存失败 buffer 保持 dirty 并有 toast。
   - Save All（`commitAllDirty`）遍历 `dirtyTextBuffers(openTabs)`，`Promise.allSettled` 逐 buffer 落盘，部分失败保留失败 buffer 的 dirty 状态。
   - `closeTab` 对 dirty text buffer 增加确认；`deleteFile` 走 `force` 关闭。
   - 自保存不再误触"文件已外部修改"横幅（`selfSaveRef` 吸收自身 mtime 变化）；"重新加载"显式走 `openFile(file, { reload: true })`。
   - `tests/desktop-buffer-state.test.mjs` 6/6、`tests/desktop-buffer-wiring.test.mjs` 5/5 GREEN。

2. **Stale response guard 完成**
   - `loadTree()` 用 `treeRequestRef` token，`openFile()` 用 `openRequestRef` token（含媒体预览路径）；workspace 切换 / 关 tab / 重命名都会 bump token，旧响应直接丢弃。

3. **Desktop auth bootstrap 完成**
   - boot 链路现在是 `GET /api/auth/me` → 失败则 `GET /api/auth/bootstrap` → `POST /api/auth/local`。
   - 实测：bootstrap 200 → local 200 → 重放同一 bootstrap cookie 403（一次性语义成立）。

4. **通用 IDE 建模泄漏清理**
   - 执行计划文案去掉 `figure-ledger` / "Literature Search MCP"；Citations 快捷提示去掉 `state/claim-ledger.csv`；MCP 提示去掉 paperctl 字样。
   - `createFile` 不再强加 `paper/` 前缀；新建文件默认名/占位符随 Pack capability 变化（latex → `.tex`，否则 `.md`）。
   - 空编辑器主按钮改为"打开主文档"。Evidence 抽屉内的 claim-ledger 文案保留——它只在 `evidence` capability（math-modeling Pack）下可达。

5. **Workspace chooser**
   - **修复 TDZ 崩溃**：原代码在 `selectedPack` 声明前引用它（`selectedPackRequiresAdapter`），chooser 一渲染就 ReferenceError；已调整声明顺序。
   - 增加 `role="dialog"` / `aria-modal` / `aria-labelledby`、焦点陷阱（Tab 循环）、Escape 关闭（有 onDismiss 时）、卸载后焦点恢复。
   - 增加 loading / error / retry 状态（`catalogState` → `loading`/`loadError`/`onRetry` props，CSS 见 `ide.css` `.workspace-load-error` 等）。

6. **状态栏去伪存真**
   - 移除假 `main` branch 段；改为真实 Workspace + Pack 名、未保存 buffer 计数（点击跳 Changes 视图）、"本地模式"。

### 0.7 本轮验证证据

- `node --test`（buffer-state、buffer-wiring、workspace-ui、modeling-status、server-auth-security、workspace-http、workspace-kernel）：**42/42 pass**。
- `python -m pytest tests/test_paperctl_runtime.py`：**25/25 pass**。
- `npm run build`（web + ide）通过；`node --check app/server.mjs` 通过。
- `npm run smoke` / `dom-ui-smoke` / `visual-smoke` / `runtime-timeout-smoke` / `node app/desktop-workspace-visual-smoke.mjs` 全部 OK；1440×900 与 1100×720 截图在 `dist/visual-qa/`。
- 服务器已在 `http://127.0.0.1:3719/ide/` 启动；served `ide.js` 已含 bootstrap 链路与全部 buffer 函数。

---

## 1. 一句话总结

Paper OS 现在的核心方向不是“数学建模专用工具”，而是一个 **local-first general document IDE**：

- **Workspace Kernel 是产品核心**：文件树、编辑器、保存、预览、搜索、导出、任务、能力边界都围绕 Workspace 运转。
- **Pack 是专业能力边界**：`general`、`latex`、`markdown`、`math-modeling` 等 Pack 决定某个工作区能使用哪些菜单、命令、任务和文档能力。
- **数学建模是第一方能力，但必须 Pack-scoped**：它可以很强，但不能污染全局 IDE 语义；通用编辑器体验必须独立成立。
- **长期目标是 Cursor-like 的文档 IDE**：好看的 UI、清晰的信息架构、强大的文件/文档工作流、可验证的本地安全边界，以及后续 AI Apply/EditTransaction 能力。

---

## 2. 已经做过什么

### 2.1 产品方向和架构文档

已经把项目方向从“数学建模论文工具”重新收敛为“通用文档 IDE + Pack 专业扩展”。

已更新或明确过的文档方向：

- `README.md`
- `docs/PRODUCT.md`
- `docs/ARCHITECTURE.md`
- `docs/CAPABILITY_MAP.md`

核心决策：

1. **Workspace Kernel 是核心，不是附属功能**
   - 工作区创建、注册、切换、文件访问、安全边界、后续 AI 编辑事务都应挂在 Workspace Kernel 上。

2. **Pack 分类**
   - `baseline`：通用文档能力。
   - `format`：格式相关能力，例如 Markdown、LaTeX。
   - `professional`：专业领域能力，例如数学建模。

3. **能力门控 Capability Gating**
   - 菜单、命令面板、Evidence、compile、底部按钮、activity bar、Tectonic 命令等，都应根据当前 Workspace 的 Pack capability 决定是否可见或可用。

4. **当前 AI Apply 与未来 EditTransaction 分离**
   - 当前只声明已有保障。
   - 未来目标是更强的 EditTransaction 不变量，例如事务化编辑、多文件快照、回滚、冲突处理。

5. **终端能力要真实表达**
   - 不能全局宣称有完整通用 Terminal。
   - 当前只有 `math-modeling` Pack 暴露 `paperctl` 相关任务能力。

---

### 2.2 Workspace/UI 已完成工作

已经实现或修正：

- Pack-aware Workspace chooser。
- 支持 managed workspace 创建。
- 支持 existing folder 注册。
- 移除了自动创建数学建模 demo 的行为。
- 移除了 title-bar `prompt()`。
- Workspace 切换时会重置：
  - editor state
  - media state
  - PDF state
  - 相关缓存状态
- 切换 Workspace 时会提示 dirty buffers 风险。
- activity bar、command palette、menus、bottom controls 等已加 capability gating。
- 泛化 Terminal 文案已经移除。
- `math-modeling` 作为 adapter-only Pack 仍然可见，但不能走 generic create/register。
- 修复过一次 chooser JSX patch 造成的 malformed JSX。

已验证过：

```bash
node --test tests/desktop-workspace-ui.test.mjs
# 14/14 passed

npm run ide:build
# passed
```

---

### 2.3 Server / Path Security 已完成工作

已经修复或加强：

- `DELETE .` / `DELETE ./` 不能再递归删除 Workspace root。
- Workspace ID 拒绝：
  - `.`
  - `..`
- 使用 canonical realpath containment 防止 symlink / junction 逃逸。
- 新路径位于 junction 下时也会被 containment 拦截。
- tree/search/export walkers 不再跟随 Workspace 外部的 junction。
- HTTP tests 使用隔离的 `PAPER_OS_DATA_DIR`，避免污染真实 `app/data`。

已验证过：

```bash
node --test tests/server-workspace-security.test.mjs
# 之前达到 28/28 passed
```

仍然存在的风险：

- symlink swap TOCTOU。
- hardlink 语义风险。
- 同步且无上限的 walker 可能存在性能/阻塞风险。

---

### 2.4 Browser Trust / Local Auth Security 已完成工作

已经加入：

- `requestPolicyError()`。
- HTTP 路由前的 loopback Host / Origin 检查。
- WebSocket cookie parsing 前的 Host / Origin 检查。
- 缺失 Host、重复 Host、外部 Host、外部 Origin、`null` Origin 会被拒绝。
- 一次性 256-bit HttpOnly bootstrap cookie：
  - `GET /api/auth/bootstrap`
  - `POST /api/auth/local`
  - `POST /api/auth/local` 成功后清除 bootstrap cookie。
  - bootstrap cookie 只能消费一次。

已验证过：

```bash
node --test tests/server-auth-security.test.mjs
# 1/1 passed

node --check app/server.mjs
# passed
```

重要未完成点：

- Desktop boot 可能仍然直接调用 `/api/auth/local`。
- 正确集成方式应是：

```js
await api.get("/api/auth/bootstrap");
await api.post("/api/auth/local", {});
```

---

### 2.5 Buffer Safety TDD 已经启动但未完成

已经创建文件：

- `apps/desktop/src/text-buffer.mjs`
- `tests/desktop-buffer-state.test.mjs`
- `tests/desktop-buffer-wiring.test.mjs`

已知状态：

- Pure buffer helper 已做到 `6/6` GREEN。
- Wiring tests 已经进入 RED 阶段。
- `ide.jsx` 的 wiring 还没有最终确认落盘。
- 曾经尝试用一个聚合 patch 处理，但 `git apply --check` 因 stale context 原子失败。
- 后续应重新基于当前 `ide.jsx` 精确上下文拆小 patch。

Buffer Safety 目标：

1. 每个 text tab 独立拥有：
   - `content`
   - `savedContent`
   - `dirty`
   - `loaded` state
2. 切换 tab 时恢复内存 buffer，而不是重新从磁盘覆盖。
3. `Save All` 写入所有 dirty buffers。
4. 每个 dirty buffer 保存自己的 snapshot。
5. save 失败时该 buffer 保持 dirty。
6. rename/delete/close 会更新 buffer state。
7. Workspace reset 会清空 buffers。

---

### 2.6 清理工作

已经清理：

- 删除过 29 个 root-level `.paperos-*` patch/source/log 临时文件。
- 未触碰 `.paperos/`。
- 未删除历史 `app/data` session/audit 文件，因为无法证明所有权。
- 没有新增依赖。
- 没有创建 commit。

当前需要注意：

- Worktree 中有大量用户既有改动。
- 后续不能随意 revert unrelated changes。
- 如果需要 patch，优先小步、可回滚、先 `git apply --check` 再落地。

---

## 3. 现在项目处于什么状态

### 3.1 当前主线

当前主线是：

> 把 Paper OS 从一个领域工具，打磨成一个通用、本地优先、Pack 驱动、外观和交互都足够专业的文档 IDE。

这意味着后续任何功能都要先问：

1. 它是 Workspace Kernel 的通用能力吗？
2. 它是某个 Pack 的专业能力吗？
3. 它有没有污染全局 IDE 语义？
4. 它的 UI 是否像主流专业 IDE，而不是 demo 面板？
5. 它的安全边界是否 local-first、可解释、可验证？

### 3.2 当前最重要的未完成事项

> 2026-07-20 第二轮更新：原 1–6 项（Buffer Safety、auth bootstrap、stale response、modeling leakage、chooser 可访问性、伪 SCM 清理）已全部完成，见 §0。

当前建议的下一批事项（第六轮后更新，优先级从高到低）：

1. **mac/Linux 真实产物 + 代码签名**
   - CI workflow 已就绪（`.github/workflows/release.yml`），需在真实 CI 上跑出 mac/linux tarball；Windows 便携 zip 已能本地产出。进一步：Authenticode（Windows）/ notarization（macOS）代码签名，与 Ed25519 清单签名互补。

2. **desktop 启动器校验签名**
   - launcher 下载/更新时用 `/api/releases/pubkey` 验证 Ed25519 清单 + 比对 sha256 后再运行。

3. **Workspace 权限与 native picker**
   - 全局 external-folder registration / Workspace CRUD 仍对所有成员开放；需要 native picker、opaque folder capability、Workspace ACL。

4. **密钥轮换迁移**
   - 轮换 `PAPER_OS_SECRET` 会使旧 `account-providers.json` 密文失效——需 re-encrypt 迁移脚本。

5. **EditTransaction v2 / TOCTOU / 文件监听增量化**；**AI 执行计划真实化 / 真实 SCM**（同前几轮）。

---

## 4. 后续怎么做

### Phase 1：把编辑器底层状态做稳

目标：不丢内容、不串 tab、不被旧请求覆盖。

推荐顺序：

1. 检查当前状态：

```bash
git status --short
Select-String -Path apps/desktop/src/ide.jsx -Pattern "text-buffer|auth/bootstrap|auth/local"
Get-Content apps/desktop/src/text-buffer.mjs
Get-Content tests/desktop-buffer-state.test.mjs
Get-Content tests/desktop-buffer-wiring.test.mjs
```

2. 先跑已有 buffer tests：

```bash
node --test tests/desktop-buffer-state.test.mjs
node --test tests/desktop-buffer-wiring.test.mjs
```

3. 修 `ide.jsx` wiring：

- open file 后写入对应 buffer。
- editor onChange 只更新 active buffer。
- tab switch 从 buffer memory 恢复。
- save 当前文件时保存 active buffer snapshot。
- save all 遍历所有 dirty buffers。
- close/delete/rename/workspace switch 同步 buffer registry。

4. 做 stale response guard：

- `loadTree()` 使用 request token 或 workspace id snapshot。
- `openFile()` 使用 request token 或 active path snapshot。
- response 返回时如果 workspace/file 已变，直接丢弃。

5. 重新验证：

```bash
node --test tests/desktop-buffer-state.test.mjs
node --test tests/desktop-buffer-wiring.test.mjs
node --test tests/desktop-workspace-ui.test.mjs
npm run ide:build
```

---

### Phase 2：补齐本地信任链路

目标：服务端安全策略和桌面启动链路一致。

需要做：

1. 找到 desktop boot auth：

```bash
Select-String -Path apps/desktop/src/ide.jsx,apps/desktop/src/**/*.mjs -Pattern "/api/auth/local"
```

2. 在 local login 前加：

```js
await api.get("/api/auth/bootstrap");
await api.post("/api/auth/local", {});
```

3. 避免重复 bootstrap 带来的状态不一致：

- bootstrap 只用于本地启动握手。
- auth failure 要给可读错误。
- 不要在任意请求失败后盲目 bootstrap。

4. 验证：

```bash
node --test tests/server-auth-security.test.mjs
node --check app/server.mjs
npm run ide:build
```

---

### Phase 3：把 Pack 边界继续做干净

目标：通用编辑器不再泄漏数学建模语义。

要查的关键词：

```bash
Select-String -Path apps,app,docs,tests -Recurse -Pattern "figure-ledger|claim-ledger|paperctl|math-modeling|paper/"
```

处理原则：

- 通用 IDE 文案使用 neutral language：
  - workspace
  - document
  - asset
  - output
  - problem
  - task
- 数学建模文案只出现在：
  - `math-modeling` Pack
  - Pack-specific tasks
  - Pack-specific docs
  - Pack-specific templates

不要把专业能力删掉；要把它隔离到正确位置。

---

### Phase 4：继续打磨 UI 到 Cursor-class

目标：从“能用的工具”升级到“专业 IDE 产品”。

重点：

1. Workspace chooser
   - 更像真实 app onboarding / project picker。
   - 有 loading / empty / error / retry。
   - 支持键盘、Escape、焦点恢复。

2. Activity bar
   - 图标、状态、hover、disabled 状态要一致。
   - 不可用能力不要假装可用。

3. Command palette
   - 只显示当前 Pack 支持的命令。
   - disabled 命令要说明原因。

4. Bottom/status bar
   - 不要假装有 Git branch。
   - 显示真实状态：
     - active pack
     - workspace trust
     - dirty count
     - task/progress state

5. Editor/preview split
   - 强化文档 IDE 感。
   - 避免数学建模 demo 感。

6. Visual QA
   - 参考基线：

```text
.omx/state/workspace-polish/reference/
```

建议视口：

- `1440x900`
- `1100x720`

---

### Phase 5：再做安全复审

当前已修好 path traversal、junction escape、local auth bootstrap 的一部分，但还需要复审：

1. AuthZ / Workspace 权限
   - 目前所有 authenticated members 可能都有全局 external-folder registration 和 Workspace CRUD 权限。
   - 后续要做：
     - native picker
     - opaque folder capability
     - Workspace ACL

2. Filesystem TOCTOU
   - realpath containment 已有，但 symlink swap 仍需更强策略。

3. Walker 性能边界
   - tree/search/export 不应无限同步遍历大目录。

4. WebSocket trust
   - 保证和 HTTP 路由一致的 Host / Origin / Cookie 策略。

---

## 5. 建议的完整验证清单

在准备交付前，建议跑：

```bash
git status --short
git diff --check

node --check app/server.mjs
node --test tests/server-auth-security.test.mjs
node --test tests/server-workspace-security.test.mjs
node --test tests/desktop-workspace-ui.test.mjs
node --test tests/desktop-buffer-state.test.mjs
node --test tests/desktop-buffer-wiring.test.mjs

npm run build
npm run ide:build
```

如果项目中 Python runtime suite 仍然可用，也要跑：

```bash
python -m pytest
```

还应做：

- smoke test
- DOM smoke
- visual smoke
- timeout smoke
- 1440×900 视觉检查
- 1100×720 视觉检查

最后启动并保持 IDE 可用：

```text
http://127.0.0.1:3719/ide/
```

---

## 6. 给下一位接手者的具体操作建议

### 第一步：不要马上重构

先确认当前文件状态和已有测试。这个仓库已有大量用户改动，不能大面积格式化或回滚。

### 第二步：先补 buffer wiring

这是最高价值、最低争议的下一步。建议只改：

- `apps/desktop/src/ide.jsx`
- 必要时小改 `apps/desktop/src/text-buffer.mjs`
- 对应 tests

### 第三步：再补 auth bootstrap

服务端已经有安全策略，前端必须适配，否则真实启动会有断点。

### 第四步：再做 Pack leakage cleanup

不要删数学建模能力，只是把它们移回 `math-modeling` Pack。

### 第五步：UI polish 和视觉 QA

在底层状态稳定之后再打磨视觉，否则容易返工。

---

## 7. 当前风险和注意事项

- `apply_patch` 在 Windows sandbox 中有时会 timeout。
  - 更可靠方式：生成小型 unified diff。
  - 先 `git apply --check`。
  - 再实际 apply。

- 不要删除 `.paperos/`。

- 不要清理 `app/data` 历史 session/audit 文件，除非能证明所有权和用途。

- 不要把 `math-modeling` 做成全局默认语义。

- 不要新增依赖，除非明确需要并经过验证。

- 不要声称有完整 Terminal / Git / SCM，除非实际实现。

- 不要在没有测试保护的情况下重构 editor state。

---

## 8. 推荐继续工作的短任务列表

> 第二轮已完成：1–10 全部打勾（见 §0 与 §0.7）。

下一批推荐短任务：

1. apply-blocks 增加写前 mtime 校验与失败回滚（EditTransaction 第一步）。
2. Workspace 注册走 native folder picker（替代手输路径）。
3. tree/search/export walker 加深度与条目上限，超限报错而不是无限遍历。
4. WebSocket 与 HTTP 的 Host/Origin/Cookie 策略一致性复审。
5. AI 面板接真实 provider 配置，去掉静态模型选项。
6. `market/`：把调研结论沉淀为 PRD（Overleaf AI Assist 是直接对标，见 §10）。

---

## 9. 交接结论

Paper OS 的方向已经定清楚：

> 它应该是一个以 Workspace Kernel 为核心、以 Pack 为能力边界、本地优先、专业美观、可验证安全的通用文档 IDE。

已经完成的工作主要集中在：

- 产品定位收敛。
- Workspace/Pack 架构。
- UI capability gating。
- path security。
- local browser trust。
- 文档更新。
- buffer safety TDD 起步。

下一位接手者最应该继续的是（第二轮后更新）：

1. AI Apply 的事务化（mtime 校验 → 快照 → 回滚）。
2. Workspace 权限模型与 native picker。
3. Walker 性能边界与 TOCTOU 加固。
4. AI 面板产品化（真实 provider / 真实任务编排）。
5. 若做 Git 集成，作为独立 capability 从零设计，不复用伪状态。

---

## 10. 市场调研摘要（2026-07，支撑产品方向）

- **Overleaf（Digital Science）**：约 2000 万用户，2025-06 起以 AI Assist 付费加购形式集成 Writefull（TeXGPT、语言润色、error assist）。这验证了 "LaTeX + AI" 的付费意愿，也是 Paper OS 的直接对标。
- **本地优先的空缺**：Overleaf 免费档有编译超时/队列限制，且文档存云端。隐私、离线、编译速度（本地 1-5s vs 云端 5-120s）是明确的细分需求；已有 Thetapad 等 local-first 新品以此切入。
- **桌面竞品**：VS Code + LaTeX Workshop（530 万+ 安装）占开发者心智；TeXstudio 占专用桌面 IDE 约 15%；两者都没有一体化的 AI 工作流。Texifier 证明"精致桌面体验"本身可以卖钱。
- **结论**：Paper OS 的差异化 = 本地优先（隐私/速度/离线）+ Cursor 级 AI 工作流（inline edit、apply、evidence）+ Pack 化多领域扩展。竞品要么云端 AI（Overleaf）要么本地无 AI（TeXstudio），两者兼得的位置目前是空的。企业/机构市场看重的正是本地数据边界 + 可验证安全，这与 Workspace Kernel 的安全设计路线一致。

