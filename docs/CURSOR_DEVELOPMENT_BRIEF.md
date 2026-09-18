# Paper OS Cursor 开发任务书

这份文档可以直接交给 Cursor。请先阅读仓库根目录 `AGENTS.md`、`CONTEXT.md`、`.impeccable.md`，再阅读 `docs/PRODUCT_SPEC_CURSOR.md`、`docs/ARCHITECTURE.md`、`docs/CAPABILITY_MAP.md` 和 `docs/HANDOFF.md`。不要跳过现有架构，不要推倒重写桌面 IDE。

## 任务目标

把 Paper OS 继续完善为“Cursor/VS Code 风格的通用 IDE + 内置 LaTeX 原生能力”：

- 通用代码、Markdown、数据和文档编辑；
- 本地 Workspace、终端、运行、Git 和插件入口；
- 无需安装 LaTeX 插件的本地编译和 PDF 预览；
- Agent 模式和 Render 模式共存、可切换但不互斥；
- AI Harness 让计划、上下文、命令、Diff、结果和回溯对用户可见；
- UI 舒适、克制、长期可用，适配不同窗口和 DPI；
- 完成后写交接文档、测试记录和已知风险。

## 开发纪律

1. 先做源码审查和实现计划，再改代码。
2. 保留 Workspace Kernel、Pack、文本缓冲、Apply Proposal 和现有 API 契约。
3. 不把 LaTeX 逻辑硬编码为所有 Workspace 的全局 UI；按 Capability/Pack 暴露。
4. 不伪造已经完成的 Git、插件、远程、AI 模型或调试能力。
5. 每个高风险改动先补回归测试；每个 UI 改动至少跑构建和 smoke。
6. 不新增依赖，除非现有依赖无法实现且在交接文档中说明原因。
7. 文件写入必须经过受控 API 和 Workspace 根目录校验。
8. AI 写入必须经过可见 Diff/Apply/Reject/Conflict/Rollback 流程。
9. 失败时继续修复，不以“代码已改”作为完成依据。
10. 完成前实际启动项目，按验收清单逐项记录证据。

## 推荐执行顺序

### 阶段 0：基线和风险

- 运行现有测试、`npm run web:build`、`npm run ide:build` 和已有 smoke。
- 记录当前失败，不要把已有失败归因到本次改动。
- 画出 `apps/desktop/src/ide.jsx`、`ide.css`、`app/server.mjs`、Workspace Kernel、编译和 AI API 的依赖关系。
- 确认桌面入口和 Web 开发入口都能启动。

交付物：`docs/STATUS.md` 更新、基线测试结果、风险清单。

### 阶段 1：双模式工作台

- 在桌面 IDE 顶栏加入 Agent/Render 分段控制。
- 两种模式共享 Workspace、文件树、标签、缓冲、AI、终端和编译状态。
- 当前模式在 Assistant 和状态栏显示；切换持久化。
- Agent 模式保持编辑器和 AI 任务流为主。
- Render 模式以 PDF/预览为主；没有 PDF 时显示明确空状态和公式草稿入口。
- 窄窗口下将模式按钮压缩为图标，但保留 aria-label/title。

验收：切换不丢编辑内容、不丢 AI 对话、不重置 Workspace；刷新后模式保持；窄窗口无重叠。

### 阶段 2：Render 与 LaTeX

- 复用现有 Tectonic/latex 编译服务，不在前端另起不受控编译器。
- 编译中、成功、失败、超时、缺少引擎和缺少宏包都要有 UI 状态。
- 成功后 PDF 预览更新；失败保留最近成功产物并标记 stale。
- 复用现有 PDF/SyncTeX 能力，补齐页码、缩放、定位和错误降级。
- 使用现有依赖实现公式实时预览；避免为公式渲染新增依赖。
- 公式解析异常不能使 Render 面板崩溃。

验收：准备一个成功 `.tex` 和一个故意失败 `.tex`，分别验证 PDF、日志、问题定位、旧产物保护和实时公式。

### 阶段 3：AI Harness

- 把 AI 请求拆成 Context、Plan、Tool、Policy、Transaction、Trace。
- 展示活动文件、相关文件、Pack、错误和选区上下文。
- 工具调用显示读取/搜索/修改/编译/终端步骤和耗时。
- 多文件修改显示统一 Diff；用户可 Apply、Reject、Refresh、Cancel。
- 检测外部 mtime 变化和冲突；Apply 失败必须回滚或明确部分状态。
- 给危险终端命令、插件安装和环境修改增加确认。
- 保留会话和运行记录，至少包含时间、Workspace、模型/运行时、提示词版本、工具调用、用户决定和错误。

验收：让 AI 修改两个文件、故意制造外部冲突、拒绝一次 Apply、模拟编译失败，确认每一步可见且可回溯。

### 阶段 4：VS Code 兼容层

- 先实现 `.vsix` 解包、manifest 校验、安装目录、启用/禁用/卸载/版本状态。
- 建立 Extension Host 进程/边界和受控 API 适配器，不让扩展直接越过 Workspace 根目录。
- 建立兼容矩阵和样例扩展：主题、语言、格式化、Git/LaTeX、命令、Tree View、Webview、调试器、远程、原生模块。
- 不支持的 API 返回清晰错误并隔离单个扩展。
- 自研扩展沿用同一 manifest、打包、签名/校验和发布流程；先支持本地/私有源，再接市场。

验收：每一类至少有一个真实扩展或最小 fixture；记录支持、部分支持和不支持原因。

### 阶段 5：UI、性能和交接

- 检查固定区域、分割器、标签、长路径、空状态、加载状态和错误状态。
- 检查 1920x1080、1440x900、1280x800、1024px 窄窗口和 125%/150% DPI。
- 检查键盘路径：打开文件、保存、Quick Open、命令面板、编译、切模式、关闭预览。
- 检查长日志、长 AI 回复、大文件和大量文件树不会让主线程失控。
- 更新 `docs/STATUS.md`、`docs/HANDOFF.md`、`docs/CAPABILITY_MAP.md` 和必要 ADR。

## 必须保留的产品行为

- 用户可以自己编辑，也可以让 AI 编辑；两者不是互斥模式。
- Agent/Render 是界面重心，不是能力权限墙。
- LaTeX 编译是内置 Capability，不要求额外安装插件。
- 本地文件和本地编译是 source of truth。
- 所有 AI 写入可见、可确认、可拒绝、可回退。
- 复杂扩展不兼容时只影响扩展，不影响主 IDE。
- UI 需要让用户知道当前发生了什么，而不是只显示一个旋转图标。

## 禁止做法

- 不要把 Paper OS 改成只有 LaTeX 的编辑器。
- 不要为了快速演示硬编码假 Workspace、假 PDF、假 Git、假模型成功状态。
- 不要在没有 API/测试支持时声称“完整 VS Code 兼容”。
- 不要将所有 AI 生成文本直接写入文件。
- 不要用营销式大卡片、紫蓝渐变、装饰性背景或过度动画覆盖编辑器。
- 不要把错误吞掉后显示成功。
- 不要在未验证前删除现有测试或重写基础服务。

## 完成定义

只有同时满足以下条件才可报告完成：

- 构建命令成功；
- 相关单元、集成和 UI smoke 成功；
- 桌面/开发服务实际启动；
- Agent/Render、编辑、编译、PDF、AI Diff/Apply、错误和空状态按清单验证；
- 至少验证三种桌面尺寸和一个高 DPI 场景；
- 文档记录了已实现、部分实现、未实现和已知风险；
- 对任何未通过项继续修改，直到通过或明确升级为阻塞项。

## 每次交接必须填写

```text
日期：
变更目标：
修改文件：
新增/修复能力：
运行命令：
测试结果：
人工验证：
已知失败：
未实现/降级：
风险与后续：
回滚方式：
```

## 给 Cursor 的启动指令

你现在负责 Paper OS IDE 的增量开发。请先读取本任务书和 `docs/PRODUCT_SPEC_CURSOR.md`，再读取仓库架构文档和当前实现。先输出源码审查、风险、分阶段计划和本阶段验收测试；计划确认后再改代码。每次只做一个可验证切片，保持现有 Workspace Kernel、Pack、AI Apply Proposal、LaTeX 编译和桌面启动契约。完成一阶段后必须运行构建、测试和实际启动验证，更新交接文档，并报告证据、剩余风险和下一阶段建议。不要把规划中的能力伪装成已完成，不要静默修改用户文件。
