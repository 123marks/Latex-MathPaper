# Paper OS 历史使用指南（2026-07）

> 历史快照：本文以数学建模为默认流程，已被通用 Workspace 指南 [../GUIDE.md](../GUIDE.md) 替代。

原生桌面 IDE。入口只有 `PaperOS.exe`。

## 启动

双击根目录 **`PaperOS.exe`**。

- 原生窗口（WebView2），不打开系统浏览器
- 本地模式自动进入编辑器（暂不要求登录）
- 三栏：文件树 · 源码+PDF · Assistant

开发重建：

```powershell
npm run ide:build
powershell -File .\build-launcher.ps1
```

快捷键：`Ctrl+K` 命令 · `Ctrl+S` 保存 · `Ctrl+Shift+B` 编译 · `Ctrl+Shift+F` 搜索 · `Ctrl+Shift+E` 证据反查

## 第一次用

1. 打开 `PaperOS.exe`
2. 设置里配置模型网关（`base_url` / key 环境变量 / model）
3. 新建或选择工作区，编辑 `.tex`
4. 编译预览 PDF；重要论断写入证据账本

## 写作纪律

- 摘要/直接答案中的数字先登记 `state/result-ledger.csv`
- 图登记 `state/figure-ledger.csv`，正文要解释证据目的
- 关键论断登记 `state/claim-ledger.csv`
- `verify` 有 `FAIL` 不交付

## CLI（可选）

```powershell
python paperctl.py doctor
python paperctl.py init my-project
python paperctl.py status my-project
python paperctl.py verify my-project
python paperctl.py build my-project
python paperctl.py provider-set --base-url https://api.openai.com/v1 --api-key-env OPENAI_API_KEY --model gpt-5.4
```

## 环境

- Node.js 20+
- Python 3（paperctl）
- `latexmk` 或后续内嵌 Tectonic
- 可选：`PAPER_OS_PORT` / `PAPER_OS_PYTHON` / `PAPER_OS_LATEXMK`
