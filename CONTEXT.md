# Paper OS Domain Context

## Product Intent

Paper OS is a general-purpose, local-first document IDE. It should feel as
capable and predictable as a mainstream code editor while treating structured
writing, typesetting, preview, evidence, and AI-assisted revision as first-class
work.

Mathematical modeling is a built-in professional Pack. It is an important use
case and compatibility target, but it must not define the Workspace Kernel or
the vocabulary of the general editor.

## Domain Language

### Workspace

A directory explicitly opened or created by the user. A Workspace has a stable
ID, a display name, a root path, a Pack, and derived Capabilities. Files outside
the registered root are never part of the Workspace.

### Document

A file inside a Workspace that Paper OS can edit or preview. Documents may be
LaTeX, Markdown, bibliography, source code, data, images, PDFs, or other formats.

### Pack

A declarative professional profile that adds defaults, templates, commands,
quality checks, and optional views to the Workspace Kernel. Packs do not own
file editing, search, AI review, or preview infrastructure.

Initial Packs:

- `general`: arbitrary folders and mixed text/source documents.
- `latex`: LaTeX editing, compilation, PDF preview, bibliography, and SyncTeX.
- `markdown`: Markdown notes and long-form writing.
- `math-modeling`: LaTeX plus problem stages, evidence ledgers, scripts, figures,
  and submission verification.

### Capability

A feature exposed by the Workspace Kernel or enabled by a Pack, such as file
editing, search, terminal, LaTeX compilation, PDF preview, evidence tracing, or
submission packaging.

### Artifact

A generated or imported file with a role in the work: PDF output, figure, data
table, build log, reference database, model result, or submission package.

### Evidence Link

A trace from a statement in a Document to an Artifact or source. Evidence Links
are useful beyond mathematical modeling and must remain optional for Workspaces
that do not use them.

### Apply Proposal

An AI-produced edit that is previewed before it is written. Apply Proposals use
Workspace-relative paths and never bypass the Workspace root.

### Workspace Adapter

An implementation that supplies Workspaces to the Workspace Kernel. The first
three adapters are managed Workspaces under `workspaces/`, explicitly registered
external folders, and legacy mathematical-modeling projects under `contests/`.

## Invariants

1. The Workspace Kernel never assumes a contest, paper section layout, or
   evidence ledger exists.
2. Every file operation resolves through the registered Workspace root.
3. Packs add Capabilities; they do not fork the editor into separate products.
4. AI writes require an Apply Proposal and explicit user action.
5. Local files and local compilation remain the source of truth.
6. Legacy `contests/` projects remain usable through a Workspace Adapter during
   migration.
7. UI terminology uses Workspace, Document, Pack, Capability, Artifact, and
   Evidence Link consistently.

## Architecture Reading Order

1. `CONTEXT.md`
2. `docs/adr/0001-general-workspace-kernel.md`
3. `docs/ARCHITECTURE.md`
4. `docs/CAPABILITY_MAP.md`
5. Pack-specific material under `product/` and `templates/`
