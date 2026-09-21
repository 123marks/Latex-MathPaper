# ADR-0006: Desktop Chrome Evidence Is CSS-Pixel and CDP-Emulated

- Status: Accepted
- Decision date: 2026-09-21

## Context

切片 6 要求 1920/1440/1280/1024/800 与 125%/150% DPI 的布局证据。当前稳定入口是 `PaperOS.exe`（WinForms + WebView2），`MinimumSize` 为 1100×720；Tauri scaffold 的 `minWidth` 同样是 1100。无头浏览器可以把 `/ide/` 缩到 800px，也可以用 `deviceScaleFactor` 模拟 125%/150%。把这些采样写成“真机窗口”或“物理显示器 DPI”会再次把证据说满。

## Decision

1. 桌面 IDE 的视口/DPI 验收以隔离 `PAPER_OS_DATA_DIR` 的无头 Chrome/Edge + CDP 为准，打开的是 `/ide/`，不是 `PaperOS.exe` 客户区。
2. 800×600 只证明 CSS 折行，不证明 Windows 真机能缩到该尺寸。
3. 125%/150% 只证明 `Emulation.setDeviceMetricsOverride` 的 `deviceScaleFactor`，不证明物理 125%/150% 桌面缩放、字体 hinting 或 WebView2 系统 DPI。
4. 长日志、聊天和大文件用显式 cap（200 / 80 / 2MB），不把 cap 说成虚拟化列表或 60fps。
5. 实体 GPU、移动真机、像素基准仍属未验证项，沿用 ADR-0005 的桌面壳边界。

## Consequences

- `STATUS.md` 必须同时写清：浏览器视口矩阵已测、本机窗口下限仍是 1100×720。
- 新增桌面视觉 smoke 不得省略 `deviceScaleFactor` 字段，也不得把截图尺寸当成物理英寸。
- 若以后改为真机 WinForms/WebView2 采样，应新增 ADR 并保留本记录为历史口径。

## Evidence

- Launcher floor: `launcher/Program.cs` `MinimumSize = 1100,720`
- Tauri floor: `apps/desktop/src-tauri/tauri.conf.json` `minWidth: 1100`
- Budgets: `apps/desktop/src/ui-budget.mjs`
- Smoke: `app/desktop-ui-perf-smoke.mjs`
