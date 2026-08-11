# MCP Catalog

MCP 给 IDE 代理提供工具，不替代 `paperctl`、编译与质量闸门。

## 推荐类别

| 类别 | 用途 | 优先级 |
| --- | --- | --- |
| Filesystem | 读写当前项目 `.tex` / 数据 / 图 / 账本 | 必选，锁作用域 |
| Fetch / Web | 官方规则与文献 | 推荐 |
| Command | 跑脚本与编译 | 推荐，需审批 |
| Git | diff / 版本上下文 | 稍后 |
| Browser | 预览检查 | 可选 |
| SQLite/DuckDB | 大表查询 | 可选 |

## 策略

1. 无 MCP 也能用本地文件 + CLI 完成写作
2. 先 filesystem（仅当前项目）→ fetch → command → 其它
3. 小分域 server，避免把巨型工具 schema 灌进上下文
4. 低频操作用 CLI / Skill

## 护栏

- 不暴露任意 shell
- 原始数据与生成物分离（`data/` vs `runs/`）
- 研究影响正文时写入 `source-ledger`
- 防范 tool poisoning、网页注入、过宽目录权限

示例配置：`product/mcp/mcp-config.example.json`
安全策略：`product/mcp/security-policy.md`
