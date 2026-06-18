# Contest Workspace Template

This directory is copied by `paperctl.py init <contest-id>`.

## Workflow

1. Put the contest statement in `problem/`.
2. Put raw data in `data/raw/`.
3. Fill `state/problem-map.md` and `state/modeling-plan.md`.
4. Write preprocessing, modeling, and plotting scripts in `src/`.
5. Put generated outputs in `runs/`, `figures/`, and `tables/`.
6. Record important numbers in `state/result-ledger.csv`.
7. Record figures in `state/figure-ledger.csv`.
8. Write LaTeX sections under `paper/sections/`.
9. Run `python ..\..\paperctl.py verify <contest-id>` from the project root.
10. Build with `python ..\..\paperctl.py build <contest-id>` if `latexmk` is installed.

## Quality Rule

Do not write paper claims before the related evidence exists in a ledger.
