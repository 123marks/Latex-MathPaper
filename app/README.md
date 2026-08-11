# Paper OS App

本地 Node 服务：为原生 IDE 窗口与官网提供 API。

## 开发

```powershell
npm start
# IDE 静态资源
npm run ide:build
```

桌面入口是根目录 `PaperOS.exe`（WebView2 原生窗口），不是浏览器。

## 打包

```powershell
python paperctl.py package-app
```

`paperctl.py package-app` 默认输出 `dist/PaperOS-portable`，但该目录名是历史命名，
不证明产物已包含 Node 依赖或 self-contained .NET runtime。正式发布口径以根
`README.md` 和 `docs/RUNBOOK.md` 为准。
