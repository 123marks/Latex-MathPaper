# 02 · 动效与动态背景（Motion & Dynamic Background）

> 这是解决"死板 / 静态 / 人机味"的核心文档。原则：**电影感但克制**——光从地平线来，
> 内容永远是主角。参照即梦/Midjourney 的暗色氛围，而非彩虹霓虹。

---

## 1. 背景系统总架构（分层）

背景是 3 层叠加，`position: fixed`，`pointer-events: none`，从下到上：

| 层 | z | 实现 | 作用 |
| --- | --- | --- | --- |
| L0 光场 | `--z-bg (-3)` | `HorizonBackground`（WebGL/ogl） | 呼吸的地平线辉光 + 两处暖光源 + 低频流动 |
| L1 颗粒 | `--z-grain (-2)` | `body::after`（SVG 噪声，已有） | 消除暗面塑料感的胶片颗粒 |
| L2 星尘（可选） | `--z-bg + 1` | `HorizonBackground` 同一 canvas 内绘制 | 极稀疏、极缓慢上浮的暖金微粒（"墨点/尘埃"） |

> L2 星尘并入 L0 的同一个 shader/canvas，**不新开 canvas/RAF**，保证只有一个全屏 GPU 负载。

回退链：WebGL 可用 → `HorizonBackground`；否则 → `.bg-fallback`（`base.css` 静态径向渐变，已有）；
`prefers-reduced-motion` → 渲染**单帧静态**（`uTime` 固定），不进 RAF 循环。

---

## 2. HorizonBackground（升级版动态背景）

`web/src/components/HorizonBackground.jsx` 已替代 Aurora 并由 `App.jsx` 接入；它保留
"ogl + 单 Triangle 全屏 shader + WebGL 失败回退 + reduced-motion 单帧"骨架。
指针辉光、星尘/极光丝缕、后台/离屏暂停、低性能自动降级和 reduced-motion
单帧均已实现。2026-08-04 已完成 T0.3 严格浏览器行为门禁，覆盖首次可见启动、后台/离屏、
BFCache、慢帧降级、reduced-motion、WebGL 失败和幂等资源释放；结构化证据见
`dist/visual-qa/horizon-behavior.json`。实体中端 GPU 的 60fps 目标仍待真机验证。

### 2.1 视觉配方（片元着色器）

在现有 FRAG 基础上叠加，最终画面 = 深炭底 + 以下元素：

1. **地平线光带**：下方 1/3 暖金带，顶缘由 `fbm` 噪声缓慢起伏（已有，保留，呼吸周期 12–16s）。
2. **双暖光源**：低左（琥珀）+ 低右（朱砂微量）径向衰减（已有，保留）。
3. **已实现·极光丝缕**：在光带上方叠 2–3 条极低对比、极缓慢横向漂移的暖色"丝缕"
   （`fbm` domain-warp），振幅极小，只在余光里可感知——这是"动起来但不吵"的关键。
4. **已实现·指针光晕**：`uMouse` 处一个极柔和的暖金提亮（半径大、强度低 ≤ 0.06），
   鼠标移动时用阻尼跟随（lerp 0.06/帧），制造"光随人动"的高级感。
5. **已实现·星尘**：极稀疏（~40 点）暖金微粒，缓慢上浮 + 明灭；用 hash 定位，`smoothstep` 画点。
6. **暖色晕影 + 胶片颗粒**（已有，保留）。

配色严格取自 `01`§2：`charcoal #08080a`、`amber #d4a341`、`amberB #e2b564`、`vermilion #c44747`。
**禁止**引入青/紫/蓝，禁止高饱和。整体亮度：中心内容区必须够暗以保证文字对比度（光集中在下缘与四角余光）。

### 2.2 Uniforms

```
uTime (float)   — 秒
uRes  (vec2)    — 画布分辨率
uMouse(vec2)    — 阻尼后的归一化指针位置，默认 (0.5, 0.35)
uScroll(float)  — 归一化滚动进度 0..1（可选，用于让光带随滚动极缓沉降）
```

### 2.3 交互与性能预算（行为门禁已完成，实体性能待实测）

- **DPR 上限**：`min(devicePixelRatio, 1.75)`（已有，保留）。
- **暂停策略**：`document.hidden`（切后台）或背景被完全滚出视口（`IntersectionObserver`）时，
  `cancelAnimationFrame` 暂停；恢复时续跑。避免后台空耗电。
- **BFCache 生命周期**：`pagehide.persisted=true` 只暂停并保留 canvas/context，`pageshow.persisted=true`
  恢复；普通 `pagehide` 和 React unmount 才执行幂等 teardown。
- **慢帧自适应**：连续慢帧超过源码阈值后关闭星尘、丝缕和指针光晕；时间戳注入已验证
  `uQuality: 1 → 0`。当前会话不自动升回高质量，真机阈值与恢复策略仍待测量。
- **移动端**：`max-width: 768px` 或 `pointer: coarse` 时，禁用指针光晕与星尘，降 DPR 到 1.25。
- **单例**：全站只挂一个 `HorizonBackground`（在 `App.jsx`，已如此）。IDE 内部**不铺**动态背景（用实底）。
- **teardown**：终止离开/卸载时取消 RAF、移除监听与 canvas，并只调用一次 `loseContext`。

### 2.4 reduced-motion / 失败

- `prefers-reduced-motion: reduce`：设 `uTime=8`、`uMouse` 居中，渲染**一帧**，不进循环（已有模式，保留）。
- 可选 BackgroundVideo：CSS 动画规则不能暂停 HTMLMediaElement；命中 reduced-motion 时不发 `/bg-space.mp4` HEAD、不创建 `autoPlay loop` video。系统偏好恢复时允许重新探测，偏好 listener 必须在卸载时清理。

### 2.5 T0.3 行为证据（2026-08-05 复验）

- 默认门禁：`npm run browser-visual-smoke`，根脚本已默认传 `--strict`；无浏览器或任一断言失败都会非零退出。
- 环境：Edge `151.0.4129.59`、Node `v24.12.0`、Windows、1440x1200、强制 SwiftShader。
- 行为：单 context/canvas；隐藏、离屏与 BFCache 均为 0 draw delta；BFCache 使用同源 `/ → /features → history.back()` 真实导航，原生 `pagehide/pageshow.persisted` 均为 `true`、文档 token 不变、`notRestored=[]`，恢复后继续绘制；
  reduced-motion 总计 1 次 draw；强制 WebGL 失败显示 `.bg-fallback`；终止销毁只 `loseContext` 一次。
- 证据：`dist/visual-qa/horizon-behavior.json`（schema 2、`verdict: pass`、`strict: true`），包含
  浏览器/OS/Node/Git/WebGL renderer、命令、行为快照与四张截图的 SHA-256。
- 性能边界：正常样本的 `drawCallsPerSecond` 来自禁用 GPU 的 SwiftShader `drawArrays` 调用频率，
  **不是**浏览器呈现 FPS，也不能证明实体中端 GPU 已达到 60fps。
- WebGL 创建失败：`setFailed(true)` → 渲染 `.bg-fallback`（已有，保留）。

---

## 3. 滚动驱动动效（Scroll-Driven）

用 framer-motion（已装）`useScroll` + `useTransform`，或原生 `IntersectionObserver`。

### 3.1 Reveal 入场（已有 `Reveal.jsx`，保持并统一）

- 元素进入视口：`opacity 0→1` + `y 24→0`，`--dur-4`，`--ease-out-expo`，一次性（不反复触发）。
- 列表用 stagger：每项 `delay = i * 0.06s`，最多错峰 8 项后归零（避免长列表拖尾）。
- reduced-motion：直接显示，无位移。

### 3.2 Hero 视差（已有雏形，增强）

- IDE 悬浮截图：随滚动 `y: 0→-60`，`opacity: 1→0.3`（`Home.jsx` 已有，保留手法）。
- 追溯徽章：随滚动极缓 `rotate` + 轻微 `y`，与截图不同步以造纵深。
- 地平线 `.horizon`：随滚动 `scaleY` 微增 + `opacity` 微降（日落感）。

### 3.3 Sticky 工作流带（参考图 `2.png`）

`指令 → Skills/MCP → 本地文件 → LaTeX → 可验证 PDF` 横向流程：
滚动到该段时，连线的暖金"行进蚂蚁"（`marchAnts`）依次点亮各节点（`IntersectionObserver` 逐个触发）。

---

## 4. 指针视差（Pointer Parallax）

- Hero 悬浮 chrome：`onMouseMove` 计算相对中心偏移，`transform: rotateX/rotateY`（≤ 4deg）+ `translate`（≤ 8px），
  阻尼跟随（lerp）。营造"卡片浮在光场上"。移动端禁用。
- 卡片 hover：`.card.lift` 已有 `translateY(-6px)` + 描边点亮 + 辉光（保持）。可选加极轻 3D 倾斜。
- 背景指针光晕见 §2.1.4。

---

## 5. 逐组件动效清单（Motion Inventory）

| 组件 | 动效 | 时长/缓动 | 备注 |
| --- | --- | --- | --- |
| Nav | 滚动 >40px：从透明→ `glass-frost` 收缩 + 阴影浮现 | `--dur-3`/`--ease` | 已有 glass-frost，接滚动态 |
| Hero 标题 | 逐行 `fadeUp` stagger | `--dur-5` | 已有，保持 |
| Hero 强调词 | `--grad-foil` 文本 + 极缓金箔扫光（`shimmer` 8s） | 慢循环 | 新增 |
| Hero chrome | 入场淡上 + 指针视差 + 滚动视差 | 组合 | §3.2/§4 |
| 主 CTA | hover：上浮 2px + 掠光 `shimmer` | `--dur-2` | 已有 `.btn-primary::after`，保持 |
| 数字指标 | 进入视口：从 0 **count-up** 到目标值 | `--dur-4` | 新增 `useCountUp` hook |
| 卡片 | 进入 `Reveal` + hover `lift` | 组合 | 已有 |
| Tabs | 指示条滑动 | `--dur-2`/`--ease` | 新增（`01`§7.3） |
| Segmented | 高亮块滑动 | `--dur-2` | 新增 |
| AI 时间线 | 步骤逐个点亮 + running 转圈 + 连线变绿 | `--dur-3` | `01`§8.4 |
| 证据连线 | `dashoffset` 行进蚂蚁 | 慢循环 | `01`§8.5 |
| Quill/加载 | 圆环旋转（品牌位）；列表用 skeleton shimmer | 循环 | `01`§8.2 |
| Toast | 从右下滑入 + 淡出 | `--dur-3` | 新增 |
| 模态 | 背景淡入 + 卡片 `scale .96→1` 淡上 | `--dur-3`/`--ease-out-expo` | 焦点陷阱见 `01`§7.6 |
| PDF/编译状态 | "编译中"= 进度细条不定态 + Quill 转 | 循环 | 真实状态驱动 |

**禁止**：无意义的持续跳动/闪烁、`--ease-spring` 用于大位移、超过 2 个元素同时抢注意力、
自动播放视频带声音、滚动劫持（scroll-jacking）。

---

## 6. 动效工具（新增，供全站复用）

放 `web/src/lib/motion.js` 与 `web/src/components/`：

- `useCountUp(target, {duration, start})` — 数字滚动（SSR 首渲染确定；reduced-motion 在浏览器绘制前收敛到终值）。
- `useReducedMotion()` — 包一层 `matchMedia`；SSR 与 hydration 首值一致，浏览器用同构 layout effect 在绘制前解析偏好，并保持可清理的 change listener 以支持 `false → true → false`。
- `usePointerParallax(ref, {max})` — 返回阻尼后的 `rotateX/rotateY/translate`。
- `useInViewOnce(ref, {margin})` — 一次性入场触发。
- `Reveal.jsx`（已有）、`Ambient.jsx`（已有）— 复用/统一到上述 hooks。
- 母题组件：`TraceBadge.jsx`、`ActionTimeline.jsx`、`EvidenceFlow.jsx`、`QuillMark.jsx`、`CountUp.jsx`。

所有 hook 必须保持 SSR 首渲染确定，并在注册 RAF/Observer/输入监听前同步判 reduced-motion；命中则在浏览器绘制前收敛到静态值且不启动持久动作。

---

## 7. 性能与质量红线

1. 全站背景只有 **1 个** WebGL 上下文、**1 个** RAF 主循环（背景）。页面级动效用 CSS/framer，不各自开 RAF。
2. 动画只驱动 `transform` / `opacity` / `filter`，禁止对 `width/height/top/left` 做逐帧动画（触发重排）。
3. 首屏（LCP）不被背景阻塞：`HorizonBackground` 异步挂载，`canvas` 不参与布局。
4. 目标：桌面中端 GPU 稳定 60fps；低端/移动端降级后 ≥ 30fps；后台标签 0 帧。
5. `prefers-reduced-motion` 下页面必须**完全可用且安静**（无循环动画、无自动位移）。

> 当前门禁已证明后台标签 0 draw；桌面/移动端 FPS 数字仍是验收目标，不是已完成声明。

---

## 8. 落地清单

- [x] `web/src/components/HorizonBackground.jsx` 已落地并由 `App.jsx` 接入，Aurora 已退出运行路径。
- [x] `web/src/lib/motion.js` 四个 hooks 已落地，`Reveal`/`Ambient` 已统一 reduced-motion 门控；SSR/hydration、绘制前收敛与资源清理专项测试见 `tests/web-motion.test.mjs`。
- [x] `CountUp/TraceBadge/ActionTimeline/EvidenceFlow/QuillMark` 母题组件已迁入 `components/motifs/`；真实数据输入、空态、非法状态、ARIA、唯一 SVG ID 与确定 locale 见 `tests/web-motifs.test.mjs`。
- [ ] Nav 接滚动收缩态；Hero 接指针+滚动视差；指标接 count-up；Tabs/Segmented 接滑动指示。
- [x] `base.css` 已补 `marchAnts`、`foilShimmer` 关键帧，并有 CSS 解析零 warning 与 `prefers-reduced-motion` 停止门禁。
- [ ] `AuroraBackground.jsx` 当前无引用，审阅后可删除；`BackgroundVideo.jsx` 仍由 `App.jsx` 使用，已具备 MIME/SPA fallback/reduced-motion 门禁，但是否长期保留仍需单独决策，不能作为 Aurora 清理的附带删除。
- [x] 浏览器行为 QA：严格覆盖 WebGL 失败、reduced-motion、后台/离屏、BFCache、慢帧降级与资源释放；证据见 `dist/visual-qa/horizon-behavior.json`。
- [ ] 在实体中端 GPU 与移动设备上完成呈现 FPS、温度/功耗和降级阈值基准，不使用 SwiftShader draw-call 采样代替。
- 验证：`npm run web:build` + `npm run browser-visual-smoke`；真机性能基准完成前保持上述限制声明。
