# AI Runtime Architecture

This product is a LaTeX-first math modeling paper workflow framework. The AI runtime is a stage runner, not an autonomous black box.

## Core Components

| Component | Path | Purpose |
| --- | --- | --- |
| Provider config | `product/runtime/providers.example.json` | Defines OpenAI-compatible `base_url`, API key environment variable, model, and timeout. |
| Stage config | `product/runtime/stages.json` | Defines intake, modeling, figure, writing, and verification stages. |
| Prompt package | `contests/<id>/ai-runs/<run>/prompt.md` | Human-reviewable prompt built from workflow and contest context. |
| Response package | `contests/<id>/ai-runs/<run>/response.md` | AI output when `run-stage` calls a provider. |
| AI run ledger | `contests/<id>/state/ai-run-ledger.csv` | Records stage, provider, model, prompt path, response path, and status. |
| Response applier | `paperctl.py apply-response` | Previews or applies strict `BEGIN_FILE` response blocks inside the contest workspace. |

## Commands

Create a prompt package without calling a model:

```powershell
python paperctl.py stage-prompt sample-contest intake
```

Dry-run provider config and prompt packaging:

```powershell
python paperctl.py run-stage sample-contest intake --dry-run
```

Call an OpenAI-compatible provider:

```powershell
$env:OPENAI_API_KEY="..."
python paperctl.py run-stage sample-contest intake --provider default
```

Inspect runtime configuration:

```powershell
python paperctl.py list-stages
python paperctl.py provider-check --provider default
python paperctl.py provider-check --provider default --require-key
```

Preview or apply AI response file blocks:

```powershell
python paperctl.py apply-response sample-contest ai-runs/<run>/response.md
python paperctl.py apply-response sample-contest ai-runs/<run>/response.md --apply
```

## Design Rules

- AI output does not auto-edit LaTeX or scripts.
- Every response is saved for review before edits are applied.
- AI-proposed file edits must use strict blocks:

```text
BEGIN_FILE: relative/path
...complete file content...
END_FILE
```

- `apply-response` rejects absolute paths, drive-letter paths, backslash paths, traversal segments, nested blocks, duplicate paths, and unclosed blocks.
- Provider config uses `base_url`, `api_key_env`, and `model` so users can connect OpenAI, local gateways, or compatible API services.
- MCP and skills are stage recommendations, not hidden runtime magic.
- Verification remains deterministic through `paperctl.py verify` and `latexmk`.

## Stage Model

The runtime follows this loop:

```text
contest files -> stage prompt -> AI response -> apply-response preview -> reviewed file edits -> deterministic verify/build
```

This keeps the tool useful under contest pressure while preserving evidence traceability and preventing unreviewed AI claims from entering the final paper.
