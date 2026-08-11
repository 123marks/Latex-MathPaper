# Paper OS Architecture

Paper OS uses a **Workspace Kernel + Packs** architecture. The product and UI
use **Pack** as the common term: `general` is the baseline profile, `latex` and
`markdown` are format Packs, and `math-modeling` is the first professional
workflow Pack. The Kernel supplies a stable document IDE; Packs contribute
format or workflow behavior through declared extension points. Mathematical
modeling is currently bridged from the legacy `contests/` layout.

This document distinguishes four states:

- **Implemented**: present in the current codebase.
- **Partial**: usable, but still tied to transitional interfaces.
- **Target contract**: the architectural boundary new work must follow.
- **Roadmap**: accepted direction without a complete implementation.

## System Context

```text
Public site / future control plane
  discovery · download · documentation · later account/community services
                              │
                              │ optional auth/deep links (roadmap)
                              ▼
PaperOS.exe (current Windows entry: WinForms + WebView2)
  React IDE
    │
    ▼
Local Node runtime (app/server.mjs)
  Workspace Kernel · file/search APIs · AI gateway · build/tool execution
    │                         │                         │
    ▼                         ▼                         ▼
Workspace roots         user-owned model API      local tools
managed/external/legacy                         Tectonic/latexmk/etc.
```

Heavy work stays local. The public site is not the routine compile or inference
plane. The current desktop contract is `PaperOS.exe`; Tauri is a future shell
option and must not be described as the active launcher.

## Runtime Entry Contract

| Concern | Current source of truth | State |
| --- | --- | --- |
| Windows entry | `PaperOS.exe`, built through `build-launcher.ps1` | Implemented |
| IDE source | `apps/desktop/src/ide.jsx`, built into `app/ide/` | Implemented |
| Local API/runtime | `app/server.mjs` | Implemented |
| Workspace Kernel | `app/lib/workspaces.mjs` | Implemented |
| Pack catalog | `product/workspace-packs.json` | Implemented |
| Mathematical-modeling CLI | `paperctl.py`, operating on `contests/<id>` | Compatibility surface |
| Cross-platform shell | Tauri | Roadmap |

`paperctl.py` is not the generic Workspace Kernel. Its stage, verification,
build, and packaging commands are supplied to the `math-modeling` Pack through
the legacy adapter until those operations are exposed as Pack contributions.

## Architectural Layers

| Layer | Owns | Must not own |
| --- | --- | --- |
| **Shell** | Native window, menus, lifecycle, deep links | Document semantics or build rules |
| **Workbench** | Layout, explorer, tabs, editor groups, preview groups, panels, command UI, status | Direct filesystem/process access |
| **Workspace Kernel** | Workspace identity, adapters, sessions, Resources, path safety, provider/command registries, Capability checks | Contest stages or a fixed paper layout |
| **Pack Host** | Manifest validation and contribution activation | Independent editor forks or unrestricted code execution |
| **Services** | Files, search, builds, diagnostics, AI transactions, tool runtime | Pack-specific presentation assumptions |
| **Adapters** | Managed, external, and legacy Workspace discovery | New global vocabulary |

## Workspace Kernel

A Workspace is a directory explicitly opened or created by the user. Its
minimum record is:

```text
Workspace
  id            stable local identifier
  name          display name
  root          absolute root held by the Kernel, never supplied to UI writes
  source        managed | external | legacy-contest
  pack          active Pack identifier
  capabilities  derived set exposed to commands and views
  status        ready | built | verified | failing | missing
```

Implemented adapters:

1. **Managed** Workspaces under `workspaces/` with
   `.paperos/workspace.json`.
2. **External** folders stored in the local registry without copying content.
3. **Legacy contest** directories under `contests/`, exposed with the
   `math-modeling` Pack.

Every Resource path is resolved by the Kernel relative to the registered root.
Absolute paths, traversal, and cross-Workspace writes are rejected. New HTTP
interfaces use `workspace`; `contest` remains a temporary request alias.

## Core Domain Contracts

The following contracts are the target architecture. Only the subset called out
in “Implementation Mapping” exists today.

### WorkspaceSession

A `WorkspaceSession` is the runtime state for one opened Workspace, not another
project format.

```text
WorkspaceSession
  sessionId
  workspace
  capabilities
  openResources[]
  activeResource
  editorGroups/layout
  activeBuildProfile
  diagnostics
  pendingEditTransactions[]
  lifecycle: opening -> ready -> closing -> closed
```

The session coordinates state and cancellation; it does not read files or spawn
tools directly. Restorable UI state may be persisted separately from Workspace
content. A missing external folder yields a recoverable session state rather
than silently removing the registration.

### Resource and TextDocument

`Resource` is the generic unit opened, previewed, built, referenced, or emitted.
It covers text, images, PDFs, data, directories, logs, and generated Artifacts.

```text
Resource
  resourceId / URI
  workspaceId
  relativePath
  kind / mediaType
  origin: source | generated | external-reference
  readonly
  metadata

TextDocument extends Resource
  languageId
  encoding
  version
  text model
  dirty state
  saved checkpoint
```

Version/checkpoint data is mandatory for conflict-aware edits and later
collaboration. Binary files remain Resources and must never be decoded as text
merely because no specialized editor is available.

### EditorProvider

An `EditorProvider` declares which Resources it can edit and creates the editor
model/view for a Workbench group. Selection is deterministic: explicit user
override, then Pack contribution priority, then built-in fallback.

Minimum responsibilities:

- match by Resource kind, media type, extension, and Capability;
- open an editor without changing the underlying Resource identity;
- expose dirty/save/revert and selection state through Kernel services;
- support a read-only mode and clear unsupported-state fallback;
- never perform arbitrary filesystem writes outside the Resource service.

The built-in text editor is the fallback. Formula, bibliography, data-table, or
semantic-outline editors are Pack contributions, not branches in the global
Workbench.

### PreviewProvider

A `PreviewProvider` renders a Resource or Artifact without claiming edit
ownership. It declares supported inputs, refresh behavior, and whether it can
map preview positions back to source positions.

Examples include PDF, image, Markdown, formula, and build-log previews. True
SyncTeX is a capability of the LaTeX preview/build integration; estimated page
navigation must remain labeled as partial behavior.

### BuildProfile

A `BuildProfile` is a declarative recipe, normally contributed by a Pack or
overridden by Workspace settings.

```text
BuildProfile
  id / label
  requiredCapabilities[]
  entrypoint rule
  tool requirement
  arguments/environment policy
  working-directory policy
  diagnostic parser IDs[]
  artifact rules[]
  clean/cancel behavior
```

Profiles describe intent and expected outputs. They do not spawn processes.
Entrypoint selection is explicit or deterministic; the Kernel must not assume
`paper/main.tex`, `main.tex`, or any contest layout globally.

### BuildJob

A `BuildJob` is one immutable execution snapshot of a Build Profile against a
WorkspaceSession and entry Resource.

```text
BuildJob
  jobId
  workspaceId / sessionId
  profile snapshot
  entry Resource
  state: queued -> running -> succeeded | failed | cancelled
  timestamps / exit code
  streamed output
  diagnostics[]
  artifactSet
```

Jobs are cancellable, observable, and isolated by Workspace. A new request does
not mutate the history of a completed job. The Workbench subscribes to job
events rather than parsing ad hoc terminal text.

### ArtifactSet

An `ArtifactSet` is the typed output of a Build Job or import operation. Each
Artifact records kind, relative path, producing job/profile, source inputs, and
availability.

Typical kinds are `pdf`, `synctex`, `log`, `figure`, `data`,
`bibliography`, and `submission-package`. Preview selection consumes Artifact
metadata instead of hard-coding `build/main.pdf`. Evidence Links may point to
Artifacts but are not required in every Workspace.

### EditTransaction

The current compatibility path validates Workspace-relative file-block paths,
produces a preview, and requires explicit Apply before writing. It does not yet
provide base checkpoints, conflict state, atomic multi-file rollback, or
transaction-level undo.

The target `EditTransaction` is a Workspace-scoped, reviewable set of edits for
AI Apply, refactors, quick fixes, and future collaborative merges:

```text
EditTransaction
  transactionId
  workspaceId
  origin: ai | command | quick-fix | user
  base checkpoints per Resource
  edits[]: create | update | rename | delete
  state: proposed -> previewed -> applied | rejected | conflicted | failed
  validation / diagnostics
  undo record
```

The target service validates Workspace-relative paths, base versions,
permissions, and collisions, then presents a diff. Multi-file Apply is atomic
where the filesystem permits and otherwise uses rollback with an explicit
failure report. The current `BEGIN_FILE`/`END_FILE` parser should produce an
Edit Transaction eventually; it must not remain a parallel write path.

### CommandContribution

A `CommandContribution` separates command discovery from execution:

```text
CommandContribution
  id / title / category
  source Pack
  requiredCapabilities[]
  when / enablement expression
  optional keybinding and menu placements
  handler service/action ID
```

The Kernel filters visibility and enablement. Pack-specific commands such as
modeling stages or submission packaging are unavailable when the active
Workspace lacks the required Capability.

### ToolRuntimeService

`ToolRuntimeService` is the single process boundary for local tools and model
helpers. It owns discovery, version probes, optional installation, permission
checks, sanitized environment construction, Workspace-scoped working
directories, cancellation, timeouts, and output streaming.

Build Jobs and commands call this service; Packs never spawn processes directly.
The service will subsume current one-off Tectonic/`latexmk` probing and provide
the same lifecycle for formatters, converters, linters, and Pack tools.

## Pack Contribution Points

The Pack manifest is declarative. The target host recognizes these contribution
points:

| Contribution | Purpose | Kernel enforcement |
| --- | --- | --- |
| `capabilities` | Enable named domain abilities | Drives visibility and service authorization |
| `templates` | Seed managed Workspaces | No overwrite without an explicit destructive flow |
| `commands` | Add Command Contributions | Capability and context gating |
| `resourceKinds` | Add semantic Resource classification | Cannot bypass path ownership |
| `editors` | Register Editor Providers | Deterministic matching and fallback |
| `previews` | Register Preview Providers | Sandboxed Resource/Artifact inputs |
| `buildProfiles` | Declare build recipes | Executed only by ToolRuntimeService |
| `diagnostics` | Parse or validate Resources/build output | Structured severity and source locations |
| `semanticSchemas` | Describe outlines, references, ledgers, or domain entities | Optional; never required by Kernel files API |
| `views` | Add Pack-specific side or panel views | Mounted in named Workbench regions |
| `artifactRules` | Classify generated outputs | Produces typed Artifact Sets |
| `evidenceSchemas` | Define Evidence Link types and validation | Active only with evidence Capability |
| `settings` | Declare scoped configuration | Validated and namespaced by Pack |

Packs may combine contributions into a professional workflow, but the global
file tree, editor groups, command palette, status model, and AI review flow stay
consistent.

## Primary Flows

### Open and Edit

```text
Workspace Adapter -> Workspace Kernel -> WorkspaceSession
  -> Resource service -> provider registry -> EditorProvider or PreviewProvider
  -> save/checkpoint through Resource service
```

### Build and Preview

```text
CommandContribution
  -> select entry Resource + BuildProfile
  -> create BuildJob
  -> ToolRuntimeService
  -> diagnostics + ArtifactSet
  -> PreviewProvider opens selected Artifact
```

The current `/api/editor/compile` and `compile-live` routes are transitional
implementations of this flow: they accept an explicit Workspace-relative `.tex`
path, choose Tectonic or `latexmk`, stream or return output, and locate a PDF.
They are not yet generic BuildProfile/BuildJob services.

### AI Apply

Target flow:

```text
Workspace context + selected Resources
  -> model provider
  -> proposed edits
  -> EditTransaction validation
  -> diff preview
  -> explicit Apply or Reject
  -> checkpoint + diagnostics refresh
```

The current file-block compatibility path validates Workspace-relative paths,
returns per-target mtime baselines, requires explicit Apply, rejects stale
targets, and journals old content so a later write failure can roll back earlier
writes. It is a transactional slice, not the target EditTransaction: it has no
stable Resource versions, durable transaction identity, hunk decisions,
crash-recovery journal, or transaction-level undo.

## Operations and Workspace Lifecycle

### Runtime

- `PaperOS.exe` currently requires Node.js 20+, .NET 8 Desktop Runtime (x64),
  Edge WebView2 Runtime, and installed `app` production dependencies. The ZIP
  excludes `app/node_modules` and is not a self-contained portable artifact.
  The launcher uses `PAPER_OS_PORT` when configured, and otherwise uses
  `127.0.0.1:3719` when available or already serving Paper OS. If
  another process owns that port, the launcher selects a free loopback port.
- The launcher waits up to 20 seconds for `GET /api/health`. It opens `/ide/`
  only after that endpoint identifies a healthy Paper OS runtime.
- Closing the native window kills the Node process that window started. If the
  launcher reused an already healthy runtime, it does not own or stop it.
- The server writes runtime messages to stdout/stderr. The current launcher does
  not persist a log file; run `node app/server.mjs` from a terminal when console
  output is required for diagnosis.

### Workspace state and recovery

- Managed Workspaces live under `workspaces/` and carry
  `.paperos/workspace.json`. External registrations live in
  `app/data/workspaces.json`; registry writes use a temporary file and rename.
- Back up the registry and Workspace content separately, preferably with the
  runtime stopped. The registry stores references to external folders and is
  not a backup of their contents.
- External registrations store absolute paths. A moved or unavailable folder
  remains listed with `missing` status. No relink or unregister API exists yet;
  restore the original path or stop Paper OS, back up and remove the stale JSON
  entry, then register the folder at its new path.
- Legacy `contests/` directories are discovered through the math-modeling
  compatibility adapter; they are not converted or copied automatically.

### Pack lifecycle

- The current Pack Host loads only the built-in catalog at
  `product/workspace-packs.json` and its checked-in templates/adapters.
- Third-party Pack installation, enable/disable, update, migration, rollback,
  signing, and marketplace flows are not implemented. External Pack manifests
  are not discovered or executed by the current runtime.

## Implementation Mapping

| Contract | Current implementation | State |
| --- | --- | --- |
| Workspace records/adapters | `app/lib/workspaces.mjs` | Implemented |
| Pack metadata/Capabilities | `product/workspace-packs.json` | Implemented, contribution surface still small |
| Workspace-safe path resolution | `workspaceKernel.resolvePath` and server routing | Implemented |
| Workspace HTTP identity | `workspace` with `contest` alias | Partial migration |
| WorkspaceSession | Implicit React/server state | Target contract |
| Resource/TextDocument | Paths plus Monaco models/media handling | Target contract |
| EditorProvider/PreviewProvider | Built-in conditional UI branches | Target contract |
| BuildProfile/BuildJob/ArtifactSet | Direct compile routes and PDF lookup | Target contract |
| EditTransaction | Apply blocks with preview baselines, mtime conflicts, and rollback | Partial; durable generalized transaction planned |
| CommandContribution | Existing command palette and hard-coded actions | Target contract |
| ToolRuntimeService | Scattered runtime probes/process execution | Target contract |

## Safety Invariants

1. All reads and writes resolve through the active Workspace root.
2. Target invariant: Pack activation never grants undeclared filesystem, process, network, or
   model access.
3. Target invariant: Tool processes run with explicit working directory, timeout, cancellation,
   and captured output.
4. Current AI file-block writes validate Workspace-relative paths, show a
   preview, require explicit Apply, reject changed mtime baselines, and roll back
   an in-process partial write failure.
5. Target invariant: AI and bulk edits enter one durable EditTransaction path
   with content versions, explicit conflict states, atomic Apply and undo.
6. Generated Artifacts never replace source Resources silently.
7. Missing tools, folders, providers, and Artifacts are explicit states.
8. Compatibility aliases do not become names in new APIs or UI.

## Migration Sequence

1. Complete Workspace terminology and Pack-aware entry surfaces.
2. Extract explicit WorkspaceSession and Resource/TextDocument services.
3. Replace editor/preview conditionals with provider registries.
4. Move compile routes to BuildProfile -> BuildJob -> ArtifactSet.
5. Route every AI/bulk write through EditTransaction.
6. Move `paperctl` features behind math-modeling Command Contributions and
   ToolRuntimeService adapters.
7. Add collaboration only after checkpoint and transaction semantics are stable.

Reference projects informed these boundaries at the level of behavior and
architecture. Their source code and licenses remain separate; in particular,
GPL implementation code must not be copied into Paper OS.
