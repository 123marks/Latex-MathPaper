# Architecture Decision Records

ADR 记录会长期影响边界、兼容、安全或运维的决策。它回答“为什么这样做”，不代替产品验收、实现或测试。

## 状态

- `Proposed`：讨论中，不可作为已接受约束。
- `Accepted`：当前有效。
- `Deprecated`：仍可见但不建议用于新工作。
- `Superseded`：被后续 ADR 替代，必须链接替代者。
- `Rejected`：明确不采用，保留原因避免重复探索。

## 索引

| ADR | 状态 | 决策 |
| --- | --- | --- |
| [0001](0001-general-workspace-kernel.md) | Accepted | 通用 Workspace Kernel + Professional Packs |
| [0002](0002-loopback-trust-and-local-bootstrap.md) | Accepted | loopback trust policy + one-time desktop bootstrap |
| [0003](0003-transactional-apply-blocks.md) | Accepted | Apply Blocks 兼容路径的冲突与回滚语义 |
| [0004](0004-release-integrity-layers.md) | Accepted | Ed25519 manifest、hash 和平台代码签名分层 |
| [0005](0005-transitional-desktop-shell.md) | Accepted (Transitional) | WinForms 当前入口、Tauri scaffold 和 Node runtime 边界 |
| [0006](0006-desktop-chrome-evidence.md) | Accepted | 桌面视口/DPI 证据是 CSS 像素 + CDP 模拟，不是 PaperOS.exe 真机窗口 |

## 新增 ADR 的触发条件

- 改 Workspace/Pack/Capability 的所有权。
- 改 local auth、Host/Origin、secret、path containment 等信任边界。
- 改持久化格式、迁移或恢复策略。
- 选择/替换桌面壳、runtime bundling 或 updater。
- 把 EditTransaction、BuildJob、ToolRuntime 等 Contract 升为稳定实现。
- 引入第三方依赖、Pack 执行权限或云协作模型。

文件名使用 `NNNN-short-title.md`。Accepted ADR 不直接改写结论；方向变化时新建 ADR 并把旧记录标为 Superseded。

