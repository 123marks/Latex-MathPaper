# Skill Catalog for Math Modeling Paper Product

This catalog separates skills that should drive the product from skills that are useful only as references or optional extensions.

## Local Core Skills

| Skill | Source | Status | Product use |
| --- | --- | --- | --- |
| `math-modeling-paper` | `math-modeling-paper.zip` | Core | Contest-paper structure, chapter rules, phase order, abstract and section templates. |
| `math-modeling-paper-excellence` | local installed skill and zip | Core | Quality gates for judged artifacts, direct answers, evidence discipline, LaTeX verification. |
| `nature-figure` | `nature-skills-main.zip` | Core | Publication-style matplotlib figures and multi-panel figure discipline. |
| `nature-polishing` | `nature-skills-main.zip` | Core | Academic prose polishing after the argument and data are already verified. |
| `nature-data` | `nature-skills-main.zip` | Useful | Data availability, metadata, reproducibility discipline. |
| `web-search` | `web-search.zip` | Useful | Official rules, method references, and source collection. |
| `playwright-master` | `playwright-master.zip` | Optional | Browser/PDF preview checks or future dashboard QA. |
| `self-improving` | `self-improving.zip` | Optional | Long-term memory and feedback loops after the MVP is stable. |

## External Candidate Skills

Search command examples:

```powershell
npx skills find "latex academic writing"
npx skills find "matplotlib scientific figure"
npx skills find "research paper"
npx skills find "mcp"
npx skills find "math modeling"
```

| Candidate | Status | Why it matters | Install command |
| --- | --- | --- | --- |
| `bahayonghang/academic-writing-skills@latex-paper-en` | Candidate | English LaTeX paper writing support. | `npx skills add bahayonghang/academic-writing-skills@latex-paper-en -g -y` |
| `poemswe/co-researcher@academic-writing` | Candidate | Academic writing workflows. | `npx skills add poemswe/co-researcher@academic-writing -g -y` |
| `a-green-hand-jack/ml-research-skills@init-latex-project` | Candidate | LaTeX project initialization ideas. | `npx skills add a-green-hand-jack/ml-research-skills@init-latex-project -g -y` |
| `wentorai/research-plugins@latex-skills` | Candidate | Extra LaTeX skill support. | `npx skills add wentorai/research-plugins@latex-skills -g -y` |
| `davila7/claude-code-templates@scientific-visualization` | Candidate | Scientific visualization patterns. | `npx skills add davila7/claude-code-templates@scientific-visualization -g -y` |
| `lingzhi227/agent-research-skills@figure-generation` | Candidate | Research figure generation support. | `npx skills add lingzhi227/agent-research-skills@figure-generation -g -y` |
| `dkyazzentwatwa/chatgpt-skills@scientific-paper-figure-generator` | Candidate | Paper figure generation ideas. | `npx skills add dkyazzentwatwa/chatgpt-skills@scientific-paper-figure-generator -g -y` |
| `seabbs/skills@analyzing-research-papers` | Candidate | Analyze exemplar papers and method references. | `npx skills add seabbs/skills@analyzing-research-papers -g -y` |
| `qodex-ai/ai-agent-skills@chat-with-arxiv` | Optional | Literature exploration if internet and arXiv access are available. | `npx skills add qodex-ai/ai-agent-skills@chat-with-arxiv -g -y` |
| `anthropics/skills@mcp-builder` | Candidate | Build or adapt MCP servers. | `npx skills add anthropics/skills@mcp-builder -g -y` |
| `mcp-use/mcp-use@mcp-apps-builder` | Optional | MCP app patterns. | `npx skills add mcp-use/mcp-use@mcp-apps-builder -g -y` |
| `github/awesome-copilot@mcp-cli` | Optional | MCP command-line operations. | `npx skills add github/awesome-copilot@mcp-cli -g -y` |
| `athola/claude-night-market@math-review` | Candidate | Mathematical derivation and proof review. | `npx skills add athola/claude-night-market@math-review -g -y` |
| `tushar2704/research-skills@latex-writing` | Candidate | LaTeX writing workflow candidate found through skills.sh search. | `npx skills add tushar2704/research-skills@latex-writing -g -y` |
| `tushar2704/research-skills@paper-writing` | Candidate | Paper writing workflow candidate found through skills.sh search. | `npx skills add tushar2704/research-skills@paper-writing -g -y` |
| `tushar2704/research-skills@scientific-writing` | Candidate | Scientific writing workflow candidate. | `npx skills add tushar2704/research-skills@scientific-writing -g -y` |
| `plurigrid/asi@academic-writing-standards` | Candidate | Academic writing standards and style support. | `npx skills add plurigrid/asi@academic-writing-standards -g -y` |
| `composiohq/awesome-claude-skills@research-paper-chat` | Optional | Chat with research papers; useful for literature digestion if sources are verified. | `npx skills add composiohq/awesome-claude-skills@research-paper-chat -g -y` |
| `jcardif/agent-skills@scientific-paper` | Candidate | Scientific paper workflow candidate found through 2026-06-08 search. | `npx skills add jcardif/agent-skills@scientific-paper -g -y` |
| `eyadsibai/ltk@scientific-computing` | Candidate | Scientific computing candidate for numerical workflow review. | `npx skills add eyadsibai/ltk@scientific-computing -g -y` |
| `l-yifan/skills@scientific-figure-pro` | Candidate | Scientific figure generation/review candidate. | `npx skills add l-yifan/skills@scientific-figure-pro -g -y` |
| `drshailesh88/integrated_content_os@scientific-visualization` | Candidate | Additional scientific visualization candidate found on 2026-06-09. | `npx skills add drshailesh88/integrated_content_os@scientific-visualization -g -y` |
| `jimmc414/kosmos@scientific-visualization` | Optional | Alternative scientific visualization candidate. | `npx skills add jimmc414/kosmos@scientific-visualization -g -y` |
| `zechenzhangagi/ai-research-skills@ml-paper-writing` | Optional | ML paper writing candidate; use only after result evidence is locked. | `npx skills add zechenzhangagi/ai-research-skills@ml-paper-writing -g -y` |
| `davila7/claude-code-templates@ml-paper-writing` | Optional | ML paper writing workflow candidate; overlaps with local writing skills. | `npx skills add davila7/claude-code-templates@ml-paper-writing -g -y` |
| `eyh0602/skillshub@paper-polish` | Optional | Paper polishing candidate; should never introduce new claims. | `npx skills add eyh0602/skillshub@paper-polish -g -y` |
| `parcadei/continuous-claude-v3@math-model-selector` | Optional | Model family selector candidate; advisory only. | `npx skills add parcadei/continuous-claude-v3@math-model-selector -g -y` |
| `kishorkukreja/awesome-supply-chain@optimization-modeling` | Candidate | Optimization modeling candidate for logistics, scheduling, allocation, and constraints. | `npx skills add kishorkukreja/awesome-supply-chain@optimization-modeling -g -y` |
| `alphaonedev/openclaw-graph@cs-math` | Optional | Graph/math candidate for algorithm-heavy problems. | `npx skills add alphaonedev/openclaw-graph@cs-math -g -y` |
| `seabbs/skills@academic-writing-standards` | Candidate | Academic writing standards candidate. | `npx skills add seabbs/skills@academic-writing-standards -g -y` |
| `base/skills@base-mcp` | Candidate | MCP-related tooling candidate. | `npx skills add base/skills@base-mcp -g -y` |
| `alpic-ai/skybridge@mcp-app-builder` | Candidate | MCP app builder candidate. | `npx skills add alpic-ai/skybridge@mcp-app-builder -g -y` |
| `mathews-tom/praxis-skills@filesystem` | Optional | Filesystem-oriented skill candidate. | `npx skills add mathews-tom/praxis-skills@filesystem -g -y` |
| `webrenew/memories@memories-mcp` | Optional | Memory MCP candidate; review privacy risks before use. | `npx skills add webrenew/memories@memories-mcp -g -y` |

## Recommendation

Install only after reading each skill's `SKILL.md`. For the first product version, local skills are enough. External skills should be treated as optional references because contest work benefits more from a stable workflow than from many overlapping writing helpers.

Priority installation order if more capability is needed:

1. `seabbs/skills@analyzing-research-papers`
2. `athola/claude-night-market@math-review`
3. `davila7/claude-code-templates@scientific-visualization`
4. `bahayonghang/academic-writing-skills@latex-paper-en`
5. `anthropics/skills@mcp-builder`

Additional candidates from later search should be read before installation:

- `tushar2704/research-skills@latex-writing`
- `tushar2704/research-skills@paper-writing`
- `plurigrid/asi@academic-writing-standards`
- `jcardif/agent-skills@scientific-paper`
- `l-yifan/skills@scientific-figure-pro`
- `parcadei/continuous-claude-v3@math-model-selector`

Machine-readable recommendations now live in `product/knowledge-base.json`. Use:

```powershell
python paperctl.py recommend-skills intake
python paperctl.py recommend-skills modeling
python paperctl.py recommend-skills figure
python paperctl.py recommend-skills writing
python paperctl.py recommend-skills verification
python paperctl.py blueprint
```

## Safety Rules

- Do not install many skills blindly before a contest.
- Do not let external writing skills invent claims, references, formulas, or results.
- Treat every external skill as advisory until its instructions are inspected.
- Prefer local product workflows and ledgers over skill-specific output formats.
