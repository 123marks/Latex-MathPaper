# Math Modeling Paper OS

> 这是一款针对数学建模类赛事的通用性全功能的论文生产神器。

This workspace is being shaped into a local product for mathematical modeling competitions. It uses LaTeX as the final paper source, Python scripts for reproducible results and figures, skills for expert workflows, and optional MCP integrations for tool access.

## What Exists

- `MathModelingPaperOS.exe`: Windows product launcher when built with `build-launcher.ps1`.
- `MathModelingPaperOS.cmd`: script fallback launcher.
- `app/`: Node.js local web app with a browser-based product UI.
- `launcher/`: small .NET launcher source that opens the browser UI and supervises the local server.
- `paperctl.py`: CLI for contest workspace initialization, verification, build, clean, and environment checks.
- `templates/contest/`: copyable contest workspace template.
- `product/`: workflows, quality checklists, role prompts, and product config.
- `product/runtime/`: OpenAI-compatible provider config and workflow stage definitions.
- `product/mcp/`: example MCP config and security policy.
- `product/skills/`: external skill evaluation workflow.
- `docs/knowledge/`: skill catalog, MCP catalog, paper quality system, and LaTeX notes.
- `docs/operator-guide.md`: practical usage guide.
- `contests/sample-contest/`: generated sample workspace used to verify the product skeleton.

## Quick Start

Product UI:

```powershell
.\MathModelingPaperOS.exe
.\MathModelingPaperOS.cmd
```

This starts the local app at `http://127.0.0.1:3719`. The UI is intentionally a browser/desktop-style product surface rather than a Python GUI. Use the `.cmd` launcher if the `.exe` launcher file group has not been built yet.

CLI:

```powershell
python paperctl.py doctor
python paperctl.py init my-contest
python paperctl.py verify my-contest
python paperctl.py build my-contest
python paperctl.py list-stages
python paperctl.py status my-contest
python paperctl.py pipeline my-contest
python paperctl.py advance my-contest --dry-run
python paperctl.py kb-search latex
python paperctl.py recommend-skills writing
python paperctl.py recommend-mcp verification
python paperctl.py blueprint
python paperctl.py skill-audit writing
python paperctl.py skill-review athola/claude-night-market@math-review
python paperctl.py provider-check
python paperctl.py provider-set --base-url https://api.openai.com/v1 --api-key-env OPENAI_API_KEY --model gpt-5.4
python paperctl.py ingest my-contest C:\path\to\problem.pdf --kind problem
python paperctl.py onboard real-contest --problem C:\path\to\problem.pdf --data C:\path\to\data.csv
python paperctl.py package-app
python paperctl.py package-submission my-contest --allow-warnings
python paperctl.py stage-prompt my-contest intake
python paperctl.py run-stage my-contest intake --dry-run
python paperctl.py apply-response my-contest ai-runs/<run>/response.md
npm run visual-smoke
npm run runtime-timeout-smoke
python -m unittest discover -s tests
```

## Product App

The app is a local web product, not a Python GUI. The Windows launcher starts `node app/server.mjs` and opens the browser at `http://127.0.0.1:3719`.

The frontend has two layers:

- Official-site homepage: a model-gateway style product site with provider relay, signal routing, always-on trace motion, and executable-runtime positioning.
- Workbench app: provider setup, contest onboarding, stage gates, verification/build/package actions, and Skill/MCP recommendations.
- Runtime section: explains the Windows EXE launcher, OpenAI-compatible provider switchboard, portable folder, and submission packaging path.

Design context is stored in `.impeccable.md`. Future UI changes should preserve the official-site-to-application split, the research command-center tone, and persistent idle motion instead of hover-only effects.

Frontend quality gates:

```powershell
npm run smoke
npm run visual-smoke
npm run dom-ui-smoke
npm run headed-visual-smoke
npm run runtime-timeout-smoke
npm run browser-visual-smoke
```

`smoke` checks the live local API plus page shell. `visual-smoke` checks that the frontend keeps the landing/app split, persistent motion system, responsive breakpoints, reduced-motion support, and avoids obvious generic AI UI patterns. `dom-ui-smoke` starts the local app and checks the runtime HTML/API contract for the official homepage, app workbench, live relay components, and Skill/MCP intelligence. `runtime-timeout-smoke` verifies that runtime probes cannot hang the app startup path when an external command stalls.

`headed-visual-smoke` opens a real local Chrome/Edge window, connects through DevTools, and captures `dist/visual-qa/headed-homepage.png` plus `dist/visual-qa/headed-app.png`. Use it on Windows machines where headless browser screenshot mode crashes.

`browser-visual-smoke` is an optional real-browser screenshot probe. It attempts homepage and application screenshots under `dist/visual-qa/` when local Chrome/Edge headless rendering works. On Windows machines where Chrome/Edge headless GPU crashes, it reports `SKIP`; set `PAPER_OS_BROWSER_STRICT=1` to make that fatal.

Current product functions:

- Create contest workspaces from `templates/contest/`.
- Configure an OpenAI-compatible provider with `base_url`, API key environment variable, model, temperature, and timeout.
- Import official problem files, raw data, references, or user-provided skills into the active contest workspace.
- Run status, pipeline, dry-run advance, verification, build, submission packaging, skill audit, MCP audit, and provider checks.
- Inspect the workflow blueprint plus stage-specific Skill/MCP recommendations in the product UI.
- Keep LaTeX and evidence ledgers as the source of truth; AI output remains reviewable before file writes.
- Generate a portable app folder that excludes private contest workspaces.
- Generate a final submission package for a contest workspace.
- Onboard a real contest by creating the workspace, importing materials, writing a pipeline report, and creating the first intake prompt.
- Present the product as a polished animated website plus an application workspace instead of a Python-style form panel.
- Keep persistent motion visible while idle: traffic lanes, model orbit, signal pulse, trace stream, runtime orbit, stage sheen, and progress tracks.

Packaging direction:

- Current MVP: `.exe/.cmd + Node local web server + browser UI`, which is low-dependency and easy to debug during contest pressure.
- Next desktop shell: Tauri if small Windows binaries matter most; Electron if fastest packaging and maximum web UI consistency matter most; Neutralino if a lightweight shell is acceptable with a smaller ecosystem.
- The packaging layer should not own workflow logic. It should keep calling the same local API/CLI contract.

## Contest Workflow

1. Put the official problem statement in `contests/<id>/problem/`.
2. Put raw data in `contests/<id>/data/raw/`.
3. Refresh `contests/<id>/contest-rules.md`.
4. Fill `state/problem-map.md` and `state/modeling-plan.md`.
5. Write scripts in `src/` and store outputs in `runs/`.
6. Record result evidence in `state/result-ledger.csv`.
7. Generate figures into `figures/` and record them in `state/figure-ledger.csv`.
8. Record important claims in `state/claim-ledger.csv`.
9. Write paper sections in `paper/sections/`.
10. Run `verify`, `build`, and `package-submission`.

Use `status` during a contest to see which workflow stage is currently incomplete and which command should run next. Use `pipeline` for a full stage-gate report. Use `advance --dry-run` to create the next-stage prompt package without calling an API.

## Product Principle

Every important paper claim must trace through `state/claim-ledger.csv` to a result row, figure row, script, source, or LaTeX artifact. The product should make high-quality contest writing faster without hiding weak evidence behind polished language.

## Knowledge Base

`product/knowledge-base.json` is the machine-readable local knowledge base. It records product principles, official reference sources, skill candidates, MCP categories, and stage gates.

`product/workflows/competition-blueprint.json` is the product-level operating blueprint. It defines lanes from contest intake to submission verification, including entry commands, recommended skills, MCP capabilities, required outputs, and gates.

Useful queries:

```powershell
python paperctl.py kb-search mcp
python paperctl.py kb-search scientific figure
python paperctl.py recommend-skills figure
python paperctl.py recommend-mcp modeling
python paperctl.py blueprint
python paperctl.py blueprint scientific-figures
python paperctl.py skill-audit verification
```

`skill-audit` checks whether recommended local/global skills are currently installed. It does not install anything; install commands remain advisory until you read each candidate's `SKILL.md`.

Use `skill-review` before installing an external skill:

```powershell
python paperctl.py skill-review athola/claude-night-market@math-review
```

This writes a review checklist under `product/skills/reviews/`. Install only after the review records a clear adoption decision.

## Portable Package

Create a portable Windows folder:

```powershell
python paperctl.py package-app
```

Output defaults to `dist/MathModelingPaperOS-portable`. It includes the app, templates, product config, docs, tests, launcher, and CLI, but intentionally excludes `contests/` so private contest files are not copied.

Build the optional Windows `.exe` launcher:

```powershell
.\build-launcher.ps1
```

The executable is a thin launcher only. It locates Node.js, starts `app/server.mjs`, waits for `/api/health`, opens the browser UI, and leaves all workflow logic in `paperctl.py`.

Current executable boundary:

- `MathModelingPaperOS.exe` is the local desktop entry point.
- The launcher is framework-dependent and ships with `MathModelingPaperOS.dll`, `MathModelingPaperOS.deps.json`, and `MathModelingPaperOS.runtimeconfig.json`; keep those files beside the `.exe`.
- Node.js 20+ is still required on the target machine.
- Python and `latexmk` are required for full contest verification and PDF building.
- The launcher is deliberately thin so backend workflow logic remains testable and portable.
- If port `3719` is occupied by Paper OS, the launcher reuses it. If the port belongs to another service, it falls back to a free local port unless `PAPER_OS_PORT` is explicitly set.
- The app probes Python and LaTeX with deadlines so a slow or broken runtime does not block the UI. Override command paths with `PAPER_OS_PYTHON` and `PAPER_OS_LATEXMK` when needed.

## Submission Package

Create a final handoff folder for a contest:

```powershell
python paperctl.py package-submission my-contest --allow-warnings
```

By default this runs `build`, runs `verify`, blocks on `FAIL`, blocks on `WARN` unless `--allow-warnings` is provided, and writes `contests/<id>/submission-package/`. The package includes `paper/main.pdf`, LaTeX sources, sections, bibliography, scripts, figures, run artifacts, evidence ledgers, verification report, pipeline report, and `SUBMISSION_MANIFEST.md`.

## AI Runtime

The tool supports OpenAI-compatible providers through `product/runtime/providers.example.json` or the UI-created `product/runtime/providers.local.json`. A provider can have its own `base_url`, `api_key_env`, and `model`. Use the product UI, `list-stages`, and `provider-check` to validate provider configuration before a real call.

CLI setup example:

```powershell
python paperctl.py provider-set --base-url https://api.openai.com/v1 --api-key-env OPENAI_API_KEY --model gpt-5.4
$env:OPENAI_API_KEY="..."
python paperctl.py provider-check --provider-config product/runtime/providers.local.json --require-key
```

The app can import local materials into a contest workspace:

- Problem files into `problem/`; text-like files sync directly to `problem/problem.md`, and PDFs attempt text extraction with a placeholder fallback.
- Raw data into `data/raw/`.
- References into `references/`.
- User-provided skills into `skills/`.

CLI ingest example:

```powershell
python paperctl.py ingest my-contest C:\path\to\problem.pdf --kind problem
python paperctl.py ingest my-contest C:\path\to\data.csv --kind data
python paperctl.py ingest my-contest C:\path\to\my-skill.md --kind skill
```

Real contest onboarding:

```powershell
python paperctl.py onboard real-contest --problem C:\path\to\problem.pdf --data C:\path\to\data.csv --reference C:\path\to\rules.pdf
```

This creates or reuses the contest workspace, imports materials, writes `state/pipeline-report.md`, and creates a manual intake prompt under `ai-runs/`.

`stage-prompt` creates a reviewable prompt package; `run-stage` can call the provider and stores the response under `contests/<id>/ai-runs/`. AI output is intentionally not auto-applied to paper files. To make model output actionable, responses can include strict file blocks:

```text
BEGIN_FILE: state/problem-map.md
...complete file content...
END_FILE
```

`apply-response` previews these blocks by default. Re-run with `--apply` only after review.

Runtime loop:

```text
status/pipeline -> advance --dry-run or run-stage -> review response.md -> apply-response preview -> apply-response --apply -> verify -> build
```

## Current Verification

The sample workspace has been initialized, model/plot templates have run, and `paperctl.py verify sample-contest` reports 51 PASS, 1 WARN, 0 FAIL. The remaining warning is intentional because the template still contains TODO placeholders.

## License

Released under the Apache License 2.0. See `LICENSE` for the full text.
