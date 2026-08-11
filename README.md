# Paper OS

> A local-first IDE for serious documents.

Paper OS is a general-purpose desktop document IDE built around a **Workspace
Kernel** and **Packs**. The Kernel provides files, search, editors, preview,
local tools, AI review, commands, and status. Packs add templates, format or
workflow capabilities, diagnostics, semantic schemas, and views.

The product and UI use **Pack** as the common term for every Workspace profile.
`general` is the baseline profile, `latex` and `markdown` are format Packs, and
`math-modeling` is the first professional workflow Pack. Mathematical modeling
is not the product kernel.

## Start

The checked-in Windows launcher and `dist/release/*.zip` are development
artifacts, not a self-contained portable release. Before launching, install:

- Node.js 20+
- .NET 8 Desktop Runtime (x64)
- Edge WebView2 Runtime

After extracting the ZIP, install its production Node dependency once:

```powershell
npm --prefix app ci --omit=dev
```

Then open:

```text
PaperOS.exe
```

Windows 11 normally includes WebView2. The current archive does not bundle
Node, `app/node_modules`, or a self-contained .NET runtime; it must not be
described as an install-free portable build.

For local development:

```powershell
npm run ide:build
powershell -File .\build-launcher.ps1
```

The current Windows entry is a framework-dependent WinForms/WebView2 shell that
starts the local Node runtime and opens the IDE inside the native window. Tauri
is a future shell target, not the current launch contract.

## Workspace Packs

| Pack | Class | Use | Current support |
| --- | --- | --- | --- |
| `general` | Baseline profile | Open an arbitrary existing folder | Registration, files, search, preview, and AI surfaces |
| `latex` | Format Pack | Articles, reports, and books | Managed starter template, local LaTeX compile, PDF preview |
| `markdown` | Format Pack | Notes and long-form Markdown | Managed starter template and text editing |
| `math-modeling` | Professional workflow Pack | Competition modeling workflow | Legacy `contests/` adapter, stages, evidence ledgers, scripts, figures, verification, and packaging |

Managed Workspaces live under `workspaces/`. Existing folders can be registered
without being copied. Existing directories under `contests/` remain available
through the mathematical-modeling compatibility adapter.

## Compile Contract

The general IDE compile command operates on an explicit `.tex` Resource inside
the active Workspace. The current runtime prefers bundled Tectonic, then system
Tectonic, then `latexmk`, and keeps all path resolution inside the Workspace
root.

`paperctl.py` is currently the compatibility CLI for the `math-modeling` Pack.
Its `init`, `status`, `verify`, `build`, and submission commands operate on
`contests/<id>`; they are not the generic Workspace creation or build API.

```powershell
python paperctl.py doctor
python paperctl.py init my-modeling-project
python paperctl.py verify my-modeling-project
python paperctl.py build my-modeling-project
```

## Operations and Workspace Lifecycle

- `PaperOS.exe` uses `PAPER_OS_PORT` when set. Otherwise it uses loopback port
  `3719` when available or already serving Paper OS, and selects a free loopback
  port if another process owns `3719`. Check the active service at
  `http://127.0.0.1:<port>/api/health`.
- Closing the native window stops the Node process started by that window. A
  healthy server that the launcher reused is not owned or stopped by it.
- The server currently writes runtime messages to stdout/stderr; the launcher
  does not create a persistent log file. Run `node app/server.mjs` in a terminal
  when console output is needed for diagnosis.
- External Workspace registrations are stored in `app/data/workspaces.json`;
  managed Workspace content remains under `workspaces/`. Back up both the
  registry and the actual Workspace directories, preferably while the runtime
  is stopped. A registry copy alone is not a content backup.
- An external folder is registered by absolute path. If it moves, the old entry
  remains visible as `missing`; there is no relink/unregister API yet. Restore
  the old path or, with Paper OS stopped and the registry backed up, remove the
  stale entry and register the folder at its new location.
- Current Packs are the built-ins declared in `product/workspace-packs.json`.
  Third-party Pack installation, update, rollback, signing, and marketplace
  flows are not shipped.

## Project Status

The Workspace Kernel, Pack catalog, managed creation, external-folder
registration, legacy contest discovery, safe Workspace-relative paths, Pack
Capability gating, independent text buffers, stale-response guards, and the
server-side Workspace API are implemented. The compatibility Apply path now
rejects stale mtime baselines and rolls back failed multi-file writes, but a
durable, undoable EditTransaction is still an architecture contract. Provider
registries, declarative Build Jobs, generic Artifact Sets, and signed
cross-platform desktop distribution remain incomplete. AI provider failures can
fall back to `mock-local`; product surfaces must not present that as a real model.

See [docs/CAPABILITY_MAP.md](docs/CAPABILITY_MAP.md) for the evidence-based
status of each capability and [docs/STATUS.md](docs/STATUS.md) for the current
audited worktree snapshot.

## Documentation

| Document | Purpose |
| --- | --- |
| [docs/README.md](docs/README.md) | Documentation map, precedence, and update rules |
| [CONTEXT.md](CONTEXT.md) | Canonical domain language and invariants |
| [docs/HANDOFF.md](docs/HANDOFF.md) | Past, present, future, risks, and next-maintainer sequence |
| [docs/STATUS.md](docs/STATUS.md) | Current implementation and verification snapshot |
| [docs/PRODUCT.md](docs/PRODUCT.md) | Product position, boundaries, and delivery stages |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Runtime and extension architecture |
| [docs/CAPABILITY_MAP.md](docs/CAPABILITY_MAP.md) | Implemented, partial, and planned capabilities |
| [docs/DESIGN.md](docs/DESIGN.md) | Visual language and primary surfaces |
| [docs/GUIDE.md](docs/GUIDE.md) | Current usage and commands |
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) | Setup, repository layout, and change workflow |
| [docs/TESTING.md](docs/TESTING.md) | Test matrix and evidence format |
| [docs/RUNBOOK.md](docs/RUNBOOK.md) | Runtime, backup, recovery, secrets, and release operations |
| [docs/TRACEABILITY.md](docs/TRACEABILITY.md) | Requirement-to-code-to-test traceability |
| [docs/adr/README.md](docs/adr/README.md) | Architecture decision index |
| [docs/redesign/README.md](docs/redesign/README.md) | Active enterprise redesign specification |
| [product/README.md](product/README.md) | Runtime-consumed Packs, workflows, agents, skills, and release metadata |
| [CHANGELOG.md](CHANGELOG.md) | Versioned change history and known limitations |

## Naming

| Name | Use |
| --- | --- |
| **Paper OS** | Product display name |
| `PaperOS.exe` | Current Windows desktop entry |
| `paper-os` | npm/config package name |
| `paperos://` | Planned deep-link scheme |

## License

Apache License 2.0. See `LICENSE`.
