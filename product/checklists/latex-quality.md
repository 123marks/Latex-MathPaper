# LaTeX Quality Checklist

## Build

- [ ] `latexmk -pdf -interaction=nonstopmode -halt-on-error main.tex` succeeds.
- [ ] `paper.pdf` exists.
- [ ] Build log has no missing files.
- [ ] Build log has no undefined references or citations.

## Structure

- [ ] `main.tex` inputs all required section files.
- [ ] Figures use relative paths.
- [ ] Appendix code uses relative paths.
- [ ] Bibliography file exists if citations are used.

## Submission Hygiene

- [ ] No absolute local paths.
- [ ] No visible AI-process notes.
- [ ] No author-identifying information if the contest requires anonymity.
- [ ] Page limits and summary-sheet rules are checked against the current official rules.
