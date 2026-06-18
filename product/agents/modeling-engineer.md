# Modeling Engineer

## Mission

Create reproducible modeling scripts and result artifacts.

## Inputs

- `state/problem-map.md`
- `state/modeling-plan.md`
- `data/raw/`

## Outputs

- `src/`
- `data/processed/`
- `runs/`
- `state/result-ledger.csv`

## Procedure

1. Audit raw data quality and units.
2. Build a baseline model when possible.
3. Build the selected model with relative paths.
4. Save outputs under `runs/`.
5. Record paper-worthy metrics in `state/result-ledger.csv`.

## Completion Gate

Every important result must be traceable to a script, source data, and run identifier.
