# Math Modeling Paper Product Plan

> **Goal:** Build a local product that turns a contest problem, data, modeling code, and reusable agent skills into a high-quality LaTeX mathematical modeling paper.

## 1. Product Definition

This product is a contest-paper operating system, not a generic writing assistant.

The target output is a complete, reproducible LaTeX paper package:

- `main.tex` and modular section files.
- `figures/` with publication-quality PDF/SVG/PNG figures.
- `tables/` with generated tables or LaTeX fragments.
- `src/` with modeling, preprocessing, and plotting scripts.
- `data/` with raw and processed contest data.
- `runs/` with model results, logs, metrics, and validation artifacts.
- `paper.pdf` compiled by a repeatable build command.

The product should help one person move fast during a math modeling competition while preserving the standards expected from a top contest paper: clear problem decomposition, defensible modeling choices, quantitative results, high-quality figures, explicit validation, and a clean LaTeX deliverable.

## 2. Current Local Assets

The workspace currently contains skill packages rather than an application:

- `math-modeling-paper.zip`: contest-paper structure, chapter writing rules, and templates.
- `math-modeling-paper-excellence.zip`: stricter review workflow for problem analysis, assumptions, validation, figures, LaTeX compilation, and anti-slop checks.
- `nature-skills-main.zip`: `nature-figure`, `nature-polishing`, and `nature-data` skills for publication-style figures, academic writing, and data availability discipline.
- `web-search.zip`: web research helper skill.
- `playwright-master.zip`: browser automation skill, useful for visual checks and web capture.
- `self-improving.zip`: agent memory and continuous improvement pattern, useful later but not required for the first product cut.

The immediate gap is orchestration. The skills describe local expert behavior, but there is no product layer that decides when to call each skill, where artifacts live, how outputs are checked, or how LaTeX compilation gates completion.

## 3. Product Architecture

Use a file-first architecture. The product should work even without a web UI.

```text
contest input
  -> intake and problem decomposition
  -> data audit and modeling plan
  -> code execution and result generation
  -> figure and table generation
  -> LaTeX section drafting
  -> quality review and consistency checks
  -> compile and deliver paper.pdf
```

Recommended repository layout:

```text
.
|-- AGENTS.md
|-- product/
|   |-- config.yaml
|   |-- workflows/
|   |   |-- intake.yaml
|   |   |-- modeling.yaml
|   |   |-- writing.yaml
|   |   `-- verification.yaml
|   `-- checklists/
|       |-- paper-quality.md
|       |-- figure-quality.md
|       `-- latex-quality.md
|-- contests/
|   `-- <contest-id>/
|       |-- problem/
|       |-- data/raw/
|       |-- data/processed/
|       |-- src/
|       |-- figures/
|       |-- tables/
|       |-- runs/
|       |-- paper/
|       |   |-- main.tex
|       |   |-- sections/
|       |   |-- refs.bib
|       |   `-- Makefile
|       `-- state/
|           |-- problem-map.md
|           |-- modeling-plan.md
|           |-- result-ledger.csv
|           |-- figure-ledger.csv
|           `-- verification-report.md
`-- docs/plans/
```

The key idea is traceability. Every claim in the paper should connect back to a result row, every result row should connect back to code and data, and every figure should have a declared evidence purpose.

## 4. Skill Orchestration

The skills should be treated as product modules:

| Stage | Primary skill | Product responsibility |
| --- | --- | --- |
| Problem intake | `math-modeling-paper` | Split the contest task into questions, expected outputs, methods, and evidence needs. |
| Quality strategy | `math-modeling-paper-excellence` | Enforce judged-artifact standards, section logic, validation, and anti-slop checks. |
| Figure generation | `nature-figure` | Produce clean research-style plots with stable palettes, typography, and export formats. |
| Academic language | `nature-polishing` | Polish abstracts, conclusions, and English text without inventing claims. |
| Research support | `web-search` or MCP web search | Collect official rules, references, and method background. |
| Browser checks | `playwright` | Later: inspect generated HTML/PDF previews or web UI. |

Do not let a polishing skill rewrite the paper's scientific argument. The argument must come from problem analysis, model outputs, and verified evidence.

## 5. MCP Strategy

MCP should be the tool integration layer, not the product brain.

Useful MCP categories:

- Filesystem MCP: expose contest folders, LaTeX files, data, scripts, and generated artifacts.
- Git MCP: inspect diffs, commits, and branch state during contest work.
- Python or command MCP: run preprocessing, solvers, plotting scripts, and syntax checks.
- Web/search MCP: retrieve official contest rules, method references, and package documentation.
- Browser MCP: inspect web pages or generated previews when needed.
- SQLite or DuckDB MCP: optional, useful if contest data becomes tabular and query-heavy.

The product should still have local scripts and checklists. MCP gives tools to agents; it does not replace deterministic build, validation, and artifact organization.

## 6. LaTeX Build Standard

Use `latexmk` as the default build driver because it automatically reruns LaTeX enough times to resolve references, bibliographies, and indexes.

Minimum build targets:

```makefile
pdf:
	latexmk -pdf -interaction=nonstopmode -halt-on-error main.tex

clean:
	latexmk -C
```

Recommended paper structure:

```latex
\input{sections/00-abstract}
\input{sections/01-restatement}
\input{sections/02-analysis}
\input{sections/03-assumptions}
\input{sections/04-symbols}
\input{sections/05-data}
\input{sections/06-model-q1}
\input{sections/07-model-q2}
\input{sections/08-model-q3}
\input{sections/09-validation}
\input{sections/10-evaluation}
```

Use LaTeX as the source of truth for the final paper. Markdown can be used for planning and review notes, but the deliverable should be edited and compiled as LaTeX.

## 7. Contest Paper Workflow

### Phase A: Intake

Inputs:

- Contest problem PDF or text.
- Data files.
- Contest-specific rules and template constraints.
- Team preferences, such as Chinese-only, bilingual abstract, page limit, appendix policy.

Outputs:

- `state/problem-map.md`: question list, required outputs, constraints, data dependencies, likely methods.
- `state/modeling-plan.md`: selected model families, alternatives rejected, expected figures and tables.

Acceptance criteria:

- Every subquestion has a direct answer target.
- Every expected result has a planned evidence artifact.
- Assumptions are tagged with validation paths.

### Phase B: Data and Modeling

Inputs:

- Raw data.
- Problem map.

Outputs:

- Cleaned data in `data/processed/`.
- Modeling scripts in `src/`.
- Run outputs in `runs/`.
- `state/result-ledger.csv`.

Acceptance criteria:

- All result numbers in the paper can be traced to a script output.
- Scripts use relative paths.
- Model choices include a reason, not just a method name.

### Phase C: Figures and Tables

Inputs:

- Run outputs and validation metrics.

Outputs:

- Figures in `figures/`, preferably PDF/SVG for vector plots and PNG only when raster is necessary.
- Tables or LaTeX fragments in `tables/`.
- `state/figure-ledger.csv` with figure purpose, source data, script, and caption claim.

Acceptance criteria:

- Each figure has one evidence purpose.
- Axes, units, captions, and text are readable.
- No default matplotlib style, decorative charts, or unsupported claims.

### Phase D: LaTeX Writing

Inputs:

- Problem map, modeling plan, results, figure ledger.

Outputs:

- Modular LaTeX paper sections.
- Chinese abstract and English abstract if required.
- References and appendix code.

Acceptance criteria:

- Each question section follows: motivation, variables, objective, constraints, algorithm, results, mechanism explanation, direct answer.
- Formulas use the motivation-formula-interpretation pattern.
- Results include exact values, units, baselines, and percentages where applicable.

### Phase E: Verification

Inputs:

- Full paper package.

Outputs:

- `paper.pdf`.
- `state/verification-report.md`.

Acceptance criteria:

- LaTeX compiles cleanly.
- No undefined references or missing citations.
- Key numbers agree across abstract, body, tables, and figures.
- Every figure is interpreted in text.
- Sensitivity analysis covers important parameters and assumptions.
- The final answer to each contest question is explicit.

## 8. MVP Scope

Build the first usable product as a command-line/file workflow:

1. Scaffold a contest workspace from a template.
2. Create `problem-map.md` and `modeling-plan.md` from the problem statement.
3. Provide a LaTeX paper template aligned to the math modeling chapter structure.
4. Provide a figure script template using Nature-style matplotlib defaults.
5. Provide ledgers for results and figures.
6. Provide a verification checklist and build command.

This MVP is enough to support a real contest before any web UI exists.

## 9. Later Product Layers

After the file-first MVP works, add layers in this order:

1. Orchestrator CLI: `paperctl init`, `paperctl intake`, `paperctl build`, `paperctl verify`.
2. MCP configuration bundle: filesystem, git, browser/search, and command execution tools.
3. Agent workflow prompts: intake agent, modeling agent, figure agent, writer agent, verifier agent.
4. Local dashboard: progress view, result ledger, figure ledger, build status, PDF preview.
5. Memory layer: reusable modeling patterns, judge comments, prior contest templates, preferred figure styles.

Avoid starting with a dashboard. The dashboard is useful only after the underlying artifact workflow is reliable.

## 10. Quality Gates

Use these non-negotiable gates before calling a paper complete:

- Problem gate: every contest subquestion has a direct answer.
- Evidence gate: every important claim has a number, table, figure, formula, or cited source.
- Reproducibility gate: all generated results come from relative-path scripts.
- Figure gate: every figure has a declared purpose, source script, and caption claim.
- LaTeX gate: `latexmk` build succeeds and cross-references resolve.
- Consistency gate: abstract, body, tables, and figures use the same numbers.
- Validation gate: sensitivity and robustness analysis are substantive, not decorative.
- Anti-slop gate: remove generic transitions, vague claims, unused formulas, and unexplained figures.

## 11. Implementation Plan

### Milestone 1: Product Skeleton

Create the repository structure, contest template, LaTeX skeleton, Makefile, result ledger, figure ledger, and verification checklist.

Deliverable:

- A new contest can be initialized manually by copying `templates/contest/`.

### Milestone 2: First Contest Workflow

Apply the skeleton to one real or sample contest problem.

Deliverable:

- One compiled sample paper with placeholder-safe content, one generated figure, and a verification report.

### Milestone 3: CLI Automation

Add a small CLI to initialize contest workspaces, run builds, and run verification checks.

Deliverable:

- `paperctl init <contest-id>`
- `paperctl build <contest-id>`
- `paperctl verify <contest-id>`

### Milestone 4: Agent/MCP Integration

Add documented MCP config and role prompts for intake, modeling, figures, writing, and verification.

Deliverable:

- A repeatable agent workflow that can take a new contest folder from problem intake to compiled draft.

### Milestone 5: Polished Product Layer

Add dashboard or TUI only after the CLI and artifacts are stable.

Deliverable:

- A local operator interface showing stage status, build errors, missing evidence, and PDF preview.

## 12. Research Sources

Use these sources as the baseline references for implementation decisions:

- MCP architecture: https://modelcontextprotocol.io/docs/learn/architecture
- MCP specification architecture: https://modelcontextprotocol.io/specification/2025-06-18/architecture
- CTAN `latexmk`: https://ctan.org/pkg/latexmk
- COMAP MCM/ICM instructions: https://www.contest.comap.org/undergraduate/contests/mcm/instructions.html
- CUMCM official site: https://www.mcm.edu.cn/index_cn.html
- CUMCM paper format PDF: https://www.mcm.edu.cn/upload_cn/node/775/cQMeL0YY905244c8bd4b9af832f1699446d8385e.pdf
- Nature research figure guide: https://research-figure-guide.nature.com/
- Nature figure panel guide: https://research-figure-guide.nature.com/figures/building-and-exporting-figure-panels/

Contest rules can change by year. The product must refresh the relevant official rule documents before each contest run.

## 13. Immediate Next Step

The next engineering action should be Milestone 1:

- Expand or install the useful skills into the local skill environment if needed.
- Add `templates/contest/`.
- Add a LaTeX modeling-paper template.
- Add Nature-style plotting template.
- Add result and figure ledgers.
- Add verification checklist.

This creates a usable product foundation without depending on external services or a premature UI.
