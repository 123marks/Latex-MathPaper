# 04 · 应用内工作台与各面规格（App / Workbench Spec）

> 登录后的产品面。密度优先、键盘友好、专业。视觉对齐 `UI-Design/{5,b,c,d,e,f}.png`。
> 涉及 `web/src/pages/app/*.jsx`（网页版）与 `apps/desktop/src/ide.jsx`（桌面版，拆分见 `05`）。
> 两端**共享 UX 规格**；桌面版是主编辑器，网页版是轻量/协作视图。

---

## 0. 应用外壳（`AppLayout.jsx`）

现状：左侧栏（品牌 + `总览/工作台/模型 Key/API 用量/社区/账户设置` + 管理入口）+ 顶栏（⌘K 触发 + 角色徽章 + 头像 + 退出）。

**升级**：
- 侧栏图标化 activity 风格：图标 + 文字，active 项左侧 3px 琥珀条 + `aria-current`。
- 顶栏 `☰` 换 `Icon name="menu"`（禁 emoji）；⌘K 触发做成 `.glass` 搜索条，右侧 `⌘K` kbd。
- 顶栏右加：团队/工作区切换下拉（对齐 `d.png` 顶部）、通知铃、`● 本地同步` 状态点。
- 侧栏底部真实版本信息（读 `/api/health` 的 build）。

---

## 1. Workbench 工作台（对齐 `5.png` / `b.png`，核心）

网页版 `web/src/pages/app/Workbench.jsx`；桌面版 `ide.jsx` 的 `IDE()`。目标是**同一套三/四栏布局语言**。

### 1.1 布局（Workbench Layout Contract）

```
┌ 标题/菜单区: Logo | Workspace 切换 | ⌘K 命令 | 通用文档▾ Pack | 协作者 | 头像 ┐
├activity┬ explorer / OUTLINE / LABELS ┬ 编辑器 tabs + 源码 | PDF 预览 ┬ AI Assistant ┤
│ 图标栏 │  文件树（Pack 视图）          │  Monaco ⇆ PDF（可分屏）        │  对话+执行计划 │
│        │                              ├───────────────────────────────┤              │
│        │                              │  底部面板: PROBLEMS/OUTPUT/TERMINAL/LaTeX     │
├────────┴──────────────────────────────┴───────────────────────────────┴──────────────┤
│ 状态栏: 分支▾ | 诊断●▲ | Pack | LaTeX UTF-8 LF | Ln/Col | 页数 | ● 本地同步 | 协作者   │
└───────────────────────────────────────────────────────────────────────────────────────┘
```

- 左宽 `--ide-rail (260)`，右宽 `--ide-right (360)`，状态栏 `--ide-status (28)`（令牌已存在）。
- 面板可折叠/拖拽分隔；编辑器与 PDF 可左右或上下分屏；tab 可拖拽重排、中键关闭、dirty 态见 §1.6。

### 1.2 Activity Bar（图标栏）

图标：`文件树 / 搜索 / 源代码管理 / 技能(Skills) / 市场 / 设置`（对齐 `5.png` 左条）。
能力门控：无 `evidence` 能力则不显示证据相关入口；`math-modeling` 专属图标只在该 Pack 出现。

### 1.3 Explorer / Outline / Labels

- 文件树：Pack 感知图标（.tex/.bib/.pdf/figures/），dirty 圆点，右键菜单（新建/重命名/删除/在放大镜打开）。
- 底部可折叠 `OUTLINE`（`parseOutline()` 已有）+ `LABELS`（\label 索引）+（有能力时）`ERRORS`。
- 生成物（build/、*.pdf）按策略弱化显示。

### 1.4 编辑器（Monaco）

- 语法高亮（`setupLatex()` 已有）、行号、当前行、括号匹配、minimap 可选。
- 顶部 tab 栏：面包屑（`sections › methodology.tex › { } equation`，对齐 `b.png`）。
- 选区浮动操作：`⌘K` inline edit（`InlineEditBar` 已有）、格式化、插入公式/表格（生成器技能）。
- 差异视图：AI Apply/版本对比走并排 diff（绿增红删，对齐 `b.png` 右侧差异建议）。

### 1.5 PDF 预览

- 工具条：页码/翻页、缩放、适宽、放大镜按钮、反查、版本对比（对齐 `c.png` 顶部 `批注/放大镜/反查/版本`）。
- SyncTeX：源↔PDF 双向跳转（真实 SyncTeX 为目标，当前"估算导航"须标注为 partial，`ARCHITECTURE.md` 已界定）。
- 编译态：编译中显示进度条 + Quill 转；失败可点开日志跳到 PROBLEMS。

### 1.6 状态模型（真实，禁止伪造）

| 维度 | 状态 | 呈现 |
| --- | --- | --- |
| 编译 | 未保存/保存中/编译中/失败(看日志)/完成 | 状态栏 + toast + PDF 工具条 |
| 同步 | 在线/离线可用/同步中/冲突 | 状态栏 signal/info/vermilion |
| AI | 空闲/思考(Quill 慢转)/用工具/等待确认 | AI 面板头 + 时间线 |
| 协作 | 个人/团队实时/只读分享 | 顶栏协作者 + 状态栏人数 |
| tab | clean/dirty(●)/冲突 | tab 圆点；hover 换 ×（固定 16px 槽；当前 Buffer 证据见 [`../CAPABILITY_MAP.md`](../CAPABILITY_MAP.md)） |

底栏**不得**显示假 `main` 分支或假在线数（见 [`../HANDOFF.md`](../HANDOFF.md) 的不可破坏决策）。分支段只在真实 SCM 能力接入后出现。

### 1.7 命令面板 / Quick Open / 搜索

`⌘K` 命令面板（`CommandPalette` 已有）、`⌘P` Quick Open 模糊匹配（`QuickOpenModal`/`fuzzyScore` 已有）、
`⌘⇧F` 全局搜索（`SearchModal` 已有）。只显示当前 Pack 支持的命令，禁用项给原因。

---

## 2. AI Assistant 面板（对齐 `5.png`/`b.png` 右栏，Overleaf 式能力）

### 2.1 结构

- 头部：`Paper OS Assistant` + 模型 chip（真实 `/api/provider`：显示已配置模型 + Key 状态，点进设置；真实 provider/mock 边界见 [`../STATUS.md`](../STATUS.md)）+ 固定/最小化。
- 对话区：用户气泡 + 助手气泡；助手回答可含**执行计划**（`ActionTimeline`，`01`§8.4）。
- **执行计划时间线**：读上下文→通用文档搜索 MCP→更新 `method.tex` 与 `references.bib`，每步真实状态（done/running/pending），数据来自 `buildExecutionPlan()`（勿造假）。
- 差异建议区：AI 修改以逐块 diff 呈现（绿增红删），底部 `Apply / Reject`，走 EditTransaction（`/api/editor/apply-blocks`，冲突 409 保护已实现，契约见 [`../adr/0003-transactional-apply-blocks.md`](../adr/0003-transactional-apply-blocks.md)）。
- 证据来源区：引用的文件/文献（对齐 `b.png` 底部"证据来源 refs.bib …"）。
- 输入区：多行输入 + 附件 chip（`@Files`）+ `Skills` + `MCP` + 发送。

### 2.2 内建工具（借 Overleaf，落为 Skills/命令，能力门控）

选区感知的：改写（Paraphrase/精简/学术化/拆分/合并）、解释公式、生成（标题/摘要/公式/表格）、
Error Assist（编译错误 → 解释 + 建议修复，接 PROBLEMS）、**Citation/Evidence Reviewer**（扫描无出处论断 → 反查/建议，接放大镜）。
每个工具是一个 Skill 卡，来自内建或市场。

---

## 3. 放大镜 · 证据反查（对齐 `c.png`，`Magnifier.jsx`）

### 3.1 现状问题

现 `Magnifier.jsx` 写死 `sample-contest` 与建模账本名（`claim-ledger/result-ledger/figure-ledger`）。
**须通用化**：证据是 Kernel 概念，账本命名是 `math-modeling` Pack 语义（`CONTEXT.md` §Evidence Link）。

### 3.2 目标形态

- 真实 PDF 上覆盖一枚**放大镜镜片**（玻璃浮层，`01`§6），镜片内以 `STIX Two Math` 放大选中论断/公式（对齐 `c.png`）。
- 镜片可拖动、缩放（滑杆 180%）、固定；`反查` 按钮点亮右侧证据抽屉。
- **证据抽屉**（右侧 drawer，`01`§7.6）分区（通用命名 + Pack 语义并存）：
  1. `Claim Ledger`（主张，含状态：草稿/已核验 + 校验人 + 时间）
  2. `Result Ledger`（结果，含公式/输出/生成时间）
  3. `Script`（生成脚本，代码片段 + 行号）
  4. `Dataset`（数据表，小型 `.tbl` 预览）
  5. `Source`（文献，标题 + DOI）
- 从选中论断到各证据卡用 `EvidenceFlow` 暖金虚线连线（`01`§8.5）。
- 底部操作：`打开源文件 / 查看完整版本 / 证据链完整 ✓`（对齐 `c.png`）。
- 数据来自 `/api/editor/evidence`（已实现）；工作区/文件/行改为从当前 Workbench 上下文带入，而非手输 `sample-contest`。
- **能力门控**：仅在 Workspace 具 `evidence` 能力（如 `math-modeling` Pack）时可用；通用 Workspace 隐藏或显示"该工作区未启用证据链"。

---

## 4. 团队空间（对齐 `d.png`，`TeamSpace.jsx`）

- 顶部：团队切换 + 搜索 + 邀请成员 + 团队设置。
- 左栏：团队卡（头像堆叠 + 成员数 + 进行中项目）+ 成员列表（角色徽章 owner/admin/member）+ 进行中项目列表。
- 中栏 Tab：`看板 / 成员 / 团队库 / 活动`。
  - **看板**：`待办 / 进行中 / 已审` 三列卡片（任务 + 负责人 + 截止 + 证据数 + 状态 pill），可关联证据（展开"关联证据"含文件/数据/技能，对齐 `d.png`）。数据 `/api/team/tasks`（已实现 GET/POST）。
  - **活动**：近 7 天贡献热力（每人一行、每天一格，`07`§热力图）。
- 右栏：团队库（常用模板/已发布技能/最近讨论/共享引用），`打开团队库`。
- 数据 `/api/team`（已实现）。真实成员/角色，禁造假在线数。

---

## 5. 技能与插件市场（对齐 `e.png`，`Market.jsx`）

- 左：类别树（全部/写作辅助/数据图表/排版样式/评审校对/团队协作/MCP 服务/自定义，带计数）+ 我的资源（已安装/已启用/收藏夹/最近使用）+ 开发者中心入口。
- 中：卡片网格，顶部筛选（全部/已认证/免费/开源）+ 排序（热门/最新/评分）。
  - 卡片：图标 + 名称 + `已认证`徽章 + 简介 + 作者 + 版本 + 下载量 + 评分 + `安装/试用/收藏`。
- 右：详情抽屉（选中卡）：Tab `概览/README/版本/评价` + 截图轮播 + **权限与能力**（reads/writes/calls 显式声明，对齐 `e.png`）+ **MCP 配置**（JSON 预览）+ 信任说明（已过安全审查）+ `安装/卸载/禁用`。
- 数据 `/api/market/skills`（已实现）。安装是本地能力启用（非任意代码执行；权限显式，`ARCHITECTURE.md` §Pack 安全）。

---

## 6. 社区广场（对齐 `f.png`，`CommunityBoard.jsx`）

- 顶部：搜索 + 团队切换 + 设置。
- 左主流：信息流 Tab `最新/热门/本周精选/官方推荐`；条目 = 作者 + 徽章 + 标题 + 摘要 + 标签 + 操作（下载模板/查看项目/安装技能/阅读笔记）+ 点赞/评论/收藏计数。
- 右栏：团队精选、可复现项目骨架、本月之星、贡献榜（排名 + 头像 + 分数）、`发布到社区` CTA。
- 数据 `/api/community/posts`（已实现 GET/POST）。发帖走已有接口，含内容审核占位。

---

## 7. 总览 Dashboard（`Dashboard.jsx`）

登录首页。卡片式：
- 欢迎 + 快速入口（打开工作台/新建工作区/下载桌面端/配置模型 Key）。
- 最近工作区（`/api/editor/projects`）。
- 用量速览（今日/本月 token、剩余配额，mini `AreaSpark`，引到用量页）。
- 团队动态 + 社区精选摘要。
- 系统状态点（本地运行时/引擎就绪）。
措辞保持通用，产品语义以 [`../PRODUCT.md`](../PRODUCT.md) 为准，禁止把数学建模 Pack 文案泄漏到全局。

---

## 8. API 用量 `Usage.jsx` / 模型 Key `ApiKeys.jsx`（借 new-api，详见 `07`）

- **Usage**：时间范围切换 + 概览指标（count-up）+ 趋势面积图 + 按模型/按 Key 分解（堆叠条/环形）+ 明细表（可筛选/导出）。数据 `/api/usage/me`、`/api/admin/usage`。
- **ApiKeys**：网关说明 + BYOK 配置（加密存储，明文不回传；边界见 [`../ARCHITECTURE.md`](../ARCHITECTURE.md)）+ 每 Key 用量/配额/模型限制/状态 + 测试连通 + Playground（可选）。

---

## 9. 后台管理（`admin/*`，借 new-api + API-Monitor）

现有：Overview/Usage/Users/Community/Content/Audit/System/Keys/Releases。升级重点：
- **RBAC**：Root/Admin/User 能力矩阵（`isRoot/isAdmin`），页面按角色门控。
- **Usage/Overview**：数据可视化（`07`）。
- **System/健康**：运行时状态、限流阈值、注册开关（已实现 `/api/admin/system`）+ **公开状态页**入口（`07`§状态页，借 API-Monitor）。
- **Releases**：Ed25519 签名清单校验展示（已实现 `/api/admin/releases`）。
- **Audit**：操作审计表（可筛选，`/api/admin/audit`）。

---

## 10. 落地清单

- [ ] `AppLayout` 图标化 + 工作区/团队切换 + 通知 + 图标菜单。
- [ ] Workbench 落布局契约、状态模型、AI 时间线、diff Apply；Magnifier 通用化 + 镜片浮层 + 证据抽屉 + 连线。
- [ ] TeamSpace 看板+活动热力；Market 详情抽屉(权限/MCP)；CommunityBoard 流+榜；Dashboard 速览卡。
- [ ] Usage/ApiKeys 接 `07` 图表；admin 加 RBAC 门控 + 健康面。
- [ ] 全部能力门控：evidence/stages/math-modeling 只在有能力时出现。
- 验证：`web:build`/`ide:build` 绿；1440/1100 实拍；深链 200；`node --test` 相关用例不回归。
