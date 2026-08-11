---
title: Paper OS documentation governance implementation plan
status: completed
owner: project maintainers
created: 2026-08-03
updated: 2026-08-03
target_release: unreleased
design: 2026-08-03-documentation-governance-design.md
result_evidence: ../README.md and ../HANDOFF.md and ../STATUS.md
result_commits: []
delivery_state: dirty working-tree snapshot
---

# Documentation Governance Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 建立一套能支撑企业级交接、开发、验证、运维和审计的 Paper OS 文档体系。

**Architecture:** 稳定契约、当前状态、操作手册和历史记录分层；HANDOFF 作为导航入口，TRACEABILITY 定义声明到证据的映射，STATUS 绑定当前审计基线。

**Tech Stack:** Markdown、Git、Node.js 20、PowerShell、Node test runner、Vite、Python pytest、.NET/Tauri 构建工具。

---

### Task 1: 冻结旧交接记录

**Files:**
- Move: `docs/HANDOFF.md` -> `docs/history/2026-07-legacy-handoff.md`
- Create: `docs/history/README.md`

**Steps:**
1. 将旧文件标记为历史快照，不再作为当前状态来源。
2. 保留原文，避免丢失过去六轮工作记录。
3. 检查新旧链接没有互相冒充权威来源。

### Task 2: 建立当前状态与交接入口

**Files:**
- Create: `docs/STATUS.md`
- Create: `docs/HANDOFF.md`

**Steps:**
1. 记录日期、分支、基线提交、版本和 dirty worktree 事实。
2. 按过去、现在、未来说明项目，并区分已实现、部分实现和计划。
3. 为 P0/P1/P2 后续工作给出验收、依赖、风险和首批命令。
4. 将未验证声明明确标记为未验证。

### Task 3: 补齐开发、测试和运维手册

**Files:**
- Create: `docs/DEVELOPMENT.md`
- Create: `docs/TESTING.md`
- Create: `docs/RUNBOOK.md`
- Modify: `docs/GUIDE.md`

**Steps:**
1. 给出环境、安装、目录、开发入口和数据保护规则。
2. 建立测试层级、命令、证明范围、依赖和证据记录格式。
3. 建立启停、健康、日志、备份、恢复、密钥和发布故障手册。
4. 将通用 Workspace 使用放在 Guide 主线，把数学建模降为 Pack 专章。

### Task 4: 建立追溯和决策治理

**Files:**
- Create: `docs/TRACEABILITY.md`
- Create: `docs/adr/README.md`
- Create: `CHANGELOG.md`

**Steps:**
1. 定义需求、决策、计划、代码、测试、发布之间的 ID 和链接规则。
2. 建立 ADR 状态和索引，列出缺失的高价值 ADR。
3. 用版本/Unreleased 结构替代“第几轮”式变更日志。

### Task 5: 同步现有权威文档

**Files:**
- Modify: `README.md`
- Modify: `docs/PRODUCT.md`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/CAPABILITY_MAP.md`
- Modify: `docs/redesign/README.md`
- Modify: `docs/redesign/08-execution-plan.md`
- Modify: `issues/paper-os-redesign.md`

**Steps:**
1. 修正 Apply Transaction、桌面入口、发布资产和 mock AI 的事实。
2. 修复 redesign `00` 断链并增加生命周期说明。
3. 更新重设计文档和三个黄金样例的实际状态。

### Task 6: 验证并固化证据

**Files:**
- Modify: `docs/STATUS.md`
- Modify: `docs/HANDOFF.md`

**Steps:**
1. Run: `git diff --check`。Expected: exit 0。
2. Run: `node --check app/server.mjs`。Expected: exit 0。
3. Run: `node --test tests/*.test.mjs`。Expected: all tests pass。
4. Run: `npm run build`。Expected: web 和 IDE 构建成功。
5. Run: `python -m pytest`。Expected: tests pass；若环境缺失，记录阻断。
6. 检查 Markdown 相对链接和命令引用；把本次结果写入 STATUS 的验证记录。


## Result

Status: completed on 2026-08-03.

- Delivered the documentation map, current status, engineering handoff, development/testing/runbook guides, traceability matrix, ADR index/records, product asset catalog, changelog, and historical archive.
- Synchronized README, product contract, architecture, capability map, redesign lifecycle, and issue status.
- Verification: `git diff --check`; `node --check`; Node 59/59; Python 25/25; Web+IDE build; API/DOM/Horizon/timeout/desktop visual smoke.
- Not tested: general browser screenshots were skipped by the environment; native installer/signing/updater and macOS/Linux artifacts.
