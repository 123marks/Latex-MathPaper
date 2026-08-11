# ADR-0003: Transactional Semantics for Apply Blocks

- Status: Accepted
- Decision date: 2026-07-20
- Documented: 2026-08-03

## Context

AI 兼容输出使用 `BEGIN_FILE`/`END_FILE` 表达多文件建议。仅做路径校验和逐文件写入会产生两个严重问题：preview 后外部修改可能被覆盖；中途失败会留下半套修改。

## Decision

1. Preview 返回每个目标的 baseline stamp，包括 path、存在性、大小和 mtime。
2. Apply 回传 baseline；任一已存在目标在 preview 后变化时，整个操作以 `409 APPLY_CONFLICT` 拒绝，写入前不改变任何文件。
3. 写入前保存旧内容/存在性 journal。
4. 中途写失败时逆序恢复旧文件并删除本次新建文件；返回 `500 APPLY_ROLLBACK`。
5. 所有路径仍经 Workspace-relative containment，且 UI 必须显式确认 Apply。

## Consequences

- 兼容路径具备实用的冲突检测和失败回滚，不再是“逐文件尽力写入”。
- mtime 不是通用内容版本，检查与写入之间仍有 TOCTOU 窗口。
- 当前没有持久 transaction ID、undo record、hunk-level review 或跨进程恢复。
- 因此文档把能力标为 Partial EditTransaction，而不是完整 Contract 已交付。

## Evidence

- Implementation: `app/server.mjs`, `apps/desktop/src/ide.jsx`
- Test: `tests/editor-apply-transaction.test.mjs`

## Future Direction

以 versioned Resource/TextDocument、transaction journal、hunk decisions 和 durable undo 替代 mtime compatibility path；AI 和非 AI 批量编辑最终共用一条 EditTransaction 服务。

