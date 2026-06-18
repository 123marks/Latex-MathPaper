# MCP Catalog for Math Modeling Paper Product

MCP should expose tools to the agent workflow. It should not replace deterministic scripts, LaTeX builds, or quality gates.

## Recommended MCP Categories

| Category | Purpose | MVP status |
| --- | --- | --- |
| Filesystem | Read and edit contest folders, LaTeX files, data, figures, scripts, and ledgers. | Recommended |
| Git | Inspect diffs and version decisions when the workspace becomes a git repo. | Recommended later |
| Fetch/Web search | Retrieve official contest rules, source references, package docs, and method background. | Recommended |
| Browser automation | Inspect generated previews, web pages, and future dashboard screens. | Optional |
| Command execution | Run Python scripts, solver commands, plot generation, and LaTeX builds. | Recommended |
| SQLite/DuckDB | Query tabular data and result ledgers for larger contests. | Optional |
| ArXiv/Semantic Scholar | Explore method literature when needed. | Optional |

## Candidate Servers and Sources

| MCP server type | Typical package/source | Use in this product |
| --- | --- | --- |
| Filesystem server | Official MCP filesystem examples or package | Give agents scoped access to `contests/<id>/`. |
| Git server | Official/community MCP git server | Support diff review, commit context, and versioned paper history. |
| Fetch server | Official/community MCP fetch server | Pull official rules and technical references. |
| Browser/Puppeteer/Playwright server | Community browser MCP server | Check rendered PDFs, web pages, and future UI. |
| SQLite server | Official/community SQLite MCP server | Query result ledgers and processed data. |
| Sequential thinking server | Community MCP server | Useful for complex modeling strategy, but not required. |
| Official MCP Registry | `registry.modelcontextprotocol.io` | Discover reviewed server entries instead of relying on random search results. |

## Minimal MCP Configuration Strategy

Start without MCP. The MVP should work through local files and `paperctl.py`.

Add MCP in this order:

1. Filesystem access scoped to the workspace.
2. Fetch/web access for official sources.
3. Command execution for build and script runs if the host environment supports safe scoping.
4. Browser automation for PDF/dashboard inspection.
5. Database MCP only when data volume justifies it.

## Guardrails

- Scope filesystem access to the active workspace or active contest folder.
- Do not expose arbitrary shell execution unless the runtime has approval and sandbox rules.
- Keep generated results in `runs/` and never mix generated artifacts with raw data.
- Store source URLs in `state/source-ledger.csv` when research affects the paper.
- Refresh official contest rules before each contest run.
- Treat MCP as a supply-chain and execution-risk surface. Prefer official reference servers and reviewed packages.
- Disable any MCP server that is not needed for the current stage.

## Product Interface

The product should describe MCP tools as capabilities in `product/config.yaml`.

Example:

```yaml
mcp:
  required:
    - filesystem
  recommended:
    - fetch
    - command
  optional:
    - browser
    - sqlite
```

This keeps MCP installation separate from the contest artifact workflow.

## Implementation Files

- Example config: `product/mcp/mcp-config.example.json`
- Security policy: `product/mcp/security-policy.md`

## Research Notes

The official `modelcontextprotocol/servers` repository now describes itself as a small set of reference implementations maintained by the MCP steering group, while broader discovery belongs to registries and community directories. Current high-value reference categories for this product are filesystem, git, fetch, time, and optional memory/sequential thinking. Recent 2026 MCP security reporting also reinforces that command and filesystem servers should be scoped narrowly and reviewed before use.

The product knowledge base now stores MCP recommendations in `product/knowledge-base.json`. Use these commands to query stage-specific recommendations:

```powershell
python paperctl.py recommend-mcp intake
python paperctl.py recommend-mcp modeling
python paperctl.py recommend-mcp figure
python paperctl.py recommend-mcp writing
python paperctl.py recommend-mcp verification
python paperctl.py kb-search mcp
python paperctl.py blueprint
```

The product-level blueprint lives at `product/workflows/competition-blueprint.json`. It maps MCP categories to lanes such as contest intake, compute/ledger, scientific figures, LaTeX writing, and submission verification.

Current implementation decision:

- `filesystem` is recommended for every stage but must be scoped to the active workspace or contest folder.
- `fetch` is recommended for rules/source retrieval, with prompt-injection caution.
- `command` is useful for modeling, figure, and verification stages but requires explicit sandbox/approval discipline.
- `git`, `browser`, and `sqlite-duckdb` remain optional until the workflow needs them.

Security-sensitive risk classes to consider before enabling MCP:

- Tool poisoning: malicious tool descriptions or metadata can influence agent behavior.
- Prompt injection through fetched web content or documents.
- Excessive filesystem scope exposing private contest data.
- Command execution tools that bypass the project workflow.
- Community server supply-chain risk.

The product default remains: local file workflow first, MCP only after explicit review.
