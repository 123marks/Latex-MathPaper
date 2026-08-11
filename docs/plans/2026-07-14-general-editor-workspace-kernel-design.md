---
title: General Editor Workspace Kernel implementation plan
status: completed
owner: project maintainers
created: 2026-07-14
updated: 2026-08-03
related_adr: ../adr/0001-general-workspace-kernel.md
result_evidence: ../STATUS.md and ../CAPABILITY_MAP.md
result_commits: []
delivery_state: dirty working-tree snapshot
---

# General Editor Workspace Kernel Implementation Plan

> **For Codex:** Use test-driven development and execute each task against the
> current working tree. The working tree contains authoritative uncommitted
> product changes, so this plan intentionally does not create a separate
> worktree or run commits automatically.

**Goal:** Make Paper OS a general-purpose document IDE whose mathematical-modeling workflow is an optional professional Pack.

**Architecture:** Add one deep Workspace Kernel Module that owns Workspace discovery, registration, Pack metadata, root-path resolution, and legacy contest compatibility. Route desktop editor file operations through this Module, then replace contest-first onboarding with a Pack-aware Workspace chooser.

**Tech Stack:** Node.js 20 ESM, React 18, Monaco, JSON Pack manifests, Node built-in test runner, existing WinForms/WebView2 shell.

---

## Product Shape

The general editor owns the stable surfaces: activity bar, explorer, tabs,
editor, media/PDF preview, search, terminal, source control affordances, command
palette, AI review, and status bar. A Pack contributes templates, commands,
quality gates, optional side views, and Artifact/Evidence conventions.

The first Pack catalog contains:

| Pack | Purpose | Added Capabilities |
| --- | --- | --- |
| `general` | Existing arbitrary folder | files, search, terminal, AI |
| `latex` | Article/report/book | LaTeX compile, PDF preview, bibliography |
| `markdown` | Notes and long-form Markdown | Markdown preview, links |
| `math-modeling` | Competition workflow | stages, ledgers, scripts, figures, package |

## Workspace Interface

```js
const kernel = createWorkspaceKernel(options);

kernel.listPacks();
kernel.listWorkspaces();
kernel.getWorkspace(workspaceId);
kernel.registerWorkspace({ id, name, path, pack });
kernel.createManagedWorkspace({ id, name, pack });
kernel.resolvePath(workspaceId, relativePath);
```

Callers learn only this interface. Registry persistence, manifest parsing,
legacy `contests/` discovery, Pack inference, atomic writes, and traversal
protection remain inside the Module.

## Data Flow

```text
Welcome / title bar
  -> GET /api/editor/projects
  -> Workspace Kernel lists managed + external + legacy adapters
  -> user opens or creates a Workspace
  -> editor requests workspace=<id>
  -> Workspace Kernel resolves the root
  -> file/search/compile/evidence Modules use root-relative paths
```

`contest=<id>` remains accepted during migration. Pack-only operations such as
`paperctl status` require the `math-modeling` Capability.

## Error Handling And Safety

- Reject invalid or duplicate Workspace IDs.
- Reject registration paths that do not exist or are not directories.
- Resolve every Document path through `resolvePath`; reject traversal and
  absolute paths supplied as relative Document paths.
- Persist the external Workspace registry with temp-file plus rename.
- Never overwrite a managed Workspace unless an explicit future destructive
  workflow authorizes it.
- Return specific UI errors: missing folder, duplicate ID, unsupported Pack, or
  Capability unavailable.

## Task 1: Workspace Kernel Contract

**Files:**

- Create: `tests/workspace-kernel.test.mjs`
- Create: `app/lib/workspaces.mjs`
- Create: `product/workspace-packs.json`

1. Write tests for Pack listing, legacy contest discovery, external folder
   registration, managed Workspace creation, and traversal rejection.
2. Run `node --test tests/workspace-kernel.test.mjs` and confirm it fails because
   the Module does not exist.
3. Implement the smallest Workspace Kernel that satisfies the tests.
4. Re-run the test and confirm all cases pass.

## Task 2: Generic Starter Templates

**Files:**

- Create: `templates/workspaces/latex/main.tex`
- Create: `templates/workspaces/latex/README.md`
- Create: `templates/workspaces/markdown/README.md`
- Create: `templates/workspaces/markdown/notes.md`

1. Extend the managed-creation test to assert the correct starter files.
2. Confirm the test fails before adding templates.
3. Add restrained, domain-neutral starter content.
4. Confirm the test passes.

## Task 3: Node Runtime Adapter

**Files:**

- Modify: `app/server.mjs`
- Modify: `package.json`

1. Add a testable helper expectation for `workspace` and legacy `contest` request
   fields.
2. Instantiate the Workspace Kernel once at server startup.
3. Generalize project listing and creation to expose Packs and support external
   folder registration.
4. Route editor tree, Document CRUD, search, export, preview, compilation,
   evidence lookup, and Apply Proposals through Workspace root resolution.
5. Keep mathematical-modeling `/api/contest/*` commands Pack-specific.

## Task 4: Cursor-Class Workspace Entry

**Files:**

- Modify: `apps/desktop/src/ide.jsx`
- Modify: `apps/desktop/src/assets/ide.css`

1. Remove automatic creation of the MCM demo Workspace.
2. Replace prompt-based creation with an inline Pack chooser and folder
   registration form.
3. Show Workspace name, Pack, root hint, and state in recent Workspace rows.
4. Keep the editor dense and predictable: fixed chrome dimensions, readable
   contrast, compact typography, visible focus states, and no decorative cards.
5. Hide Pack-specific actions when their Capability is absent.

## Task 5: Product And Architecture Alignment

**Files:**

- Modify: `README.md`
- Modify: `docs/PRODUCT.md`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/CAPABILITY_MAP.md`
- Modify: `.impeccable.md`

1. Make the general editor the product identity.
2. Describe mathematical modeling as the first professional Pack.
3. Record the Workspace Kernel and Adapter migration.
4. Separate shipped capabilities from roadmap claims.

## Verification

Run:

```powershell
node --test tests/workspace-kernel.test.mjs
python -m unittest tests.test_paperctl_runtime
npm run ide:build
npm run web:build
node --check app/server.mjs
npm run dom-ui-smoke
```

Then start the local server and verify:

- an existing arbitrary folder can be registered and opened;
- a LaTeX Workspace can be created without contest files;
- `sample-contest` still opens as `math-modeling`;
- file traversal is rejected;
- the Welcome surface fits at 1100x720 and 1440x900;
- editor, preview, Assistant, and bottom panel do not overlap.
