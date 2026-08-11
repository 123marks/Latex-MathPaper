# ADR-0005: Transitional Desktop Shell Strategy

- Status: Accepted (Transitional)
- Decision date: 2026-08-03

## Context

仓库同时存在 WinForms/WebView2 launcher 和 Tauri v2 scaffold。两者都把现有 React IDE 导航到本地 Node 服务；Tauri 当前仍从系统 PATH 启动 `node`，尚未形成独立 runtime sidecar。把 Tauri 描述为已完成替代会制造发布和支持风险。

## Decision

1. 当前 Windows 交付入口继续以根 `PaperOS.exe`（WinForms + WebView2）为准。
2. Tauri 保持过渡/实验入口，直到内嵌 runtime、CSP、日志、进程生命周期、安装和升级验证通过。
3. Web/IDE/API 尽量共享，shell-specific 行为通过窄接口实现。
4. 最终选择 Tauri、保留 WinForms 或双轨支持前，必须有新的 ADR 和迁移计划。

## Consequences

- 文档和下载不能把 Tauri scaffold 当稳定跨平台桌面产品。
- 当前依赖 Node 20 + WebView2 的要求必须对用户诚实。
- 需要修复 root/Tauri/desktop/Cargo version drift。
- Tauri `csp: null`、外部 Node、无持久日志和无签名 updater 是退出过渡状态前的阻断项。

## Evidence

- Current launcher: `launcher/Program.cs`, `build-launcher.ps1`
- Tauri scaffold: `apps/desktop/src-tauri/`
- Shared IDE: `apps/desktop/src/`, generated `app/ide/`

