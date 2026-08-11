# LaTeX Build

## 驱动

默认 `latexmk`；桌面产品路线同时支持内嵌 Tectonic，本机有 TeX Live 时优先本机。

```powershell
latexmk -pdf -interaction=nonstopmode -halt-on-error main.tex
latexmk -C
```

## 结构

```text
paper/
|-- main.tex
|-- refs.bib
|-- Makefile
`-- sections/
    |-- 00-abstract.tex
    |-- 01-restatement.tex
    |-- …
    `-- 10-evaluation.tex
```

原则：`main.tex` 保持薄；正文在 `sections/`；图与附录用相对路径；中文场景可用 `ctexart`。

## 完成条件

- 编译成功（或明确报告缺引擎）
- PDF 存在
- 无未解析引用
- 图路径有效
