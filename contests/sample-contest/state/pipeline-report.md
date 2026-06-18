# Pipeline Report

Contest: `sample-contest`
Pipeline: `math-modeling-paper-pipeline`

## Stage Status

### intake

- Status: done
- Owner: intake-analyst
- Gate: problem-map and modeling-plan identify every subquestion, direct-answer target, data dependency, and rule/source dependency.
- Evidence: problem/rules/map/plan files are populated
- Entry: python paperctl.py stage-prompt sample-contest intake
- Review: python paperctl.py apply-response sample-contest ai-runs/<run>/response.md

### modeling

- Status: done
- Owner: modeling-engineer
- Gate: result-ledger rows resolve to scripts, source data, exact values, metrics, and units.
- Evidence: result ledger, scripts, and run artifacts exist
- Entry: python paperctl.py stage-prompt sample-contest modeling
- Review: python paperctl.py verify sample-contest

### figure

- Status: done
- Owner: figure-engineer
- Gate: figure-ledger rows resolve to generated figures, source data, scripts, purpose, and caption claims.
- Evidence: figure ledger and generated figures exist
- Entry: python paperctl.py stage-prompt sample-contest figure
- Review: python paperctl.py verify sample-contest

### writing

- Status: in_progress
- Owner: latex-writer
- Gate: LaTeX sections contain no TODO markers, direct answers are explicit, and claim-ledger references cover important claims.
- Evidence: finish LaTeX sections and remove TODO markers after evidence is ready
- Entry: python paperctl.py stage-prompt sample-contest writing
- Review: python paperctl.py apply-response sample-contest ai-runs/<run>/response.md

### verification

- Status: blocked
- Owner: verifier
- Gate: verification report has zero FAIL, intentional WARN items are documented, PDF exists, and submission rules are current.
- Evidence: verification has zero FAIL but writing still has TODO/evidence gaps
- Entry: python paperctl.py verify sample-contest
- Review: python paperctl.py status sample-contest

## Next Action

- Next stage: writing
- Recommendation: Draft/revise LaTeX sections using only verified evidence.
- Prompt command: `python paperctl.py stage-prompt sample-contest writing`
- Dry-run command: `python paperctl.py advance sample-contest --dry-run`

## Non-Negotiable Gates

- No invented contest facts, result values, references, or constraints.
- No important result claim without claim-ledger evidence.
- No absolute local paths in LaTeX or scripts.
- No broad MCP filesystem or command access without explicit scoping.
- No final submission while paperctl status reports blocked/todo/in_progress stages.
