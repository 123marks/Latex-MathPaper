# LaTeX Build Notes

## Build Driver

Use `latexmk` as the preferred build driver. It automatically reruns LaTeX and related tools until cross-references and generated files stabilize.

## Minimal Build Commands

```powershell
latexmk -pdf -interaction=nonstopmode -halt-on-error main.tex
latexmk -C
```

The product CLI should call `latexmk` when available, but verification should still work without it.

## Template Policy

- Keep `main.tex` small.
- Put content in `sections/*.tex`.
- Use relative paths for figures and appendix code.
- Keep references in `refs.bib`.
- Prefer `ctexart` for Chinese contest papers if the local TeX environment supports it.
- Prefer modular sections so agents can edit one part without damaging the whole paper.

## Required Structure

```text
paper/
|-- main.tex
|-- refs.bib
|-- Makefile
`-- sections/
    |-- 00-abstract.tex
    |-- 01-restatement.tex
    |-- 02-analysis.tex
    |-- 03-assumptions.tex
    |-- 04-symbols.tex
    |-- 05-data.tex
    |-- 06-model-q1.tex
    |-- 07-model-q2.tex
    |-- 08-model-q3.tex
    |-- 09-validation.tex
    `-- 10-evaluation.tex
```

## Build Gate

A paper is not complete until:

- `latexmk` succeeds, or the missing local LaTeX dependency is explicitly reported.
- Generated PDF exists.
- No unresolved references are visible in the `.log` or PDF text review.
- Figure paths resolve.
- Appendix code paths are relative.
