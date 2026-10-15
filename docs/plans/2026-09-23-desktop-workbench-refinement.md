# Desktop workbench refinement

The user's reference is a quiet, dense Cursor workspace. The current desktop
entry is a hand-built React/Monaco workbench hosted in WinForms/WebView2, not
a VS Code fork. Improve this existing product without changing its storage,
permissions, compilation or review model.

## Decision

A palette-only change would leave the collisions and duplicated information.
A VS Code migration would replace the application and exceed this task.
Refine the existing workbench: controlled typography, Chinese interface copy,
bounded chrome and a full-height assistant. Keep real file operations and all
proposal review actions in place.

## Visual contract

- Dark charcoal editor with quieter surrounding panels, neutral selection,
  restrained amber focus/accent, clear accessible secondary text.
- Locally bundled Inter for Latin UI and JetBrains Mono for source; explicit
  Microsoft YaHei UI/PingFang SC sans-serif CJK fallbacks. No remote font CSS.
- 13px interface text, 12px secondary labels, 14px/22px regular source text.
  No serif headings or uppercase monospace headings in routine IDE chrome.
- Compact menu and workspace switcher with real minimum widths, ellipsis and
  tooltips. Remove repeated Pack and product badges from the main toolbar.
- Tabs above breadcrumbs. Assistant aligns to tabs and reaches the status bar;
  the output panel occupies only the editor column.
- Assistant context is expandable, source/diff/proposal state remains visible
  when relevant, and the initial state tells the truth about model readiness.
- Interface terminology is Chinese (工作区, 文档类型, 编辑, 预览, 问题, 输出,
  终端, 任务, 助手); technical identifiers and content remain unmodified.
- Native Windows caption follows the dark application where DWM supports it.

## Validation

47 existing relevant desktop tests passed before edits. Preserve buffer state,
mode switching, capability gates and proposal apply/reject/cancel semantics.
Update tests that intentionally assert old English labels. Build the actual
`app/ide` output. Inspect browser screenshots, actual font availability,
keyboard input, menus, workspace chooser, mode switching, assistant context,
long names and viewport boundaries. Record visual verdicts and limitations.
