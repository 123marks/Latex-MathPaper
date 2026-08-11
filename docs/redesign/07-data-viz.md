# 07 · 数据可视化规范（Data Visualization）

> 用户点名的短板之一。目标：用**轻量自绘**图表把用量、证据、团队、系统健康"讲清楚"，
> 风格与 Horizon Atelier 一致（暖色、克制、可读）。对标 new-api 的用量看板 + API-Monitor 的状态页。

---

## 1. 技术选型（决定：不引图表大库）

- **自绘 SVG（首选）/ Canvas（大数据量或粒子）**，沉淀到 `web/src/components/charts/*`。
- 依据：项目已有 `Chart.jsx`（`BarSeries`/`AreaSpark` 均为手绘 SVG），风格统一、零重依赖、可完全令牌化、易做 reduced-motion；
  图表复杂度（趋势/占比/排行/热力/力导向/仪表）用自绘完全够，引 echarts/recharts 会增体积并破坏暗色令牌一致性（见 `README.md` §8）。
- 例外：仅当出现真正复杂的交互式大数据可视化需求且自绘成本过高时，再评估引库（需单独批准）。

---

## 2. 图表配色（令牌化）

主色 `--amber`；分类色板（暖调、低饱和、可区分、暗底可读）：

```
--chart-1: #d4a341  (amber        主)
--chart-2: #6db594  (signal-2     绿)
--chart-3: #7e9bb8  (ink-cool     蓝灰)
--chart-4: #c98a5a  (terracotta   陶土)
--chart-5: #b48ead  (muted mauve  低饱和紫灰，仅作第 5 类，不做主色)
--chart-6: #c44747  (vermilion    仅表"错误/超限/下降")
--chart-grid: rgba(232,227,218,.08)   网格线
--chart-axis: var(--muted)            轴标签
```

规则：单序列图一律 `--amber` 渐变填充（如 `AreaSpark` 现状）；多序列按 1→5 顺序取色；
`--chart-6` 朱砂**只**表负面语义。禁止彩虹高饱和堆叠。

---

## 3. 图表目录（Chart Catalog，`components/charts/*`）

| 组件 | 类型 | 用于 | 现状/来源 |
| --- | --- | --- | --- |
| `NumberStat` | 大数字 + count-up + 同比 | 概览指标卡 | 现有 `.stat`/`.metric-card`，加 count-up（`02`§6） |
| `AreaTrend` | 面积/折线趋势 + hover tooltip + 网格 | 用量趋势、Token 消耗 | 升级现有 `AreaSpark`（加坐标轴/tooltip/多序列） |
| `BarDaily` | 柱状（每日） | 每日调用量 | 现有 `.bars`/`BarSeries`，加 tooltip/空态 |
| `StackedBar` | 堆叠柱（输入/输出 token；按模型） | 用量拆分 | 新增 |
| `Donut` | 环形占比 + 图例 | 模型/渠道占比、配额已用 | 新增 |
| `RankBars` | 横向排行条 | 用户消耗排行 | 现有 `.rank-bar`，组件化 |
| `Sparkline` | 迷你趋势（无轴） | Dashboard 速览、表格内联 | 现有 `AreaSpark` 简化 |
| `Heatmap` | 日历/网格热力 | 团队近 7 天活跃、贡献热力 | 新增（对齐 `d.png` 顶部活动条） |
| `Gauge` / `Meter` | 仪表/进度条 | 配额、编译耗时、健康度 | `01`§7.10 `.meter` |
| `EvidenceGraph` | 力导向/放射图 | 放大镜证据关系（论断↔脚本↔数据↔文献） | 新增（Canvas 或 SVG，静态布局优先） |
| `UptimeTimeline` | 状态条带（up/down/maintenance） | 公开状态页、系统健康 | 新增（对齐 API-Monitor） |
| `LatencyChart` | 延迟折线 + 分位 | 状态页/健康 | 新增 |

### 3.1 通用组件契约

- Props：`data`（标准化数组）、`height`、`id`（SVG defs 唯一）、`series`（多序列时）、`format`（值格式化）、`aria-label`。
- 自适应宽度（`viewBox` + `preserveAspectRatio` 或 ResizeObserver）；`vector-effect: non-scaling-stroke` 保线宽。
- 只用 `transform/opacity` 做入场动画（进视口时线条 `stroke-dashoffset` 生长、柱子高度增长），reduced-motion 直接终态。
- 三态：`loading`→骨架（`01`§7.9），`empty`→`.empty`，`error`→`.alert.error`。

---

## 4. 可访问性（图表硬约束）

1. 每图 `role="img"` + 描述性 `aria-label`（含关键结论，如"近 30 天 token 趋势，峰值 5 月 8 日"）。
2. 复杂图（排行/拆分）提供**数据表回退**：`<details>` 内嵌 `.tbl`，屏幕阅读器与"导出 CSV"共用。
3. 颜色不作唯一编码：序列同时用图例文字 + 直接标注；负面用朱砂 + 图标/文字。
4. tooltip 键盘可达（焦点移动到数据点时显示）；hover 与 focus 一致。
5. reduced-motion 下无生长动画。

---

## 5. 各页落地

### 5.1 API 用量 `Usage.jsx`（借 new-api）

- 顶部：时间范围 `.segmented`（7/30/90，现用 chip，改分段）。
- 概览：4× `NumberStat`（请求数 / total tokens / 估算费用 / 活跃模型），count-up。
- 趋势：`AreaTrend`（每日 tokens，hover 显示当天 请求/输入/输出/费用）。
- 拆分：`StackedBar`（输入 vs 输出 token）+ `Donut`（按模型占比）。
- 明细：`.tbl`（按模型，可排序）+ 导出 CSV。
- 数据：`/api/usage/me?days=`（现返回 `daily/models/totals`，字段已够）。诚实标注"本机直连不上传消息内容，只记模型/数量/费用"（现有文案，保持）。

### 5.2 后台用量 `AdminUsage.jsx`

- 全站：`NumberStat`×4 + `AreaTrend`（全站 tokens）+ `RankBars`（用户消耗排行，现有 `.rank-bar` 组件化）+ 按模型 `.tbl`。
- 数据：`/api/admin/usage?days=`（现返回 `daily/models/users/totals/prompt/completion`，字段已够）。

### 5.3 后台总览 `AdminOverview.jsx`

- KPI 卡（用户/工作区/编译次数/在线）+ 迷你 `Sparkline` + 最近审计摘要。数据 `/api/admin/metrics`。

### 5.4 团队活跃 `TeamSpace.jsx`

- 顶部"近 7 天活动"= `Heatmap`（每人一行 × 每天一格，颜色深浅=贡献量，对齐 `d.png`）。
- 贡献榜 = `RankBars`。数据 `/api/team`、`/api/team/tasks`。

### 5.5 放大镜证据图 `Magnifier.jsx`

- `EvidenceGraph`：中心=选中论断，放射连到 脚本/数据/文献/图表 节点（暖金连线，`01`§8.5）。
- 点击节点滚动到证据抽屉对应卡。数据 `/api/editor/evidence`。静态力导向布局（预计算坐标）优先，避免持续物理模拟耗电。

### 5.6 配额 / Key `ApiKeys.jsx`

- 每 Key 配额 `Gauge`/`Meter`（已用/上限，超阈值转朱砂）。BYOK 说明保留。

### 5.7 Dashboard 速览 `Dashboard.jsx`

- 今日/本月 token `Sparkline` + `NumberStat`，点击进用量页。

---

## 6. 公开状态页（新增，借 API-Monitor）

面向所有人的 `/status`（或后台"系统健康"内嵌）：
- 顶部总体状态徽章（全部正常/部分降级/故障）。
- 服务列表（Web / 本地运行时说明 / 下载 CDN / 更新清单）：`UptimeTimeline`（90 天条带）+ 当前状态 + 90 天在线率。
- `LatencyChart`（如有探测数据）。
- 事件/维护时间线（可手工维护 JSON，或后台管理）。
- 数据源：可复用 `/api/health` + 新增轻量探测（不夸大：本地优先产品，"服务"主要是站点/下载/更新，编译/推理在本机不入状态页）。
- 诚实原则：不把"本地编译"列成需要监控的云服务。

---

## 7. 落地清单

- [ ] 建 `web/src/components/charts/`：`NumberStat/AreaTrend/BarDaily/StackedBar/Donut/RankBars/Sparkline/Heatmap/Gauge/EvidenceGraph/UptimeTimeline/LatencyChart`。
- [ ] `tokens.css` 加 `--chart-1..6`、`--chart-grid`、`--chart-axis`。
- [ ] 把 `Usage/AdminUsage/AdminOverview/TeamSpace/Magnifier/ApiKeys/Dashboard` 接入对应图表 + 三态 + a11y。
- [ ] 新增 `/status` 公开状态页（或后台健康面）。
- [ ] 迁移旧 `Chart.jsx` 到 `charts/` 并保留导出兼容。
- 验证：`web:build` 绿；抽查图表 reduced-motion 与 aria-label；空/错/载三态可见。
