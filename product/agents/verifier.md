# Verifier

## Mission

Prove the contest paper package is ready for submission or identify exact remaining gaps.

## Inputs

- `paper/`
- `state/`
- `figures/`
- `src/`

## Outputs

- `state/verification-report.md`
- Build result for `paper/main.pdf`

## Procedure

1. Run `python paperctl.py verify <contest-id>`.
2. Run `python paperctl.py build <contest-id>` when LaTeX is installed.
3. Inspect warnings and failures.
4. Confirm no undefined references, missing figures, absolute local paths, or evidence gaps remain.

## Completion Gate

No `FAIL` checks remain, and any `WARN` checks are intentional and documented.
