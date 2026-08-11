# Paper OS Product Contract

Paper OS is a **general-purpose, local-first document IDE**. It brings the
predictability of a mature code editor to structured writing, typesetting,
preview, evidence, local tools, and AI-assisted revision.

The product architecture is **Workspace Kernel + Packs**. The product and UI
use **Pack** as the common term: `general` is the baseline profile, `latex` and
`markdown` are format Packs, and `math-modeling` is the first professional
workflow Pack. Mathematical modeling is an important compatibility target; it
does not define the vocabulary or behavior of the general editor.

## Product Promise

Open a folder or create a document Workspace, work with the right editor and
preview for each Resource, run local tools with inspectable output, and review
AI changes before they touch disk.

Paper OS is for research groups, engineers, technical writers, students, and
teams producing serious long-form documents. A Workspace may contain LaTeX,
Markdown, code, data, images, PDFs, bibliographies, or generated Artifacts.

## Product Shape

| Surface | Responsibility | Boundary |
| --- | --- | --- |
| **Desktop IDE** | Workspace navigation, Resource editing, preview, search, local tools, builds, diagnostics, AI review | The primary working surface |
| **Workspace Kernel** | Workspace registration, path safety, sessions, files, commands, Capabilities, provider selection | Never assumes a contest or paper layout |
| **Packs** | Baseline, format, or professional workflow contributions: templates, commands, build profiles, diagnostics, semantic schemas, optional views | Extend one shared editor; never fork the product |
| **Local runtime** | Node API, tool discovery, process execution, artifact collection, user-owned model providers | Local files remain the source of truth |
| **Public site/control plane** | Discovery, download, documentation, and later account/community services | Does not carry routine document compilation or model inference |

The current Windows product entry is `PaperOS.exe`, backed by a
WinForms/WebView2 shell and a local Node runtime. Tauri and cloud collaboration
remain roadmap items and must not be presented as shipped behavior.

## Kernel Experience

The general editor owns the stable, repeated workflow:

1. **Open** a managed Workspace, register an existing folder, or reopen a legacy
   Workspace through an adapter.
2. **Navigate** a Resource tree and search across the active Workspace.
3. **Edit or preview** each Resource through the appropriate provider.
4. **Run** a command or build with visible progress, diagnostics, and outputs.
5. **Review AI changes** in a preview before Apply.
6. **Inspect status** from one source of truth: dirty Resources, diagnostics,
   active Pack, tool readiness, and build state.

Files, search, editor chrome, preview infrastructure, terminal/tool output, AI
review, commands, and status are Kernel concerns. Evidence ledgers, contest
stages, bibliography workflows, submission checks, and other professional
semantics are Pack concerns.

## Initial Packs

| Pack | Class | Intended Workspace | Contributions | Delivery state |
| --- | --- | --- | --- | --- |
| `general` | Baseline profile | Existing arbitrary folder | Baseline files, search, output, AI | Kernel and registration implemented; generic terminal planned |
| `latex` | Format Pack | Article, report, book | Starter template, LaTeX/PDF Capabilities, bibliography conventions | Template and current compile path implemented; provider/build-profile contract planned |
| `markdown` | Format Pack | Notes and long-form prose | Starter template, Markdown semantics | Template implemented; rich preview/link semantics planned |
| `math-modeling` | Professional workflow Pack | Mathematical-modeling competition | LaTeX plus stages, evidence ledgers, scripts, figures, verification, submission packaging | Existing `contests/` workflow exposed through a compatibility adapter |

A Pack declares contributions; it does not receive unrestricted filesystem or
process access. The Kernel evaluates Capabilities and routes commands through
the local runtime.

## AI Contract

### Current guarantees

- Model access is configured by the user through a compatible provider.
- AI context is scoped to the active Workspace and explicitly attached
  Resources or semantic references.
- AI output is a proposal, not an implicit write.
- Model requests may use a configured OpenAI-compatible provider or fall back to
  a deterministic `mock-local` response when provider execution fails. The UI
  must expose that state instead of presenting the fallback as a real model.
- The current file-block path rejects unsafe paths, produces a preview, and
  requires explicit Apply before writing. Preview returns mtime baselines;
  Apply rejects changed targets with `APPLY_CONFLICT` and rolls back earlier
  writes when a later write fails.
- The existing `BEGIN_FILE`/`END_FILE` response format is a compatibility path,
  not a durable, general EditTransaction implementation or the long-term
  editing model.

### Target EditTransaction invariants

- Every edit carries a Resource base version or saved checkpoint.
- Conflicts, stale bases, permission failures, and path collisions are explicit
  states presented before Apply.
- Multi-file Apply is atomic where supported and otherwise rolls back with an
  explicit failure report; successful transactions retain an undo record.
- AI and bulk edits converge on this one transaction path.

The compatibility path ships mtime conflict detection and best-effort rollback.
Stable Resource versions, durable transaction identity, hunk review, crash
recovery, and transaction-level undo remain roadmap contracts.

## Build Contract

Generic document compilation belongs to the IDE build service. A build starts
from an explicit entry Resource and a Build Profile, runs as a cancellable Build
Job, and produces a typed Artifact Set.

The current implementation is narrower: the editor sends an explicit
Workspace-relative `.tex` path and the local runtime selects Tectonic or
`latexmk`. `paperctl build <id>` remains specific to the mathematical-modeling
Pack and its `contests/<id>` layout. Product copy and general UI must not present
that CLI as the universal Workspace build contract.

## Current Product Reality

Implemented in the current codebase:

- Pack catalog with `general`, `latex`, `markdown`, and `math-modeling`;
- managed Workspaces under `workspaces/`;
- registration of existing folders with atomic registry persistence;
- legacy `contests/` discovery as mathematical-modeling Workspaces;
- safe Workspace-relative path resolution;
- server-side Workspace listing, creation, registration, file operations,
  search, preview/export, LaTeX compilation, evidence lookup, and AI Apply path
  routing;
- independent per-tab text buffers, Save All snapshot safety, and stale-response
  guards for Workspace tree and file loads;
- one-time desktop local-auth bootstrap and transactional Apply compatibility
  behavior with mtime conflicts and rollback;
- a dense desktop IDE shell with Resource tree, Monaco editing, PDF/image
  preview, Assistant, command surface, and bottom output panels.

Transitional behavior remains: some routes and UI vocabulary still use
`project` or `contest`, and the provider/job/transaction abstractions described
in the architecture are not yet complete. New interfaces use `workspace`;
`contest` is accepted only as a compatibility alias.

## Roadmap, Not Current Claims

- persisted `WorkspaceSession` restoration;
- generic `Resource`/`TextDocument` models and provider registries;
- Pack-contributed editors, previews, diagnostics, views, and semantic schemas;
- declarative `BuildProfile`, cancellable `BuildJob`, and typed `ArtifactSet`;
- a durable, content-versioned, hunk-reviewable and undoable `EditTransaction`
  shared by AI and non-AI multi-file edits;
- a unified `ToolRuntimeService` for discovery, installation, permissions, and
  streamed execution;
- true SyncTeX navigation, collaboration, roles, cloud sync, marketplace, and
  signed cross-platform distribution.

## Product Principles

1. **Workspace first.** “Contest” and “paper” are domain terms inside Packs.
2. **Local truth.** Files, builds, and tool output are authoritative on the
   user’s machine.
3. **Reviewable automation.** AI and bulk operations show their intended change
   before writing.
4. **Capability-gated extension.** A Pack may contribute behavior only through
   declared extension points.
5. **Editor-grade ergonomics.** Dense, readable, keyboard-friendly surfaces
   take precedence over marketing composition inside the app.
6. **Honest status.** Planned collaboration or semantic depth is never shown as
   already available.

## Brand

The visual system remains **Horizon Atelier**: deep charcoal, warm amber signal,
editorial typography on public surfaces, and the Quill Circle mark. In the IDE,
the brand is expressed through precision, contrast, and restrained accents;
professional Packs may add semantic cues but cannot replace the global chrome.

The previous line “LaTeX native. Team first. AI in every paragraph.” is retired
from global product surfaces while team collaboration remains on the roadmap.
A future Pack-specific campaign may reuse a qualified variant only after its
claims match shipped behavior.

## Non-Goals

- A browser tab masquerading as the primary desktop editor.
- A separate editor product for every document domain.
- Mandatory conversion of existing folders into a proprietary project shape.
- Platform-paid model tokens by default.
- AI writes that bypass review, path safety, or local version checks.
- Markdown output presented as a substitute for a required compiled deliverable.
