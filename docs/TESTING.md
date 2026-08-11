# Paper OS 测试与验证

测试结果用于证明一个明确范围，不是“项目整体没问题”的替代品。每次交付必须记录日期、commit、工作区 clean/dirty、命令、退出码、通过/失败数和未覆盖项。

## 最小门禁

从仓库根目录：

```powershell
git diff --check
node --check app/server.mjs
node --test
npm run build
python -m pytest tests/test_paperctl_runtime.py
```

`node --test` 让 Node 自己发现 `tests/**/*.test.*`，比在 Windows 依赖 shell glob 更稳定。

## 验证矩阵

| 层 | 命令 | 证明范围 | 不证明 |
| --- | --- | --- | --- |
| 格式 | `git diff --check` | 无 whitespace error/conflict marker | Markdown 内容正确 |
| Server syntax | `node --check app/server.mjs` | 主服务可解析 | 路由行为正确 |
| Node suite | `node --test` | Workspace、auth、account、admin、store、signing、apply、desktop wiring、motion hooks、motif SSR/CSS、发布包 launcher 完整性等回归 | 浏览器渲染、原生壳 |
| Python suite | `python -m pytest tests/test_paperctl_runtime.py` | math-modeling CLI/runtime | 通用 IDE |
| Web build | `npm run web:build` | React/Vite production build | 视觉和运行 API |
| IDE build | `npm run ide:build` | desktop bundle | native launcher/真实交互 |
| Combined build | `npm run build` | Web + IDE | .NET/Tauri/package |
| API smoke | `npm run smoke` | 本地服务关键端点/流程 | 复杂 UI |
| DOM smoke | `npm run dom-ui-smoke` | DOM 关键状态与文案 | 像素质量 |
| Visual smoke | `npm run visual-smoke` | Horizon 源码、构建资产、reduced-motion/fallback/App 接线的静态契约 | 浏览器渲染、截图、运行时行为、人工设计判断 |
| Home browser | `npm run home-hero-visual-smoke` | 1440×900、1100×720、820×800、390×844 的 Hero/公共区块几何、导航互斥；另测 40px/41px Header、881px 桌面边界、820/390 菜单首焦点/Escape、认证态唯一下载主 CTA、reduced-motion 和结构化证据 | 真实 Workbench 截图、真实 AI timeline、实体 GPU/真机性能、跨设备像素基准 |
| Browser visual | `npm run browser-visual-smoke` | 默认 strict；真实 Edge/Chrome 的 1440x1200 截图、Horizon 生命周期/降级/fallback、Workbench 和结构化哈希证据 | 实体 GPU 呈现 FPS、其他设备/视口、人工设计判断 |
| Workbench AI T3.3 | `node --test tests/web-workbench-ai.test.mjs tests/editor-apply-transaction.test.mjs tests/workspace-http.test.mjs tests/browser-visual-smoke.test.mjs` + `npm run browser-visual-smoke` | provider/runtime truth、SSE buffering、真实 ActionTimeline、BEGIN_FILE preview/diff、baseline Apply、Reject、409/rollback 与 1440×1200/390×844 Edge 证据 | 生产 provider SLA、本机模型推理、通用 undo/hunk UI、T3.6 Hero 产品截图 |
| Public pages T1.4 | `npm run web:build` + Vite `5174` + backend `3719` + `npm run public-pages-visual-smoke` | Features/Pricing/Enterprise 的 3 routes x 4 viewports；`browserErrors=[]`、44px min touch、`scrollY=0`、零 horizontal/text/out-of-bounds overflow、yearly + FAQ keyboard、reduced-motion pass；共享 strict Edge 另以 `npm run browser-visual-smoke` 验证 | Vite-alone 不够；`/api` 代理到 `3719`，少了后端会返回 `500`/`ECONNREFUSED` |
| Runtime timeout | `npm run runtime-timeout-smoke` | 工具超时路径 | 所有 runtime 错误 |
| WinForms | `powershell -File .\build-launcher.ps1` | 当前 launcher 可编译 | 安装、升级、签名 |
| Tauri | `cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml` | Rust/Tauri source 可检查 | runtime sidecar/安装包 |
| Windows package | `npm run package:win` | 开发预览 ZIP + SHA 产出 | 依赖完整性、干净机启动、portable/self-contained、Authenticode/自动更新 |

## 按变更选测试

### Workspace/文件系统

```powershell
node --test tests/workspace-kernel.test.mjs `
  tests/workspace-http.test.mjs `
  tests/server-walker-bounds.test.mjs
```

必须覆盖 traversal、absolute path、root deletion、junction/symlink containment、missing external folder 和 walker truncation。

### Auth/account/admin/secret

```powershell
node --test tests/server-auth-security.test.mjs `
  tests/account-api.test.mjs `
  tests/admin-api.test.mjs `
  tests/secret-box.test.mjs `
  tests/store-atomic.test.mjs
```

### Editor/desktop

```powershell
node --test tests/desktop-buffer-state.test.mjs `
  tests/desktop-buffer-wiring.test.mjs `
  tests/desktop-workspace-ui.test.mjs `
  tests/editor-apply-transaction.test.mjs
npm run ide:build
```

### Web motion

```powershell
node --test tests/web-motion.test.mjs
node --test tests/web-motifs.test.mjs
node --test tests/browser-visual-smoke.test.mjs
npm run web:build
npm run browser-visual-smoke
```

`web-motion` 专项测试覆盖 hook 的 SSR/hydration 首值一致、浏览器 layout effect 绘制前 reduced-motion、零 RAF/Observer/输入监听，以及指针视差按需启动和清理；源码测试本身不替代浏览器证据。

`web-motifs` 专项测试通过 Vite SSR 实际加载五个 motif，覆盖真实数据/空态/非法输入、ARIA、TraceBadge 唯一 ID、EvidenceFlow 结构化路径、CountUp locale 与 CSS 解析零 warning。

`browser-visual-smoke` 根脚本默认传 `--strict`，验证真实浏览器行为并写入 `dist/visual-qa/horizon-behavior.json`。仅在非门禁的本地探查中使用 `npm run browser-visual-smoke:optional`；它允许无浏览器环境 SKIP，不得记录为通过。

### T1.4 Public pages

```powershell
npm run web:build
node app/server.mjs # backend 3719
npm --prefix web run dev -- --host 127.0.0.1 --port 5174
npm run public-pages-visual-smoke
node --test tests/web-public-pages.test.mjs
```

Run order:

- Build first, then bring up Vite on `5174` and the existing backend on `3719`.
- Do not use Vite-alone captures as evidence. The browser smoke proxies `/api` to `3719` and will surface `500`/`ECONNREFUSED` if that backend is absent.
- Dedicated public-page evidence is `dist/visual-qa/public-pages-behavior.json` with `browserErrors=[]`, 3 routes x 4 viewports, 44px minimum touch, `scrollY=0`, zero horizontal/text/out-of-bounds overflow, yearly keyboard state, FAQ keyboard open, and reduced-motion pass. The separate shared `npm run browser-visual-smoke` gate produced the 112.6s strict Edge result.

### Server transport/security

```powershell
node --test tests/server-auth-security.test.mjs `
  tests/server-ws-hardening.test.mjs `
  tests/spa-fallback.test.mjs
node --check app/server.mjs
```

### 发布

```powershell
node --test tests/signer.test.mjs tests/admin-api.test.mjs
npm run package:win
Get-FileHash dist\release\PaperOS-0.5.0-windows-x64.zip -Algorithm SHA256
```

发布门禁还必须在独立进程中用 `/api/releases/pubkey` 验证 manifest 签名，并在目标 Windows 版本启动产物。SHA 和 Ed25519 不能替代 Authenticode。

## 视觉 QA

最低视口：

- 1440x900
- 1100x720
- 一个手机视口用于公开站

检查：

- 无文本、按钮、导航、浮层和 panel 重叠。
- longest localized text 不溢出。
- 键盘焦点可见，dialog 能 trap focus/Escape 恢复。
- `prefers-reduced-motion` 下无持续动画；WebGL 创建失败时静态 fallback 仍可用。
- loading/empty/error/retry/disabled/dirty/conflict 状态真实可达。
- 截图对照 `UI-Design/` 和 `docs/redesign/`，记录差异，不只保存“看起来不错”的图。

## 证据记录模板

```markdown
### Verification 2026-08-03

- Baseline: `<commit>` (`clean|dirty`)
- Environment: Windows 11; Node `<version>`; Python `<version>`
- Command: `node --test`
- Result: exit 0; `<pass>/<total>`; duration `<time>`
- Artifacts: `<paths or CI URL>`
- Not tested: `<explicit gaps>`
```


### Horizon T0.3 证据

- 运行顺序：先 `npm run web:build`，再 `npm run browser-visual-smoke`，否则探针会加载旧 bundle。
- JSON 必须包含 `verdict: pass`、`verification.strict: true`、浏览器/OS/Node/Git、WebGL vendor/renderer、行为快照和四张截图 SHA-256；BFCache 还必须来自真实同源 back/forward，记录原生 persisted 事件、同一文档 token 与 `Page.backForwardCacheNotUsed` 结果。
- 独立验算截图哈希；PowerShell 5 读取中文 JSON 时必须显式 `Get-Content -Encoding utf8`，或用 Node `JSON.parse`。
- `drawCallsPerSecond` 仅表示探针统计的 `drawArrays` 调用频率。强制 SwiftShader 的该值不得写成 FPS，也不得作为实体 GPU 性能通过证据。
- 真机性能记录必须补充物理 GPU/驱动、浏览器版本、供电/温度、视口/DPR、呈现 FPS 方法和降级触发结果。

### Motif T0.4 证据

- 先跑 `node --test tests/web-motifs.test.mjs tests/web-motion.test.mjs`，再跑 `npm run web:build`；构建日志不得含 CSS syntax warning。
- 每个 motif 必须无 props 可独立 SSR 渲染；业务状态必须来自调用方，禁止在组件内造执行步骤、在线人数或证据。
- `ActionTimeline` 覆盖 done/running/pending、空态和非法状态；`EvidenceFlow` 只接收经过校验的结构化点；`TraceBadge` 多实例 ID 不冲突。
- `CountUp` 默认使用产品确定 locale，SSR/hydration 首值一致；reduced-motion 在浏览器绘制前收敛且不启动持久动作。
- `base.css` 必须通过解析器零 warning，`marchAnts`/`foilShimmer` 有真实调用方，所有持久动画有 reduced-motion stop。
- T0.4 完成只证明原子组件契约，不证明 Home/Workbench 已完成页面级接入。

失败不得从记录中删除。修复后保留失败原因和新的通过证据，或链接 issue/commit。

### T0.5 UI primitives 证据

T0.5 是 UI 词汇层收口，不是页面级 redesign 完成。先写测试再写实现；首轮 BackgroundVideo 与 Kitchensink 回归、独立复审后的 production MIME/层级、Tabs IDREF 和空命名回归都在旧实现上得到预期 RED。后续审查发现的自动视频 reduced-motion 缺口、JPEG poster MIME 缺口和 motion 偏好单向锁存也分别先复现为 RED：旧实现会多发 1 次 HEAD、把 `.jpg/.jpeg` 返回为 `application/octet-stream`，并在 `true → false` 后继续保持 reduced。

验证顺序（PowerShell）：

    node --test tests/web-background-video.test.mjs
    node --test tests/web-motion.test.mjs
    node --test tests/web-ui-primitives.test.mjs
    npm run web:build
    npm run ide:build
    node --test
    python -m pytest -p no:cacheprovider
    npm run visual-smoke
    npm run browser-visual-smoke
    node app/kitchensink-visual-smoke.mjs http://127.0.0.1:5174/_kitchensink
    git diff --check

验收范围：

- web/src/components/ui/ 必须包含十四个公开 primitive；每个可独立 SSR/render，旧 Button/Card/Chip class API 不得回归。
- Kitchensink 必须展示可适用的 default、hover/focus、disabled、loading、empty、error、dirty、critical 状态；不能把示例状态冒充业务数据。
- Tabs/Segmented 验证方向键、Home/End、disabled 跳过、roving tabindex 和所有 `aria-controls` IDREF 可解析；Dialog/Meter 拒绝空可访问名称；Modal/Drawer 的初始焦点、Tab/Shift+Tab、Escape、焦点恢复同时有共享 helper 单测和真实 Edge 证据。
- 1440×900、1100×720、390×844 必须无横向溢出、文本裁切和小于 31px 的可见控件，且 capture 前 scrollY 必须为 0。
- 生产 Web build 必须精确检索不到 Kitchensink 文案；dev-only 路由只能由 import.meta.env.DEV 动态导入。可选 `bg-space.mp4` 必须由 production server 以 `video/mp4` 返回，`bg-space.jpg/.jpeg` 必须是 `image/jpeg`；reduced-motion 下不得探测或渲染自动循环视频，偏好恢复后共享 hook 必须能回到 normal motion，且卸载时清理 media-query listener。视频与 scrim 必须位于 Horizon 上方的低不透明度可见层。
- T0.5 证据：dist/visual-qa/kitchensink-behavior.json，以及 kitchensink-1440x900、kitchensink-1100x720、kitchensink-390x844 的 viewport/full-page PNG。证据只证明本阶段组件和浏览器布局，不证明实体 GPU、移动真机、像素基准、桌面壳或签名安装。

### T0.6 Icon registry 证据

T0.6 只验证两端图标语义注册和兼容行为，不宣称页面级接入完成。测试必须实际导入并渲染 Web/桌面 `Icon`，不能只用源码正则查找 `case` 文本；未知名称行为也必须锁定。

验证顺序：

    node --test tests/icon-registry.test.mjs
    node --test
    npm run web:build
    npm run ide:build
    npm run visual-smoke
    npm run browser-visual-smoke
    node app/kitchensink-visual-smoke.mjs
    git diff --check

验收范围：

- `web/src/components/Icon.jsx` 与 `apps/desktop/src/icons.jsx` 共同支持 `menu`、`template`、`git-branch`、`sync`、`magnifier`、`evidence`、`mcp`、`play`、`filter`、`export`，并分别导出 `ICON_NAMES`。
- Web 未知语义继续静默返回空；桌面未知语义继续返回既有圆形 fallback；桌面旧 `branch`/`refresh` 别名不得回归。
- 当前证据：icon registry 2/2、Node 115/115、Python 25/25、Web 2297 modules、IDE build、visual-smoke、严格 Edge 和 Kitchensink 三视口通过；生产包精确检索输出 `NO_KITCHENSINK_IN_PRODUCTION`。
- T0.6 证据证明注册表、构建和既有 T0.5 验收面没有回归，不证明实体 GPU、移动真机、像素基准、WinForms/Tauri 真机或签名安装链。

### T1.1 Home Hero 证据（历史基础）

T1.1 当前验收对象是 truth-driven B 路线。`HeroIdeMock` 必须显示“界面示意”，只描述真实存在的 Pack、Preview → Apply 等产品契约；不得把它写成 Workbench 截图或真实 AI 执行记录。未经基准证明的编译秒数、证据类别数量，以及“模型推理不出本机”等表述必须由测试拒绝。

验证顺序：

    node --test tests/web-home-hero.test.mjs tests/web-horizon-palette.test.mjs
    npm run web:build
    npm run visual-smoke
    npm run home-hero-visual-smoke
    npm run browser-visual-smoke

验收范围：

- 1440×900、1100×720、820×800、390×844 均无横向溢出、目标文本裁切、越界、Hero 文案与产品预览重叠；预览首屏可见，桌面导航与菜单按钮互斥。
- `#workflow` 点击后锚点不被固定导航遮挡；reduced-motion 下 Hero 入场、滚动视差、TraceBadge 与平滑滚动静态化，滚动前后 stage transform/opacity 不漂移。
- 820px 菜单具有 `aria-expanded`/`aria-controls`、移动导航 landmark；打开后首链接获得焦点，Escape 关闭并把焦点还给菜单按钮。重新打开后从 820px 拉宽到 1000px 必须卸载移动导航并恢复主导航，缩回 820px 后保持关闭。
- 报告为 `dist/visual-qa/home-hero-behavior.json`，原始 PNG 与报告同步生成，并要求 `browserErrors=[]`。报告内 `evidenceSha256` 是对规范化行为字段计算的稳定 SHA-256：排除 `generatedAt`、逐帧截图字节/SHA，并将几何采集归一到 0.1px；截图原始 SHA 仍逐张保留。T1.1 收口时稳定行为 SHA-256 为 `61d18c1e1eecc118be5020530ee310530754df389c8b365df61c56d005b0f16c`，这是历史快照；当前 T1.2 值见下一节。
- 该证据只完成 T1.1 B 路线；在该历史快照时 T3.3 与 T3.6 均待单独实现。当前 T3.3 证据见后文；T3.6 `web/public/hero-ide.png` 仍待完成。

### T1.2 公共区块与 Home 全页证据（历史快照）

T1.2 的验收对象是七个可复用公共组件及 Home 的真实组合，不是只检查文件存在。`SectionHead`、`StatRow`、`WorkflowRibbon`、`FeatureCard`、`FAQ`、`LogoWall`、`CtaBand` 必须独立渲染；Home 必须实际使用全部组件，并保持产品事实、原生语义和 Pack capability 边界。

验证顺序：

```powershell
node --test tests/web-public-sections.test.mjs `
  tests/web-home-hero.test.mjs `
  tests/home-hero-evidence.test.mjs
node --test
python -m pytest -p no:cacheprovider
npm run build
npm run visual-smoke
npm run home-hero-visual-smoke
npm run browser-visual-smoke
```

结构与可访问性门禁：

- 七组件必须位于 `web/src/components/public/` 并由 Home 直接导入；不要为当前七个 motif 增加 schema renderer、barrel 或新依赖。
- `StatRow` 每组文档顺序必须是 `dt` 后接 `dd`，值可以是真实字符串；不得为视觉效果恢复没有数据源的 CountUp。
- Workflow 必须是五节点 ordered list、四个 connector DOM 节点和四项中性 evidence label；Evidence 产品能力仍由 Pack capability 决定，静态首页标签不等于全局能力承诺。
- FAQ 必须是四个原生 `details/summary`，wrapper 有可识别 region landmark；真实 Edge 中用 Enter 键打开/关闭，焦点留在 summary，触控行高度不低于 44px。
- LogoWall 只能使用中性受众/场景文案，不能虚构客户、机构或背书。
- Comparison 复用共享 `ui/Table` 的 caption/header/cell label 语义；窄容器下 caption 必须占满可用宽度，不能逐字竖排或产生横向溢出。

浏览器门禁：

- 四视口 workflow columns 必须是 `5/5/2/1`；visible connectors 必须是 `4/4/0/4`。connector 可见处厚度至少 1.9px（当前为 2px）；820px 的 0 是 641–1080px 两列布局的已锁定特例，不应误改为四视口统一显示。
- Comparison caption 宽度比必须维持接近 full width（当前 `0.9984/0.9982/0.9975/0.9947`）；四视口均不得出现 horizontal overflow、目标文本 clipping/out-of-bounds 或 copy/mock overlap。
- 全页证据采集必须逐个访问 Reveal section，等待 CTA opacity 达标，再恢复 `scrollY=0` 执行 full-page capture；报告中的 `fullPageScrollY` 四视口均必须为 0，防止 fixed nav 出现在页面中段。
- reduced-motion 下 workflow connector、Hero、TraceBadge、CTA glow 和 FAQ 装饰过渡必须静态化；移动菜单的 Enter/Escape/首焦点/焦点恢复及 820→1000→820 状态迁移继续作为 T1.1 回归门禁。
- T1.2 收口证据：响应式/可访问性合同 14/14、条件化 connector 合同 6/6、当时全量 Node 134/134、Python 25/25、Web 2308 modules + Desktop IDE bundle、visual smoke 13 keyframes/51 assets、Home smoke 与 strict Edge exit 0；视觉复核 92/100、pass，记录在 `.omx/state/t1-2/ralph-progress.json`。

哈希判读：

- 当前报告：`dist/visual-qa/home-hero-behavior.json`。
- T1.2 稳定行为摘要：`evidenceSha256=d5080b1f2451bf3725d6a497a6973ae2a32553a902841694acbf501e0db9840d`。它用于比较规范化行为，有意排除采集时间、逐帧 PNG 字节/SHA 与亚像素抖动。
- T1.2 报告文件 SHA-256：`7de8da881c40173453e355df642d32d2f4c214158ee3726ecd5a07fc0924f7ca`。每张原始 PNG 的 SHA 也逐项保存在报告中，承担 point-in-time 产物完整性。
- 不要把原始 PNG SHA 纳入现有 `evidenceSha256` 后仍沿用“稳定行为摘要”语义。若需要聚合内容完整性，新增或重命名独立 content/artifact digest，并为两类哈希分别写回归测试。

完成边界：本段是 T1.2 历史快照；T1.3 历史证据见下一节，当前基线见前文 T1.4。

### T1.3 公共导航证据（历史快照）

验证顺序：

```powershell
node --test tests/web-public-navigation.test.mjs
node --test
python -m pytest -p no:cacheprovider
npm run web:build
npm run ide:build
npm run visual-smoke
npm run home-hero-visual-smoke
npm run browser-visual-smoke
```

门禁：

- `/pricing` 必须是唯一 `aria-current="page"`，且 2px 琥珀指示来自该 ARIA 状态；不得增加手写 pathname current state。
- Header 的严格边界是 `scrollY > 40`：40px 仍为透明常规态，41px 必须具备 `nav--scrolled`、`glass-frost`、shadow 与可测收缩。监听必须 passive 并清理同一 callback，不得 scroll-jacking 或新增 RAF。
- 唯一主按钮必须是 `/download`“下载桌面端”；注册/登录或工作台/退出是次级。≤880px 的账户操作在移动导航内仍可达，顶部 CTA 与 44px menu 不得重叠。
- 881px 是 `>880px` 桌面分支的最窄实测边界：主导航必须可见、menu 必须隐藏，导航容器和页面不得溢出，brand/nav 与 nav/actions 不得重叠。当前证据两侧 gap 均为 18px，因此不需要新增第二个 breakpoint。
- 820px 与 390px 都必须真实打开菜单；`document.activeElement` 必须精确等于第一个 `.mobile-nav__link`，随后 Escape 关闭并恢复 menu button 焦点。既有 820→1000→820 自动关闭继续通过。
- 认证态使用 `Page.addScriptToEvaluateOnNewDocument` 在页面加载前只拦截 `/api/auth/me`，触发现有 `AuthProvider`；顶栏仍必须只有一个 `.btn-primary`，href 为 `/download`，工作台入口保持次级。
- 当时实测：聚焦 7/7、全量 Node 141/141、Python 25/25、Web 2308 modules、IDE bundle、visual smoke 13/51、Home 四视口/881px 和 230.8s strict Edge 均通过；视觉复核 94/pass，独立复审 `APPROVED`。
- 当时稳定行为摘要：`117c18b46d45856afebc9447464d33ab94e4506f5e8f2d56f8f6ec1157d4b398`；当时报告文件 SHA-256：`f82f4686e4b854849d23b37f7d16e362f7f947886e78fdbc131f6d02017f0615`。T1.2 哈希只作更早的历史快照。

完成边界：本段只证明 T1.3。T1.4/T1.5 后续均已完成；在该历史快照时 T3.3/T3.6 尚未完成。当前 T3.3 证据见后文，T3.6、实体 GPU/移动真机性能、桌面壳或签名安装链仍开放。

### T1.5 登录/注册证据（历史快照）

验证顺序：

```powershell
node --test tests/web-auth-pages.test.mjs tests/browser-visual-smoke.test.mjs
node --test
python -m pytest -p no:cacheprovider
npm run build
npm run visual-smoke
npm run auth-visual-smoke
npm run browser-visual-smoke
```

auth browser smoke 运行前必须保证 Vite 5174 与 backend 3719 同时在线。它覆盖 `/login` 与 `/register` 的 1440x900、1100x720、820x800、390x844，要求：每页一个 h1；两个可键盘切换的 radio mode；Google/GitHub/企业微信开发 OAuth；`/download` 离线入口；桌面侧栏包含两个视觉 fragment 和五步 trace；移动隐藏侧栏；输入/按钮/链接最小触控 44px；零横向、文本或 out-of-bounds overflow；browserErrors=[]。

交互门禁从登录页以 ArrowRight 进入注册页，验证单一字符类和确认不一致都显示反馈并禁用提交，合法匹配密码重新启用提交，再以 ArrowLeft 返回登录页。reduced-motion 下 Segmented indicator、fragment 和离线入口的 animation/transition 必须收敛到静态阈值。

当前证据：聚焦 19/19、Node 155/155、Python 25/25、Web 2312 modules + IDE bundle、13 keyframes/52 assets、auth Edge 与 strict Edge exit 0。报告 `dist/visual-qa/auth-pages-behavior.json` 的稳定行为摘要为 `81651dc06e68a9874ab414ed8610babe81094e9edb79687a68c55a2707802df4`，报告文件 SHA-256 为 `f0dd5bdf2b5cd71eeb02c895359e7b5953544e9659e75cb8e79fab8608bb7a0e`。

完成边界：本段只证明 T1.5 的历史收口；当前基线是下一节的 T3.3。

### T3.3 Web Workbench AI 面板证据（当前基线）

验证顺序：

```powershell
node --test tests/web-workbench-ai.test.mjs tests/editor-apply-transaction.test.mjs tests/workspace-http.test.mjs tests/browser-visual-smoke.test.mjs
node --test
python -m pytest -p no:cacheprovider
npm run build
npm run visual-smoke
npm run browser-visual-smoke
git diff --check
```

自动化覆盖五层合同：

1. 纯 helper：provider 配置归一化、requesting/streaming/previewing/ready/applying/applied/rejected/failed 生命周期、跨 chunk SSE buffer、多 BEGIN_FILE 解析、bounded replacement diff 和精确 baseline Apply payload。
2. 组件/UI：configured provider 与 response runtime 分离，mock-local 明示，ActionTimeline 使用真实 plan，proposal 路径/bytes/create-update/diff、Reject/Apply、conflict、rollback 和 preview-error 可见。
3. 服务端：真实 provider 与 mock-local 都在第一个 delta 前发送 runtime metadata；上游错误返回 PROVIDER_STREAM_ERROR；JSON no-store；密钥和 provider error body 不进入浏览器。
4. Edit transaction：Preview 返回 path/mtime baseline；Apply 使用同一 assistant text 与 baseline；409 禁用陈旧 Apply并刷新预览；rollback 不保留部分写入；成功后刷新 tree 和受影响的 clean buffer。
5. 真实 Edge：临时 ai-qa Workspace 连续两轮 mock-local 请求，第一轮 Reject 不落盘，第二轮 Apply 写入 paper/main.tex；同时覆盖 1440×1200、390×844、reduced-motion、browserErrors 和根级横向溢出。

当前结果：Node 164/164、Python 25/25、Web 2316 modules、Desktop IDE bundle、visual smoke 13 keyframes/52 assets、strict Edge exit 0。dist/visual-qa/horizon-behavior.json 为 schema 2 / verdict pass / strict true；ai-qa 从 77 bytes 变为 197 bytes，Apply trace HTTP 200、written:[paper/main.tex]。1440×1200 与 390×844 均 overflowX:false；reduced-motion 计算样式为 none / 0.001ms / 1。

截图证据：

| 状态 | 文件 | SHA-256 |
| --- | --- | --- |
| Preview ready | `dist/visual-qa/workbench-ai-ready-1440x1200.png` | `69e4b2dcbb605b31c96e1b549807755b195ca17627f1fc82c3266b3f3e9ec3aa` |
| Applied desktop | `dist/visual-qa/workbench-ai-applied-1440x1200.png` | `f1cde38b737ce9b931842a5c6f113708d84d10b6c9d7ef832df7bfa105e36192` |
| Applied mobile | `dist/visual-qa/workbench-ai-applied-390x844.png` | `6c322b746266f42213dd88d85892ae58a79f8f39d67b7f79f0bcef55ddafd850` |

完成边界：本证据关闭 T3.3，但不证明生产 provider 可用性、本机模型推理、通用 hunk/undo、实体 GPU/移动真机性能或 T3.6 Hero 产品截图。下一严格任务为 T3.6。

## 当前缺口

- 根 `package.json` 尚无统一 `test`、lint、typecheck、docs-check 脚本。
- CI 尚未证明在每次变更运行全 Node/Python/build/security suite。
- 没有稳定的 Markdown link checker 和文档状态校验。
- Tauri/WinForms/安装包缺少自动端到端启动与退出测试。
- 已有严格浏览器行为/截图哈希证据，但仍缺稳定的像素基准对比、可访问性扫描、多设备视口矩阵和实体 GPU 性能基准。
- Windows ZIP 未携带 `app/node_modules` 或 self-contained .NET runtime，尚未通过干净机安装/启动门禁。

