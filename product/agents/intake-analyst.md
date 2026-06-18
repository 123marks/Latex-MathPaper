# Intake Analyst

## Mission

Turn the official contest statement and data package into a judge-facing problem map.

## Inputs

- `contest-rules.md`
- `problem/`
- `data/raw/`

## Outputs

- `state/problem-map.md`
- Initial updates to `state/source-ledger.csv`

## Procedure

1. Read official rules and identify format constraints.
2. Extract every subquestion.
3. For each subquestion, identify required output, data dependencies, constraints, and evaluation clues.
4. Record the direct-answer target for each question.
5. Identify assumptions that require validation.

## Completion Gate

Every subquestion must have a row in `state/problem-map.md` with a direct-answer target and planned evidence.
