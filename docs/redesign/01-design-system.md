# 01 · 设计系统（Design System）— Horizon Atelier

> 一切 UI 的词汇表。令牌是唯一真源；组件消费令牌；页面组合组件。
> 现有基础见 `web/src/styles/tokens.css` / `base.css` / `components.css`，本文是其**目标完全体**。

---

## 1. 设计语言定位

**Horizon Atelier**：深炭画布 + 暖琥珀电压 + 编辑体衬线 + 地平线辉光。
气质 = "严肃学术工坊 × 电影感暗色产品"。参照即梦/Midjourney 的暗色电影感，
但**克制**：内容永远是主角，光只从地平线来。

一句话规则：**深炭底、单一暖金、衬线做标题、等宽做代码、玻璃只在少数几处、光在页脚。**

---

## 2. 颜色令牌（Color Tokens）

### 2.1 基底（深炭，永不纯黑）

| 令牌 | 值 | 用途 |
| --- | --- | --- |
| `--bg-0` | `#08080a` | 最深，body 兜底 / shader clear |
| `--bg-1` | `#0a0a0c` | body 背景 |
| `--bg-2` | `#0f0f12` | 卡片/面板底 |
| `--bg-3` | `#141417` | 抬起面（hover 面、下拉） |
| `--bg-app` | `#0d0d10` | IDE 应用底 |
| `--bg-elev` | `#17171b` | 新增：模态/浮层底 |

### 2.2 文本（冷暖偏白，永不 `#fff`）

| 令牌 | 值 | 用途 |
| --- | --- | --- |
| `--text` | `#e8e3da` | 主文本 |
| `--text-soft` | `#c4beb1` | 次文本 |
| `--muted` | `#a59f95` | 弱化 / 标签 |
| `--faint` | `#6f6a62` | 占位符 / 禁用 |

### 2.3 品牌暖琥珀（唯一电压色）

| 令牌 | 值 | 用途 |
| --- | --- | --- |
| `--amber` | `#d4a341` | 主强调、CTA、链接、焦点 |
| `--amber-bright` | `#e2b564` | 高亮、hover 文本 |
| `--amber-deep` | `#a87a26` | 渐变暗端 |
| `--amber-soft` | `rgba(212,163,65,.14)` | 芯片/软背景 |
| `--amber-glow` | `rgba(212,163,65,.4)` | 辉光/焦点环 |

### 2.4 语义色（仅语义，不做装饰）

| 令牌 | 值 | 语义 |
| --- | --- | --- |
| `--vermilion` | `#c44747` | 错误 / 重要强调 / 删除 |
| `--signal` | `#4d9978` | 成功 / 在线 / 已验证 |
| `--signal-2` | `#6db594` | 成功文本 |
| `--ink-cool` | `#7e9bb8` | 代码里的冷色点缀（字符串/注释区分） |
| `--info` | `#5b8fb0` | 新增：信息提示（编译中/同步中） |

### 2.5 描边与分隔

| 令牌 | 值 |
| --- | --- |
| `--ink-line` | `rgba(232,227,218,.08)` |
| `--ink-line-2` | `rgba(232,227,218,.14)` |
| `--ink-line-3` | `rgba(232,227,218,.20)`（新增，强分隔/表头） |

### 2.6 签名渐变

```css
--grad-horizon: linear-gradient(180deg, transparent 0%, rgba(212,163,65,.06) 35%,
  rgba(212,163,65,.22) 65%, rgba(196,71,71,.16) 85%, transparent 100%);
--grad-amber: linear-gradient(135deg, #d4a341 0%, #e2b564 50%, #d4a341 100%);
--grad-vermilion: linear-gradient(135deg, #c44747 0%, #d4a341 100%);
--grad-quill: conic-gradient(from 180deg, rgba(212,163,65,0) 0%, rgba(212,163,65,.4) 30%,
  rgba(232,181,100,.6) 50%, rgba(196,71,71,.5) 70%, rgba(212,163,65,0) 100%);
/* 新增：文本金箔（用于 hero 强调词） */
--grad-foil: linear-gradient(100deg, #b8801f 0%, #f0d38a 25%, #e2b564 50%, #f0d38a 75%, #b8801f 100%);
```

**必避**：紫蓝渐变、青绿/玫红彩虹极光、纯黑纯白、硬阴影、emoji 当图标、Inter/Roboto 当主展示字体。

---

## 3. 排版（Typography）

### 3.1 字体族（`--font-*`，已存在，保持）

- Display：`"Playfair Display", "Source Han Serif SC", "Noto Serif SC", serif`
- Sans：`"Inter", "Inter Tight", "PingFang SC", "Microsoft YaHei", system-ui`
- Mono：`"JetBrains Mono", "Cascadia Code", "IBM Plex Mono", ui-monospace`
- Math：`"STIX Two Math", "Latin Modern Math", "Cambria Math"`

### 3.2 类型比例（新增令牌，模块化 1.25）

| 令牌 | px | 用途 |
| --- | --- | --- |
| `--fs-hero` | `clamp(48px, 7vw, 92px)` | 首屏大标题（Display） |
| `--fs-h1` | `clamp(34px, 4.5vw, 52px)` | 页级标题 |
| `--fs-h2` | `clamp(26px, 3vw, 36px)` | 区块标题 |
| `--fs-h3` | `22px` | 卡片标题 |
| `--fs-lead` | `19px` | 引导段 |
| `--fs-body` | `15px` | 正文 |
| `--fs-sm` | `13px` | 次要 |
| `--fs-xs` | `11.5px` | 标签/eyebrow（等宽、字距 0.2em、大写） |

规则：中文标题用 Display 衬线 + 字重 500；强调词用斜体衬线 `.serif-it` 或 `--grad-foil` 文本裁切。
正文行高 1.65；标题行高 1.05–1.15。**hero 的英文副标题**（如 `Local first · Pack powered.`）
用斜体 Display，字距 -0.01em。

---

## 4. 间距 / 圆角 / 阴影 / 层级

### 4.1 间距刻度（8pt 基线，新增令牌）

`--sp-1:4px · --sp-2:8px · --sp-3:12px · --sp-4:16px · --sp-5:24px · --sp-6:32px · --sp-7:48px · --sp-8:64px · --sp-9:96px · --sp-10:128px`

区块纵向节奏：展示站 section 间距 `--sp-9`（96px）起步；IDE 内部用 `--sp-2/3`。

### 4.2 圆角（已存在）

`--radius-xl:28 · --radius:20 · --radius-sm:14 · --radius-xs:9 · --radius-pill:999`

### 4.3 阴影 / 辉光（已存在 + 新增）

```css
--shadow-sm: 0 10px 30px -18px rgba(0,0,0,.7);
--shadow:    0 30px 80px -40px rgba(0,0,0,.85);
--shadow-lg: 0 50px 120px -40px rgba(0,0,0,.9);
--glow-amber: 0 0 0 1px rgba(212,163,65,.4), 0 12px 40px -12px rgba(212,163,65,.45);
--ring: 0 0 0 3px rgba(212,163,65,.32);          /* 焦点环 */
/* 新增：悬浮产品截图的电影级投影（Cursor 式 chrome） */
--shadow-chrome: 0 40px 120px -30px rgba(0,0,0,.9), 0 8px 30px -12px rgba(212,163,65,.18);
```

### 4.4 z-index 层级（统一令牌，杜绝魔法数字）

`--z-bg:-3 · --z-grain:-2 · --z-content:1 · --z-nav:100 · --z-dropdown:200 · --z-overlay:900 · --z-modal:1000 · --z-toast:1100 · --z-tooltip:1200`

---

## 5. 运动令牌（Motion）

```css
--ease: cubic-bezier(.22,1,.36,1);            /* 通用 */
--ease-out-expo: cubic-bezier(.16,1,.3,1);    /* 入场：快出慢停 */
--ease-spring: cubic-bezier(.34,1.56,.64,1);  /* 仅限微交互（芯片/勾选），禁用于大位移 */
--dur-1: .15s;  --dur-2: .25s;  --dur-3: .4s;  --dur-4: .7s;  --dur-5: 1.1s;
```

规则：默认 `--ease-out-expo`；禁止 bounce 于大块位移；hover 用 `--dur-2/3`；入场用 `--dur-4/5`。
**所有** transition/animation 必须在 `prefers-reduced-motion` 下缩到 0.001ms（`base.css` 已有全局兜底，保持）。

---

## 6. 玻璃材质（Glass）纪律

玻璃**只**用于三处：顶部 nav、命令面板 / Quick Open、放大镜镜片浮层。其余一律实底卡片。

```css
--glass: rgba(232,227,218,.04);  --glass-2: rgba(232,227,218,.07);  --glass-3: rgba(232,227,218,.10);
--glass-border: rgba(232,227,218,.10);  --glass-border-2: rgba(232,227,218,.16);
--blur: 20px;  --blur-lg: 36px;
```

每块玻璃必须带 1px 内高光（`inset 0 1px 0 rgba(232,227,218,.06~.08)`）和一条 135° 高光渐变（`.glass::after`）。
禁止"满屏玻璃"——那是廉价感来源。

---

## 7. 组件规范（Component Specs）

已有：`.btn`（primary/glass/quiet/danger/lg/sm/block/is-running）、`.chip`（muted/rose/signal）、`.dot`、
`.card`（lift/app）、`.field`/`.input`、`.alert`、`.spinner`、`.empty`、`.divider`、`.log`、`.eyebrow`、`.glass`/`.glass-frost`。
**保持这些 API 不变**，只扩展。以下为需新增或规范化的组件。

### 7.1 按钮补充

- **`.btn-ghost-amber`**：透明底 + 琥珀描边 + 琥珀文字，hover 填 `--amber-soft`。用于次级 CTA。
- **图标按钮 `.icon-btn`**：32×32，圆角 `--radius-xs`，hover 出 `--glass-2`，用于 IDE 工具条。
- 所有按钮：`:focus-visible` 必须显示 `--ring`；`:disabled` 走 `opacity:.5`。

### 7.2 Segmented Control 分段选择器 `.segmented`

用于登录/注册切换、参考图 `g.png` 的"登录|注册"、Pricing 月/年切换、市场排序。
胶囊底 + 滑动高亮块（`--amber-soft` + 1px 琥珀描边），active 文字变 `--text`。

### 7.3 Tabs 标签页 `.tabs` / `.tab`

用于 IDE 编辑器标签、市场详情（概览/README/版本/评价）。
底部 2px 指示条用 `--grad-amber`，切换时指示条**滑动**（`transform` 过渡，非瞬移）。dirty 态见 `04`。

### 7.4 Table 表格 `.tbl`

用于用量日志、admin 用户、状态页。表头 `--ink-line-3` 下边线、`--fs-xs` 大写；行 hover `--glass`；
数字列右对齐 + 等宽字体；状态用 `.chip`。斑马纹**不用**（暗色下噪），用 hover + 分隔线。

### 7.5 Tooltip / Popover

暗色实底 `--bg-elev` + `--ink-line-2` 描边 + `--shadow`；箭头可省。延迟 300ms 出现。键盘可聚焦触发。

### 7.6 Modal / Drawer

模态：`--z-modal`，背景 `rgba(0,0,0,.6)` + `backdrop-filter: blur(4px)`，卡片 `--bg-elev`。
必备：`role="dialog"` `aria-modal` `aria-labelledby`、焦点陷阱、Esc 关闭、卸载后焦点恢复
（WorkspaceChooser 已实现该模式，作为范式复用）。
抽屉（放大镜证据反查、团队库）从右侧滑入，宽 `clamp(320px, 30vw, 420px)`。

### 7.7 Toast 通知

右下堆叠，`--bg-elev` + 左侧 3px 语义色条（amber/vermilion/signal），4s 自动消失，可手动关。
用于保存成功/编译失败/应用冲突（`APPLY_CONFLICT`）。

### 7.8 Badge / Status Pill

`已验证`（signal）/`编译中`（info + 转圈）/`失败`（vermilion）/`离线可用`（muted）。
状态语义清单见 `04`§状态模型，不得臆造。

### 7.9 Skeleton 骨架屏

列表/卡片/图表加载态用骨架（`--glass` 底 + 缓慢 shimmer 扫光），**不要**用大 spinner 占整屏。

### 7.10 Progress / Meter

用于配额（new-api 式）、编译进度、上传。细条 4px，填充 `--grad-amber`；超阈值转 `--vermilion`。

---

## 8. 五大母题实现规格

### 8.1 Horizon Glow 地平线辉光

- 首选：全屏 WebGL（`HorizonBackground`，见 `02`）。
- 局部：`.horizon` 元素（`base.css` 已有）用于 hero/CTA 段底部 36vh 光带 + 1px 亮线。
- 回退：`body::before` 静态径向渐变（已有）。
- 约束：光带顶缘用 fbm 噪声缓慢起伏，呼吸周期 12–16s；绝不做成静止硬渐变。

### 8.2 Quill Circle 羽笔圆环

- 品牌：`Logo.jsx`（琥珀圆角方 + 镂空衬线 P，已定稿，保持）。
- 动态母题：`.quill-circle` / `.quill-mark`（`base.css` 已有）——虚线圆环 `quillSpin` 18–22s。
- **状态复用**：AI"思考中"= `.quill-mark` 加速旋转（8s）；加载 = 同款。统一"转圈=羽笔"，不用通用 spinner 于品牌位。

### 8.3 Traceable Badge 追溯徽章

参考图 `1.png/a.png` 右上的环形印章。规格：
- 双层同心圆，外环文字沿路径排布 `TRACEABLE · VERIFIABLE · REPRODUCIBLE`，`--fs-xs` 字距 0.3em，`--muted`。
- 外环 `spinSlow` 40s 极慢旋转；内环十字准星 + 琥珀点。
- SVG 实现（`<textPath>`），组件名 `TraceBadge`，尺寸 `size` 可配（hero 用 ~220px，半透明叠在 IDE 截图右上）。

### 8.4 AI Action Timeline AI 动作时间线

参考图 `1.png/5.png` 右侧"执行计划"。规格：
- 竖向步骤列表，每步：序号圆点 + 标题 + 一行说明 + 右侧状态图标。
- 状态：`done`（信号绿勾）/`running`（琥珀 `.quill-mark` 转）/`pending`（`--faint` 空心圈）。
- 步骤间 1px 连线（`--ink-line-2`），已完成段连线转 `--signal`。
- 组件名 `ActionTimeline`，数据来自真实 `buildExecutionPlan()`（`ide.jsx` 已有雏形，勿造假步骤）。

### 8.5 Evidence Flow 证据连线

参考图 `1.png/2.png/c.png` 的 source/citation/figure 红线。规格：
- 从编辑器/PDF 中的锚点，用**暖金虚线**（非红，红只在 mockup 里示意；成品用 `--amber` 60% + 虚线）
  连到右侧证据卡。
- 实现：SVG overlay 层，`stroke-dasharray` + 缓慢 `dashoffset` 流动（`marchAnts` 动画）。
- 放大镜面（`04`§放大镜）是主场；hero 截图里做**静态示意**即可（性能）。

---

## 9. 图标系统

- 唯一来源：`web/src/components/Icon.jsx`（Lucide 语义注册表，已建）。**禁止 emoji / unicode 字形当图标**。
- T0.6 已登记 `menu`、`template`、`git-branch`、`sync`、`magnifier`、`evidence`、`mcp`、`play`、`filter`、`export`；新增语义名仍按需登记，不得在调用点直接写 SVG/emoji/unicode。
- IDE 侧用 `apps/desktop/src/icons.jsx` 的等价注册表，保持两端语义名一致。
- 描边宽度默认 1.8；在 12px 以下用 1.6。

---

## 10. 可访问性（硬约束）

1. 文本对比度 ≥ 4.5:1（`--text` on `--bg-1` 通过；`--muted` 仅用于非关键文本）。
2. 所有可交互元素 `:focus-visible` 显示 `--ring`；键盘可达（Tab 顺序合理，跳过装饰）。
3. `prefers-reduced-motion`：全局动画归零（已有兜底）；WebGL 背景取静态帧；视差/自动轮播停用。
4. 语义化：`aria-label`（图标按钮）、`role`/`aria-modal`（模态）、`aria-live`（toast/编译状态）、
   `aria-current`（导航当前项）。
5. 颜色不作唯一信息载体：状态同时用图标 + 文字（如"● 已验证"而非纯绿点）。
6. 最小点击区 ≥ 32×32（IDE 工具条）/ 44×44（触屏/展示站）。

---

## 11. 落地清单（本文对应的代码改动）

- [ ] `tokens.css`：补 `--bg-elev`、`--ink-line-3`、`--info`、类型比例 `--fs-*`、间距 `--sp-*`、`--z-*`、`--shadow-chrome`、`--grad-foil`、`--dur-*`。（黄金样例已给，见 `samples`）
- [x] components.css：T0.5 十四个 UI primitive 的样式与状态契约已落地，并由 Kitchensink、SSR/ARIA/键盘回归和三视口 smoke 验收。
- [x] `components/motifs/`：新增 `TraceBadge.jsx`、`ActionTimeline.jsx`、`EvidenceFlow.jsx`、`QuillMark.jsx`、`CountUp.jsx`；旧 `components/TraceBadge.jsx` 仅保留兼容转发。T0.4 证据见 `tests/web-motifs.test.mjs`。
- [x] `Icon.jsx`：Web 与 IDE 两端补齐十个 T0.6 语义名，并导出 `ICON_NAMES`；未知 Web 名称静默空、未知桌面名称保留圆形 fallback。
- 验证：`npm run web:build` 绿；对比度用浏览器 devtools 抽查关键文本。

## 12. T0.5 UI 原子组件落地契约（2026-08-05）

T0.5 将本章第 7 节的视觉词汇落成独立 React primitives，且保持既有 Button/Card/Chip CSS API 兼容。实现边界如下：

- 入口：web/src/components/ui/index.js；每个公开组件都可独立 SSR/render，内部共享 helper 不作为业务组件导出。
- 交互选择：Tabs 使用 tablist/tab/tabpanel + roving tabindex；Segmented 使用 radiogroup/radio；方向键、Home、End、disabled 跳过规则由共享 selection helper 保证。
- 对话框：Modal 与 Drawer 共享 dialog frame；title 必须为非空可访问名称，并具备 aria-modal、初始焦点、Tab/Shift+Tab 环绕、Escape 关闭和关闭后焦点恢复。
- IDREF 与命名：Tabs 的所有 `aria-controls` 必须指向始终存在的 panel；Meter label 必须非空，禁止生成指向空文本的 `aria-labelledby`。
- 反馈：Toast 使用 alert 与可访问关闭按钮；Tooltip 使用 tooltip + aria-describedby，支持 hover/focus、延迟显示和 Escape；Badge 的状态枚举受控，不在组件内臆造。
- 数据与加载：Table 保持原生 table/thead/th scope 语义；Skeleton 对读屏隐藏并以 busy 容器承载；Meter 暴露 min/max/now 和可见 label。
- 尺寸与动效：交互控件稳定在至少 31px 的验收下，IDE 工具条继续遵守 32px 设计约束；现有 reduced-motion 规则优先于 Tabs、Segmented、Drawer、Tooltip 和 Skeleton 动效。
- 背景媒体：CSS 动画兜底不能代替 HTMLMediaElement 控制；BackgroundVideo 必须复用共享 motion 门控，在 reduced-motion 下不探测、不渲染 `autoPlay loop` 视频，并在偏好双向变化时同步恢复/停止。production server 必须显式提供 `.mp4 -> video/mp4` 与 `.jpg/.jpeg -> image/jpeg`。

本阶段的开发验收页是 /_kitchensink，仅在 DEV 动态导入。它不是生产页面，也不替代 Home、Workbench 或桌面 IDE 的页面级接入。后续接入时必须传入真实业务数据，不得把 Kitchensink 的示例状态复制成产品事实。

## 13. T0.6 Icon 注册补全契约（2026-08-06）

T0.6 只收口图标语义注册，不提前改写页面信息架构。Web 端唯一来源是 `web/src/components/Icon.jsx` 的 Lucide `MAP`；桌面端唯一来源是 `apps/desktop/src/icons.jsx` 的 SVG `switch`。两端共同语义为 `menu`、`template`、`git-branch`、`sync`、`magnifier`、`evidence`、`mcp`、`play`、`filter`、`export`，并分别导出冻结的 `ICON_NAMES` 供测试和调用方审计。

兼容边界：桌面端继续接受旧 `branch`、`refresh` 别名；Web 未知名称继续静默返回 `null`，桌面未知名称继续返回既有圆形 fallback。`tests/icon-registry.test.mjs` 先在旧实现上验证 RED，再以两端真实 Vite SSR/SVG 输出锁定注册、渲染和未知名称行为，聚焦测试为 2/2。后续页面任务必须复用语义名，不得在组件调用点重新绘制图标或用 emoji/unicode 字符替代。
