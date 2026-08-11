---
title: T3.6 真实 Workbench Hero 截图 — 尝试与卡点
status: blocked
as_of: 2026-08-11
baseline_commit: a4ab293
depends_on: T3.3
---

# T3.6：真实 Workbench Hero 截图（尝试记录 / 交接）

## 目标

用 CDP 冒烟脚本拍摄已验证的真实 Workbench AI 状态（打开 `paper/main.tex` 源码 + PDF 预览 + AI「Preview → Apply」面板），导出 `web/public/hero-ide.png`（≤300KB），替换 `web/src/pages/Home.jsx` 中的临时 `HeroIdeMock`，并通过 `web:build`/`ide:build`、1440/1100 实拍与能力门控审查。

## 本轮已验证可行的部分

- 采集管线打通：`app/browser-visual-smoke.mjs` 能自启动隔离服务、bootstrap 会话、注册 `ai-qa` Workspace、驱动真实 mock-local AI「ready」提案（4 步 ActionTimeline、Reject/Apply、`paper/main.tex` 提案），并按 `Page.captureScreenshot` + `clip {0,0,1440,900}` 导出。
- 尺寸满足预算：导出的 PNG 约 **133KB**，远低于 300KB。
- 打开文件路径可用：点击 `.file-tree .item`（`main.tex`）后 `.item.active` 与预览面板 docked 均正常；`main.tex` 种子已可换成更完整的 methodology LaTeX。

## 卡点（当前环境无法产出合格 Hero）

1. **Monaco 编辑器在无头 Edge 下不合成**：源码编辑器为 `@monaco-editor/react`（`web/src/components/LaTeXEditor.jsx`）。在 `--headless=new` + SwiftShader 软件渲染下，`.monaco-editor .view-line` 存在于 DOM，但截图里编辑器区域是整块黑屏。等待 `.view-line` 渲染后仍为黑，属于无头合成问题，非加载失败（`monaco-editor` 本地已装，jsdelivr 也可达）。
2. **有头 Edge 连不上调试端口**：改为有头（真实 GPU）时 `waitForTab` 报 `Browser DevTools tab did not become available`，疑似本机已有 Edge 实例占用，新实例未绑定 `--remote-debugging-port`。需在无竞争 Edge 实例时重试。
3. **无 Tectonic/LaTeX 工具链**：PDF 预览只能显示占位内容，且顶部有「Tectonic not installed」横幅。即便 Monaco 正常出图，Hero 也会带占位 PDF 与安装横幅，不足以替换现有精修示意图。

结论：当前可采到的真实截图质量低于现有 `HeroIdeMock`（已显式标注「界面示意」）。为不使首页回退，本轮**回滚了全部采集实验**（工作区 clean，`a4ab293`），保留示意图，T3.6 保持 open。

## 专用采集脚本（已实现，待在稳定环境验证）

已新增 `app/hero-ide-visual-smoke.mjs` 与 `npm run hero-visual-smoke`：启动隔离服务与 `hero-ide` Workspace（种子为完整 methodology LaTeX），**有头 + 真实 GPU** 启动 Edge，注册会话 cookie，导航到 Workbench，打开 `main.tex`、等待 Monaco `.view-line` 绘制、驱动真实 mock-local AI 到 `.ai-proposal__state--ready`，再按 1440×900 截图导出 `web/public/hero-ide.png`。选择器与已通过的 `verifyWorkbenchAI` 完全一致。

在当前沙箱**未能端到端验证**：无头下 Monaco 不合成；改有头后可连 DevTools，但进程清理（`taskkill`）在多次浏览器运行后进入系统级卡顿，导致 `finally` 挂起、真实错误被掩盖。该脚本的 `finally` 已改为容错（延迟 + `rmSync` 重试 + try/catch），在**干净的有头 GPU 工作站、且无其它 Edge 占用调试端口**时应可直接产出资产。

## 完成路径（下次在合适环境执行）

1. 在干净工作站运行 `npm run hero-visual-smoke`，产出 `web/public/hero-ide.png`（≤300KB）；若装有 Tectonic，可先编译出真实 PDF 以去掉「未安装」横幅。
2. 备选：将 `@monaco-editor/react` 配为使用本地 `monaco-editor`（`loader.config({ monaco })` + Vite worker），改善离线/本地优先与确定性渲染后再采集。

完成后：替换 `Home.jsx` 中 `<HeroIdeMock />` 为 `<img className="hero-shot" src="/hero-ide.png" alt="真实 Paper OS Workbench：源码、PDF 预览与 AI Preview → Apply" />`（保留 `.hero-stage-wrap` 视差与 reduced-motion 门控、`TraceBadge` 叠加），并更新 `tests/web-home-hero.test.mjs`（第 2 个用例断言的 `.hero-mock-*`/`界面示意` 需改为真实图断言）与 `app/home-hero-visual-smoke.mjs`、`app/browser-visual-smoke.mjs` 中 `.hero-mock` 就绪选择器；随后 `node --test`、`npm run build`、`npm run home-hero-visual-smoke` 复验并同步 STATUS/HANDOFF/redesign/issue/CHANGELOG。

## 关键文件

- `app/hero-ide-visual-smoke.mjs`（专用采集脚本，`npm run hero-visual-smoke`）
- `web/src/pages/Home.jsx`（Hero 组合，`.hero-stage-wrap` → `.hero-stage` → `HeroIdeMock`）
- `web/src/components/HeroIdeMock.jsx`（当前临时示意）
- `web/src/components/LaTeXEditor.jsx`（Monaco 装配）
- `app/browser-visual-smoke.mjs`（CDP 采集 harness，`verifyWorkbenchAI` 的 ready 状态是 Hero 输入）
- `tests/web-home-hero.test.mjs`、`app/home-hero-visual-smoke.mjs`（替换后需同步的门禁）
