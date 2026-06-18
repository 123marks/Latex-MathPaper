# Math Modeling Paper OS App

This is the product-facing local web application. It avoids Python GUI frameworks and uses Node.js plus native browser UI.

## Run

From the project root:

```powershell
.\MathModelingPaperOS.cmd
```

Or:

```powershell
node app/server.mjs
```

Open:

```text
http://127.0.0.1:3719
```

## What The App Controls

- Contest workspace creation.
- AI provider configuration with `base_url`, `api_key_env`, model, temperature, and timeout.
- Local material import into `problem/`, `data/raw/`, `references/`, or `skills/`.
- Pipeline/status/advance/verify/build commands through `paperctl.py`.
- Skill and MCP audits.

## Packaging Direction

Current release is a zero-dependency local app launcher for Windows. For a true single-file `.exe`, use one of these later packaging layers:

- Electron: fastest Windows desktop shell, larger binary because it bundles Chromium/Node.
- Tauri: smaller desktop executable, requires Rust/build tooling and uses the OS web renderer.
- Neutralino: lightweight JavaScript/HTML/CSS shell, smaller ecosystem.

The backend contract should stay the same: UI calls Node API, Node API calls `paperctl.py`, and `paperctl.py` owns the LaTeX/AI/skills/MCP workflow.

Create a portable folder without private contest data:

```powershell
python paperctl.py package-app
```

The output is `dist/MathModelingPaperOS-portable` unless `--output` is provided.
