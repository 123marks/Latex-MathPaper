# Paper OS Product Runtime Assets

`product/` 不是普通项目文档目录。这里的文件会被本地服务、数学建模 Pack 或未来 Pack host 消费；修改可能改变运行行为。

| 路径 | 作用 | 当前消费者/验证 |
| --- | --- | --- |
| `workspace-packs.json` | built-in Pack manifest 和 Capabilities | Workspace Kernel、desktop chooser、Workspace tests |
| `config.yaml` | 产品/工具配置 | `paperctl.py` 与相关运行流程 |
| `releases.json` | 版本和下载资产声明 | release API、download UI、admin/signing tests |
| `runtime/` | provider、stage、pipeline 定义 | math-modeling AI runtime |
| `workflows/` | intake/modeling/writing/verification 流程 | `paperctl.py`/Pack runtime |
| `agents/` | 专业角色提示 | math-modeling runtime |
| `checklists/` | 质量门禁 | Pack verify/review 流程 |
| `skills/` | skill 采用策略和评审记录 | runtime/维护者人工决策 |
| `mcp/` | MCP 配置示例和安全策略 | 尚未形成生产权限管理 |

## 修改规则

1. 先确认消费者和 schema；当前尚无完整自动 schema 校验，不能把字段改名当纯文档变更。
2. `math-modeling` 专业语义不得泄漏到 `general` Kernel 默认行为。
3. release manifest 只能声明真实存在、经过 hash/签名验证的资产。
4. provider 示例只能引用环境变量，不能保存真实 key。
5. 外部 skill 在 review 状态明确前不得安装/启用。
6. 变更后运行相应 Workspace、paperctl、release/signing tests，并同步 `docs/CAPABILITY_MAP.md` 和 `CHANGELOG.md`。

通用领域语言见 [`../CONTEXT.md`](../CONTEXT.md)，当前事实见 [`../docs/STATUS.md`](../docs/STATUS.md)。

