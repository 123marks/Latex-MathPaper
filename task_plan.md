# Task Plan

## Goal

Turn this workspace into a usable local product foundation for math modeling competitions: LaTeX-first paper generation, skill/MCP orchestration knowledge base, contest workspace templates, workflows, and verification tooling.

## Phases

| Phase | Status | Deliverable |
| --- | --- | --- |
| 1. Persistent planning | complete | `task_plan.md`, `findings.md`, `progress.md` |
| 2. Research knowledge base | complete | Skill, MCP, LaTeX, and paper-quality catalogs under `docs/knowledge/` |
| 3. Product skeleton | complete | `product/` workflows/checklists/config and `templates/contest/` |
| 4. CLI and verification | complete | `paperctl.py` with `init`, `verify`, `build`, `clean`, and `doctor` commands |
| 5. Evidence run | complete | Sample contest initialization and verification output |
| 6. AI runtime product loop | complete | Stage prompts, provider calls, provider checks, and safe response application |
| 7. Knowledge-driven operations | complete | Machine-readable knowledge base, skill/MCP recommendations, workflow status, pipeline, advance, and skill audit commands |
| 8. Local product app | complete | Windows launcher, Node local API, browser UI, provider setup, material ingest, and command dashboard |
| 9. Workflow intelligence | complete | Shared product blueprint, expanded skill/MCP knowledge base, CLI/UI recommendation surface |
| 10. Skill governance and portable packaging | complete | Skill review artifacts and portable app folder generation |
| 11. Real contest intake hardening | complete | Problem PDF/text ingest syncs `problem/problem.md` with extraction fallback |
| 12. Real contest onboarding | complete | One command creates workspace, imports materials, writes pipeline report, and creates intake prompt |
| 13. Submission and executable closure | complete | Final-paper submission package plus a Windows `.exe` launcher wrapper |
| 14. Product-grade frontend shell | complete | Official-site homepage, model-gateway motion system, runtime section, and application workbench UI |

## Decisions

- Start with a file-first product, then expose it through a local web UI instead of a Python GUI.
- LaTeX is the final source of truth. Markdown is for planning, ledgers, and reviews.
- MCP is an integration layer for tools, not the product brain.
- Every paper claim should be traceable to a result ledger row, figure ledger row, script, or source.
- No new runtime dependencies in the first version; use Python standard library and external `latexmk` only when present.
- AI responses may propose file edits, but only strict `BEGIN_FILE` blocks can be previewed/applied, and `--apply` is required for writes.
- Desktop packaging is a shell concern. The core workflow remains `paperctl.py` + contest artifacts so Electron/Tauri/Neutralino can be swapped later.
- The product workflow blueprint is a first-class artifact. UI/CLI should read the same lane definitions instead of duplicating workflow guidance.
- External skills require a local review artifact before installation.
- Portable app packaging must exclude `contests/` by default to avoid leaking private contest data.
- Problem ingestion must create a usable `problem/problem.md`; PDF imports attempt text extraction and otherwise write a clear manual-fill placeholder.
- Real contest pilots should start from `onboard`, not a manually remembered command chain.
- Runtime health probes are informational and must be deadline-bounded; a broken Python/LaTeX executable cannot be allowed to block the local product UI.
- Product UI design context lives in `.impeccable.md`; preserve the official-site-to-workbench split and persistent idle motion in future frontend changes.
- The Windows launcher must wait for `/api/health`, not just an open TCP port, before opening the browser.

## Risks

| Risk | Mitigation |
| --- | --- |
| Product becomes a pile of prompts | Create deterministic folder layout, ledgers, checklists, and CLI commands. |
| AI writing invents claims | Gate every claim through result and figure ledgers. |
| LaTeX breaks during contest pressure | Provide a minimal modular template and build command. |
| External skills vary in quality | Keep a curated catalog with recommended, optional, and risky items. |
| MCP setup becomes too heavy | Document MCP as optional integration after MVP skeleton. |
| Headless screenshot QA is unstable on this Windows environment | Keep stable `visual-smoke` as the core gate; provide optional `browser-visual-smoke` with strict mode for machines where Chrome/Edge headless rendering works. |

## Next Actions

1. Apply the product to a real contest problem folder.
2. Add stronger numeric consistency verification between LaTeX prose and result values.
3. Apply the MCP configuration bundle with reviewed servers only when needed.
4. Add optional external skill install/read workflow execution for the best candidates in `docs/knowledge/skill-catalog.md`.
5. Build a real contest pilot using the next problem PDF/data.
6. Run the local product UI through a real contest pilot.
7. Add stronger provider/runtime telemetry after a real API-backed pilot.
8. Package the app with Tauri or Electron only after the local web product proves the workflow.
9. Review the highest-priority external skills with `skill-review` before any installation.
10. Use `package-app` for portable folder distribution; use the generated `.exe` launcher when present and `.cmd` as fallback.
11. Run a real contest pilot with an official PDF/data bundle and replace any PDF placeholder with verified extracted or manually pasted text.
12. Use `onboard` on an official contest bundle, then run status/verify/build from the generated workspace.
13. Add `package-submission` so the product can collect PDF, LaTeX source, code, figures, runs, and evidence ledgers into a reviewable final handoff folder.
14. Add a small Windows `.exe` launcher that keeps the UI non-Python while preserving the existing Node API and `paperctl.py` workflow engine.
15. Continue refining the frontend into a high-polish product surface: landing homepage, app workbench, persistent animation, responsive layout, and clearer workflow hierarchy.
16. Add real screenshot-based visual regression tests when Playwright or a stable browser automation path is available.
17. Consider a future bundled runtime installer if Node/Python/LaTeX should be embedded rather than documented as prerequisites.

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| `git status` failed because this directory is not a git repo | Checked repo state after first planning document | Treat this as a plain workspace; do not rely on git verification. |
| `rg --files` timed out on earlier full scan | Tried whole-workspace file listing | Switched to targeted directory inspection. |
| LaTeX log scan produced a false failure on `File \`` | `verify sample-contest` after adding log checks | Replaced broad pattern with concrete fatal/missing-file patterns. |
| `py_compile` created `__pycache__` inside `templates/contest/src` | Compiled template scripts directly | Removed cache directories and avoided compiling template scripts in final verification. |
| Parallel Python checks sometimes exceeded timeout | Ran py_compile, doctor, and verify in parallel | Sequential `py_compile`, `doctor`, `verify`, and `build` succeeded; avoid parallel Python verification in this environment. |
| `apply-response` needed a safety boundary | Started from failing tests for missing parser/applier | Implemented strict file block parsing, path rejection, preview-only default, and explicit `--apply`. |
| Initial launcher publish produced a large WinForms-dependent bundle | Built `.exe` with Windows Forms | Replaced WinForms with direct Win32 `MessageBoxW`, reducing the launcher to a single published executable. |
| `build-launcher.ps1` copied stale output after failed `dotnet publish` | Sandbox blocked NuGet restore | Cleared publish output first and added `$LASTEXITCODE` plus expected-file checks before copying. |
| Reference site fetch was incomplete in sandbox | Tried to retrieve `https://api.aisz.mom/` with local shell | Used available browser/open evidence and product requirements to implement the same category of animated landing + app workbench pattern without copying assets. |
| `npm run smoke` hung on `/api/summary` after runtime health probes were added | Summary waited for Python/LaTeX/status child processes during app startup | Added child-process deadlines, an outer summary deadline, Windows process cleanup, and `runtime-timeout-smoke`. |
| Portable package dropped design context | `package-app` copied runtime files but not `.impeccable.md` | Added `.impeccable.md` to the package manifest and locked it with a unit test. |
| Chrome/Edge headless screenshot fails with GPU process crashes on this machine | Tried real browser screenshot via `browser-visual-smoke` | Made browser visual smoke optional by default and strict with `PAPER_OS_BROWSER_STRICT=1`; core UI gate remains `visual-smoke`. |
| Launcher build attempted NuGet/network access | `dotnet publish -r win-x64` required runtime packs and NuGet in this environment | Pinned .NET 8 SDK with `global.json`, added local `nuget.config`, set `DOTNET_CLI_HOME`, and switched to framework-dependent launcher output. |
