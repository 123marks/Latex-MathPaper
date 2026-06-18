# Operator Guide

This project is a local operating system for mathematical modeling contest papers.

## First Use

Product UI:

```powershell
.\MathModelingPaperOS.exe
.\MathModelingPaperOS.cmd
```

This opens a local browser UI at `http://127.0.0.1:3719`. The interface is a Node/browser product surface, not a Python GUI. The backend still uses `paperctl.py` for deterministic workspace, AI, LaTeX, skill, and MCP operations. Use the `.cmd` fallback if the `.exe` has not been built.

The first screen is the official-site homepage. It uses a model-gateway/middle-station visual language: provider relay, signal routing, model orbit, and trace streams. Use `Enter App` or scroll to `Application Workbench` for the contest controls.

The homepage also includes a `Local Runtime` section that explains the executable launcher, provider switchboard, portable package, and final submission-package flow.

Design context lives in `.impeccable.md`. Treat it as the product UI contract for future design changes.

CLI:

```powershell
python paperctl.py init my-contest
```

This creates:

- `contests/my-contest/problem/`
- `contests/my-contest/data/raw/`
- `contests/my-contest/src/`
- `contests/my-contest/figures/`
- `contests/my-contest/paper/`
- `contests/my-contest/state/`

## Contest Workflow

1. Put the official problem statement in `problem/`.
2. Put raw data in `data/raw/`.
3. Refresh `contest-rules.md` from official sources.
4. Fill `state/problem-map.md`.
5. Fill `state/modeling-plan.md`.
6. Write preprocessing and modeling scripts in `src/`.
7. Put generated outputs in `runs/`.
8. Record result numbers in `state/result-ledger.csv`.
9. Generate figures into `figures/`.
10. Record figures in `state/figure-ledger.csv`.
11. Record important abstract and direct-answer claims in `state/claim-ledger.csv`.
12. Write LaTeX in `paper/sections/`.
13. Run verification and build.

## Commands

```powershell
python paperctl.py doctor
python paperctl.py verify my-contest
python paperctl.py build my-contest
python paperctl.py clean my-contest
python paperctl.py list-stages
python paperctl.py status my-contest
python paperctl.py pipeline my-contest
python paperctl.py advance my-contest --dry-run
python paperctl.py kb-search mcp
python paperctl.py recommend-skills writing
python paperctl.py recommend-mcp verification
python paperctl.py blueprint
python paperctl.py blueprint latex-writing
python paperctl.py skill-audit writing
python paperctl.py skill-review athola/claude-night-market@math-review
python paperctl.py provider-check
python paperctl.py provider-set --base-url https://api.openai.com/v1 --api-key-env OPENAI_API_KEY --model gpt-5.4
python paperctl.py ingest my-contest C:\path\to\problem.pdf --kind problem
python paperctl.py onboard real-contest --problem C:\path\to\problem.pdf --data C:\path\to\data.csv
python paperctl.py stage-prompt my-contest intake
python paperctl.py run-stage my-contest intake --dry-run
python paperctl.py apply-response my-contest ai-runs/<run>/response.md
python paperctl.py apply-response my-contest ai-runs/<run>/response.md --apply
python paperctl.py package-app
python paperctl.py package-submission my-contest --allow-warnings
npm run visual-smoke
npm run runtime-timeout-smoke
```

`verify` checks structure, ledgers, figure paths, TODO markers, unresolved markers, and absolute Windows paths. `build` calls `latexmk` from the contest paper directory.

`list-stages` prints the configured workflow stages, recommended skills, and recommended MCP/tool categories. `status` reads the contest workspace and reports the next incomplete workflow stage. `pipeline` writes `state/pipeline-report.md` with stage gates, owners, entry commands, and non-negotiable gates. `advance --dry-run` creates a prompt package for the next incomplete stage without calling an AI provider.

`kb-search`, `recommend-skills`, `recommend-mcp`, and `skill-audit` query the local knowledge base in `product/knowledge-base.json`. `skill-audit` reports whether recommended skills appear installed locally; it never installs them.

`blueprint` prints `product/workflows/competition-blueprint.json`. Use it when you need the end-to-end product workflow rather than a single stage prompt. The UI uses the same blueprint for its Workflow Intelligence panel.

`skill-review` writes a review checklist for a known skill candidate under `product/skills/reviews/`. Do this before installing an external skill. The review should record whether the skill duplicates local core behavior, requires risky tool access, or conflicts with the evidence-ledger workflow.

`package-app` writes a portable app folder to `dist/MathModelingPaperOS-portable` by default. It deliberately excludes `contests/` so official problem files, raw data, and private workspaces are not copied into a distributable package.

`package-submission` writes `contests/<id>/submission-package/` by default. It runs build and verification, blocks on verification failures, blocks on warnings unless `--allow-warnings` is provided, and collects the final PDF, LaTeX source, scripts, figures, run artifacts, evidence ledgers, verification report, pipeline report, and `SUBMISSION_MANIFEST.md`.

`provider-check` validates the configured OpenAI-compatible provider. Missing API keys are warnings by default; use `--require-key` when you want CI or pre-flight checks to fail without a key.

`provider-set` writes `product/runtime/providers.local.json` by default. Use it or the UI to configure a model gateway with `base_url`, `api_key_env`, and `model` without editing JSON manually.

`ingest` copies local materials into the contest workspace:

- `--kind problem` -> `problem/`; text-like files sync to `problem/problem.md`, and PDF files attempt text extraction with a placeholder fallback if no extractor/text is available.
- `--kind data` -> `data/raw/`.
- `--kind reference` -> `references/`.
- `--kind skill` -> `skills/`.

`onboard` is the fastest real-contest entry point. It creates the workspace if needed, imports problem/data/reference/skill files, writes the pipeline report, and creates a manual intake prompt:

```powershell
python paperctl.py onboard real-contest --problem C:\path\to\problem.pdf --data C:\path\to\data.csv --reference C:\path\to\rules.pdf
```

`stage-prompt` creates a prompt package under `ai-runs/` without calling a model. `run-stage` reads `product/runtime/providers.example.json` and can call an OpenAI-compatible API when the relevant API key environment variable is set.

`apply-response` parses strict file blocks from an AI response. It previews by default and only writes files with `--apply`.

```text
BEGIN_FILE: state/problem-map.md
...complete file content...
END_FILE
```

## Runtime Pattern

```text
status/pipeline -> advance --dry-run or run-stage -> review response.md -> apply-response preview -> apply-response --apply -> verify -> build
```

The framework deliberately avoids unreviewed AI edits. File blocks must use relative forward-slash paths and stay inside `contests/<id>/`.

## Frontend Quality Gate

```powershell
npm run smoke
npm run visual-smoke
npm run runtime-timeout-smoke
npm run browser-visual-smoke
```

`smoke` starts the local app and checks the backend-driven shell. `visual-smoke` is a stable implementation audit for the product UI: landing page, workbench shell, persistent motion keyframes, responsive breakpoints, reduced-motion support, and anti-slop markers. `runtime-timeout-smoke` checks that stuck external runtime probes are bounded and reported instead of hanging the UI.

`browser-visual-smoke` attempts a real Chrome/Edge headless screenshot into `dist/visual-qa/browser-homepage.png`. It is optional by default because some Windows graphics environments crash the browser GPU process under headless mode. Set `PAPER_OS_BROWSER_STRICT=1` when running on a stable browser automation machine.

## Skill Use By Stage

| Stage | Skill |
| --- | --- |
| Problem intake | `math-modeling-paper` |
| Paper quality gate | `math-modeling-paper-excellence` |
| Scientific figures | `nature-figure` |
| Academic prose polishing | `nature-polishing` |
| Source/rule research | `web-search` or MCP fetch/search |

## Submission Discipline

- Do not put a result into the abstract until it appears in `state/result-ledger.csv`.
- Do not include a figure unless it appears in `state/figure-ledger.csv`.
- Do not keep an important result claim unless it appears in `state/claim-ledger.csv`.
- Do not rely on a rule unless it appears in `contest-rules.md` or `state/source-ledger.csv`.
- Do not submit while `verify` has `FAIL` items.
- Treat `WARN` items as acceptable only when they are intentional placeholders during early drafting.
- Use `package-submission` for the final handoff folder instead of manually copying files.

## MCP And Skills

- MCP example config lives at `product/mcp/mcp-config.example.json`.
- MCP safety rules live at `product/mcp/security-policy.md`.
- External skill install workflow lives at `product/skills/external-skill-workflow.md`.
- Real contest onboarding workflow lives at `product/workflows/real-contest-onboarding.yaml`.
- Machine-readable skill/MCP recommendations live at `product/knowledge-base.json`.

Recommended discovery loop:

```text
kb-search -> recommend-skills/recommend-mcp -> read candidate instructions -> optionally install one skill -> run verify/build
```

Do not install many skills or enable broad MCP servers immediately before a contest. The local workflow and ledgers are the source of truth.

## Desktop Packaging Notes

The current deliverable is a Windows `.exe`/`.cmd` launcher plus local web app. This is intentional: it keeps the workflow debuggable while the paper pipeline is still being stabilized.

Build the `.exe` launcher:

```powershell
.\build-launcher.ps1
```

The launcher is deliberately thin: it locates Node.js, starts the local server, waits for `/api/health`, opens the browser UI, and stops the server process when the launcher exits. It does not own the paper workflow.

Executable boundary:

- The launcher is the desktop entry point, not a Python GUI.
- The local web app is the product interface.
- `paperctl.py` remains the deterministic backend.
- The launcher is framework-dependent. Keep `MathModelingPaperOS.exe`, `MathModelingPaperOS.dll`, `MathModelingPaperOS.deps.json`, and `MathModelingPaperOS.runtimeconfig.json` together.
- Node.js is required to run the UI server.
- Python and `latexmk` are required for full verification/build workflows.
- The launcher validates Node.js 20+, uses `PAPER_OS_PORT` when set, reuses an existing Paper OS service only when `/api/health` matches, and falls back to a free local port if `3719` belongs to another service.
- Runtime health checks are best-effort. The UI reports Python/LaTeX availability but does not block forever if either probe stalls. Use `PAPER_OS_PYTHON` or `PAPER_OS_LATEXMK` to point the server at explicit executables.

Researched packaging options:

- Electron: fastest route to a polished desktop shell because it embeds Chromium and Node.js, but it produces a larger bundle.
- Tauri: best candidate for a small Windows executable because it uses the OS web renderer and Rust-side commands, but it adds Rust/build-tool prerequisites.
- Neutralino: lightweight JavaScript/HTML/CSS desktop shell that avoids bundling Chromium, but its ecosystem is smaller than Electron/Tauri.

Recommended next step after a real contest pilot: wrap `app/server.mjs` and `app/public/` with Tauri, keeping `paperctl.py` as a child-process workflow engine until the Python logic is either frozen or ported.
