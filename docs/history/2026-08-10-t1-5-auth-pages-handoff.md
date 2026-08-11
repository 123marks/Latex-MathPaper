---
title: T1.5 Login/Register handoff
status: complete
as_of: 2026-08-10
branch: main
worktree: dirty
---

# T1.5 Login/Register 交接

## 1. 过去

T1.1–T1.4 已分别完成 Hero、公共区块、导航和 Features/Pricing/Enterprise。本任务没有重开这些页面，也没有修改后端认证、session、角色或 OAuth provider 语义。开始 T1.5 时，Login 独自包含开发 OAuth，Register 缺少确认密码；两页用普通互链而非 Segmented；AuthAside 仍包含 Team First、五阶段和论文流水线文案；没有离线本地项目入口。

## 2. 现在

T1.5 已完成并成为当前认证页基线：

- `web/src/components/AuthPanel.jsx`：共享右栏 chrome，包含首页入口、登录/注册 Segmented、错误区、提交按钮、三项开发 OAuth、`/download` 离线入口和本地文件/模型服务商边界。
- `web/src/components/AuthAside.jsx`：中性 Workspace/Packs/LaTeX/Evidence 品牌叙事、四项能力、两个 code/PDF fragment 和五步 trace。
- `web/src/lib/password-policy.js`：纯函数校验 10–256 位、至少两类字符和确认密码一致性。
- `web/src/pages/Login.jsx`：保留 identifier/password、useAuth.login、from redirect 和已有 OAuth dev callback/refresh。
- `web/src/pages/Register.jsx`：保留注册 payload 与 useAuth.register，新增 confirmPassword 但提交前剔除；策略或确认错误时禁用提交。
- `web/src/styles/pages.css`：auth-only 触控、响应式、fragment、trace、离线入口和 reduced-motion 样式；没有新增依赖。
- `tests/web-auth-pages.test.mjs`、`tests/browser-visual-smoke.test.mjs`、`app/auth-visual-smoke.mjs`：SSR/source 与真实 Edge 回归。

数据流保持如下：页面持有业务状态 → AuthPanel 只渲染共享 chrome → useAuth 调既有 `/api/auth/login` 或 `/api/auth/register` → 成功后按 from 或 `/app` replace 跳转。OAuth 仍请求 `/api/auth/oauth/:provider/start`；dev 响应跟随同源 callback 并 refresh session。角色继续由服务端决定：首账号 owner，其余 member。

## 3. 验证

| 门禁 | 结果 |
| --- | --- |
| focused auth/source | 19/19 pass |
| all Node | 155/155 pass |
| Python | 25/25 pass |
| production build | Web 2312 modules + Desktop IDE bundle |
| static visual | 13 keyframes / 52 assets |
| auth Edge | 2 routes x 4 viewports，exit 0 |
| strict Edge | 88.8s，Home/Workbench overflowX=false |

auth 行为 SHA-256：`81651dc06e68a9874ab414ed8610babe81094e9edb79687a68c55a2707802df4`。报告文件 SHA-256：`f0dd5bdf2b5cd71eeb02c895359e7b5953544e9659e75cb8e79fab8608bb7a0e`。

visual verdict 为 92/pass；Windows 图像 helper 无法打开 `UI-Design/4.png`、`g.png`，因此没有宣称像素级参考对照完成。Edge 已证明八个视口无横向/文本/越界 overflow，最小触控 44px，键盘 mode、invalid/mismatch/valid 按钮状态、reduced-motion 和 browserErrors=[] 全部通过。

## 4. 未来

下一位维护者不要继续反复打磨 T1.5，除非出现 failing regression、用户视觉复核问题或新的明确需求。下一严格原子任务应在 T3.3 与 T3.6 中选择一个：

1. T3.3：AI 面板接真实 provider、buildExecutionPlan 和 apply-blocks 数据，不把 Hero 静态示意当成完成证据。
2. T3.6：用真实 Workbench CDP 截图生成 `web/public/hero-ide.png`，再替换 HeroIdeMock。

仍未完成的长期边界：实体 GPU/移动真机性能、稳定像素基准、WinForms/Tauri 真机、零依赖安装、签名和更新链。工作区仍高度 dirty，未创建 commit/PR；接手者必须先读 `docs/STATUS.md`、`docs/HANDOFF.md`、本文件和 `task_plan.md`，然后以 fresh verification 为准。
