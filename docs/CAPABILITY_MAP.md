# Paper OS Capability Map

This map separates working code from architectural intent. It is not a feature
wish list and must be updated when verification changes.

## Status Legend

| Status | Meaning |
| --- | --- |
| **Implemented** | Present in the current codebase with a working runtime path |
| **Partial** | A useful slice exists, but the contract or UX is incomplete |
| **Contract** | Defined in architecture; implementation has not converged on it |
| **Planned** | Product direction without a complete contract or implementation |
| **Compatibility** | Retained for existing Workspaces while new interfaces migrate |

These labels describe implementation state in the named working-tree baseline;
they do not imply a clean commit, CI evidence, or release readiness. Delivery
evidence is tracked separately in `STATUS.md` and `TRACEABILITY.md`.

## Workspace Kernel

| Capability | Owner | Status | Current evidence / remaining work |
| --- | --- | --- | --- |
| List managed, external, and legacy Workspaces | Kernel | **Implemented** | `app/lib/workspaces.mjs`; `/api/editor/projects` |
| Create managed Workspace from Pack template | Kernel + Pack | **Implemented** | LaTeX and Markdown templates under `templates/workspaces/` |
| Register an existing folder without copying it | Kernel | **Implemented** | Atomic external Workspace registry |
| Safe Workspace-relative path resolution | Kernel | **Implemented** | Traversal and absolute-path rejection; used by editor routes |
| Pack catalog and Capability metadata | Pack Host | **Implemented** | `product/workspace-packs.json` |
| `workspace` request identity | Kernel/API | **Partial** | New routes accept it; `contest` remains a compatibility alias |
| Pack-aware Workspace chooser | Workbench | **Implemented** | Managed create, external registration, title-bar switching, Workspace metadata/state, empty-list handling, session reset, and Pack Capability gating are verified |
| Persisted `WorkspaceSession` | Kernel | **Contract** | Replace implicit component state with lifecycle/session service |
| Workspace trust and per-Workspace permissions | Kernel | **Planned** | Needed before broader tools and third-party Packs |

## Resources and Workbench

| Capability | Owner | Status | Current evidence / remaining work |
| --- | --- | --- | --- |
| File tree, open, edit, save, create, rename, delete | Kernel + Workbench | **Implemented** | Desktop tree/Monaco and Workspace-routed server operations |
| Independent text buffers and Save All snapshots | Workbench | **Implemented** | `text-buffer.mjs`; buffer state/wiring tests; newer edits remain dirty after an older snapshot saves |
| PDF and image preview | Workbench | **Implemented** | Media preview avoids opening binary content as text |
| Workspace text search | Search service | **Implemented** | Server-side bounded search |
| Replace, regex, and structured search | Search service | **Planned** | Current search is not a Cursor-equivalent replace engine |
| Monaco text editing and command surface | Workbench | **Implemented** | Desktop IDE source and generated `app/ide/` bundle |
| Generic `Resource` / versioned `TextDocument` | Kernel | **Contract** | Current code still passes paths and ad hoc models |
| `EditorProvider` registry | Workbench/Pack Host | **Contract** | Replace hard-coded type branches; keep text fallback |
| `PreviewProvider` registry | Workbench/Pack Host | **Contract** | Generalize PDF/image and add Markdown/formula providers |
| Outline / Go to Symbol | Provider + Workbench | **Partial** | Section outline exists in both the desktop IDE (`OutlinePanel`) and the Web Workbench; no language-server symbols |
| Source control integration | Workbench | **Partial** | Read-only `GET /api/editor/git-status` (branch, dirty count, `isRepo:false` when absent) shown in the Web Workbench status bar; the desktop IDE status bar is not wired yet; no staging/commit/diff UI |
| Output/problems panel | Workbench | **Implemented** | Shows current command/build output and parsed problems; this is not a terminal session |
| Interactive terminal | Tool runtime + Workbench | **Partial** | `POST /api/editor/terminal` (allowlist, argv-only, cwd pinned, 120s/512KB caps, SSE) plus a Web Workbench panel; the desktop IDE has no terminal tab yet (slice 4); not a full shell |
| Desktop Agent/Render work modes | Workbench (desktop) | **Implemented** | Slice 1 (2026-09-18): layout emphasis only, shared state, `localStorage` persistence, honest `RenderStage` empty state, 1440/1280/1024/800 folding without overlap; `tests/desktop-work-mode.test.mjs`, `npm run desktop-mode-visual-smoke` |

## Build, Diagnostics, and Artifacts

| Capability | Owner | Status | Current evidence / remaining work |
| --- | --- | --- | --- |
| Compile an explicit Workspace-relative `.tex` Resource | Build service | **Implemented** | `/api/editor/compile` selects bundled/system Tectonic or `latexmk` |
| Stream live compile output | Build service | **Implemented** | `compile-live` publishes Workspace-scoped events |
| Install/probe Tectonic | Local runtime | **Implemented** | Engine endpoint and IDE installation surface |
| PDF discovery after compile | Build service | **Partial** | Works through current path heuristics; not a typed Artifact Set |
| Parsed, navigable LaTeX diagnostics | Diagnostics | **Partial** | Logs/output exist; complete structured parsing and jump-to-source remain |
| Source to PDF navigation | LaTeX Pack | **Partial** | Real SyncTeX (`--synctex`, `lib/synctex.mjs`, `GET /api/editor/synctex`) is wired in both Workbench and the desktop IDE (slice 2b: Ctrl+Alt+J / double-click; `SYNCTEX_MISSING` degrades to a labelled section-page estimate) |
| Compile lifecycle honesty (desktop) | Build service + desktop Workbench | **Implemented** | Slice 2a (2026-09-21): `compile-jobs` timeout/cancel/one-job-per-Workspace; `done` attaches `pdf` only when the file is fresh; desktop state machine + stale badge; `tests/compile-live-api.test.mjs`, `npm run desktop-compile-smoke` |
| Live formula draft (desktop) | LaTeX Pack + desktop Workbench | **Implemented** | Slice 2b: `LiveMathDrafts` in Render-when-no-PDF; KaTeX via esbuild alias; per-formula errors; editor stays mounted. Not a caret overlay |
| Declarative `BuildProfile` | Pack Host + Build service | **Contract** | Needed for entrypoint/tool/output rules without contest assumptions |
| Cancellable, retained `BuildJob` lifecycle | Build service | **Contract** | Current live route streams a process but lacks the generic job model |
| Typed `ArtifactSet` | Build service | **Contract** | Replace hard-coded PDF lookup and represent logs/SyncTeX/packages |
| Unified `ToolRuntimeService` | Local runtime | **Contract** | Consolidate tool discovery, install, execution, permission, timeout, cancellation |

## AI and Review

| Capability | Owner | Status | Current evidence / remaining work |
| --- | --- | --- | --- |
| User-owned compatible model provider | AI service | **Partial** | Local configuration and runtime path work; provider failure can fall back to `mock-local` and must be surfaced explicitly |
| Assistant with Workspace/file context | AI service + Workbench | **Partial** | File and semantic chips exist; context budgeting and provider-neutral contracts need work |
| Selection-based inline action | Workbench | **Implemented** | Current `Ctrl+K` selection flow |
| Transactional file-block Apply | AI service | **Partial** | Preview baselines, mtime conflicts and in-process rollback exist; stable versions, hunk UI, durable journal and undo remain |
| General `EditTransaction` for all multi-file writes | Kernel/AI service | **Contract** | Requires Resource versions, transaction identity, hunk decisions, crash recovery, and undo |
| Apply/Reject hunk diff | Workbench | **Planned** | Must consume EditTransaction rather than a parallel AI-only path |
| MCP connection/permission management | Tool runtime | **Planned** | Side-panel concepts are not a production permission boundary |

## Pack Delivery

| Pack / contribution | Status | Current boundary |
| --- | --- | --- |
| `general` Pack | **Implemented** | Existing-folder registration and baseline Kernel Capabilities |
| `latex` Pack | **Partial** | Template, compile, PDF, engine path; bibliography, providers, profiles, and true SyncTeX remain |
| `markdown` Pack | **Partial** | Template and text editing; rich preview, links, outline, and export remain |
| `math-modeling` Pack | **Compatibility** | Existing `contests/`, `paperctl`, stages, ledgers, scripts, figures, verification, packaging |
| Capability-gated stage commands | **Implemented** | Server rejects stage operations without `stages` Capability |
| `CommandContribution` | **Contract** | Replace hard-coded Pack actions with declarative discovery/enablement |
| Pack editors/previews/build profiles/diagnostics | **Contract** | Manifest host currently exposes metadata/templates/Capabilities only |
| Pack semantic schemas/views/artifact/evidence rules | **Contract** | Needed to keep domain depth outside the Kernel |
| Third-party Pack install/marketplace | **Planned** | Requires signing, permissions, trust, compatibility, and rollback design |

## Mathematical-Modeling Pack

The existing competition workflow remains a first-party professional feature,
but every item in this section is conditional on the `math-modeling` Pack.

| Capability | Status | Notes |
| --- | --- | --- |
| Legacy `contests/<id>` discovery | **Compatibility** | Exposed as a Workspace through `legacy-contest` adapter |
| `paperctl init/status/verify/build` | **Compatibility** | Pack CLI, not generic Workspace commands |
| Problem stages and stage prompts | **Implemented** | Requires `stages` Capability |
| Claim/result/figure ledgers | **Implemented** | Evidence semantics belong to the Pack |
| Script, figure, and submission checks | **Implemented** | Existing deterministic workflow |
| Pack-native commands and views | **Contract** | Migrate CLI/UI coupling to contribution points |
| Generic Evidence Links usable by other Packs | **Planned** | Kernel supports the concept without requiring ledgers everywhere |

## Team and Cloud Surfaces

| Capability | Status | Product truth |
| --- | --- | --- |
| Public site and Windows development archive | **Partial** | Web surface and Windows ZIP exist; the archive omits Node dependencies and a self-contained .NET runtime, and platform installers/signing remain |
| Account and local team/task surfaces | **Partial** | Routes/pages exist; not production real-time collaboration or a durable execution queue |
| Deep-link flow | **Planned** | `paperos://` appears in Tauri config but is not a verified shipped contract |
| Real-time collaboration and roles | **Planned** | Requires TextDocument checkpoints and EditTransaction semantics first |
| Shared evidence/team library | **Planned** | May build on Pack semantic schemas; not current local behavior |
| Skill/Pack marketplace | **Planned** | Visual concepts exist; install trust model does not |
| Signed cross-platform distribution | **Planned** | Ed25519 manifest and a Windows development ZIP exist; self-contained runtime, Authenticode/notarization and macOS/Linux assets do not |

## Workbench Layout Contract

Target layout:

```
text
+--------------------------------------------------------------------+
| menu/title | Workspace | command entry                             |
+----------+------------------+----------------------+---------------+
| activity | explorer / Pack  | editor / preview     | assistant     |
|          | view             |                      |               |
|          |                  +----------------------+---------------+
|          |                  | bottom panel                         |
|          |                  | current: output / problems / Pack tasks |
|          |                  | target: terminal sessions / Build Jobs |
+----------+------------------+--------------------------------------+
| status: Workspace | Pack | diagnostics | tool/build | line/col    |
+--------------------------------------------------------------------+
```

- **Activity** provides navigation, not a pile of domain actions.
- **Explorer** shows Resources and hides generated noise by policy.
- **Editor/Preview** is selected by providers, with stable group dimensions.
- **Assistant** proposes actions; it does not become the product homepage.
- **Bottom panel** currently exposes output, problems, and capability-gated Pack tasks.
  Generic terminal sessions and retained Build Jobs are target behavior, not current behavior.
- **Status** reports real state: active Workspace/Pack, dirty Resources, tool
  readiness, diagnostics, and current job.
- Pack views mount in named regions and cannot replace global navigation or
  editor chrome.

## Delivery Order

1. Finish Pack-aware Workspace entry, terminology, and compatibility responses.
2. Establish WorkspaceSession and Resource/TextDocument checkpoints.
3. Introduce EditorProvider and PreviewProvider registries.
4. Convert compile/runtime paths to BuildProfile, BuildJob, ArtifactSet, and
   ToolRuntimeService.
5. Route AI Apply and bulk changes through EditTransaction.
6. Move mathematical-modeling UI/CLI features into Pack contributions.
7. Add richer LaTeX/Markdown providers, then collaboration and marketplace
   surfaces after local contracts are stable.

## Deliberate Non-Goals

- Contest terminology in general Workspace UI or APIs.
- A separate Workbench implementation per Pack.
- Browser-first editing as the default desktop experience.
- Decorative status indicators that imply unavailable functionality.
- Purple-neon "AI product" chrome or card-heavy marketing layout inside the IDE.
- Platform-paid model tokens by default.
