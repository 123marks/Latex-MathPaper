# 06 · 架构与模块化演进（Architecture）

> 用户痛点里的"架构、框架、工作流、功能模块"落在这里。本文只讲**结构与演进**，
> 领域契约（WorkspaceSession / Resource / BuildProfile / BuildJob / ArtifactSet / EditTransaction /
> ToolRuntimeService）以既有 `docs/ARCHITECTURE.md` 为权威，本文给**落地的目录与迁移步骤**。

原则：**先分层、再抽契约、每步测试护栏、搬运不改语义**。不为假想需求过度设计。

---

## 1. 现状（已核实）

| 部件 | 现状 | 问题 |
| --- | --- | --- |
| 后端 | `app/server.mjs` 单文件巨型路由（60+ `/api/*`，手写 if/else 匹配） | 无分层、难测难改 |
| 领域库 | `app/lib/{workspaces,auth,secret-box,signer,store,workspaces,modeling-status}.mjs` | 已有雏形，边界还散在 server |
| 桌面前端 | `apps/desktop/src/ide.jsx` 144KB 单文件 | 见 `05`§7 |
| 网页前端 | `web/src/{pages,components,lib,styles}` | 结构尚可，缺组件库分层与图表 |
| 状态 | React 组件内隐式 state | 无 Session/Store 抽象 |
| 测试 | `tests/*.test.mjs`（node --test，59 通过）+ pytest | 好资产，重构护栏 |

---

## 2. 前端架构（Web + Desktop 统一语言）

### 2.1 目录规范（web/src 目标）

```
web/src/
  main.jsx App.jsx
  routes/            # 路由表集中（现散在 App.jsx，抽出）
  layouts/           # SiteLayout, AppLayout, AuthLayout, AdminLayout
  pages/             # 页面（薄，组合 features + ui）
  features/          # 领域功能块：auth, workbench, magnifier, team, market, community, usage, admin
  components/
    ui/              # 设计系统原子：Button, Card, Chip, Tabs, Table, Modal, Drawer, Toast, Segmented, Skeleton, Meter...
    motifs/          # 母题：HorizonBackground, TraceBadge, ActionTimeline, EvidenceFlow, QuillMark, CountUp
    charts/          # 数据可视化（见 07）
  lib/               # api.js, auth.jsx, ws.js, format.js, motion.js（新）, hooks/
  styles/            # tokens.css, base.css, components.css, pages.css（后续可按 feature 拆）
```

- **分层纪律**：`pages` 只组合，不写复杂逻辑；`features` 承载数据获取 + 业务；`components/ui` 纯展示、无业务、消费令牌；`components/motifs` 是品牌母题；`lib` 是无 UI 的工具。
- 现有组件（`Logo/Icon/Reveal/Ambient/CommandPalette/Chart/...`）按上表归位（`Chart.jsx` 并入 `charts/`）。
- 引入路径别名（vite `resolve.alias`：`@/` → `src/`）减少相对路径地狱。

### 2.2 组件库（Design System 落地）

- 把 `01-design-system.md` 的组件实现为 `components/ui/*`，**每个组件一个文件 + 消费 CSS 类**（继续用 CSS 变量方案，不引入 CSS-in-JS，保持零重依赖）。
- 组件 API 稳定、受控、可组合；禁止在页面里散写魔法样式（现状 `Home/Download` 有大量 inline style，逐步收敛到类）。
- Storybook 非必需（避免重依赖）；改用一个 `/_kitchensink` 内部路由页集中展示所有组件态（dev only）。

### 2.3 状态管理

- 保持轻量：React Context + hooks（`auth.jsx` 已是范式）。不引入 Redux/MobX 等重库。
- 新增：`useWorkspaceSession`（对齐 `ARCHITECTURE.md` §WorkspaceSession）、`useCompile`、`useAI`、`useUsage` 等 feature hooks。
- 服务端状态可用轻量 fetch 封装（`lib/api.js` 已有）；如需缓存/失效，考虑极小的自写 SWR 式 hook，不引 react-query（除非明确收益 > 体积）。

### 2.4 Web 与 Desktop 共享

现状两套 IDE（`web/.../Workbench.jsx` 与 `apps/desktop/.../ide.jsx`）。策略（`05`§7.1 呼应）：
- **短期**：抽共享**纯组件/纯函数**（editor 语言配置、outline/problems 解析、diff 渲染、母题组件、ui 原子）到可被两端 import 的位置。
- **落地方式（二选一，`08` 定）**：① 建 `packages/shared/`（npm workspaces）；② 桌面端从 `web/src` 相对 import 共享文件（更简单，先用②，重依赖再升①）。
- 差异部分（桌面：本地 FS/进程、原生集成；网页：只读/协作视图）各自保留。

### 2.5 前端工作流（构建/开发）

- Web：Vite（`web/`）；Desktop IDE：`apps/desktop/build-ide.mjs` → `app/ide/`。保持。
- 生产 minify + 默认关闭 sourcemap；状态以当前 Vite/build 配置和 build 验证为准。
- 加 lint（现有 lint 全绿，保持规则）；可加 `prettier --check`（不改风格，仅一致性）。

---

## 3. 后端架构（`app/server.mjs` 分层）

### 3.1 目标分层

```
app/
  server.mjs         # 仅：HTTP/WS bootstrap + 中间件装配 + 路由挂载（薄）
  http/
    router.mjs       # 声明式路由表（method+path → handler），替换手写 if/else 链
    middleware.mjs   # 安全头/CSP、loopback Host/Origin 校验、readBody 限额、限流、鉴权门
    respond.mjs      # 统一 json/error/stream 响应 + 错误码（不泄内部细节）
  routes/            # 按域拆：auth, account, editor, engine, releases, admin, community, team, market, usage, chat, provider, health
  services/          # 无 HTTP 依赖的业务：workspaceKernel(已有 lib/workspaces), build(compile), evidence, ai, usage, releases(signer 已有)
  lib/               # 现有：auth, secret-box, signer, store, workspaces, modeling-status（保持）
  data/              # 运行时数据（勿动）
```

### 3.2 迁移原则（零语义变更 + 测试护栏）

1. **不改安全逻辑语义**：鉴权、loopback/Origin 校验、路径包含（realpath containment）、限流、CSP、body 限额、
   bootstrap 一次性 cookie、apply-blocks 冲突 409/回滚——这些是资产（见 [`../ARCHITECTURE.md`](../ARCHITECTURE.md) 与 `tests/server-*.test.mjs`），
   只"搬运"到 `middleware/routes/services`，**行为字节级不变**。
2. **先建路由表壳**：把现有 `if (method===.. && path===..)` 分支逐个改成 `router.add(method, path, handler)`，handler 先原样内联，再抽到 `routes/*`。
3. 每搬一组端点，跑对应测试：
   `node --test tests/server-auth-security.test.mjs tests/server-walker-bounds.test.mjs tests/server-ws-hardening.test.mjs tests/workspace-http.test.mjs tests/account-api.test.mjs tests/admin-api.test.mjs tests/editor-apply-transaction.test.mjs tests/spa-fallback.test.mjs`。
4. WS 加固逻辑随 `http/middleware` 一起迁移，保持 try/catch 包裹与 Host/Origin/Cookie 一致性，并以 `tests/server-ws-hardening.test.mjs` 为回归护栏。
5. 全程 `node --check app/server.mjs` + 全量 `node --test tests/*.test.mjs` 绿。

### 3.3 端点清单（现状，迁移时作为对照表）

鉴权/账户：`/api/auth/{register,login,bootstrap,local,logout,me}`、`/api/account/{overview,profile,password,provider,provider/key,sessions/revoke-others}`。
编辑器/构建：`/api/editor/{tree,file(GET/PUT/DELETE/PATCH),projects(GET/POST),search,export,raw,run,compile,compile-live,evidence,apply-blocks}`、`/api/engine/{status,install/tectonic}`。
平台：`/api/{health,content,releases,releases/pubkey,summary,intelligence,provider(GET/POST),upload,run,chat,usage/me}`、`/api/community/posts(GET/POST)`、`/api/{team,team/tasks(GET/POST),market/skills,skills}`。
后台：`/api/admin/{metrics,users,audit,system(GET/PUT),keys,releases,content(PUT),usage,stream}`。
兼容：`/api/contest`、`/api/contest/*`、`/api/onboard`（math-modeling 兼容别名，保留，`contest` 仅兼容别名不入新 API，`ARCHITECTURE.md` §迁移）。

### 3.4 领域契约演进（对齐 `ARCHITECTURE.md`，按序）

按 `ARCHITECTURE.md` §Migration Sequence 与 `CAPABILITY_MAP.md` §Delivery Order 推进，本重设计**不提前**做深水区，仅在 P6 起步：
1. `WorkspaceSession`：把隐式 React/server 状态收敛成显式会话（生命周期 opening→ready→closing→closed）。
2. `Resource/TextDocument`：路径 + Monaco 模型 → 带 version/checkpoint 的文档模型（为冲突感知/协作铺路）。
3. `EditorProvider/PreviewProvider` 注册表：替换硬编码类型分支（保留文本兜底）。
4. `BuildProfile→BuildJob→ArtifactSet`：把 `/api/editor/compile*` 的路径启发式升级为声明式构建 + 可取消作业 + 类型化产物。
5. `EditTransaction`：把 apply-blocks 升级为带 base checkpoint/冲突态/原子回滚/撤销的事务（现已有 409+journal 回滚雏形）。
6. `ToolRuntimeService`：统一 Tectonic/latexmk/格式化器的发现/安装/权限/超时/取消/流式输出。
7. `math-modeling` 的 `paperctl`/UI 收敛为 Pack 贡献点（命令/视图/构建档），不再全局耦合。

> 每一步都是独立 PR 级改动，先加契约与测试，再切流量，最后删旧路径。**不要**一次性重写。

---

## 4. 数据可视化架构（详见 `07`）

- 不引图表大库；建 `components/charts/*`（SVG/Canvas 自绘，消费令牌）。
- 图表数据经 feature hooks 从 `/api/usage/*`、`/api/admin/*`、`/api/team`、`/api/editor/evidence` 获取，组件只管画。

---

## 5. 安全不变量（保持，勿破）

沿用 [`../ARCHITECTURE.md`](../ARCHITECTURE.md) 的 Safety Invariants 与 [`../STATUS.md`](../STATUS.md) 的当前实现证据：
1. 所有读写经活动 Workspace root 解析（realpath containment，拒绝穿越/绝对路径/junction 逃逸）。
2. 本地信任：loopback Host/Origin 校验（HTTP + WS），一次性 bootstrap cookie。
3. 每用户 API Key AES-256-GCM 加密（明文不落盘不回传）；发布清单 Ed25519 签名。
4. AI/批量写入经预览 + 显式 Apply；apply-blocks 冲突 409 + journal 回滚。
5. 限流、body 限额、安全响应头（CSP 等）、错误信息不泄内部。
6. 原子存储（临时文件 + rename），损坏回退不抛。
重构只能“搬运”这些，不得削弱。密钥轮换迁移脚本是已知待办，操作风险见 [`../RUNBOOK.md`](../RUNBOOK.md)，可在 P6 补。

---

## 6. 落地清单

- [ ] Web：抽 `routes/`、`layouts/`、`features/`、`components/{ui,motifs,charts}`；加 `@/` 别名；`/_kitchensink` dev 页。
- [ ] 状态：新增 feature hooks（session/compile/ai/usage）。
- [ ] 共享：抽两端共用纯组件/函数（先相对 import，必要时升 workspaces）。
- [ ] 后端：建 `http/{router,middleware,respond}` + `routes/*` + `services/*`，逐组迁移端点，测试护栏。
- [ ] 领域契约：P6 起按 §3.4 顺序，逐个 PR + 测试。
- 验证：`node --check app/server.mjs`、`node --test tests/*.test.mjs` 全绿、`python -m pytest`（如可用）、`web:build`/`ide:build` 绿。
