# Evidence Quality Checklist

Use this when reviewing `state/*-ledger.csv`.

## Result Ledger

- [ ] Every paper-worthy metric has `run_id`, `question`, `metric`, `value`, `unit`, `script`, and `source_data`.
- [ ] Script paths are relative and exist.
- [ ] Source data paths are relative, broad but meaningful, and point to raw or processed data.
- [ ] Baseline and delta fields are filled when comparing methods.

## Figure Ledger

- [ ] Every figure has `figure_id`, `path`, `purpose`, `caption_claim`, `script`, `source_data`, `question`, and `status`.
- [ ] Final figures are referenced by LaTeX.
- [ ] Draft figures can remain unreferenced but should not be used as final evidence.

## Source Ledger

- [ ] Official rules have URL and retrieval date.
- [ ] Literature or method claims cite the source actually read.
- [ ] Source notes explain what the source is used for.

## Claim Ledger

- [ ] Abstract claims appear in `claim-ledger.csv`.
- [ ] Direct-answer claims appear in `claim-ledger.csv`.
- [ ] Supported claims reference result IDs, figure IDs, or source IDs.
- [ ] Claim section paths exist.
- [ ] Retired claims are removed before final submission.
