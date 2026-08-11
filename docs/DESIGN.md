# Paper OS · Design

目标读者：设计师 / 出图工具 / 前端。视觉母题与必出界面的唯一输入。

## 设计语言：Horizon Atelier

### 配色

- 基底：`#0a0a0a` → `#0f0f0f`（深炭，绝不纯黑），可带极轻暖调 `#0c0a08`
- 主强调暖琥珀：`#d4a341` / `#e2b564` / `#a87a26`
- 朱砂（警告）：`#c44747`
- 信号绿（成功）：`#4d9978`
- 主文字：`#e8e3da`（暖冷白，非纯白）
- 柔灰：`#a59f95` / `#6f6a62` / `#3a3631`
- 品牌辉光：`linear-gradient(135deg, #d4a341 0%, #c44747 50%, #d4a341 100%)`

### 字体

- Display：Playfair Display / Cormorant Garamond（中文：思源宋 / 方正书宋）
- Body：Inter Tight / Geist
- Mono：JetBrains Mono / IBM Plex Mono
- Math：STIX Two Math / Latin Modern Math

### 质感与运动

- 玻璃：仅 nav、命令面板、放大镜；`blur(20–40px)` + 1px 内高光
- 母题：**Horizon Glow**（页面下方 1/3 暖金光带）、**Quill Circle**、**Magnifier**
- 缓动：`cubic-bezier(0.16, 1, 0.3, 1)`；禁止 bounce；尊重 `prefers-reduced-motion`

### 必避

紫蓝渐变、Inter/Roboto 当主展示字体、满屏玻璃、纯黑纯白、硬阴影、emoji 当图标。

## 信息架构

### 官网（未登录）

`/` 首页 · `/features` · `/how-to` · `/about` · `/community` · `/download` · `/login` · `/register` · `/learn`（后续）

### 应用（登录后）

- `/app` 总览
- `/app/project/:id` **IDE 主入口**（左文件树 · 中源码+PDF · 右 AI）
- `/app/agents` 技能 · `/app/market` 市场 · `/app/library` 知识库
- `/app/tasks` 看板 · `/app/team` 团队 · `/app/community` 社区

### 管理

`/admin` 用户 / 团队 / 技能审核 / 市场 / CMS / 审计

## 七张必出界面

1. **首页** — 地平线辉光 + 斜体衬线标题 + IDE 大截图 +「下载桌面端」
2. **IDE** — 三栏密集编辑器；底栏 LaTeX / UTF-8 / 分支 / 协作者
3. **放大镜** — 镜片放大段落 + 右侧证据反查抽屉
4. **团队空间** — 成员 · 看板 · 团队库 · 证据虚线流
5. **技能市场** — 分类树 · 卡片瀑布 · 详情/权限/MCP
6. **社区** — 信息流 + 精选/贡献榜
7. **登录注册** — 左品牌叙事 · 右玻璃表单 · SSO

详细中英文出图 Prompt 以本仓库历史设计稿与 `.impeccable.md` 为准；新出图必须锁死：地平线辉光 + Quill Circle + 暖金 CTA + 暗色 IDE。

## 关键状态

- 编译：未保存 / 保存中 / 编译中 / 失败（可看日志）/ 完成
- 同步：在线 / 离线可用 / 同步中 / 冲突
- AI：空闲 / 思考（quill 慢转）/ 使用工具 / 等待确认
- 协作：个人 / 团队实时 / 只读分享
