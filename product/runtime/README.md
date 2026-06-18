# Runtime Configuration

This directory defines the AI workflow runtime.

## Files

- `providers.example.json`: OpenAI-compatible provider configuration examples.
- `stages.json`: stage definitions for intake, modeling, figure, writing, and verification.
- `pipeline.json`: stage-gate operating pipeline with owners, entry commands, review commands, and non-negotiable gates.

## Provider Shape

```json
{
  "kind": "openai-compatible",
  "base_url": "https://api.openai.com/v1",
  "api_key_env": "OPENAI_API_KEY",
  "model": "gpt-5.4",
  "temperature": 0.2,
  "timeout": 120
}
```

Use a local or third-party gateway by changing `base_url`, `api_key_env`, and `model`.

## Safety

The runtime writes prompts and responses into `contests/<id>/ai-runs/`. It does not automatically apply AI output to paper files.

AI responses can propose edits with strict file blocks:

```text
BEGIN_FILE: state/problem-map.md
...complete file content...
END_FILE
```

Use `python paperctl.py apply-response <contest-id> <response.md>` to preview. Add `--apply` only after review. The applier rejects paths that escape the contest workspace.

Useful runtime checks:

```powershell
python paperctl.py list-stages
python paperctl.py pipeline sample-contest
python paperctl.py advance sample-contest --dry-run
python paperctl.py provider-check
python paperctl.py provider-check --require-key
```
