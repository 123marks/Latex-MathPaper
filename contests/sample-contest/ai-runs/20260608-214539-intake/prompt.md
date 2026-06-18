# Stage: intake

Goal: Read the contest problem and rules, then produce a judge-facing problem map and modeling plan.

Recommended skills: math-modeling-paper, math-modeling-paper-excellence, web-search

Recommended MCP/tools: filesystem, fetch

## Instructions

- Extract every subquestion and required output.
- Identify data dependencies, constraints, metrics, and direct-answer targets.
- Propose model families and rejected alternatives.
- Do not solve the problem before the direct-answer targets are clear.

## Expected Outputs

- Updated state/problem-map.md content.
- Updated state/modeling-plan.md content.
- Source-ledger updates for official rules and references.

## Context

## File: contest-rules.md

# Contest Rules

Record the current official rules for this contest run.

## Official Sources

| Source | URL | Retrieved date | Notes |
| --- | --- | --- | --- |
| Contest homepage | TODO | TODO | TODO |
| Paper format rules | TODO | TODO | TODO |

## Submission Constraints

- Page limit: TODO
- Summary sheet: TODO
- Anonymous submission requirements: TODO
- Appendix policy: TODO
- Allowed software/tools: TODO

## Notes

Refresh this file before each contest. Rules can change by year.


## File: problem/problem.md

# Problem Statement Notes

Put the official problem statement PDF or copied text in this folder.

## Subquestions

| ID | Original task | Required output | Data needed | Evaluation clue |
| --- | --- | --- | --- | --- |
| Q1 | TODO | TODO | TODO | TODO |
| Q2 | TODO | TODO | TODO | TODO |
| Q3 | TODO | TODO | TODO | TODO |


## File: state/problem-map.md

# Problem Map

## Contest

- Contest name: TODO
- Problem ID: TODO
- Retrieved date: TODO
- Official rule source: TODO

## Judge-Facing Questions

| Question | What is being asked | Required direct answer | Evidence needed | Planned artifact |
| --- | --- | --- | --- | --- |
| Q1 | TODO | TODO | TODO | TODO |
| Q2 | TODO | TODO | TODO | TODO |
| Q3 | TODO | TODO | TODO | TODO |

## Data Dependencies

| Data file | Used by | Key fields | Risks |
| --- | --- | --- | --- |
| TODO | TODO | TODO | TODO |

## Assumptions To Validate

| Assumption | Why acceptable | Used in | Validation path |
| --- | --- | --- | --- |
| TODO | TODO | TODO | TODO |


## File: state/modeling-plan.md

# Modeling Plan

## Global Strategy

State the shared modeling frame and how the subquestions connect.

## Per-Question Plan

| Question | Mathematical type | Primary model | Baseline | Rejected alternative | Reason |
| --- | --- | --- | --- | --- | --- |
| Q1 | TODO | TODO | TODO | TODO | TODO |
| Q2 | TODO | TODO | TODO | TODO | TODO |
| Q3 | TODO | TODO | TODO | TODO | TODO |

## Planned Figures

| Figure | Purpose | Source data | Script | Expected message |
| --- | --- | --- | --- | --- |
| Fig. 1 | TODO | TODO | TODO | TODO |

## Planned Validation

| Check | Object | Method | Success criterion |
| --- | --- | --- | --- |
| TODO | TODO | TODO | TODO |


## File: state/source-ledger.csv

source_id,title,url,retrieved_date,used_for,notes
rules,Official contest rules,TODO,TODO,format constraints,refresh before contest


## Output Policy

Return concrete file edits or artifact content. Do not invent contest facts, data, references, or result values. Mark unknowns as TODO.