from __future__ import annotations

import argparse
import csv
import datetime as dt
import json
import os
import shutil
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path, PurePosixPath, PureWindowsPath


ROOT = Path(__file__).resolve().parent
TEMPLATE = ROOT / "templates" / "contest"
CONTESTS = ROOT / "contests"
RUNTIME_STAGES = ROOT / "product" / "runtime" / "stages.json"
PIPELINE_CONFIG = ROOT / "product" / "runtime" / "pipeline.json"
DEFAULT_PROVIDER_CONFIG = ROOT / "product" / "runtime" / "providers.example.json"
LOCAL_PROVIDER_CONFIG = ROOT / "product" / "runtime" / "providers.local.json"
DEFAULT_MCP_CONFIG = ROOT / "product" / "mcp" / "mcp-config.example.json"
KNOWLEDGE_BASE = ROOT / "product" / "knowledge-base.json"
COMPETITION_BLUEPRINT = ROOT / "product" / "workflows" / "competition-blueprint.json"
DIST = ROOT / "dist"
SKILL_REVIEWS = ROOT / "product" / "skills" / "reviews"

REQUIRED_FILES = [
    "contest-rules.md",
    "problem/problem.md",
    "state/problem-map.md",
    "state/modeling-plan.md",
    "state/result-ledger.csv",
    "state/figure-ledger.csv",
    "state/source-ledger.csv",
    "state/claim-ledger.csv",
    "state/ai-run-ledger.csv",
    "paper/main.tex",
    "paper/refs.bib",
    "paper/Makefile",
    "paper/sections/00-abstract.tex",
    "paper/sections/01-restatement.tex",
    "paper/sections/02-analysis.tex",
    "paper/sections/03-assumptions.tex",
    "paper/sections/04-symbols.tex",
    "paper/sections/05-data.tex",
    "paper/sections/06-model-q1.tex",
    "paper/sections/07-model-q2.tex",
    "paper/sections/08-model-q3.tex",
    "paper/sections/09-validation.tex",
    "paper/sections/10-evaluation.tex",
]

REQUIRED_RESULT_COLUMNS = {
    "run_id",
    "question",
    "metric",
    "value",
    "unit",
    "script",
    "source_data",
}

REQUIRED_FIGURE_COLUMNS = {
    "figure_id",
    "path",
    "purpose",
    "caption_claim",
    "script",
    "source_data",
    "question",
    "status",
}

REQUIRED_SOURCE_COLUMNS = {
    "source_id",
    "title",
    "url",
    "retrieved_date",
    "used_for",
}

REQUIRED_CLAIM_COLUMNS = {
    "claim_id",
    "question",
    "section",
    "claim_text",
    "result_ids",
    "figure_ids",
    "source_ids",
    "expected_values",
    "status",
}

STAGE_ORDER = ["intake", "modeling", "figure", "writing", "verification"]


@dataclass
class Check:
    level: str
    message: str


def contest_dir(contest_id: str) -> Path:
    if any(part in contest_id for part in ("..", "/", "\\")):
        raise ValueError("contest_id must be a simple folder name")
    return CONTESTS / contest_id


def init_contest(args: argparse.Namespace) -> int:
    target = contest_dir(args.contest_id)
    if target.exists() and not args.force:
        print(f"Contest already exists: {target}")
        print("Use --force to replace it.")
        return 2
    if target.exists():
        shutil.rmtree(target)
    shutil.copytree(TEMPLATE, target)
    print(f"Created contest workspace: {target}")
    return 0


def read_csv(path: Path) -> tuple[list[str], list[dict[str, str]]]:
    with path.open(newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        return list(reader.fieldnames or []), list(reader)


def has_absolute_windows_path(text: str) -> bool:
    return "C:\\" in text or "D:\\" in text or "E:\\" in text


def verify_contest(args: argparse.Namespace) -> int:
    target = contest_dir(args.contest_id)
    checks: list[Check] = []

    if not target.exists():
        print(f"Missing contest workspace: {target}")
        return 2

    for relative in REQUIRED_FILES:
        path = target / relative
        if path.exists():
            checks.append(Check("PASS", f"required file exists: {relative}"))
        else:
            checks.append(Check("FAIL", f"missing required file: {relative}"))

    verify_ledger_columns(
        checks,
        target / "state" / "result-ledger.csv",
        REQUIRED_RESULT_COLUMNS,
        "result ledger",
    )
    verify_ledger_columns(
        checks,
        target / "state" / "figure-ledger.csv",
        REQUIRED_FIGURE_COLUMNS,
        "figure ledger",
    )
    verify_ledger_columns(
        checks,
        target / "state" / "source-ledger.csv",
        REQUIRED_SOURCE_COLUMNS,
        "source ledger",
    )
    verify_ledger_columns(
        checks,
        target / "state" / "claim-ledger.csv",
        REQUIRED_CLAIM_COLUMNS,
        "claim ledger",
    )
    verify_result_references(checks, target)
    verify_claim_references(checks, target)
    verify_claim_value_consistency(checks, target)
    verify_figure_paths(checks, target)
    verify_figure_latex_coverage(checks, target)
    verify_direct_answer_sections(checks, target)
    verify_latex_sources(checks, target)
    verify_latex_log(checks, target)
    verify_script_paths(checks, target)

    report = format_report(args.contest_id, checks)
    report_path = target / "state" / "verification-report.md"
    report_path.write_text(report, encoding="utf-8")
    print(report)
    print(f"Verification report written: {report_path}")

    return 1 if any(check.level == "FAIL" for check in checks) else 0


def verify_ledger_columns(
    checks: list[Check],
    path: Path,
    required: set[str],
    name: str,
) -> None:
    if not path.exists():
        checks.append(Check("FAIL", f"{name} missing: {path.relative_to(path.parents[1])}"))
        return

    columns, rows = read_csv(path)
    missing = sorted(required - set(columns))
    if missing:
        checks.append(Check("FAIL", f"{name} missing columns: {', '.join(missing)}"))
    else:
        checks.append(Check("PASS", f"{name} has required columns"))

    if rows:
        checks.append(Check("PASS", f"{name} has {len(rows)} row(s)"))
    else:
        checks.append(Check("WARN", f"{name} has no evidence rows yet"))


def verify_figure_paths(checks: list[Check], target: Path) -> None:
    figure_ledger = target / "state" / "figure-ledger.csv"
    if not figure_ledger.exists():
        return

    _, rows = read_csv(figure_ledger)
    for row in rows:
        figure_path = row.get("path", "").strip()
        if not figure_path:
            checks.append(Check("FAIL", "figure ledger row has empty path"))
            continue
        if (target / figure_path).exists():
            checks.append(Check("PASS", f"figure path exists: {figure_path}"))
        else:
            checks.append(Check("WARN", f"figure path not generated yet: {figure_path}"))


def verify_result_references(checks: list[Check], target: Path) -> None:
    result_ledger = target / "state" / "result-ledger.csv"
    if not result_ledger.exists():
        return

    _, rows = read_csv(result_ledger)
    missing_scripts: list[str] = []
    missing_sources: list[str] = []
    for row in rows:
        script = row.get("script", "").strip()
        source_data = row.get("source_data", "").strip()
        if script and not (target / script).exists():
            missing_scripts.append(script)
        if source_data and source_data.upper() != "TODO" and not (target / source_data).exists():
            missing_sources.append(source_data)

    if missing_scripts:
        checks.append(Check("FAIL", f"result ledger scripts missing: {', '.join(sorted(set(missing_scripts)))}"))
    else:
        checks.append(Check("PASS", "result ledger script paths resolve"))

    if missing_sources:
        checks.append(Check("WARN", f"result ledger source paths not found: {', '.join(sorted(set(missing_sources)))}"))
    else:
        checks.append(Check("PASS", "result ledger source paths resolve or are intentionally broad"))


def split_refs(value: str) -> list[str]:
    return [
        item.strip()
        for item in value.replace("|", ";").split(";")
        if item.strip()
    ]


def parse_key_values(value: str) -> dict[str, str]:
    pairs: dict[str, str] = {}
    for item in split_refs(value):
        if "=" not in item:
            continue
        key, raw_value = item.split("=", 1)
        key = key.strip()
        raw_value = raw_value.strip()
        if key and raw_value:
            pairs[key] = raw_value
    return pairs


def values_match(expected: str, actual: str) -> bool:
    expected = expected.strip()
    actual = actual.strip()
    try:
        return abs(float(expected) - float(actual)) <= 1e-9
    except ValueError:
        return expected == actual


def verify_claim_references(checks: list[Check], target: Path) -> None:
    claim_ledger = target / "state" / "claim-ledger.csv"
    if not claim_ledger.exists():
        return

    _, claims = read_csv(claim_ledger)
    _, result_rows = read_csv(target / "state" / "result-ledger.csv")
    _, figure_rows = read_csv(target / "state" / "figure-ledger.csv")
    _, source_rows = read_csv(target / "state" / "source-ledger.csv")

    result_ids = {
        row.get("metric", "").strip()
        for row in result_rows
        if row.get("metric", "").strip()
    }
    result_ids.update(
        row.get("run_id", "").strip()
        for row in result_rows
        if row.get("run_id", "").strip()
    )
    figure_ids = {
        row.get("figure_id", "").strip()
        for row in figure_rows
        if row.get("figure_id", "").strip()
    }
    source_ids = {
        row.get("source_id", "").strip()
        for row in source_rows
        if row.get("source_id", "").strip()
    }

    missing_sections: list[str] = []
    missing_results: list[str] = []
    missing_figures: list[str] = []
    missing_sources: list[str] = []
    unsupported_supported_claims: list[str] = []

    for claim in claims:
        claim_id = claim.get("claim_id", "").strip() or "<missing-claim-id>"
        status = claim.get("status", "").strip().lower()
        section = claim.get("section", "").strip()
        result_refs = split_refs(claim.get("result_ids", ""))
        figure_refs = split_refs(claim.get("figure_ids", ""))
        source_refs = split_refs(claim.get("source_ids", ""))

        if section and not (target / section).exists():
            missing_sections.append(f"{claim_id}:{section}")
        for ref in result_refs:
            if ref not in result_ids:
                missing_results.append(f"{claim_id}:{ref}")
        for ref in figure_refs:
            if ref not in figure_ids:
                missing_figures.append(f"{claim_id}:{ref}")
        for ref in source_refs:
            if ref not in source_ids:
                missing_sources.append(f"{claim_id}:{ref}")

        if status == "supported" and not (result_refs or figure_refs or source_refs):
            unsupported_supported_claims.append(claim_id)

    if missing_sections:
        checks.append(Check("FAIL", f"claim sections missing: {', '.join(missing_sections)}"))
    else:
        checks.append(Check("PASS", "claim section paths resolve"))

    if missing_results:
        checks.append(Check("FAIL", f"claim result references missing: {', '.join(missing_results)}"))
    else:
        checks.append(Check("PASS", "claim result references resolve"))

    if missing_figures:
        checks.append(Check("FAIL", f"claim figure references missing: {', '.join(missing_figures)}"))
    else:
        checks.append(Check("PASS", "claim figure references resolve"))

    if missing_sources:
        checks.append(Check("FAIL", f"claim source references missing: {', '.join(missing_sources)}"))
    else:
        checks.append(Check("PASS", "claim source references resolve"))

    if unsupported_supported_claims:
        checks.append(Check("FAIL", f"supported claims without evidence: {', '.join(unsupported_supported_claims)}"))
    else:
        checks.append(Check("PASS", "supported claims have evidence references"))


def verify_claim_value_consistency(checks: list[Check], target: Path) -> None:
    claim_ledger = target / "state" / "claim-ledger.csv"
    result_ledger = target / "state" / "result-ledger.csv"
    if not claim_ledger.exists() or not result_ledger.exists():
        return

    _, claims = read_csv(claim_ledger)
    _, results = read_csv(result_ledger)
    result_values: dict[str, str] = {}
    for row in results:
        metric = row.get("metric", "").strip()
        run_id = row.get("run_id", "").strip()
        value = row.get("value", "").strip()
        if metric and value:
            result_values[metric] = value
        if run_id and value:
            result_values[run_id] = value

    missing_result_values: list[str] = []
    mismatched_values: list[str] = []
    missing_in_claim_text: list[str] = []
    missing_in_section: list[str] = []

    for claim in claims:
        claim_id = claim.get("claim_id", "").strip() or "<missing-claim-id>"
        expected_values = parse_key_values(claim.get("expected_values", ""))
        if not expected_values:
            continue
        claim_text = claim.get("claim_text", "")
        section_path = claim.get("section", "").strip()
        section_text = ""
        if section_path and (target / section_path).exists():
            section_text = (target / section_path).read_text(encoding="utf-8")

        for key, expected in expected_values.items():
            actual = result_values.get(key)
            if actual is None:
                missing_result_values.append(f"{claim_id}:{key}")
                continue
            if not values_match(expected, actual):
                mismatched_values.append(f"{claim_id}:{key} expected {expected} but ledger has {actual}")
            if expected not in claim_text:
                missing_in_claim_text.append(f"{claim_id}:{expected}")
            if section_text and expected not in section_text:
                missing_in_section.append(f"{claim_id}:{expected}")

    if missing_result_values:
        checks.append(Check("FAIL", f"claim expected values missing result ledger values: {', '.join(missing_result_values)}"))
    else:
        checks.append(Check("PASS", "claim expected values resolve to result ledger values"))

    if mismatched_values:
        checks.append(Check("FAIL", f"claim expected values mismatch result ledger: {', '.join(mismatched_values)}"))
    else:
        checks.append(Check("PASS", "claim expected values match result ledger"))

    if missing_in_claim_text:
        checks.append(Check("WARN", f"expected values not present in claim text: {', '.join(missing_in_claim_text)}"))
    else:
        checks.append(Check("PASS", "expected values appear in claim text"))

    if missing_in_section:
        checks.append(Check("WARN", f"expected values not present in claim sections: {', '.join(missing_in_section)}"))
    else:
        checks.append(Check("PASS", "expected values appear in claim sections"))


def verify_figure_latex_coverage(checks: list[Check], target: Path) -> None:
    figure_ledger = target / "state" / "figure-ledger.csv"
    if not figure_ledger.exists():
        return

    latex_text = "\n".join(
        path.read_text(encoding="utf-8")
        for path in (target / "paper").rglob("*.tex")
    )
    _, rows = read_csv(figure_ledger)
    missing_in_latex: list[str] = []
    for row in rows:
        path_value = row.get("path", "").strip()
        status = row.get("status", "").strip().lower()
        if not path_value or status in {"draft", "planned", "todo"}:
            continue
        figure_name = Path(path_value).name
        figure_stem = Path(path_value).stem
        if figure_name not in latex_text and figure_stem not in latex_text:
            missing_in_latex.append(path_value)

    if missing_in_latex:
        checks.append(Check("WARN", f"finished figures not referenced in LaTeX: {', '.join(missing_in_latex)}"))
    else:
        checks.append(Check("PASS", "finished figure ledger entries are referenced or still draft"))


def verify_direct_answer_sections(checks: list[Check], target: Path) -> None:
    section_dir = target / "paper" / "sections"
    question_sections = [
        section_dir / "06-model-q1.tex",
        section_dir / "07-model-q2.tex",
        section_dir / "08-model-q3.tex",
    ]
    missing: list[str] = []
    for section in question_sections:
        if not section.exists():
            missing.append(section.name)
            continue
        text = section.read_text(encoding="utf-8")
        if "本文回答如下" not in text and "明确回答" not in text:
            missing.append(section.name)

    if missing:
        checks.append(Check("FAIL", f"model sections missing direct-answer wording: {', '.join(missing)}"))
    else:
        checks.append(Check("PASS", "model sections include direct-answer wording"))


def verify_latex_sources(checks: list[Check], target: Path) -> None:
    tex_files = list((target / "paper").rglob("*.tex"))
    if not tex_files:
        checks.append(Check("FAIL", "no LaTeX files found under paper/"))
        return

    todo_hits: list[str] = []
    absolute_hits: list[str] = []
    unresolved_hits: list[str] = []
    for path in tex_files:
        text = path.read_text(encoding="utf-8")
        relative = path.relative_to(target).as_posix()
        if "TODO" in text:
            todo_hits.append(relative)
        if has_absolute_windows_path(text):
            absolute_hits.append(relative)
        if "??" in text:
            unresolved_hits.append(relative)

    if todo_hits:
        checks.append(Check("WARN", f"TODO markers remain in LaTeX: {', '.join(todo_hits)}"))
    else:
        checks.append(Check("PASS", "no TODO markers in LaTeX"))

    if absolute_hits:
        checks.append(Check("FAIL", f"absolute Windows paths in LaTeX: {', '.join(absolute_hits)}"))
    else:
        checks.append(Check("PASS", "no absolute Windows paths in LaTeX"))

    if unresolved_hits:
        checks.append(Check("WARN", f"possible unresolved references in LaTeX: {', '.join(unresolved_hits)}"))
    else:
        checks.append(Check("PASS", "no literal ?? markers in LaTeX"))


def verify_latex_log(checks: list[Check], target: Path) -> None:
    log_path = target / "paper" / "main.log"
    pdf_path = target / "paper" / "main.pdf"
    if not log_path.exists():
        checks.append(Check("WARN", "LaTeX log not found; run build for compile checks"))
        return

    text = log_path.read_text(encoding="utf-8", errors="replace")
    failure_patterns = [
        "! LaTeX Error:",
        "Fatal error occurred",
        "Emergency stop",
        "LaTeX Error: File `",
        "No file ",
        "not found",
    ]
    warn_patterns = [
        "undefined references",
        "Citation `",
        "Rerun to get cross-references right",
        "There were undefined references",
    ]

    failures = [pattern for pattern in failure_patterns if pattern in text]
    warnings = [pattern for pattern in warn_patterns if pattern in text]

    if failures:
        checks.append(Check("FAIL", f"LaTeX log contains error patterns: {', '.join(failures)}"))
    else:
        checks.append(Check("PASS", "LaTeX log has no fatal error patterns"))

    if warnings:
        checks.append(Check("WARN", f"LaTeX log contains warning patterns: {', '.join(warnings)}"))
    else:
        checks.append(Check("PASS", "LaTeX log has no unresolved reference/citation warnings"))

    if pdf_path.exists():
        checks.append(Check("PASS", "PDF exists: paper/main.pdf"))
    else:
        checks.append(Check("WARN", "PDF not found; run build after drafting"))


def verify_script_paths(checks: list[Check], target: Path) -> None:
    script_files = list((target / "src").glob("*.py"))
    if not script_files:
        checks.append(Check("WARN", "no Python scripts found under src/"))
        return

    bad_scripts: list[str] = []
    for path in script_files:
        text = path.read_text(encoding="utf-8")
        if has_absolute_windows_path(text):
            bad_scripts.append(path.relative_to(target).as_posix())

    if bad_scripts:
        checks.append(Check("FAIL", f"absolute Windows paths in scripts: {', '.join(bad_scripts)}"))
    else:
        checks.append(Check("PASS", "scripts avoid absolute Windows paths"))


def format_report(contest_id: str, checks: list[Check]) -> str:
    counts = {
        "PASS": sum(check.level == "PASS" for check in checks),
        "WARN": sum(check.level == "WARN" for check in checks),
        "FAIL": sum(check.level == "FAIL" for check in checks),
    }
    lines = [
        "# Verification Report",
        "",
        f"Contest: `{contest_id}`",
        "",
        "## Summary",
        "",
        f"- PASS: {counts['PASS']}",
        f"- WARN: {counts['WARN']}",
        f"- FAIL: {counts['FAIL']}",
        "",
        "## Checks",
        "",
    ]
    for check in checks:
        lines.append(f"- [{check.level}] {check.message}")
    lines.append("")
    return "\n".join(lines)


def build_contest(args: argparse.Namespace) -> int:
    target = contest_dir(args.contest_id)
    paper_dir = target / "paper"
    if not paper_dir.exists():
        print(f"Missing paper directory: {paper_dir}")
        return 2

    latexmk = shutil.which("latexmk")
    if not latexmk:
        print("latexmk not found. Install a TeX distribution with latexmk to build PDFs.")
        return 2

    command = [
        latexmk,
        "-pdf",
        "-interaction=nonstopmode",
        "-halt-on-error",
        "main.tex",
    ]
    result = subprocess.run(command, cwd=paper_dir, text=True)
    return result.returncode


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def read_text_if_exists(path: Path, max_chars: int = 12000) -> str:
    if not path.exists():
        return ""
    text = path.read_text(encoding="utf-8", errors="replace")
    if len(text) > max_chars:
        return text[:max_chars] + "\n\n[TRUNCATED]\n"
    return text


def load_provider(config_path: Path, provider_name: str) -> dict:
    config = load_json(config_path)
    providers = config.get("providers", {})
    if provider_name not in providers:
        raise ValueError(f"provider not found in {config_path}: {provider_name}")
    provider = dict(providers[provider_name])
    api_key_env = provider.get("api_key_env", "")
    api_key = os.environ.get(api_key_env, "") if api_key_env else provider.get("api_key", "")
    if api_key:
        provider["api_key"] = api_key
    return provider


def load_stage(stage_name: str) -> dict:
    stages = load_json(RUNTIME_STAGES).get("stages", {})
    if stage_name not in stages:
        raise ValueError(f"stage not found in {RUNTIME_STAGES}: {stage_name}")
    return stages[stage_name]


def load_pipeline() -> dict:
    return load_json(PIPELINE_CONFIG)


def build_stage_prompt(target: Path, stage_name: str) -> str:
    stage = load_stage(stage_name)
    inputs = []
    for relative in stage.get("context_files", []):
        path = target / relative
        text = read_text_if_exists(path)
        inputs.append(f"## File: {relative}\n\n{text or '[missing]'}")

    instructions = "\n".join(f"- {item}" for item in stage.get("instructions", []))
    outputs = "\n".join(f"- {item}" for item in stage.get("expected_outputs", []))
    skills = ", ".join(stage.get("skills", [])) or "none"
    mcp = ", ".join(stage.get("mcp", [])) or "none"

    return "\n\n".join(
        [
            f"# Stage: {stage_name}",
            f"Goal: {stage.get('goal', '')}",
            f"Recommended skills: {skills}",
            f"Recommended MCP/tools: {mcp}",
            "## Instructions",
            instructions,
            "## Expected Outputs",
            outputs,
            "## Context",
            "\n\n".join(inputs),
            "## Output Policy",
            "\n".join(
                [
                    "Return reviewable artifact content. Do not invent contest facts, data, references, or result values. Mark unknowns as TODO.",
                    "When proposing file edits, use exact file blocks:",
                    "BEGIN_FILE: relative/path",
                    "...complete file content...",
                    "END_FILE",
                    "Paths must stay inside the contest workspace and use forward slashes.",
                ]
            ),
        ]
    )


def write_ai_run(target: Path, stage_name: str, prompt: str, response: str | None = None) -> Path:
    timestamp = dt.datetime.now().strftime("%Y%m%d-%H%M%S")
    run_dir = target / "ai-runs" / f"{timestamp}-{stage_name}"
    run_dir.mkdir(parents=True, exist_ok=True)
    (run_dir / "prompt.md").write_text(prompt, encoding="utf-8")
    if response is not None:
        (run_dir / "response.md").write_text(response, encoding="utf-8")
    return run_dir


def append_ai_run_ledger(
    target: Path,
    run_dir: Path,
    stage_name: str,
    provider_name: str,
    model: str,
    status: str,
    response: bool,
) -> None:
    ledger = target / "state" / "ai-run-ledger.csv"
    if not ledger.exists():
        ledger.write_text(
            "run_id,stage,provider,model,prompt_path,response_path,status,created_at,notes\n",
            encoding="utf-8",
        )
    run_id = run_dir.name
    prompt_path = (run_dir / "prompt.md").relative_to(target).as_posix()
    response_path = (run_dir / "response.md").relative_to(target).as_posix() if response else ""
    created_at = dt.datetime.now().isoformat(timespec="seconds")
    with ledger.open("a", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow([run_id, stage_name, provider_name, model, prompt_path, response_path, status, created_at, ""])


def stage_prompt(args: argparse.Namespace) -> int:
    target = contest_dir(args.contest_id)
    if not target.exists():
        print(f"Missing contest workspace: {target}")
        return 2
    prompt = build_stage_prompt(target, args.stage)
    run_dir = write_ai_run(target, args.stage, prompt)
    append_ai_run_ledger(target, run_dir, args.stage, "manual", "", "prompt-created", False)
    print(f"Prompt written: {run_dir / 'prompt.md'}")
    return 0


def call_openai_compatible(provider: dict, prompt: str) -> str:
    base_url = provider.get("base_url", "").rstrip("/")
    model = provider.get("model", "")
    api_key = provider.get("api_key", "")
    if not base_url or not model:
        raise ValueError("provider requires base_url and model")
    if not api_key:
        raise ValueError("provider API key missing; set the configured api_key_env")

    endpoint = f"{base_url}/chat/completions"
    payload = {
        "model": model,
        "messages": [
            {
                "role": "system",
                "content": "You are a rigorous math modeling paper workflow agent. Preserve evidence traceability.",
            },
            {"role": "user", "content": prompt},
        ],
        "temperature": provider.get("temperature", 0.2),
    }
    data = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        endpoint,
        data=data,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=int(provider.get("timeout", 120))) as response:
            body = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"provider HTTP {exc.code}: {detail}") from exc

    return body["choices"][0]["message"]["content"]


def run_stage(args: argparse.Namespace) -> int:
    target = contest_dir(args.contest_id)
    if not target.exists():
        print(f"Missing contest workspace: {target}")
        return 2

    config_path = Path(args.provider_config)
    provider = load_provider(config_path, args.provider)
    prompt = build_stage_prompt(target, args.stage)
    if args.dry_run:
        run_dir = write_ai_run(target, args.stage, prompt)
        append_ai_run_ledger(target, run_dir, args.stage, args.provider, provider.get("model", ""), "dry-run", False)
        print(f"Dry run prompt written: {run_dir / 'prompt.md'}")
        return 0

    response = call_openai_compatible(provider, prompt)
    run_dir = write_ai_run(target, args.stage, prompt, response)
    append_ai_run_ledger(target, run_dir, args.stage, args.provider, provider.get("model", ""), "response-created", True)
    print(f"AI response written: {run_dir / 'response.md'}")
    print("Review the response and apply edits deliberately; this command does not auto-modify paper files.")
    return 0


def validate_file_block_path(raw_path: str) -> str:
    value = raw_path.strip()
    if not value:
        raise ValueError("file block path is empty")
    if "\\" in value:
        raise ValueError(f"file block path must use forward slashes: {raw_path}")
    if ":" in value:
        raise ValueError(f"file block path must not contain drive letters or schemes: {raw_path}")
    if any(part in {"", ".", ".."} for part in value.split("/")):
        raise ValueError(f"file block path must not contain empty or traversal segments: {raw_path}")

    posix_path = PurePosixPath(value)
    windows_path = PureWindowsPath(value)
    if posix_path.is_absolute() or windows_path.is_absolute():
        raise ValueError(f"file block path must be relative: {raw_path}")

    parts = posix_path.parts
    if any(part in {"", ".", ".."} for part in parts):
        raise ValueError(f"file block path must not contain traversal segments: {raw_path}")

    normalized = posix_path.as_posix()
    if normalized in {"", "."}:
        raise ValueError("file block path is empty")
    return normalized


def parse_file_blocks(response: str) -> list[tuple[str, str]]:
    blocks: list[tuple[str, str]] = []
    seen_paths: set[str] = set()
    current_path: str | None = None
    current_lines: list[str] = []

    for line_number, line in enumerate(response.splitlines(keepends=True), start=1):
        stripped = line.strip()
        if current_path is None:
            if stripped.startswith("BEGIN_FILE:"):
                raw_path = stripped[len("BEGIN_FILE:") :].strip()
                current_path = validate_file_block_path(raw_path)
                if current_path in seen_paths:
                    raise ValueError(f"duplicate file block path: {current_path}")
                current_lines = []
            elif stripped == "END_FILE":
                raise ValueError(f"END_FILE without BEGIN_FILE at line {line_number}")
            continue

        if stripped == "END_FILE":
            blocks.append((current_path, "".join(current_lines)))
            seen_paths.add(current_path)
            current_path = None
            current_lines = []
        elif stripped.startswith("BEGIN_FILE:"):
            raise ValueError(f"nested BEGIN_FILE at line {line_number}")
        else:
            current_lines.append(line)

    if current_path is not None:
        raise ValueError(f"missing END_FILE for block: {current_path}")
    return blocks


def ensure_inside_workspace(root: Path, relative_path: str) -> Path:
    root_resolved = root.resolve()
    destination = (root / relative_path).resolve()
    if destination != root_resolved and root_resolved not in destination.parents:
        raise ValueError(f"resolved path escapes contest workspace: {relative_path}")
    return destination


def preview_or_apply_file_blocks(target: Path, response: str, apply: bool) -> str:
    blocks = parse_file_blocks(response)
    if not blocks:
        return "No BEGIN_FILE blocks found."

    lines: list[str] = []
    for relative_path, content in blocks:
        destination = ensure_inside_workspace(target, relative_path)
        status = "create" if not destination.exists() else "update"
        action = "APPLY" if apply else "PREVIEW"
        lines.append(f"{action} {relative_path} ({status}, {len(content)} chars)")
        if apply:
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_text(content, encoding="utf-8")
    return "\n".join(lines)


def resolve_response_path(target: Path, response_path: str) -> Path:
    raw_path = Path(response_path)
    candidates = [raw_path] if raw_path.is_absolute() else [raw_path, target / raw_path]
    for candidate in candidates:
        if candidate.exists():
            return candidate
    searched = ", ".join(str(candidate) for candidate in candidates)
    raise FileNotFoundError(f"response file not found; searched: {searched}")


def apply_response(args: argparse.Namespace) -> int:
    target = contest_dir(args.contest_id)
    if not target.exists():
        print(f"Missing contest workspace: {target}")
        return 2

    try:
        response_path = resolve_response_path(target, args.response_path)
        response = response_path.read_text(encoding="utf-8")
        summary = preview_or_apply_file_blocks(target, response, args.apply)
    except (FileNotFoundError, ValueError) as exc:
        print(f"Cannot apply response: {exc}")
        return 2

    print(summary)
    if not args.apply:
        print("Preview only. Re-run with --apply to write these file blocks.")
    return 0


def list_stages(_: argparse.Namespace) -> int:
    stages = load_json(RUNTIME_STAGES).get("stages", {})
    for stage_name, stage in stages.items():
        skills = ", ".join(stage.get("skills", [])) or "none"
        mcp = ", ".join(stage.get("mcp", [])) or "none"
        print(f"{stage_name}: {stage.get('goal', '')}")
        print(f"  skills: {skills}")
        print(f"  mcp: {mcp}")
    return 0


def provider_check(args: argparse.Namespace) -> int:
    checks: list[Check] = []
    config_path = Path(args.provider_config)
    try:
        config = load_json(config_path)
        checks.append(Check("PASS", f"provider config exists: {config_path}"))
    except FileNotFoundError:
        checks.append(Check("FAIL", f"provider config missing: {config_path}"))
        print(format_report("provider-check", checks))
        return 1
    except json.JSONDecodeError as exc:
        checks.append(Check("FAIL", f"provider config is invalid JSON: {exc}"))
        print(format_report("provider-check", checks))
        return 1

    providers = config.get("providers", {})
    provider = providers.get(args.provider)
    if not provider:
        checks.append(Check("FAIL", f"provider not found: {args.provider}"))
        print(format_report("provider-check", checks))
        return 1
    checks.append(Check("PASS", f"provider found: {args.provider}"))

    kind = provider.get("kind", "")
    if kind == "openai-compatible":
        checks.append(Check("PASS", "provider kind is openai-compatible"))
    else:
        checks.append(Check("FAIL", f"unsupported provider kind: {kind or '<missing>'}"))

    base_url = provider.get("base_url", "")
    parsed_url = urllib.parse.urlparse(base_url)
    if parsed_url.scheme in {"http", "https"} and parsed_url.netloc:
        checks.append(Check("PASS", f"base_url is valid: {base_url}"))
    else:
        checks.append(Check("FAIL", f"base_url must be an http(s) URL: {base_url or '<missing>'}"))

    model = provider.get("model", "")
    if model:
        checks.append(Check("PASS", f"model configured: {model}"))
    else:
        checks.append(Check("FAIL", "model missing"))

    api_key_env = provider.get("api_key_env", "")
    inline_api_key = provider.get("api_key", "")
    if api_key_env and os.environ.get(api_key_env):
        checks.append(Check("PASS", f"API key available from env: {api_key_env}"))
    elif api_key_env:
        level = "FAIL" if args.require_key else "WARN"
        checks.append(Check(level, f"API key env var is not set: {api_key_env}"))
    elif inline_api_key:
        checks.append(Check("WARN", "provider uses inline api_key; prefer api_key_env"))
    else:
        checks.append(Check("FAIL", "provider needs api_key_env or api_key"))

    try:
        timeout = int(provider.get("timeout", 120))
        if timeout > 0:
            checks.append(Check("PASS", f"timeout is positive: {timeout}"))
        else:
            checks.append(Check("FAIL", f"timeout must be positive: {timeout}"))
    except (TypeError, ValueError):
        checks.append(Check("FAIL", f"timeout must be an integer: {provider.get('timeout')}"))

    try:
        float(provider.get("temperature", 0.2))
        checks.append(Check("PASS", f"temperature configured: {provider.get('temperature', 0.2)}"))
    except (TypeError, ValueError):
        checks.append(Check("FAIL", f"temperature must be numeric: {provider.get('temperature')}"))

    print(format_report(f"provider:{args.provider}", checks))
    return 1 if any(check.level == "FAIL" for check in checks) else 0


def provider_set(args: argparse.Namespace) -> int:
    config_path = Path(args.provider_config)
    if config_path.exists():
        config = load_json(config_path)
    else:
        config = {"providers": {}}
    providers = config.setdefault("providers", {})
    providers[args.provider] = {
        "kind": "openai-compatible",
        "base_url": args.base_url,
        "api_key_env": args.api_key_env,
        "model": args.model,
        "temperature": args.temperature,
        "timeout": args.timeout,
    }
    config_path.parent.mkdir(parents=True, exist_ok=True)
    config_path.write_text(json.dumps(config, indent=2), encoding="utf-8")
    print(f"Provider written: {config_path}")
    print(f"Provider name: {args.provider}")
    return 0


def safe_copy_into_contest(target: Path, source: Path, destination_dir: Path) -> Path:
    if not source.exists() or not source.is_file():
        raise ValueError(f"source file missing: {source}")
    destination_dir.mkdir(parents=True, exist_ok=True)
    safe_name = source.name.translate(str.maketrans({char: "_" for char in '<>:"/\\|?*'}))
    destination = ensure_inside_workspace(target, (destination_dir / safe_name).relative_to(target).as_posix())
    if source.resolve() != destination.resolve():
        shutil.copy2(source, destination)
    return destination


def extract_pdf_text(path: Path) -> str:
    readers: list[tuple[str, object]] = []
    try:
        from pypdf import PdfReader  # type: ignore

        readers.append(("pypdf", PdfReader))
    except ImportError:
        pass
    try:
        from PyPDF2 import PdfReader as PyPDF2Reader  # type: ignore

        readers.append(("PyPDF2", PyPDF2Reader))
    except ImportError:
        pass

    errors: list[str] = []
    for name, reader_cls in readers:
        try:
            reader = reader_cls(str(path))
            pages = []
            for index, page in enumerate(reader.pages, start=1):
                text = page.extract_text() or ""
                if text.strip():
                    pages.append(f"## Page {index}\n\n{text.strip()}")
            if pages:
                return "\n\n".join(pages).strip()
            errors.append(f"{name}: no extractable text")
        except Exception as exc:  # pragma: no cover - depends on optional PDF libraries
            errors.append(f"{name}: {exc}")

    if not readers:
        raise ValueError("no PDF text extractor installed; install pypdf or PyPDF2, or paste problem text manually")
    raise ValueError("; ".join(errors))


def problem_text_from_source(path: Path) -> tuple[str, str]:
    suffix = path.suffix.lower()
    if suffix in {".md", ".txt", ".tex"}:
        return path.read_text(encoding="utf-8", errors="replace").strip(), "source text"
    if suffix == ".pdf":
        try:
            return extract_pdf_text(path), "PDF text extraction"
        except ValueError as exc:
            fallback = "\n".join(
                [
                    f"# Problem Statement Placeholder",
                    "",
                    f"Imported PDF: `{path.name}`",
                    "",
                    "PDF text extraction did not produce usable text.",
                    "",
                    f"Reason: {exc}",
                    "",
                    "Paste the official problem text here before running intake/modeling prompts.",
                    "",
                ]
            )
            return fallback, "PDF placeholder"
    raise ValueError(f"unsupported problem text source: {path.suffix or '<no extension>'}")


def sync_problem_markdown(target: Path, source: Path) -> str:
    text, mode = problem_text_from_source(source)
    problem_path = target / "problem" / "problem.md"
    problem_path.parent.mkdir(parents=True, exist_ok=True)
    problem_path.write_text(text.rstrip() + "\n", encoding="utf-8")
    return mode


def ingest(args: argparse.Namespace) -> int:
    target = contest_dir(args.contest_id)
    if not target.exists():
        print(f"Missing contest workspace: {target}")
        return 2
    source = Path(args.source).expanduser().resolve()
    area_map = {
        "problem": target / "problem",
        "data": target / "data" / "raw",
        "reference": target / "references",
        "skill": target / "skills",
    }
    try:
        destination = safe_copy_into_contest(target, source, area_map[args.kind])
    except ValueError as exc:
        print(f"Ingest failed: {exc}")
        return 2

    if args.kind == "problem":
        try:
            mode = sync_problem_markdown(target, destination)
            print(f"Problem text synchronized: problem/problem.md ({mode})")
        except ValueError as exc:
            print(f"Problem text not synchronized: {exc}")
    print(f"Ingested {args.kind}: {destination.relative_to(target).as_posix()}")
    return 0


def ingest_many(contest_id: str, sources: list[str], kind: str) -> int:
    exit_code = 0
    for source in sources:
        result = ingest(argparse.Namespace(contest_id=contest_id, source=source, kind=kind))
        if result != 0:
            exit_code = result
    return exit_code


def onboard_contest(args: argparse.Namespace) -> int:
    target = contest_dir(args.contest_id)
    if not target.exists() or args.force:
        init_code = init_contest(argparse.Namespace(contest_id=args.contest_id, force=args.force))
        if init_code != 0:
            return init_code
    else:
        print(f"Using existing contest workspace: {target}")

    exit_code = 0
    for kind, values in [
        ("problem", args.problem or []),
        ("data", args.data or []),
        ("reference", args.reference or []),
        ("skill", args.skill or []),
    ]:
        result = ingest_many(args.contest_id, values, kind)
        if result != 0:
            exit_code = result

    if exit_code != 0:
        print("Onboarding stopped because one or more imports failed.")
        return exit_code

    pipeline_report(argparse.Namespace(contest_id=args.contest_id))
    prompt = build_stage_prompt(target, "intake")
    run_dir = write_ai_run(target, "intake", prompt)
    append_ai_run_ledger(target, run_dir, "intake", "manual", "", "prompt-created", False)
    print(f"Intake prompt written: {run_dir / 'prompt.md'}")

    print("Onboarding complete.")
    print(f"Workspace: {target}")
    print(f"Next checks:")
    print(f"  python paperctl.py status {args.contest_id}")
    print(f"  python paperctl.py verify {args.contest_id}")
    print(f"  Review problem/problem.md before running API-backed stages.")
    return 0


def path_scope_risk(value: str) -> str:
    normalized = value.strip().strip('"').strip("'")
    if not normalized:
        return "empty"
    try:
        path = Path(normalized)
    except (TypeError, ValueError):
        return "unknown"

    root_candidates = {
        Path("C:\\"),
        Path("D:\\"),
        Path("E:\\"),
        Path.home(),
    }
    if path in root_candidates:
        return "broad"
    if path.is_absolute():
        try:
            resolved = path.resolve()
            root_resolved = ROOT.resolve()
            contests_resolved = CONTESTS.resolve()
            if resolved == root_resolved or root_resolved in resolved.parents:
                return "workspace"
            if resolved == contests_resolved or contests_resolved in resolved.parents:
                return "contest"
        except OSError:
            return "absolute"
        return "absolute"
    return "relative"


def mcp_audit(args: argparse.Namespace) -> int:
    checks: list[Check] = []
    config_path = Path(args.config)
    try:
        config = load_json(config_path)
        checks.append(Check("PASS", f"MCP config exists: {config_path}"))
    except FileNotFoundError:
        checks.append(Check("FAIL", f"MCP config missing: {config_path}"))
        print(format_report("mcp-audit", checks))
        return 1
    except json.JSONDecodeError as exc:
        checks.append(Check("FAIL", f"MCP config is invalid JSON: {exc}"))
        print(format_report("mcp-audit", checks))
        return 1

    servers = config.get("mcpServers", {})
    if isinstance(servers, dict) and servers:
        checks.append(Check("PASS", f"MCP server entries configured: {len(servers)}"))
    else:
        checks.append(Check("FAIL", "MCP config must contain non-empty mcpServers object"))
        print(format_report("mcp-audit", checks))
        return 1

    for name, server in servers.items():
        if not isinstance(server, dict):
            checks.append(Check("FAIL", f"{name}: server entry must be an object"))
            continue
        command = server.get("command", "")
        args_value = server.get("args", [])
        if command:
            checks.append(Check("PASS", f"{name}: command configured: {command}"))
        else:
            checks.append(Check("FAIL", f"{name}: command missing"))

        if isinstance(args_value, list):
            checks.append(Check("PASS", f"{name}: args list configured"))
        else:
            checks.append(Check("FAIL", f"{name}: args must be a list"))
            args_value = []

        if "filesystem" in name.lower():
            path_args = [
                value
                for value in args_value
                if isinstance(value, str)
                and (":\\" in value or value.startswith("/") or value.startswith("."))
            ]
            if not path_args:
                checks.append(Check("WARN", f"{name}: no explicit filesystem scope path found"))
            for path_arg in path_args:
                risk = path_scope_risk(path_arg)
                if risk in {"workspace", "contest", "relative"}:
                    checks.append(Check("PASS", f"{name}: filesystem scope is {risk}: {path_arg}"))
                elif risk == "broad":
                    checks.append(Check("FAIL", f"{name}: filesystem scope is too broad: {path_arg}"))
                else:
                    checks.append(Check("WARN", f"{name}: review filesystem scope ({risk}): {path_arg}"))

        notes = server.get("notes", "")
        if notes:
            checks.append(Check("PASS", f"{name}: notes document intended use"))
        else:
            checks.append(Check("WARN", f"{name}: add notes documenting stage and risk"))

    print(format_report("mcp-audit", checks))
    return 1 if any(check.level == "FAIL" for check in checks) else 0


def load_knowledge_base() -> dict:
    return load_json(KNOWLEDGE_BASE)


def load_competition_blueprint() -> dict:
    return load_json(COMPETITION_BLUEPRINT)


def find_skill_candidate(skill_id: str) -> dict | None:
    for item in load_knowledge_base().get("skill_candidates", []):
        if item.get("id") == skill_id or skill_id_to_name(item.get("id", "")) == skill_id:
            return item
    return None


def skill_review_path(skill_id: str) -> Path:
    safe = "".join(char if char.isalnum() or char in "-_." else "-" for char in skill_id)
    return SKILL_REVIEWS / f"{safe}.md"


def item_matches_query(item: dict, query_terms: list[str]) -> bool:
    searchable = " ".join(
        str(value)
        for value in [
            item.get("id", ""),
            item.get("title", ""),
            item.get("summary", ""),
            " ".join(item.get("tags", [])),
            " ".join(item.get("stage", [])),
            " ".join(item.get("stages", [])),
            item.get("priority", ""),
        ]
    ).lower()
    return all(term in searchable for term in query_terms)


def iter_knowledge_items(kb: dict) -> list[tuple[str, dict]]:
    items: list[tuple[str, dict]] = []
    for section in [
        "principles",
        "external_sources",
        "skill_candidates",
        "mcp_candidates",
        "stage_gates",
    ]:
        for item in kb.get(section, []):
            items.append((section, item))
    return items


def kb_search(args: argparse.Namespace) -> int:
    kb = load_knowledge_base()
    query_terms = [term.lower() for term in args.query if term.strip()]
    results = [
        (section, item)
        for section, item in iter_knowledge_items(kb)
        if not query_terms or item_matches_query(item, query_terms)
    ]

    if not results:
        print("No knowledge-base items matched.")
        return 1

    for section, item in results[: args.limit]:
        item_id = item.get("id", item.get("stage", "<missing-id>"))
        title = item.get("title", item_id)
        priority = item.get("priority", "")
        print(f"[{section}] {item_id}: {title}")
        if priority:
            print(f"  priority: {priority}")
        if item.get("summary"):
            print(f"  {item['summary']}")
        if item.get("url"):
            print(f"  url: {item['url']}")
        if item.get("install"):
            print(f"  install: {item['install']}")
    return 0


def recommend_skills(args: argparse.Namespace) -> int:
    kb = load_knowledge_base()
    candidates = kb.get("skill_candidates", [])
    stage = args.stage.lower()
    matches = [
        item
        for item in candidates
        if stage in [value.lower() for value in item.get("stage", [])]
    ]

    if not matches:
        print(f"No skill candidates configured for stage: {args.stage}")
        return 1

    priority_rank = {"core": 0, "candidate": 1, "optional": 2}
    matches.sort(key=lambda item: (priority_rank.get(item.get("priority", ""), 9), item.get("id", "")))
    for item in matches:
        print(f"{item.get('id')}: {item.get('summary', '')}")
        print(f"  priority: {item.get('priority', 'unknown')}")
        if item.get("install"):
            print(f"  install after review: {item['install']}")
    return 0


def recommend_mcp(args: argparse.Namespace) -> int:
    kb = load_knowledge_base()
    candidates = kb.get("mcp_candidates", [])
    stage = args.stage.lower()
    matches = [
        item
        for item in candidates
        if stage in [value.lower() for value in item.get("stages", [])]
    ]

    if not matches:
        print(f"No MCP candidates configured for stage: {args.stage}")
        return 1

    priority_rank = {"recommended": 0, "recommended-with-approval": 1, "optional": 2}
    matches.sort(key=lambda item: (priority_rank.get(item.get("priority", ""), 9), item.get("id", "")))
    for item in matches:
        print(f"{item.get('id')}: {item.get('summary', '')}")
        print(f"  priority: {item.get('priority', 'unknown')}")
        print(f"  risk: {item.get('risk', 'review before enabling')}")
    return 0


def blueprint_report(args: argparse.Namespace) -> int:
    blueprint = load_competition_blueprint()
    lanes = blueprint.get("lanes", [])
    selected = args.lane.lower() if args.lane else ""
    if selected:
        lanes = [
            lane
            for lane in lanes
            if selected in {lane.get("id", "").lower(), lane.get("title", "").lower()}
        ]
    if not lanes:
        print(f"No blueprint lane matched: {args.lane}")
        return 1

    print(f"# {blueprint.get('name', 'competition-blueprint')}")
    print()
    print(blueprint.get("summary", ""))
    print()
    for lane in lanes:
        print(f"## {lane.get('title', lane.get('id', 'lane'))}")
        print(f"id: {lane.get('id', '')}")
        print(f"goal: {lane.get('goal', '')}")
        print(f"entry: {lane.get('entry_command', '')}")
        print(f"skills: {', '.join(lane.get('recommended_skills', []))}")
        print(f"mcp: {', '.join(lane.get('recommended_mcp', []))}")
        print(f"outputs: {', '.join(lane.get('outputs', []))}")
        print(f"gate: {lane.get('gate', '')}")
        print()
    if not selected:
        print("Operating rules:")
        for rule in blueprint.get("operating_rules", []):
            print(f"- {rule}")
    return 0


def pipeline_stage_lookup() -> dict[str, dict]:
    return {
        stage.get("id", ""): stage
        for stage in load_pipeline().get("stages", [])
        if stage.get("id")
    }


def render_pipeline_report(contest_id: str, target: Path) -> str:
    pipeline = load_pipeline()
    statuses = stage_status(target)
    stage_details = pipeline_stage_lookup()
    lines = [
        "# Pipeline Report",
        "",
        f"Contest: `{contest_id}`",
        f"Pipeline: `{pipeline.get('name', 'unknown')}`",
        "",
        "## Stage Status",
        "",
    ]

    for stage_name in STAGE_ORDER:
        state, note = statuses[stage_name]
        detail = stage_details.get(stage_name, {})
        lines.append(f"### {stage_name}")
        lines.append("")
        lines.append(f"- Status: {state}")
        lines.append(f"- Owner: {detail.get('owner', 'unassigned')}")
        lines.append(f"- Gate: {detail.get('exit_gate', 'not configured')}")
        lines.append(f"- Evidence: {note}")
        entry_commands = detail.get("entry_commands", [])
        review_commands = detail.get("review_commands", [])
        if entry_commands:
            lines.append(f"- Entry: {entry_commands[0].replace('<contest-id>', contest_id)}")
        if review_commands:
            lines.append(f"- Review: {review_commands[0].replace('<contest-id>', contest_id)}")
        lines.append("")

    next_stage = next((stage for stage in STAGE_ORDER if statuses[stage][0] != "done"), None)
    lines.extend(["## Next Action", ""])
    if next_stage:
        kb = load_knowledge_base()
        gate = next((item for item in kb.get("stage_gates", []) if item.get("stage") == next_stage), {})
        lines.append(f"- Next stage: {next_stage}")
        lines.append(f"- Recommendation: {gate.get('next', 'Run stage-prompt for the next stage and review the output.')}")
        lines.append(f"- Prompt command: `python paperctl.py stage-prompt {contest_id} {next_stage}`")
        lines.append(f"- Dry-run command: `python paperctl.py advance {contest_id} --dry-run`")
    else:
        lines.append("- All configured stages are done. Re-run verify/build and inspect warnings before submission.")

    lines.extend(["", "## Non-Negotiable Gates", ""])
    for gate in pipeline.get("non_negotiable_gates", []):
        lines.append(f"- {gate}")
    lines.append("")
    return "\n".join(lines)


def pipeline_report(args: argparse.Namespace) -> int:
    target = contest_dir(args.contest_id)
    if not target.exists():
        print(f"Missing contest workspace: {target}")
        return 2

    report = render_pipeline_report(args.contest_id, target)
    report_path = target / "state" / "pipeline-report.md"
    report_path.write_text(report, encoding="utf-8")
    print(report)
    print(f"Pipeline report written: {report_path}")
    return 0


def advance_contest(args: argparse.Namespace) -> int:
    target = contest_dir(args.contest_id)
    if not target.exists():
        print(f"Missing contest workspace: {target}")
        return 2

    statuses = stage_status(target)
    next_stage = next((stage for stage in STAGE_ORDER if statuses[stage][0] != "done"), None)
    if not next_stage:
        print("All configured stages are done. Run verify/build before final submission.")
        return 0

    print(f"Next stage: {next_stage}")
    print(f"Status: {statuses[next_stage][0]} - {statuses[next_stage][1]}")
    if args.no_ai:
        prompt = build_stage_prompt(target, next_stage)
        run_dir = write_ai_run(target, next_stage, prompt)
        append_ai_run_ledger(target, run_dir, next_stage, "manual", "", "prompt-created", False)
        print(f"Prompt written: {run_dir / 'prompt.md'}")
        return 0

    run_args = argparse.Namespace(
        contest_id=args.contest_id,
        stage=next_stage,
        provider_config=args.provider_config,
        provider=args.provider,
        dry_run=args.dry_run,
    )
    return run_stage(run_args)


def local_skill_roots() -> list[Path]:
    return [
        Path.home() / ".codex" / "skills",
        Path.home() / ".agents" / "skills",
        Path.home() / ".codex" / "skills" / ".system",
    ]


def skill_id_to_name(skill_id: str) -> str:
    if "@" in skill_id:
        return skill_id.rsplit("@", 1)[-1]
    return skill_id


def local_skill_exists(skill_name: str) -> bool:
    return any((root / skill_name / "SKILL.md").exists() for root in local_skill_roots())


def skill_audit(args: argparse.Namespace) -> int:
    kb = load_knowledge_base()
    candidates = kb.get("skill_candidates", [])
    stage = args.stage.lower() if args.stage else ""
    if stage:
        candidates = [
            item
            for item in candidates
            if stage in [value.lower() for value in item.get("stage", [])]
        ]

    if not candidates:
        print(f"No skill candidates configured for stage: {args.stage}")
        return 1

    print("Skill Audit")
    for item in candidates:
        skill_name = skill_id_to_name(item.get("id", ""))
        installed = local_skill_exists(skill_name)
        source = item.get("source", "unknown")
        priority = item.get("priority", "unknown")
        state = "installed" if installed else "not-installed"
        print(f"{skill_name}: {state} ({priority}, {source})")
        if not installed and item.get("install"):
            print(f"  install after review: {item['install']}")
    return 0


def render_skill_review(skill: dict) -> str:
    skill_id = skill.get("id", "")
    install = skill.get("install", "N/A")
    stages = ", ".join(skill.get("stage", [])) or "tooling"
    tags = ", ".join(skill.get("tags", [])) or "none"
    return "\n".join(
        [
            f"# Skill Review: {skill_id}",
            "",
            "## Candidate",
            "",
            f"- Source: {skill.get('source', 'unknown')}",
            f"- Priority: {skill.get('priority', 'unknown')}",
            f"- Stages: {stages}",
            f"- Tags: {tags}",
            f"- Summary: {skill.get('summary', '')}",
            f"- Install command: `{install}`",
            "",
            "## Review Checklist",
            "",
            "- [ ] Read the upstream `SKILL.md` before installation.",
            "- [ ] Check whether it duplicates a local core skill.",
            "- [ ] Check whether it asks for broad filesystem, command, network, browser, or credential access.",
            "- [ ] Check whether it can upload private contest data or generated paper content.",
            "- [ ] Check whether it encourages unsupported claims, invented sources, or prose-first writing.",
            "- [ ] Confirm it preserves the LaTeX-first and evidence-ledger workflow.",
            "",
            "## Decision",
            "",
            "- Status: pending",
            "- Decision owner: TODO",
            "- Decision date: TODO",
            "- Adopt for stages: TODO",
            "- Rejection reason, if rejected: TODO",
            "",
            "## Notes",
            "",
            "TODO",
            "",
        ]
    )


def skill_review(args: argparse.Namespace) -> int:
    skill = find_skill_candidate(args.skill_id)
    if not skill:
        print(f"Skill candidate not found: {args.skill_id}")
        return 1

    path = skill_review_path(skill.get("id", args.skill_id))
    if path.exists() and not args.force:
        print(f"Review already exists: {path}")
        print("Use --force to replace it.")
        return 2
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(render_skill_review(skill), encoding="utf-8")
    print(f"Skill review written: {path}")
    return 0


def copy_path_for_package(source: Path, destination: Path) -> None:
    if not source.exists():
        raise FileNotFoundError(source)
    if source.is_dir():
        if destination.exists():
            shutil.rmtree(destination)
        ignore = shutil.ignore_patterns(
            "__pycache__",
            "*.pyc",
            ".git",
            "bin",
            "obj",
            "providers.local.json",
        )
        shutil.copytree(source, destination, ignore=ignore)
    else:
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, destination)


def portable_manifest(files: list[str]) -> str:
    lines = [
        "# Paper OS Portable Package",
        "",
        "This folder is generated by `python paperctl.py package-app`.",
        "",
        "## Run",
        "",
        "```powershell",
        ".\\PaperOS.exe",
        "```",
        "",
        "## Notes",
        "",
        "- Opens a native IDE window (WebView2). Does not launch a browser tab.",
        "- Requires Node.js 20+ on the target machine.",
        "- Requires Python and latexmk for full verification/build workflows.",
        "- Does not include `contests/` workspaces or private contest data.",
        "- Configure model access in the IDE settings or with `python paperctl.py provider-set`.",
        "",
        "## Included Paths",
        "",
    ]
    lines.extend(f"- `{item}`" for item in files)
    lines.append("")
    return "\n".join(lines)


def package_app(args: argparse.Namespace) -> int:
    destination = Path(args.output).resolve() if args.output else DIST / "PaperOS-portable"
    root_resolved = ROOT.resolve()
    destination_resolved = destination.resolve()
    try:
        if destination_resolved.exists() and not destination_resolved.is_dir():
            print(f"Output path exists and is not a directory: {destination_resolved}")
            return 2
        if destination_resolved == root_resolved or root_resolved in destination_resolved.parents:
            if destination_resolved.exists():
                shutil.rmtree(destination_resolved)
        elif destination_resolved.exists() and not args.force:
            print(f"Output exists outside workspace: {destination_resolved}")
            print("Use --force to replace it.")
            return 2
        elif destination_resolved.exists():
            shutil.rmtree(destination_resolved)
    except OSError as exc:
        print(f"Package output cannot be prepared: {exc}")
        return 2

    files = [
        "app",
        "apps",
        "docs",
        "product",
        "templates",
        "tests",
        "launcher",
        "paperctl.py",
        "package.json",
        "build-launcher.ps1",
        "README.md",
        ".impeccable.md",
    ]
    if (ROOT / "PaperOS.exe").exists():
        files.insert(0, "PaperOS.exe")
        for launcher_file in [
            "PaperOS.dll",
            "PaperOS.deps.json",
            "PaperOS.runtimeconfig.json",
        ]:
            if (ROOT / launcher_file).exists():
                files.insert(1, launcher_file)
        for wv in [
            "Microsoft.Web.WebView2.Core.dll",
            "Microsoft.Web.WebView2.WinForms.dll",
            "Microsoft.Web.WebView2.Wpf.dll",
        ]:
            if (ROOT / wv).exists():
                files.append(wv)
        if (ROOT / "runtimes").exists():
            files.append("runtimes")
    try:
        destination_resolved.mkdir(parents=True, exist_ok=True)
        for relative in files:
            copy_path_for_package(ROOT / relative, destination_resolved / relative)

        # Never ship local runtime data (accounts, sessions, community posts).
        packaged_data = destination_resolved / "app" / "data"
        if packaged_data.exists():
            shutil.rmtree(packaged_data, ignore_errors=True)

        (destination_resolved / "PORTABLE_README.md").write_text(portable_manifest(files), encoding="utf-8")
    except (OSError, shutil.Error) as exc:
        print(f"Package failed: {exc}")
        return 2
    print(f"Portable package written: {destination_resolved}")
    print("Private contest workspaces are intentionally excluded.")
    return 0


def path_is_inside(base: Path, candidate: Path) -> bool:
    base_resolved = base.resolve()
    candidate_resolved = candidate.resolve()
    return candidate_resolved == base_resolved or base_resolved in candidate_resolved.parents


def verification_counts(report: str) -> dict[str, int]:
    counts = {"PASS": 0, "WARN": 0, "FAIL": 0}
    for line in report.splitlines():
        for level in counts:
            prefix = f"- {level}: "
            if line.startswith(prefix):
                try:
                    counts[level] = int(line.removeprefix(prefix).strip())
                except ValueError:
                    counts[level] = 0
    return counts


def copy_submission_path(source: Path, destination: Path, package_root: Path) -> list[str]:
    copied: list[str] = []
    if not source.exists():
        return copied
    if source.is_dir():
        ignore = shutil.ignore_patterns("__pycache__", "*.pyc", ".git", ".gitkeep")
        if destination.exists():
            shutil.rmtree(destination)
        shutil.copytree(source, destination, ignore=ignore)
        for path in destination.rglob("*"):
            if path.is_file():
                copied.append(path.relative_to(package_root).as_posix())
    else:
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, destination)
        copied.append(destination.relative_to(package_root).as_posix())
    return copied


def submission_manifest(
    contest_id: str,
    target: Path,
    destination: Path,
    build_skipped: bool,
    warnings_allowed: bool,
    counts: dict[str, int],
    copied_files: list[str],
    missing_optional: list[str],
) -> str:
    generated_at = dt.datetime.now().isoformat(timespec="seconds")
    lines = [
        "# Submission Package Manifest",
        "",
        f"Contest: `{contest_id}`",
        f"Generated: `{generated_at}`",
        f"Source workspace: `{target}`",
        "",
        "## Verification",
        "",
        f"- Build skipped: {'yes' if build_skipped else 'no'}",
        f"- Warnings allowed: {'yes' if warnings_allowed else 'no'}",
        f"- PASS: {counts.get('PASS', 0)}",
        f"- WARN: {counts.get('WARN', 0)}",
        f"- FAIL: {counts.get('FAIL', 0)}",
        "",
        "## Required Final Artifacts",
        "",
        "- `paper/main.pdf`",
        "- `paper/main.tex`",
        "- `paper/sections/`",
        "- `paper/refs.bib`",
        "- `state/verification-report.md`",
        "- `state/result-ledger.csv`",
        "- `state/figure-ledger.csv`",
        "- `state/claim-ledger.csv`",
        "- `src/`",
        "- `figures/`",
        "- `runs/`",
        "",
        "## Included Files",
        "",
    ]
    lines.extend(f"- `{path}`" for path in sorted(copied_files))
    if missing_optional:
        lines.extend(["", "## Missing Optional Paths", ""])
        lines.extend(f"- `{path}`" for path in sorted(missing_optional))
    lines.extend(
        [
            "",
            "## Operator Notes",
            "",
            "- Inspect the PDF and manifest before uploading to a contest system.",
            "- If the contest requires a renamed paper file, rename a copy outside this package.",
            "- Do not submit if `FAIL` is nonzero or if warnings are not intentional.",
            "",
        ]
    )
    return "\n".join(lines)


def package_submission(args: argparse.Namespace) -> int:
    target = contest_dir(args.contest_id)
    if not target.exists():
        print(f"Missing contest workspace: {target}")
        return 2

    if not args.skip_build:
        build_code = build_contest(argparse.Namespace(contest_id=args.contest_id))
        if build_code != 0:
            print("Build failed; submission package was not created.")
            print("Use --skip-build only if paper/main.pdf already exists and you accept the risk.")
            return build_code

    pdf_path = target / "paper" / "main.pdf"
    if not pdf_path.exists():
        print("Missing paper/main.pdf; build the paper or provide --skip-build only after a PDF exists.")
        return 2

    pipeline_path = target / "state" / "pipeline-report.md"
    pipeline_path.parent.mkdir(parents=True, exist_ok=True)
    pipeline_path.write_text(render_pipeline_report(args.contest_id, target), encoding="utf-8")

    verify_code = verify_contest(argparse.Namespace(contest_id=args.contest_id))
    report_path = target / "state" / "verification-report.md"
    report = read_text_if_exists(report_path, max_chars=100000)
    counts = verification_counts(report)
    if verify_code != 0 or counts.get("FAIL", 0) > 0:
        print("Verification has FAIL items; submission package was not created.")
        return 1
    if counts.get("WARN", 0) > 0 and not args.allow_warnings:
        print("Verification has WARN items. Re-run with --allow-warnings only after reviewing them.")
        return 1

    destination = Path(args.output).resolve() if args.output else target / "submission-package"
    destination_resolved = destination.resolve()
    root_resolved = ROOT.resolve()

    required_sources = [
        "paper/main.pdf",
        "paper/main.tex",
        "paper/refs.bib",
        "paper/sections",
        "state/result-ledger.csv",
        "state/figure-ledger.csv",
        "state/claim-ledger.csv",
        "state/source-ledger.csv",
        "state/verification-report.md",
        "src",
        "figures",
        "runs",
    ]
    missing_required = [relative for relative in required_sources if not (target / relative).exists()]
    if missing_required:
        print(f"Missing required submission artifacts: {', '.join(missing_required)}")
        return 2

    source_roots = [
        target / "paper",
        target / "state",
        target / "src",
        target / "figures",
        target / "runs",
        target / "tables",
        target / "problem",
        target / "data",
        target / "references",
    ]
    if any(path_is_inside(source, destination_resolved) for source in source_roots if source.exists()):
        print(f"Output path cannot be inside a source artifact directory: {destination_resolved}")
        return 2

    try:
        if destination_resolved.exists() and not destination_resolved.is_dir():
            print(f"Output path exists and is not a directory: {destination_resolved}")
            return 2
        if path_is_inside(root_resolved, destination_resolved):
            if destination_resolved.exists():
                shutil.rmtree(destination_resolved)
        elif destination_resolved.exists() and not args.force:
            print(f"Output exists outside workspace: {destination_resolved}")
            print("Use --force to replace it.")
            return 2
        elif destination_resolved.exists():
            shutil.rmtree(destination_resolved)
        destination_resolved.mkdir(parents=True, exist_ok=True)
    except OSError as exc:
        print(f"Submission package output cannot be prepared: {exc}")
        return 2

    copy_plan = [
        ("contest-rules.md", "contest-rules.md"),
        ("problem/problem.md", "problem/problem.md"),
        ("data/raw", "data/raw"),
        ("references", "references"),
        ("paper/main.pdf", "paper/main.pdf"),
        ("paper/main.tex", "paper/main.tex"),
        ("paper/refs.bib", "paper/refs.bib"),
        ("paper/Makefile", "paper/Makefile"),
        ("paper/sections", "paper/sections"),
        ("state/problem-map.md", "state/problem-map.md"),
        ("state/modeling-plan.md", "state/modeling-plan.md"),
        ("state/result-ledger.csv", "state/result-ledger.csv"),
        ("state/figure-ledger.csv", "state/figure-ledger.csv"),
        ("state/claim-ledger.csv", "state/claim-ledger.csv"),
        ("state/source-ledger.csv", "state/source-ledger.csv"),
        ("state/ai-run-ledger.csv", "state/ai-run-ledger.csv"),
        ("state/verification-report.md", "state/verification-report.md"),
        ("state/pipeline-report.md", "state/pipeline-report.md"),
        ("src", "src"),
        ("figures", "figures"),
        ("tables", "tables"),
        ("runs", "runs"),
    ]

    copied_files: list[str] = []
    missing_optional: list[str] = []
    try:
        for source_relative, destination_relative in copy_plan:
            source = target / source_relative
            destination_item = destination_resolved / destination_relative
            if not source.exists():
                missing_optional.append(source_relative)
                continue
            copied_files.extend(copy_submission_path(source, destination_item, destination_resolved))
        manifest = submission_manifest(
            args.contest_id,
            target,
            destination_resolved,
            args.skip_build,
            args.allow_warnings,
            counts,
            copied_files,
            missing_optional,
        )
        (destination_resolved / "SUBMISSION_MANIFEST.md").write_text(manifest, encoding="utf-8")
    except (OSError, shutil.Error) as exc:
        print(f"Submission package failed: {exc}")
        return 2

    print(f"Package written: {destination_resolved}")
    print("Review SUBMISSION_MANIFEST.md and paper/main.pdf before upload.")
    return 0


def non_empty_text_file(path: Path) -> bool:
    return path.exists() and bool(path.read_text(encoding="utf-8", errors="replace").strip())


def has_non_gitkeep_file(path: Path) -> bool:
    return path.exists() and any(child.is_file() and child.name != ".gitkeep" for child in path.iterdir())


def csv_has_rows(path: Path) -> bool:
    if not path.exists():
        return False
    try:
        _, rows = read_csv(path)
    except csv.Error:
        return False
    return bool(rows)


def latex_has_todo(target: Path) -> bool:
    paper_dir = target / "paper"
    if not paper_dir.exists():
        return True
    for path in paper_dir.rglob("*.tex"):
        if "TODO" in path.read_text(encoding="utf-8", errors="replace"):
            return True
    return False


def stage_status(target: Path) -> dict[str, tuple[str, str]]:
    statuses: dict[str, tuple[str, str]] = {}

    intake_done = all(
        non_empty_text_file(target / relative)
        for relative in [
            "contest-rules.md",
            "problem/problem.md",
            "state/problem-map.md",
            "state/modeling-plan.md",
        ]
    )
    statuses["intake"] = ("done" if intake_done else "todo", "problem/rules/map/plan files are populated" if intake_done else "populate official problem, rules, problem-map, and modeling-plan")

    modeling_done = csv_has_rows(target / "state" / "result-ledger.csv") and has_non_gitkeep_file(target / "src") and has_non_gitkeep_file(target / "runs")
    statuses["modeling"] = ("done" if modeling_done else "todo", "result ledger, scripts, and run artifacts exist" if modeling_done else "create scripts, run artifacts, and result-ledger rows")

    figure_done = csv_has_rows(target / "state" / "figure-ledger.csv") and has_non_gitkeep_file(target / "figures")
    statuses["figure"] = ("done" if figure_done else "todo", "figure ledger and generated figures exist" if figure_done else "generate figures and register them in figure-ledger")

    writing_done = csv_has_rows(target / "state" / "claim-ledger.csv") and not latex_has_todo(target)
    statuses["writing"] = ("done" if writing_done else "in_progress", "claim ledger exists and LaTeX has no TODO markers" if writing_done else "finish LaTeX sections and remove TODO markers after evidence is ready")

    verification_report = target / "state" / "verification-report.md"
    report_text = read_text_if_exists(verification_report, max_chars=6000)
    verification_ready = (target / "paper" / "main.pdf").exists() and "- FAIL: 0" in report_text
    if writing_done and verification_ready:
        statuses["verification"] = ("done", "PDF exists and latest verification report has zero FAIL")
    elif verification_ready:
        statuses["verification"] = ("blocked", "verification has zero FAIL but writing still has TODO/evidence gaps")
    else:
        statuses["verification"] = ("todo", "run verify and build; resolve FAIL items before submission")

    return statuses


def status_contest(args: argparse.Namespace) -> int:
    target = contest_dir(args.contest_id)
    if not target.exists():
        print(f"Missing contest workspace: {target}")
        return 2

    statuses = stage_status(target)
    print(f"Contest: {args.contest_id}")
    for stage in STAGE_ORDER:
        state, note = statuses[stage]
        print(f"{stage}: {state} - {note}")

    next_stage = next((stage for stage in STAGE_ORDER if statuses[stage][0] != "done"), None)
    if next_stage:
        kb = load_knowledge_base()
        gate = next((item for item in kb.get("stage_gates", []) if item.get("stage") == next_stage), {})
        print(f"Next stage: {next_stage}")
        if gate.get("next"):
            print(f"Recommended next action: {gate['next']}")
        print(f"Useful commands:")
        print(f"  python paperctl.py stage-prompt {args.contest_id} {next_stage}")
        print(f"  python paperctl.py recommend-skills {next_stage}")
        print(f"  python paperctl.py recommend-mcp {next_stage}")
    else:
        print("All configured stages are marked done. Run verify/build again before final submission.")
    return 0


def clean_contest(args: argparse.Namespace) -> int:
    target = contest_dir(args.contest_id)
    paper_dir = target / "paper"
    if not paper_dir.exists():
        print(f"Missing paper directory: {paper_dir}")
        return 2

    latexmk = shutil.which("latexmk")
    if latexmk:
        flag = "-C" if args.all else "-c"
        return subprocess.run([latexmk, flag], cwd=paper_dir, text=True).returncode

    patterns = [
        "*.aux",
        "*.bbl",
        "*.blg",
        "*.fls",
        "*.fdb_latexmk",
        "*.log",
        "*.out",
        "*.toc",
    ]
    if args.all:
        patterns.append("*.pdf")

    removed = 0
    for pattern in patterns:
        for path in paper_dir.glob(pattern):
            path.unlink()
            removed += 1
    print(f"Removed {removed} build artifact(s).")
    return 0


def doctor(_: argparse.Namespace) -> int:
    checks: list[Check] = []
    checks.append(Check("PASS", f"workspace root: {ROOT}"))

    for path in [
        TEMPLATE,
        ROOT / "product" / "config.yaml",
        ROOT / "product" / "runtime" / "providers.example.json",
        ROOT / "product" / "runtime" / "stages.json",
        ROOT / "product" / "runtime" / "pipeline.json",
        ROOT / "product" / "knowledge-base.json",
        ROOT / "product" / "workflows" / "competition-blueprint.json",
        ROOT / "product" / "mcp" / "mcp-config.example.json",
        ROOT / "docs" / "knowledge" / "skill-catalog.md",
        ROOT / "docs" / "operator-guide.md",
    ]:
        if path.exists():
            checks.append(Check("PASS", f"found {path.relative_to(ROOT)}"))
        else:
            checks.append(Check("FAIL", f"missing {path.relative_to(ROOT)}"))

    if shutil.which("python"):
        checks.append(Check("PASS", "python available"))
    else:
        checks.append(Check("FAIL", "python not found"))

    if shutil.which("latexmk"):
        checks.append(Check("PASS", "latexmk available"))
    else:
        checks.append(Check("WARN", "latexmk not found; build command will not work"))

    if shutil.which("npx"):
        checks.append(Check("PASS", "npx available for skill discovery"))
    else:
        checks.append(Check("WARN", "npx not found; external skill discovery is limited"))

    print(format_report("doctor", checks))
    return 1 if any(check.level == "FAIL" for check in checks) else 0


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Manage math modeling contest paper workspaces.",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    init_parser = subparsers.add_parser("init", help="create a contest workspace")
    init_parser.add_argument("contest_id")
    init_parser.add_argument("--force", action="store_true")
    init_parser.set_defaults(func=init_contest)

    verify_parser = subparsers.add_parser("verify", help="verify a contest workspace")
    verify_parser.add_argument("contest_id")
    verify_parser.set_defaults(func=verify_contest)

    build_parser = subparsers.add_parser("build", help="build paper PDF with latexmk")
    build_parser.add_argument("contest_id")
    build_parser.set_defaults(func=build_contest)

    clean_parser = subparsers.add_parser("clean", help="clean LaTeX build artifacts")
    clean_parser.add_argument("contest_id")
    clean_parser.add_argument("--all", action="store_true", help="also remove generated PDF")
    clean_parser.set_defaults(func=clean_contest)

    doctor_parser = subparsers.add_parser("doctor", help="check local product environment")
    doctor_parser.set_defaults(func=doctor)

    prompt_parser = subparsers.add_parser("stage-prompt", help="create a prompt package for a workflow stage")
    prompt_parser.add_argument("contest_id")
    prompt_parser.add_argument("stage")
    prompt_parser.set_defaults(func=stage_prompt)

    run_parser = subparsers.add_parser("run-stage", help="call an OpenAI-compatible provider for a workflow stage")
    run_parser.add_argument("contest_id")
    run_parser.add_argument("stage")
    run_parser.add_argument("--provider-config", default=str(DEFAULT_PROVIDER_CONFIG))
    run_parser.add_argument("--provider", default="default")
    run_parser.add_argument("--dry-run", action="store_true")
    run_parser.set_defaults(func=run_stage)

    apply_parser = subparsers.add_parser("apply-response", help="preview or apply BEGIN_FILE blocks from an AI response")
    apply_parser.add_argument("contest_id")
    apply_parser.add_argument("response_path")
    apply_parser.add_argument("--apply", action="store_true", help="write parsed file blocks into the contest workspace")
    apply_parser.set_defaults(func=apply_response)

    stages_parser = subparsers.add_parser("list-stages", help="list configured AI workflow stages")
    stages_parser.set_defaults(func=list_stages)

    provider_parser = subparsers.add_parser("provider-check", help="validate an OpenAI-compatible provider config")
    provider_parser.add_argument("--provider-config", default=str(DEFAULT_PROVIDER_CONFIG))
    provider_parser.add_argument("--provider", default="default")
    provider_parser.add_argument("--require-key", action="store_true", help="fail when the configured API key env var is missing")
    provider_parser.set_defaults(func=provider_check)

    provider_set_parser = subparsers.add_parser("provider-set", help="write an OpenAI-compatible provider config")
    provider_set_parser.add_argument("--provider-config", default=str(LOCAL_PROVIDER_CONFIG))
    provider_set_parser.add_argument("--provider", default="default")
    provider_set_parser.add_argument("--base-url", required=True)
    provider_set_parser.add_argument("--api-key-env", default="PAPER_OS_API_KEY")
    provider_set_parser.add_argument("--model", required=True)
    provider_set_parser.add_argument("--temperature", type=float, default=0.2)
    provider_set_parser.add_argument("--timeout", type=int, default=120)
    provider_set_parser.set_defaults(func=provider_set)

    ingest_parser = subparsers.add_parser("ingest", help="copy a problem/data/reference/skill file into a contest workspace")
    ingest_parser.add_argument("contest_id")
    ingest_parser.add_argument("source")
    ingest_parser.add_argument("--kind", choices=["problem", "data", "reference", "skill"], default="reference")
    ingest_parser.set_defaults(func=ingest)

    onboard_parser = subparsers.add_parser("onboard", help="create and prepare a real contest workspace")
    onboard_parser.add_argument("contest_id")
    onboard_parser.add_argument("--problem", action="append", help="official problem file; can be repeated")
    onboard_parser.add_argument("--data", action="append", help="raw data file; can be repeated")
    onboard_parser.add_argument("--reference", action="append", help="reference/rule file; can be repeated")
    onboard_parser.add_argument("--skill", action="append", help="user skill file; can be repeated")
    onboard_parser.add_argument("--force", action="store_true", help="replace an existing workspace before onboarding")
    onboard_parser.add_argument("--provider-config", default=str(DEFAULT_PROVIDER_CONFIG))
    onboard_parser.add_argument("--provider", default="default")
    onboard_parser.set_defaults(func=onboard_contest)

    mcp_audit_parser = subparsers.add_parser("mcp-audit", help="validate MCP config shape and filesystem scope")
    mcp_audit_parser.add_argument("--config", default=str(DEFAULT_MCP_CONFIG))
    mcp_audit_parser.set_defaults(func=mcp_audit)

    kb_parser = subparsers.add_parser("kb-search", help="search the local product knowledge base")
    kb_parser.add_argument("query", nargs="*", help="terms to search; omit to list top items")
    kb_parser.add_argument("--limit", type=int, default=20)
    kb_parser.set_defaults(func=kb_search)

    skill_parser = subparsers.add_parser("recommend-skills", help="recommend reviewed skill candidates for a workflow stage")
    skill_parser.add_argument("stage", choices=STAGE_ORDER + ["tooling"])
    skill_parser.set_defaults(func=recommend_skills)

    mcp_parser = subparsers.add_parser("recommend-mcp", help="recommend MCP categories for a workflow stage")
    mcp_parser.add_argument("stage", choices=STAGE_ORDER)
    mcp_parser.set_defaults(func=recommend_mcp)

    blueprint_parser = subparsers.add_parser("blueprint", help="show the product workflow blueprint")
    blueprint_parser.add_argument("lane", nargs="?", help="optional lane id or title")
    blueprint_parser.set_defaults(func=blueprint_report)

    status_parser = subparsers.add_parser("status", help="show contest workflow status and next action")
    status_parser.add_argument("contest_id")
    status_parser.set_defaults(func=status_contest)

    pipeline_parser = subparsers.add_parser("pipeline", help="write and print a stage-gate pipeline report")
    pipeline_parser.add_argument("contest_id")
    pipeline_parser.set_defaults(func=pipeline_report)

    advance_parser = subparsers.add_parser("advance", help="advance the next incomplete stage")
    advance_parser.add_argument("contest_id")
    advance_parser.add_argument("--provider-config", default=str(DEFAULT_PROVIDER_CONFIG))
    advance_parser.add_argument("--provider", default="default")
    advance_parser.add_argument("--dry-run", action="store_true", help="create the next-stage prompt without calling a provider")
    advance_parser.add_argument("--no-ai", action="store_true", help="create a manual prompt package even if provider options are configured")
    advance_parser.set_defaults(func=advance_contest)

    skill_audit_parser = subparsers.add_parser("skill-audit", help="show local installation status for recommended skills")
    skill_audit_parser.add_argument("stage", nargs="?", choices=STAGE_ORDER + ["tooling"], help="optional workflow stage filter")
    skill_audit_parser.set_defaults(func=skill_audit)

    skill_review_parser = subparsers.add_parser("skill-review", help="write a review checklist for a skill candidate")
    skill_review_parser.add_argument("skill_id", help="candidate id or local skill name")
    skill_review_parser.add_argument("--force", action="store_true")
    skill_review_parser.set_defaults(func=skill_review)

    package_parser = subparsers.add_parser("package-app", help="create a portable product folder without contest data")
    package_parser.add_argument("--output", help="output directory; defaults to dist/PaperOS-portable")
    package_parser.add_argument("--force", action="store_true", help="replace existing output outside the workspace")
    package_parser.set_defaults(func=package_app)

    submission_parser = subparsers.add_parser("package-submission", help="create a final contest submission package")
    submission_parser.add_argument("contest_id")
    submission_parser.add_argument("--output", help="output directory; defaults to contests/<id>/submission-package")
    submission_parser.add_argument("--skip-build", action="store_true", help="do not run latexmk before packaging")
    submission_parser.add_argument("--allow-warnings", action="store_true", help="allow verification WARN items after review")
    submission_parser.add_argument("--force", action="store_true", help="replace existing output outside the workspace")
    submission_parser.set_defaults(func=package_submission)

    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv or sys.argv[1:])
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
