# Paper OS 追溯与审计规则

目标是让每项产品声明都能追到决策、实现、验证和发布，而不是依赖聊天记录或“某轮已经通过”的文字。

## 追溯链

```text
Requirement -> Decision/Contract -> Plan/Issue -> Code -> Test/Build -> Release/Evidence
```

每一层允许为空，但必须解释原因。`Implemented` 能力不能缺少 Code 和 Test/Build；发布声明不能只引用本地构建。

## 标识约定

- `REQ-KERNEL-*`：Workspace/Resource/Pack Kernel。
- `REQ-EDIT-*`：编辑、Buffer、Apply transaction。
- `REQ-BUILD-*`：编译、job、artifact。
- `REQ-SEC-*`：信任、路径、auth、secret。
- `REQ-DIST-*`：桌面、打包、签名、升级。
- `REQ-UX-*`：公开站、Workbench、设计系统、可访问性。

新增重要需求先在 `PRODUCT.md`、issue 或计划中分配稳定 ID。ADR 记录“为什么这样决定”，不能替代验收标准。

## 核心矩阵

| ID | 要求 | 契约/决策 | 实现证据 | 验证证据 | 状态 |
| --- | --- | --- | --- | --- | --- |
| REQ-KERNEL-001 | 通用 Workspace Kernel，不假设 contest | `CONTEXT.md`、ADR-0001 | `app/lib/workspaces.mjs` | `workspace-kernel.test.mjs`、`workspace-http.test.mjs` | Implemented |
| REQ-KERNEL-002 | Pack 能力门控 | ADR-0001、`CAPABILITY_MAP.md` | `product/workspace-packs.json`、desktop IDE | `desktop-workspace-ui.test.mjs` | Implemented |
| REQ-SEC-001 | 所有文件操作限制在 Workspace root | `ARCHITECTURE.md` safety invariants | Workspace resolver、editor routes | Workspace/walker tests | Implemented，TOCTOU risk retained |
| REQ-SEC-002 | loopback browser trust 和一次性 local bootstrap | ADR-0002 | `app/server.mjs`、desktop boot | `server-auth-security.test.mjs`、desktop wiring | Implemented |
| REQ-EDIT-001 | 每个 text tab 独立 buffer，保存不丢并发输入 | `PRODUCT.md` AI/editor contract | `text-buffer.mjs`、`ide.jsx` | buffer state/wiring tests | Implemented |
| REQ-EDIT-002 | AI multi-file proposal preview、冲突、失败回滚 | ADR-0003 | `/api/editor/apply-blocks`、IDE Apply | `editor-apply-transaction.test.mjs` | Partial transaction contract |
| REQ-BUILD-001 | 显式 Workspace-relative LaTeX compile | `PRODUCT.md` Build Contract | compile/live routes、IDE | Workspace/desktop/smoke coverage | Implemented slice |
| REQ-DIST-001 | release manifest 可验签且资产可校验 | ADR-0004 | signer、release endpoints、package script | signer/admin tests + package verification | Partial distribution |
| REQ-DIST-002 | 可独立部署的跨平台桌面产品 | ADR-0005 | WinForms launcher、Tauri scaffold | Windows artifact exists | Planned/Partial |
| REQ-UX-001 | Horizon Atelier 企业级重设计 | `DESIGN.md`、`redesign/` | tokens/background/Home golden samples | web build + visual QA | Active plan |

## 状态变更门禁

能力状态与交付证据是两个维度：`CAPABILITY_MAP.md` 的 Implemented 表示指定
working-tree baseline 中存在可运行路径；clean commit、CI、签名产物和目标机验收
决定它是否 Release-verified。dirty snapshot 可以证明实现行为，不能证明正式交付。

### Planned -> Contract

- 有清晰边界、数据流、失败状态和非目标。
- 影响核心安全/兼容时有 ADR。

### Contract -> Partial

- 有可运行 vertical slice。
- 有自动化测试和明确剩余边界。
- UI/文档不把 partial 描述为完整能力。

### Partial -> Implemented

- 验收场景和关键失败路径通过。
- 受支持平台/配置明确。
- 操作、迁移、回滚和安全影响有文档。

### Implemented -> Release-verified

- 证据绑定 clean commit 和 CI/release，不依赖 dirty working tree。
- 支持平台完成目标机安装/启动和关键用户流程验收。
- 资产、版本、hash、manifest、平台签名与下载声明一致。

### Implemented -> Deprecated/Removed

- 有 ADR 或变更说明。
- 有迁移期、兼容策略和用户数据保护。
- `CHANGELOG.md` 标明 breaking change。

## 审计证据最小字段

| 字段 | 要求 |
| --- | --- |
| `as_of` | ISO 日期/时间和时区 |
| `baseline` | commit SHA；说明 clean/dirty |
| `environment` | OS、runtime/tool 版本 |
| `command` | 可复制的完整命令 |
| `result` | exit code、pass/fail、关键产物 |
| `scope` | 该证据证明什么 |
| `not_tested` | 明确未覆盖项 |
| `artifact` | CI URL、日志、截图、hash 或发布地址 |

## 文档审计清单

1. 所有相对链接存在。
2. front matter 状态与正文一致。
3. 当前状态没有引用历史 pass 数作为唯一证据。
4. `PRODUCT`、`ARCHITECTURE`、`CAPABILITY_MAP`、`STATUS` 对同一能力没有冲突。
5. release manifest 的资产、版本、hash 与磁盘/CI 一致。
6. 环境变量、数据路径、默认端口与代码一致。
7. 每个 active plan 有 owner、updated、验收和结果位置。
8. 每个 accepted ADR 在索引中，superseded ADR 有反向链接。

