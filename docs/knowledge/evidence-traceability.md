# Evidence Traceability

Paper OS 要求重要论断可反查。IDE 里的「放大镜」就是这条链的产品化界面。

## 链

```text
文中论断 → claim-ledger → result / figure / source ledger → 脚本·数据·文献 → LaTeX 位置
```

## claim-ledger 列

| 列 | 含义 |
| --- | --- |
| `claim_id` | 如 `C-Q1-001` |
| `question` | 问题或章节 ID |
| `section` | LaTeX 路径 |
| `claim_text` | 短而精确的论断 |
| `result_ids` / `figure_ids` / `source_ids` | 证据引用 |
| `status` | `draft` / `supported` / `needs-check` / `retired` |
| `notes` | 边界与备注 |

## 规则

- 摘要与直接答案必须进账本
- 带数字的论断必须挂 result
- 由图得出的论断必须挂 figure
- 规则/文献论断必须挂 source
- 校验实现见 `paperctl.py verify`
