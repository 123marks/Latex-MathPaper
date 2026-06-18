# Findings

## Local Workspace

- The workspace is currently a skill-package collection plus docs, not an application.
- Existing zip assets include `math-modeling-paper.zip`, `math-modeling-paper-excellence.zip`, `nature-skills-main.zip`, `web-search.zip`, `playwright-master.zip`, and `self-improving.zip`.
- The already-created plan at `docs/plans/2026-06-08-math-modeling-paper-product-plan.md` defines the product direction: file-first, LaTeX-based, skill/MCP-assisted, and verification-gated.

## Local Skills Read

- `math-modeling-paper`: provides the contest-paper chapter structure and phase order from problem analysis to abstract.
- `math-modeling-paper-excellence`: enforces judged-artifact quality, direct answers, formulas, quantitative results, sensitivity analysis, and LaTeX verification.
- `nature-figure`: gives publication-style matplotlib rules, including typography, restrained palettes, vector export, and figure archetypes.
- `nature-polishing`: improves academic prose but explicitly forbids inventing scientific arguments or data.

## External Skill Search Results

Commands run with `npx skills find`:

- `latex academic writing`
- `matplotlib scientific figure`
- `research paper`
- `mcp`
- `math modeling`
- `scientific visualization latex mathematical modeling mcp`
- `math model selector optimization statistical modeling`
- `mcp filesystem fetch memory builder`
- `academic writing latex paper polish research`

Relevant candidates:

- `bahayonghang/academic-writing-skills@latex-paper-en`: English LaTeX paper writing support.
- `poemswe/co-researcher@academic-writing`: academic writing support.
- `a-green-hand-jack/ml-research-skills@init-latex-project`: LaTeX project initialization.
- `wentorai/research-plugins@latex-skills`: LaTeX skill support.
- `davila7/claude-code-templates@scientific-visualization`: scientific visualization.
- `lingzhi227/agent-research-skills@figure-generation`: research figure generation.
- `dkyazzentwatwa/chatgpt-skills@scientific-paper-figure-generator`: scientific paper figure generator.
- `seabbs/skills@analyzing-research-papers`: research paper analysis.
- `qodex-ai/ai-agent-skills@chat-with-arxiv`: arXiv paper interaction.
- `anthropics/skills@mcp-builder`: MCP builder.
- `mcp-use/mcp-use@mcp-apps-builder`: MCP app builder.
- `github/awesome-copilot@mcp-cli`: MCP CLI support.
- `athola/claude-night-market@math-review`: math review.
- `eyadsibai/ltk@scientific-computing`: scientific computing.
- `drshailesh88/integrated_content_os@scientific-visualization`: scientific visualization.
- `jimmc414/kosmos@scientific-visualization`: scientific visualization.
- `kishorkukreja/awesome-supply-chain@optimization-modeling`: optimization modeling.
- `alphaonedev/openclaw-graph@cs-math`: graph/math candidate.
- `base/skills@base-mcp`: MCP-related skill candidate.
- `alpic-ai/skybridge@mcp-app-builder`: MCP app builder candidate.
- `mathews-tom/praxis-skills@filesystem`: filesystem candidate.
- `webrenew/memories@memories-mcp`: memory MCP candidate.
- `skills.volces.com@academic-writing-refiner`: academic writing refiner.
- `zihan-zhu/academic-writing-refiner@academic-writing-refiner`: academic writing refiner.

Notes:

- Ordinary sandboxed `npx skills find` hit `EACCES` writing/accessing npm cache; the successful searches required escalation for npm/network access.
- No external skill was installed. Candidates were added to the local knowledge base for review-before-install use.

## Architecture Implications

- The first product should be a robust artifact workflow, not a dashboard.
- Skills should be invoked by workflow stage: intake, modeling, figures, writing, verification.
- MCP should expose filesystem, git, web/search, browser, and command execution after the local scaffold is reliable.
- The knowledge base should store candidate skills and MCP servers with recommendation status rather than installing everything immediately.
- The product now needs a single workflow blueprint that UI and CLI can both read, so stage guidance does not drift between front-end buttons and backend commands.

## Source Notes

- `latexmk` is the preferred build driver because it repeatedly runs the needed LaTeX commands to resolve references and produce the final PDF.
- Contest rules must be refreshed per competition year because page limits, summary sheet rules, and appendix policies can change.
- Nature-style figures should prioritize readable axes, consistent typography, source-data traceability, and non-decorative evidence.
