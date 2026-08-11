# ADR-0001: General Workspace Kernel With Professional Packs

- Status: Accepted
- Date: 2026-07-14

## Context

Paper OS currently presents itself as a general desktop LaTeX IDE, while much
of its runtime vocabulary and storage model assumes a mathematical-modeling
contest. The editor reads only `contests/<id>`, creating a new project always
installs the contest template, and several general editor interfaces still use
`contest` as their primary identifier.

The intended product is a general-purpose editor comparable in ergonomics to
Cursor. Mathematical modeling should remain deeply supported without defining
the product kernel.

## Decision

Introduce a Workspace Kernel with a small interface:

- list and inspect registered Workspaces;
- create a managed Workspace from a Pack;
- register an existing folder;
- resolve Workspace-relative paths safely;
- expose Pack metadata and Capabilities.

The Workspace Kernel has multiple Workspace Adapters:

1. managed Workspaces under `workspaces/`;
2. explicitly registered external folders;
3. legacy mathematical-modeling projects under `contests/`.

Professional behavior is supplied by declarative Packs. The `math-modeling`
Pack keeps `paperctl`, stage gates, evidence ledgers, modeling scripts, and
submission packaging. General editing, search, preview, AI Apply Proposals, and
file safety stay in the Workspace Kernel.

The existing `contest` request field remains a compatibility alias while new
interfaces and UI use `workspace`.

## Consequences

- Users can open ordinary folders without converting them into contest projects.
- Mathematical-modeling behavior remains available and can evolve independently.
- File safety and path resolution gain locality in one deep Module.
- The web Workbench, desktop IDE, and future Tauri shell can share the same
  Workspace interface.
- Migration temporarily carries both `workspace` and `contest` vocabulary.
- Pack-specific commands must be hidden or disabled when the active Workspace
  lacks the required Capability.

## Rejected Alternatives

### Keep the contest model in the kernel

Rejected because every new document type would inherit irrelevant stages,
ledgers, paths, and terminology.

### Split mathematical modeling into a separate product

Rejected because it would duplicate the editor, preview, AI, file, and build
Modules and make product quality diverge.

### Rename contest variables without changing storage or interfaces

Rejected because it would improve copy while preserving the same shallow,
contest-specific architecture.

## Migration

1. Add and test the Workspace Kernel and Pack catalog.
2. Route desktop editor file operations through the Workspace Kernel.
3. Replace first-run contest creation with an explicit Workspace/Pack chooser.
4. Move general product copy and navigation to Workspace terminology.
5. Move mathematical-modeling-only views and commands behind Pack Capabilities.
6. Converge the web Workbench and desktop IDE on the same Workspace interface.
