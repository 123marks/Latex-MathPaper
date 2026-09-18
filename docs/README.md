# Paper OS 文档中心

本目录按“稳定契约、当前事实、操作手册、计划与历史”组织。发生冲突时，先判断文档类型，不以更新时间或篇幅猜测权威性。

## 阅读顺序

新维护者按以下顺序阅读：

1. [`../CONTEXT.md`](../CONTEXT.md)：领域语言和不可破坏的不变量。
2. [`HANDOFF.md`](HANDOFF.md)：过去、现在、未来以及接手顺序。
3. [`STATUS.md`](STATUS.md)：绑定当前工作区的事实快照和验证证据。
4. [`PRODUCT.md`](PRODUCT.md)：产品承诺、边界和非目标。
5. [`ARCHITECTURE.md`](ARCHITECTURE.md)：运行时、模块边界和演进契约。
6. [`CAPABILITY_MAP.md`](CAPABILITY_MAP.md)：能力状态到代码和测试的映射。
7. [`DEVELOPMENT.md`](DEVELOPMENT.md) 与 [`TESTING.md`](TESTING.md)：开发和验证。
8. [`RUNBOOK.md`](RUNBOOK.md)：运行、备份、恢复、密钥和发布故障处理。

## 文档分类

| 类型 | 文件 | 权威范围 |
| --- | --- | --- |
| 产品规格与交接 | `PRODUCT_SPEC_CURSOR.md`、`CURSOR_DEVELOPMENT_BRIEF.md` | Paper OS 双模式 IDE、LaTeX/Render、AI Harness、插件兼容路线及可直接交给 Cursor 的分阶段开发任务书 |
| 领域契约 | `../CONTEXT.md` | 术语和系统不变量 |
| 产品契约 | `PRODUCT.md` | 产品承诺、边界、非目标 |
| 架构契约 | `ARCHITECTURE.md`、`adr/` | 组件职责、信任边界、决策原因 |
| 当前事实 | `STATUS.md`、`CAPABILITY_MAP.md` | 当前实现、状态和证据 |
| 交接入口 | `HANDOFF.md` | 接手所需的聚合说明和优先级 |
| 操作手册 | `GUIDE.md`、`DEVELOPMENT.md`、`TESTING.md`、`RUNBOOK.md` | 用户、开发、验证和运维步骤 |
| 设计规格 | `DESIGN.md`、`redesign/` | 视觉方向和未完成的目标规格 |
| 计划 | `plans/`、`../issues/` | 将来工作；不证明已经完成 |
| 历史 | `history/`、`../CHANGELOG.md` | 过去记录；不证明当前状态 |
| 产品运行资产 | `../product/` | 会被运行时或专业 Pack 消费的配置、提示和清单 |

## 冲突处理

1. 术语冲突以 `CONTEXT.md` 和已接受 ADR 为准。
2. “是否已实现”以 `STATUS.md`、`CAPABILITY_MAP.md`、当前代码和最新验证为准。
3. 计划、设计稿、截图和历史交接不能单独证明功能已交付。
4. 测试数字只有同时标注日期、commit、工作区状态和命令时才是有效证据。
5. 当前仓库存在大量未提交变更；在形成审阅过的提交前，所有事实都属于工作区快照，不属于可发布版本。

## 更新责任

- 改产品承诺：同步 `PRODUCT.md` 和 `CAPABILITY_MAP.md`。
- 改核心边界或不可逆设计：新增或替代 ADR，并同步 `ARCHITECTURE.md`。
- 改能力状态：同步 `STATUS.md`、`CAPABILITY_MAP.md`、测试证据和 `CHANGELOG.md`。
- 改启动、数据、环境变量或发布流程：同步 `DEVELOPMENT.md`、`RUNBOOK.md` 和 README。
- 完成计划：将计划状态改为 `completed`，记录验证与结果提交；不要只在聊天或 HANDOFF 中打勾。
