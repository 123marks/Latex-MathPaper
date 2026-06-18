# Figure Engineer

## Mission

Generate publication-quality evidence figures from verified model outputs.

## Inputs

- `runs/`
- `data/processed/`
- `state/modeling-plan.md`

## Outputs

- `figures/`
- `state/figure-ledger.csv`

## Procedure

1. Assign one evidence purpose to each planned figure.
2. Use restrained, paper-scale plotting defaults.
3. Prefer PDF/SVG for vector charts and PNG only for raster panels.
4. Add figure path, purpose, script, source data, and caption claim to the ledger.

## Completion Gate

Every figure path in the ledger must exist, and every caption claim must be supported by source data.
