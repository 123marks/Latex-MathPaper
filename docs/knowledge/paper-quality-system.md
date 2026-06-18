# Paper Quality System

A strong mathematical modeling paper is judged as an artifact under time pressure. The product must make the judge see the answer, the model logic, and the evidence quickly.

## Core Quality Principles

1. Every subquestion receives an explicit direct answer.
2. Every important claim is backed by computed evidence, a formula, a table, a figure, or a cited source.
3. Every model choice explains why this method is appropriate and what alternative was rejected.
4. Every formula has motivation before it and interpretation after it.
5. Every figure has one evidence purpose and is interpreted in the text.
6. Every assumption has a reason and a validation path.
7. Sensitivity analysis is a main credibility section, not an appendix decoration.
8. Abstract, body, figures, and tables use consistent numbers.

## Required Paper Sections

| Section | Job |
| --- | --- |
| Title | Identify object, method, and goal without generic contest wording. |
| Abstract | Give background, per-question method/results, validation, and final value. |
| Problem restatement | Restate tasks in original words without solving them. |
| Problem analysis | Expose mathematical nature, difficulty, method route, and problem dependencies. |
| Assumptions | State only assumptions that affect the model and can be justified. |
| Symbols | Include symbols that actually appear in formulas. |
| Data preprocessing | Explain data quality, transformations, feature extraction, and modeling implications. |
| Model sections | Define variables, objectives, constraints, solver, results, validation, and direct answers. |
| Sensitivity and validation | Stress critical parameters, assumptions, and simplified boundaries. |
| Evaluation and extension | State strengths, limitations, and extensibility without self-damage. |
| Appendix | Include reproducible code and supporting artifacts when allowed. |

## Figure Standards

- Use vector PDF/SVG for charts when possible.
- Use PNG only for raster image panels.
- Use clear axes, units, labels, and captions.
- Avoid default matplotlib styling.
- Avoid pie charts and decorative charts unless explicitly justified.
- Use direct labels over legends when that reduces reader effort.
- Each caption should state the evidence message, not just the chart type.

## Verification Checklist

- LaTeX compiles.
- No missing image files.
- No unresolved `??` references.
- No undefined citations.
- All required section files exist.
- Result ledger has source, metric, value, unit, and script columns.
- Figure ledger has figure path, purpose, script, source data, and caption claim columns.
- Every model section contains a direct answer paragraph.
- Sensitivity section exists and contains at least one substantive parameter or assumption check.

## Anti-Slop Scan

Flag these patterns:

- Generic transitions such as "first, then, finally" without content.
- Claims like "good performance", "reasonable", or "effective" without numbers.
- Equations introduced but not used.
- Figures shown but not interpreted.
- Tables that duplicate prose without comparison value.
- Long background writing that delays the model.
- English abstract facts that do not match the Chinese abstract.
- Absolute local paths in LaTeX or appendix code.
