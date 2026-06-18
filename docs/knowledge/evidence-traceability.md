# Evidence Traceability

The product needs a claim ledger because contest papers fail when polished claims are not backed by exact evidence.

## Claim Ledger Purpose

`state/claim-ledger.csv` links paper claims to:

- contest question
- LaTeX section
- result evidence
- figure evidence
- source evidence
- verification status

This creates a judge-facing chain:

```text
paper claim -> claim-ledger row -> result/figure/source ledger -> script/data/source -> LaTeX location
```

## Required Columns

| Column | Meaning |
| --- | --- |
| `claim_id` | Stable identifier, such as `C-Q1-001`. |
| `question` | Contest question ID, such as `Q1`. |
| `section` | LaTeX section path where the claim appears. |
| `claim_text` | Short, exact claim text. |
| `result_ids` | Semicolon-separated result ledger identifiers or metric names. |
| `figure_ids` | Semicolon-separated figure IDs. |
| `source_ids` | Semicolon-separated source IDs. |
| `status` | `draft`, `supported`, `needs-check`, or `retired`. |
| `notes` | Boundary conditions, caveats, or follow-up checks. |

## Rules

- Abstract claims must appear in the claim ledger.
- Direct-answer claims must appear in the claim ledger.
- Claims with numbers must connect to result ledger entries.
- Claims derived from figures must connect to figure ledger entries.
- Rule or literature claims must connect to source ledger entries.
- Retired claims should stay in the ledger during review, then be removed before final submission.

## Verification Ideas

The CLI should check:

- Claim ledger exists.
- Required columns exist.
- Supported claims have at least one evidence reference.
- Referenced figures exist in `figure-ledger.csv`.
- Referenced sources exist in `source-ledger.csv`.
- Claim section paths exist.

Implemented checks live in `paperctl.py verify`.
