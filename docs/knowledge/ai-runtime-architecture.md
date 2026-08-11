# AI Runtime

Paper OS 的 AI 是 **IDE 内的阶段式助手**，不是无人值守黑盒。模型经用户配置的 OpenAI 兼容 API 调用。

## 组件

| 组件 | 路径 | 用途 |
| --- | --- | --- |
| Provider | `product/runtime/providers.example.json` | `base_url` / `api_key_env` / `model` / timeout |
| Stages | `product/runtime/stages.json` | intake → modeling → figure → writing → verification |
| Prompt 包 | `…/ai-runs/<run>/prompt.md` | 可审阅提示 |
| Response 包 | `…/ai-runs/<run>/response.md` | 模型输出 |
| Run ledger | `…/state/ai-run-ledger.csv` | 阶段、模型、路径、状态 |
| Applier | `paperctl.py apply-response` | 预览/应用 `BEGIN_FILE` 块 |

## 循环

```text
项目文件 → stage prompt → API 响应 → apply 预览 → 人工确认 → 写入 → verify/build
```

## 规则

- 不自动改 LaTeX / 脚本
- 写入块：

```text
BEGIN_FILE: relative/path
...完整文件内容...
END_FILE
```

- 拒绝绝对路径、盘符、反斜杠、`..`、嵌套/重复/未闭合块
- MCP 与 Skill 只是阶段推荐，不替代确定性校验
