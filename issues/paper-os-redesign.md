---
title: Paper OS enterprise redesign
status: active
owner: next maintainer
updated: 2026-08-10
plan: ../docs/redesign/08-execution-plan.md
result_evidence: ../docs/STATUS.md and ../dist/visual-qa/
---

# 任务：Paper OS 企业级重设计（UI + 架构 + 桌面端）

## 上下文

Paper OS 是本地优先的通用文档 IDE（Workspace Kernel + Packs），含：
- 公开展示站 `web/`（React 18 + Vite + framer-motion + ogl）
- 应用内 IDE `web/src/pages/app/Workbench.jsx` 及桌面 IDE `apps/desktop/src/ide.jsx`（144KB 单文件 → 构建进 `app/ide/`）
- 桌面壳 `launcher/Program.cs`（WinForms + WebView2 → `PaperOS.exe`）
- 后端 `app/server.mjs`（单体路由，60+ `/api/*` 端点）

用户诉求：当前 UI 不够吸引、死板静态、有"人机味"；架构（框架/工作流/功能模块/数据可视化）不够企业级。目标观感已由 `UI-Design/` 15 张参考图锁定（Horizon Atelier：深炭 + 暖琥珀 + 地平线辉光 + 编辑体衬线）。要求：企业级展示前端 + 可下载 exe 桌面端，两者都要打磨。参考 Cursor / Overleaf / new-api / API-Monitor / 即梦 / Midjourney。

## 计划（方案 B：9 篇详规 + 3 个黄金样例）

文档集位于 `docs/redesign/`：
1. `README.md` — 总览、差距、调研、原则、路线图、阅读顺序
2. `01-design-system.md` — 令牌 + 组件 + 五大母题 + 可访问性
3. `02-motion-and-background.md` — 动态背景系统 + 逐组件动效
4. `03-web-site-spec.md` — 公开站逐页逐段规格
5. `04-app-workbench-spec.md` — 工作台/放大镜/团队/市场/社区/总览/用量
6. `05-desktop-app-spec.md` — exe 壳/onboarding/打包/更新/签名/ide 拆分
7. `06-architecture.md` — 前后端架构与模块化演进
8. `07-data-viz.md` — 数据可视化规范
9. `08-execution-plan.md` — 给 Codex 的分阶段原子任务

黄金样例（供 Codex 复制的范式）：
- `web/src/styles/tokens.css`（扩展令牌）
- `web/src/components/HorizonBackground.jsx`（新动态背景，替换 AuroraBackground）
- `web/src/pages/Home.jsx`（Hero 重构到参考图）

## 约束

- 不改后端安全逻辑；不动 `.paperos/`、`app/data`。
- 不新增重依赖；数据可视化优先轻量/自绘（详见 07）。
- 每次样例改动后 `npm run web:build` 验证不破坏构建。
- 视觉方向锁死：地平线辉光 + Quill Circle + 追溯徽章 + 暖金 CTA + 暗色 IDE。

## 状态（2026-08-11）

- [x] 研究 + 构思 + 计划（已获用户批准，方案 B）
- [x] 文档总览 + `01`–`08`
- [x] 3 个黄金样例
- [x] web:build 验证（2026-08-03：`npm run build` exit 0）
- [x] T1.1 Home Hero truth-driven B 路线（2026-08-07）：`HeroIdeMock` 明示为临时界面示意；四视口、导航、键盘、reduced-motion 与产品事实门禁通过
- [x] T1.2 公共区块组件（2026-08-07）：七组件与 Home 全量接入完成；Node 134/134、Web 2308 modules、四视口行为门禁和视觉复核 92/100 pass
- [x] T1.3 公共导航（2026-08-07）：40px/41px compact、ARIA 当前项、2px 指示、统一下载主 CTA、881px 桌面边界、820/390 首焦点/Escape 与认证态门禁完成；Node 141/141、Home/230.8s strict Edge、视觉 94/pass，独立复审 APPROVED
- [x] T1.4 Features/Pricing/Enterprise（2026-08-10）：五段深挖、Segmented/Table/FAQ/BYOK、六项企业范围与安全边界完成；独立复审 1 Important + 2 Minor 均经 RED→GREEN 关闭；Node 147/147、Web 2310 modules、12 视口 public Edge、112.6s strict Edge、视觉 92/pass
- [x] T1.5 Login/Register（2026-08-10）：共享 AuthPanel、AuthAside code/PDF/trace、中性文案、Segmented、开发 OAuth、离线入口和密码确认完成；Node 155/155、Web 2312 modules、8 视口 auth Edge、88.8s strict Edge、stable SHA 81651dc0… 通过
- [x] T3.3 Web Workbench 真实 AI 面板（2026-08-11）：provider/runtime truth、真实 ActionTimeline、BEGIN_FILE preview/diff、Reject/Apply、409/rollback、workspace 深链与 390px 垂直工作流完成；Node 164/164、Web 2316 modules、strict Edge、ai-qa 77→197 bytes 写入证据通过
- [x] T3.4 放大镜通用化（2026-08-11）：去 sample-contest 硬编码，改为 /api/editor/projects 工作区驱动 + `?workspace=` + `evidence` 能力门控 + Claim/Result/Script/Dataset/Source 五类 + EvidenceFlow 连线；commit e745f7f
- [x] T3.5 团队/市场/社区/总览（2026-08-11）：CommunityBoard 最新/热门流 + 真实贡献榜、Dashboard 速览卡、Market 详情抽屉（权限按真实 execute 推导 + 诚实 MCP 说明）、TeamSpace 7 天活动热力（真实 createdAt）；同时移除 Dashboard/Download/Docs/TeamSpace 的本机模型推理与伪造数据并加回归护栏；commits 3855ea9/7454918/e1762c9/da19471/8c3d2c0
- [ ] T3.6 Workbench Hero 真实产品截图：基于已验证的 T3.3 状态拍摄 web/public/hero-ide.png，替换 HeroIdeMock，并完成截图审查
  - 2026-08-11 尝试：CDP 采集管线与 ≤300KB 尺寸已验证，但无头 Edge 下 Monaco 编辑器不合成（黑屏）、有头 Edge 调试端口未连上、本机无 Tectonic（占位 PDF + 安装横幅）。已回滚实验、保留示意图；完成路径见 docs/plans/2026-08-11-t3-6-hero-capture.md
- [ ] P0–P6 实施与阶段验收

文档交付完成不等于重设计实现完成。当前源码样例为：

- `web/src/styles/tokens.css`
- `web/src/components/HorizonBackground.jsx`
- `web/src/pages/Home.jsx`

执行状态以 `docs/STATUS.md` 和 `docs/redesign/08-execution-plan.md` 为准。
