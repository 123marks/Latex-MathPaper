# Stage: verification

Goal: Review the paper package and identify gaps before submission.

Recommended skills: math-modeling-paper-excellence

Recommended MCP/tools: filesystem, command

## Instructions

- Identify missing direct answers, weak evidence, inconsistent values, and LaTeX risks.
- Prioritize concrete fixes with file paths.
- Do not declare completion unless verification evidence proves it.

## Expected Outputs

- Verification findings.
- Specific file-level fix plan.
- Remaining risks.

## Context

## File: state/verification-report.md

# Verification Report

Contest: `sample-contest`

## Summary

- PASS: 51
- WARN: 1
- FAIL: 0

## Checks

- [PASS] required file exists: contest-rules.md
- [PASS] required file exists: problem/problem.md
- [PASS] required file exists: state/problem-map.md
- [PASS] required file exists: state/modeling-plan.md
- [PASS] required file exists: state/result-ledger.csv
- [PASS] required file exists: state/figure-ledger.csv
- [PASS] required file exists: state/source-ledger.csv
- [PASS] required file exists: state/claim-ledger.csv
- [PASS] required file exists: state/ai-run-ledger.csv
- [PASS] required file exists: paper/main.tex
- [PASS] required file exists: paper/refs.bib
- [PASS] required file exists: paper/Makefile
- [PASS] required file exists: paper/sections/00-abstract.tex
- [PASS] required file exists: paper/sections/01-restatement.tex
- [PASS] required file exists: paper/sections/02-analysis.tex
- [PASS] required file exists: paper/sections/03-assumptions.tex
- [PASS] required file exists: paper/sections/04-symbols.tex
- [PASS] required file exists: paper/sections/05-data.tex
- [PASS] required file exists: paper/sections/06-model-q1.tex
- [PASS] required file exists: paper/sections/07-model-q2.tex
- [PASS] required file exists: paper/sections/08-model-q3.tex
- [PASS] required file exists: paper/sections/09-validation.tex
- [PASS] required file exists: paper/sections/10-evaluation.tex
- [PASS] result ledger has required columns
- [PASS] result ledger has 1 row(s)
- [PASS] figure ledger has required columns
- [PASS] figure ledger has 1 row(s)
- [PASS] source ledger has required columns
- [PASS] source ledger has 1 row(s)
- [PASS] claim ledger has required columns
- [PASS] claim ledger has 1 row(s)
- [PASS] result ledger script paths resolve
- [PASS] result ledger source paths resolve or are intentionally broad
- [PASS] claim section paths resolve
- [PASS] claim result references resolve
- [PASS] claim figure references resolve
- [PASS] claim source references resolve
- [PASS] supported claims have evidence references
- [PASS] claim expected values resolve to result ledger values
- [PASS] claim expected values match result ledger
- [PASS] expected values appear in claim text
- [PASS] expected values appear in claim sections
- [PASS] figure path exists: figures/template-comparison.pdf
- [PASS] finished figure ledger entries are referenced or still draft
- [PASS] model sections include direct-answer wording
- [WARN] TODO markers remain in LaTeX: paper/main.tex, paper/sections/00-abstract.tex, paper/sections/01-restatement.tex, paper/sections/02-analysis.tex, paper/sections/03-assumptions.tex, paper/sections/06-model-q1.tex, paper/sections/07-model-q2.tex, paper/sections/08-model-q3.tex, paper/sections/09-validation.tex, paper/sections/10-evaluation.tex
- [PASS] no absolute Windows paths in LaTeX
- [PASS] no literal ?? markers in LaTeX
- [PASS] LaTeX log has no fatal error patterns
- [PASS] LaTeX log has no unresolved reference/citation warnings
- [PASS] PDF exists: paper/main.pdf
- [PASS] scripts avoid absolute Windows paths


## File: state/result-ledger.csv

run_id,question,metric,value,unit,baseline,delta,script,source_data,notes
template,Q1,example_metric,0.0,unit,,,src/model_template.py,data/raw,replace with real result


## File: state/figure-ledger.csv

figure_id,path,purpose,caption_claim,script,source_data,question,status
FigTemplate,figures/template-comparison.pdf,Demonstrate figure pipeline,Replace with a real evidence claim,src/plot_template.py,runs/template-result.txt,Q1,draft


## File: state/claim-ledger.csv

claim_id,question,section,claim_text,result_ids,figure_ids,source_ids,expected_values,status,notes
C-Q1-001,Q1,paper/sections/06-model-q1.tex,问题一示例指标为0.0 unit,example_metric,FigTemplate,,example_metric=0.0,draft,replace after real modeling


## Output Policy

Return reviewable artifact content. Do not invent contest facts, data, references, or result values. Mark unknowns as TODO.
When proposing file edits, use exact file blocks:
BEGIN_FILE: relative/path
...complete file content...
END_FILE
Paths must stay inside the contest workspace and use forward slashes.