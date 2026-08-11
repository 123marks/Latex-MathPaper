---
title: 09 · 参考项目集成设计（标注 / 会话管理 / 文献 / 多 agent）
status: active
as_of: 2026-08-11
owner: redesign
---

# 09 · 参考项目集成设计

本文记录从四个外部项目吸收的理念，以及如何在**不破坏 Paper OS 现有不变量**（本地优先、真实性、Pack 门控、Preview → Apply 事务边界）的前提下分阶段集成。它是后续"一步步"实现的权威依据；每完成一步就回来更新第 6 节进度。

## 0. 来源

| 项目 | 定位 | 我们要吸收的核心 |
| --- | --- | --- |
| Agentation (`agentation.com`) | 给 AI agent 的可视化反馈层 | 指着真实产物圈选批注 → 结构化上下文（定位 + 意图 + 优先级 + 状态）→ 可解决的双向对话 |
| Agentero (`github.com/poco-ai/Agentero`) | Agent 原生文献管理 | 本地知识地图、划词即问、PDF 深读、BibTeX↔LaTeX、图表公式抽取、wikilinks |
| CLI-Manager (`github.com/dark-hxx/CLI-Manager`) | AI CLI 工作台 | 会话历史统一（搜索/Diff/resume/收藏）、实时状态、多维用量分析（热力/趋势/排名） |
| codeg (`github.com/xintaofei/codeg`) | 多 agent 协作工作台 | 会话聚合、@ 委派多 agent、workspace 即 diff+apply、split view |

## 1. 吸收的母题

1. 会话/批注是一等公民：可搜索、可 diff、可 resume、有状态流转，而非一次性聊天。
2. 结构化上下文优于自然语言：指着真实产物（源码行 / PDF 区域 / 元素）给 agent，附意图与优先级。
3. 本地优先 + 真实数据：解析、存储、量化都基于真实记录，绝不伪造——与 Paper OS 既有原则一致。
4. workspace 即 diff + apply：agent 产出真实文件变化，旁边就是 diff 与显式 Apply。
5. agent 可插拔：per-workspace provider、委派（进阶）。

## 2. 映射到 Paper OS

| 母题 | 已有 | 新增（本设计） |
| --- | --- | --- |
| 指着结果提改 | Magnifier 证据反查、PDF 预览、Preview → Apply | 编辑器/PDF/图上圈选批注 → 结构化标注 → 喂给 Preview → Apply |
| 对话管理 | 磁盘 `ai-runs/`、真实 ActionTimeline、Usage 页 | ai-runs 会话面板（搜索/Diff/跳回/resume）+ 真实用量分析 |
| 文献管理 | Evidence 账本（含 source）、`refs.bib`、Magnifier | References Pack：BibTeX 解析、PDF 高亮批注、citation↔source 双链、划词→问 |
| 多 agent / provider | 单 provider、账户加密 key | per-workspace provider override、@ 委派（进阶） |

## 3. 不变量与约束（不可破坏）

- 所有标注/会话/引用都基于真实数据；空态诚实显示，不造假。
- 任何写盘仍走现有 apply-blocks 的 Preview → Apply（含 mtime 冲突、回滚），不另开写路径。
- 文献等领域能力作为 Pack capability，不默认出现在通用 Workspace；标注作为通用 Kernel 能力（评审基元，非领域语义）。
- SyncTeX 目前只是估算：PDF 区域 → 源码行的精确映射尚不可用。Epic 1 先做**编辑器行范围标注（精确、零依赖）**，PDF 区域标注先降级为"页 + 区域 + 就近段落"，SyncTeX 补齐后再升级。
- 借理念不照搬技术栈：参考项目多为 Tauri+Rust 重桌面（PTY 终端、SSH、移动端、ACP 多 agent）。Paper OS 借数据模型与交互，不引入这些大件（属 Epic 4 之后）。

## 4. Epic 路线图

### Epic 1 · 可视化标注 → AI 提案（1a–1c 已完成；1d PDF 待 SyncTeX）
- 1a 标注数据模型 + 服务端 CRUD + 工作区 state 存储。
- 1b Workbench 编辑器行范围圈选批注 UI + 标注列表面板。
- 1c 多条标注聚合成结构化 AI 修改请求 → `/api/chat` + BEGIN_FILE Preview → Apply；Apply 后状态 open → proposed → resolved。
- 1d（later）PDF 区域标注（SyncTeX 补齐后升级为精确）。

### Epic 2 · AI 会话/对话管理
- 2a `/api/ai-runs` 列表 + 详情（prompt + response + BEGIN_FILE blocks + runtime metadata + apply 结果）。
- 2b 会话面板：跨 workspace 列表、搜索、过滤、标签/收藏、按 run 看 diff（复用 bounded diff）、跳回文件。
- 2c resume/重跑 + prompt 库；2d Usage 升级为真实用量分析（token 组成、workspace 排名、活动热力、24h 分布）。

### Epic 3 · References Pack
- 3a `references` capability + BibTeX 解析（`refs.bib`）；3b PDF 阅读器增强（大纲/⌘F/高亮/批注，复用 Epic 1 标注）；3c citation↔source-ledger 双链 + 划词→问；3d 图表公式抽取（重，后置）。

### Epic 4 · 多 provider / 委派（进阶，最后）
- per-workspace provider override（借 cc-switch 思路，用账户加密 key）；`@` 委派多 runtime（需 ACP/多 provider）。

## 5. 标注数据模型（Annotation Schema，Epic 1a）

存储：每个 Workspace 的 `state/annotations.json`，`{ "annotations": [ ... ] }`。经 Workspace 路径解析写入，路径安全。

```jsonc
{
  "id": "a1b2c3d4",              // 短 token
  "target": {                    // 定位（真实产物）
    "kind": "editor-range",      // editor-range | pdf-region(later) | element(later)
    "path": "paper/main.tex",    // Workspace 相对路径
    "startLine": 12,
    "endLine": 16,
    "excerpt": "\\section{Methodology}…"  // 只读快照，便于列表展示与漂移检测
  },
  "note": "这段目标函数要改成加权残差",   // 用户反馈
  "intent": "edit",              // edit | fix | question | todo
  "priority": "normal",          // low | normal | high
  "status": "open",              // open | proposed | resolved | dismissed
  "author": "whw",
  "createdAt": "2026-08-11T…",
  "updatedAt": "2026-08-11T…"
}
```

服务端 API（Epic 1a）：
- `GET /api/editor/annotations?workspace=<id>` → `{ annotations }`
- `POST /api/editor/annotations` `{ workspace, target, note, intent?, priority? }` → `{ annotation }`
- `PATCH /api/editor/annotations/:id?workspace=<id>` `{ note?, intent?, priority?, status? }` → `{ annotation }`
- `DELETE /api/editor/annotations/:id?workspace=<id>` → `{ ok: true }`

状态流转（Epic 1c）：`open` →（生成 AI 提案）`proposed` →（Apply 成功）`resolved`；用户可 `dismissed`。

## 6. 进度追踪

- [x] 1a 标注数据模型 + 服务端 CRUD + 存储 + 测试（2026-08-11，`/api/editor/annotations`，`tests/annotations-api.test.mjs`）
- [x] 1b 编辑器行范围批注 UI + 列表面板 + 测试（2026-08-11，Workbench `AnnotationsPanel` + `LaTeXEditor` 选区回调 + `api.patch`）
- [x] 1c 标注 → 结构化 AI 修改请求（填入 AI 输入，人工复核后走现有 Preview → Apply；标注转 proposed，解决仍人工）（2026-08-11，`composeFromAnnotations`）
- [x] 1d PDF 区域标注：pdf.js 页面上拖框 → 归一化矩形（0–1，服务端校验/钳制/四位舍入）
      + 备注 → 标注系统（`pdf-region` 目标），标注面板显示 `PDF p.N`、AI 组装带选区
      位置描述 + 测试（2026-08-12）。已存区域在 PDF 上回显叠加与 SyncTeX 源码反查列后续。
- [x] 2a AI 会话历史 API（`/api/chat/history` 列表/详情/搜索，真实 chat.json）+ 测试（2026-08-11）
- [x] 2b `/app/sessions` 会话管理页（搜索/详情/提案文件块/复用）+ 导航 + Workbench `?prompt` 复用（2026-08-11）
- [x] 2c Usage token 输入/输出构成（真实 promptTokens/completionTokens）+ 测试（2026-08-11）。
      每日调用量与按模型排名此前已有。
- [x] 2c-补全 用量归因：usage 记录新增 `workspace` 字段（chat 由 Workbench 传当前
      工作区、skill 从 context 读取），`aggregateUsage` 输出 `workspaces` 排名与
      24h `hours` 桶（本机时区；旧记录如实归入「未标注」）；Usage 页新增
      「24h 分布」与「按工作区」面板 + 测试（2026-08-11）
- [x] 3a `/api/editor/references`：解析工作区真实 `.bib`（平衡大括号 BibTeX 解析）+
      全 `.tex` 扫描 `\cite` 系宏，输出条目、citation↔source 位置双链、missing
      （引了但 `.bib` 没有）检测 + 测试（2026-08-11）
- [x] 3b Workbench 文献面板：可折叠条（条数/缺失徽标）、条目卡（作者/发表处/被引次数）、
      引用位置点击直达源文件、missing 列表 + 测试（2026-08-11）
- [x] 3c-1 pdf.js 渲染层 + 划词→问：iframe 预览替换为 pdfjs-dist v6 canvas 渲染
      （异步分包 gzip 143KB + 按需 worker，SSR 安全动态加载），文本层可划词、
      「问 AI」把选中文本送入 AI 输入框，缩放/页码/多页滚动 + 测试（2026-08-12）
- [ ] 3c-2 已存标注/高亮在 PDF 上持久回显（后续）
- [x] 3d DOI 导入：`POST /api/editor/references/import` 接受裸 DOI / doi.org 链接，
      content negotiation 抓取 BibTeX 追加进第一个 `.bib`（无则建 `paper/references.bib`），
      按条目 key 去重（409）；离线/上游错误如实 502/404，测试用本地 mock DOI 服务
      全链路验证；文献面板内置导入框（2026-08-11）。arXiv 后续。
- [x] 4a 多 provider 档案：`/api/account/providers` 新增/激活/删除（Key AES-256-GCM
      加密，明文与密文均不回传），生效顺序 激活档案 > 单一配置 > 共享网关，
      ApiKeys 页档案管理 UI + 测试（2026-08-11）
- [x] 4b 会话级模型选择：chat 请求可带 `profileId` 临时指定档案（未知 id 优雅回退
      激活链），Workbench AI 输入区档案下拉；端到端测试用本地 mock OpenAI 服务
      证实按请求路由（meta `source: profile:<name>` + 定向回包）（2026-08-11）
