# Progress — desktop IDE refinement

## 2026-09-23
- Read product/domain and existing design context, process/design/visual QA skills.
- Started bounded read-only native-agent investigation of desktop architecture and runtime validation.
- Identified primary desktop UI and stylesheet and existing test suite.
- Recorded screenshot issues and task scope before implementation.
- Working around a broken sandbox launch through the explicit escalation mechanism; no user files removed or overwritten.
- Implemented the second-pass workbench: bounded native chrome, Chinese UI copy, charcoal surfaces, full-height assistant, collapsed context disclosure, offline bundled fonts, regular code typography and no external font stylesheet.
- Added Windows 11 DWM dark caption attributes in launcher/Program.cs; built an isolated dist/PaperOS.exe preview and captured a real WebView2/native window screenshot at 125% DPI.
- Sequential verification: 65 related Node tests; desktop UI/perf smoke with 1920/1440/1280/1024/800 viewports and 1.25/1.5 DPI; workspace chooser visual smoke; AI harness Apply smoke; Agent/Render mode smoke. All passed on their final sequential runs.
- One parallel smoke batch hit temporary service contention; rerunning each dependent browser smoke sequentially passed. This is retained as a verification limitation.
- Reproduced the user's startup timeout with a cold `dist/PaperOS.exe`: the Node child exited 0 without listening when launched through `dist/app` junction. Added `realpathSync` entry detection in `app/server.mjs`, and made `launcher/Program.cs` resolve the actual parent of `AppContext.BaseDirectory` with `DirectoryInfo`.
- Added `tests/server-entry-symlink.test.mjs`; it failed before the fix and passed after it. Rebuilt the isolated launcher, removed the diagnostic junction, and verified `dist/PaperOS.exe` cold start (`/api/health` 200 at ~1.5s) plus real native IDE screenshot.
