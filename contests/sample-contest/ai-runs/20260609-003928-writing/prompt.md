# Stage: writing

Goal: Draft or revise LaTeX sections using only verified evidence.

Recommended skills: math-modeling-paper, math-modeling-paper-excellence, nature-polishing

Recommended MCP/tools: filesystem

## Instructions

- Use motivation-formula-interpretation for formulas.
- Add direct-answer paragraphs for subquestions.
- Add or update claim-ledger rows for important claims.
- Mark unknown values as TODO instead of inventing them.

## Expected Outputs

- LaTeX section edits.
- Claim-ledger updates.
- Any result/figure/source dependencies needed before final writing.

## Context

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


## File: state/result-ledger.csv

run_id,question,metric,value,unit,baseline,delta,script,source_data,notes
template,Q1,example_metric,0.0,unit,,,src/model_template.py,data/raw,replace with real result


## File: state/figure-ledger.csv

figure_id,path,purpose,caption_claim,script,source_data,question,status
FigTemplate,figures/template-comparison.pdf,Demonstrate figure pipeline,Replace with a real evidence claim,src/plot_template.py,runs/template-result.txt,Q1,draft


## File: state/claim-ledger.csv

claim_id,question,section,claim_text,result_ids,figure_ids,source_ids,expected_values,status,notes
C-Q1-001,Q1,paper/sections/06-model-q1.tex,问题一示例指标为0.0 unit,example_metric,FigTemplate,,example_metric=0.0,draft,replace after real modeling


## File: paper/sections/06-model-q1.tex

\section{问题一模型建立与求解}

\subsection{模型定位}

问题一的核心任务是在TODO约束下优化TODO，从而回答TODO。

\subsection{变量与目标函数}

为刻画TODO，定义决策变量$x_i$。目标函数为
\begin{equation}
  \min f(x)=\sum_{i\in\mathcal{I}} c_i x_i,
\end{equation}
其中$c_i$表示TODO。该目标函数用于衡量TODO。

\subsection{求解结果与回答}

综合以上建模与求解结果，对问题一——``TODO''——本文回答如下：问题一示例指标为0.0 unit，真实建模后需替换为可追溯结果。


## File: paper/sections/07-model-q2.tex

\section{问题二模型建立与求解}

\subsection{模型定位}

问题二在问题一基础上引入TODO。

\subsection{求解结果与回答}

综合以上建模与求解结果，对问题二——``TODO''——本文回答如下：TODO。


## File: paper/sections/08-model-q3.tex

\section{问题三模型建立与求解}

\subsection{模型定位}

问题三进一步考虑TODO。

\subsection{求解结果与回答}

综合以上建模与求解结果，对问题三——``TODO''——本文回答如下：TODO。


## Output Policy

Return reviewable artifact content. Do not invent contest facts, data, references, or result values. Mark unknowns as TODO.
When proposing file edits, use exact file blocks:
BEGIN_FILE: relative/path
...complete file content...
END_FILE
Paths must stay inside the contest workspace and use forward slashes.