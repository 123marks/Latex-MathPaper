# Skill Catalog

技能是 Paper OS IDE 的可安装 SOP，不是产品大脑。本地核心技能优先；外部技能先审后装。

## 本地核心

| Skill | 用途 |
| --- | --- |
| `math-modeling-paper` | 长文档/竞赛论文结构与章节规则 |
| `math-modeling-paper-excellence` | 质量闸门、直接答案、证据纪律 |
| `nature-figure` | 出版级科学图 |
| `nature-polishing` | 在证据锁定后润色行文 |
| `nature-data` | 数据可复现与元数据 |
| `web-search` | 规则与文献检索 |
| `playwright-master` | 可选：预览/UI 检查 |

## 使用

```powershell
python paperctl.py recommend-skills writing
python paperctl.py skill-audit writing
python paperctl.py skill-review athola/claude-night-market@math-review
python paperctl.py blueprint
```

机器可读推荐：`product/knowledge-base.json`。

## 安全

- 不在交付前盲装一堆外部技能
- 润色类技能不得编造数据、引用、公式
- 以本地工作流与账本格式为准
