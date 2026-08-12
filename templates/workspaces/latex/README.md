# LaTeX Workspace

这个工作区开箱即可体验 Paper OS 的完整闭环：

- `main.tex` 通过 `\input` 组织 `sections/` 三个章节；文件树里可直接新建/重命名/删除。
- `references.bib` 已含三条真实经典文献；工作台底部「文献」面板能看到
  citation↔source 双链，也可以粘贴 DOI / arXiv ID 一键导入新条目。
- `sections/results.tex` 演示证据纪律：正文数字与 `results/model-fit.json`
  保持一致，并用 `% evidence:` 注释标出出处。
- 选中编辑器里的任意行 → 加批注 → 「交给 AI 修改」→ 预览 diff → Apply。
- 在工作台一键下载 Tectonic 后，点 ⟲ Recompile 即可编译出 PDF；
  PDF 上可以划词问 AI，也可以拖框做区域标注。

figures/ 用于存放图片（`\includegraphics{figures/...}`）。
