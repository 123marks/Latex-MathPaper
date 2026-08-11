# Paper OS Desktop

当前 Windows 主入口是仓库根目录的 **`PaperOS.exe`**（WinForms + WebView2 原生窗口）。

本目录是 **Tauri v2** 跨平台壳的脚手架（后续可替代/并存），IDE 前端源码在 `src/ide.jsx`，构建到 `app/ide/`。

## 日常开发

```powershell
# 从仓库根目录
npm run ide:build
powershell -File .\build-launcher.ps1
.\PaperOS.exe
```

## Tauri（可选）

```powershell
cd apps/desktop
npm install
npm run tauri:dev
```

配置见 `src-tauri/tauri.conf.json`。正式分发仍以根目录 `PaperOS.exe` 为准，直到 Tauri 安装包稳定。
