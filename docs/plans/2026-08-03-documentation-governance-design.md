---
title: Paper OS documentation governance design
status: accepted
owner: project maintainers
created: 2026-08-03
updated: 2026-08-03
target_release: unreleased
related_adr:
  - ../adr/0001-general-workspace-kernel.md
tracking_issue: ../../issues/paper-os-redesign.md
---

# Paper OS 文档治理设计

## 目标

把仓库文档从“多轮开发记录叠加”升级为可交接、可追溯、可审计的工程知识系统。新接手者应能在 30 分钟内回答四个问题：产品是什么、当前真实完成了什么、如何运行与验证、下一步按什么顺序做。

## 已选方案

采用“稳定契约 + 当前状态 + 操作手册 + 历史记录”四层结构：

1. `CONTEXT.md`、`docs/PRODUCT.md`、`docs/ARCHITECTURE.md` 和 ADR 保存稳定定义与决策。
2. `docs/STATUS.md` 和 `docs/CAPABILITY_MAP.md` 保存带时间锚点的当前事实。
3. `docs/DEVELOPMENT.md`、`docs/TESTING.md`、`docs/RUNBOOK.md` 和 `docs/GUIDE.md` 保存可执行操作。
4. `CHANGELOG.md`、`docs/history/`、`docs/plans/` 和 `issues/` 保存过去与未来，不直接充当当前状态。

`docs/HANDOFF.md` 是面向下一位维护者的聚合入口，只引用上述权威来源，不再复制数百行历史状态。

## 状态与证据模型

能力统一使用 `Implemented`、`Partial`、`Contract`、`Planned`、`Compatibility` 五态。任何 `Implemented` 声明至少要有代码路径和验证路径；测试结果必须标注日期、基线提交和工作区是否干净。长期文档不保留脱离基线的“59/59 passed”之类数字。

追溯链采用：

```text
产品要求 -> ADR/架构契约 -> 计划或 issue -> 实现路径 -> 测试/构建 -> 发布或交接证据
```

## 关键取舍

- 保留旧交接全文到 `docs/history/`，避免重写历史；旧记录明确标为非当前事实。
- 不为“企业级”堆叠空模板；每个新增文档都必须有明确读者、权威范围和更新触发条件。
- 当前工作区只有一个历史提交且存在大量未提交变更，因此本次只能建立“审计快照”，不能伪称已经形成可追溯的发布版本。
- 产品方向保持 Workspace Kernel + Packs；重设计规范是活跃计划，不覆盖已实现能力的事实来源。

## 完成标准

- README 能导航到所有权威文档。
- HANDOFF 能清楚描述过去、现在、未来、风险和接手顺序。
- STATUS 中每个关键声明有代码/测试证据或明确标记未验证。
- 开发、测试、运维命令可以从仓库根目录直接执行。
- 文档之间不存在已知的“完成/未完成”直接冲突和失效链接。

