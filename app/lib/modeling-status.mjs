import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const STAGE_ORDER = ["intake", "modeling", "figure", "writing", "verification"];

function readText(path, maxChars = Number.POSITIVE_INFINITY) {
  if (!existsSync(path)) return "";
  try {
    return readFileSync(path, "utf8").slice(0, maxChars);
  } catch {
    return "";
  }
}

function nonEmptyTextFile(path) {
  return Boolean(readText(path).trim());
}

function csvHasRows(path) {
  const lines = readText(path).split(/\r?\n/).filter((line) => line.trim());
  return lines.length > 1;
}

function hasNonGitkeepFile(path) {
  if (!existsSync(path)) return false;
  try {
    return readdirSync(path, { withFileTypes: true }).some(
      (entry) => entry.isFile() && entry.name !== ".gitkeep",
    );
  } catch {
    return false;
  }
}

function latexHasTodo(path) {
  if (!existsSync(path)) return true;
  const pending = [path];
  while (pending.length) {
    const current = pending.pop();
    let entries;
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const child = join(current, entry.name);
      if (entry.isDirectory()) pending.push(child);
      else if (entry.isFile() && entry.name.toLowerCase().endsWith(".tex") && readText(child).includes("TODO")) {
        return true;
      }
    }
  }
  return false;
}

function stage(state, note) {
  return { state, note };
}

export function readModelingStatus(workspaceRoot) {
  const root = resolve(workspaceRoot);
  const intakeDone = [
    "contest-rules.md",
    join("problem", "problem.md"),
    join("state", "problem-map.md"),
    join("state", "modeling-plan.md"),
  ].every((path) => nonEmptyTextFile(join(root, path)));

  const modelingDone =
    csvHasRows(join(root, "state", "result-ledger.csv")) &&
    hasNonGitkeepFile(join(root, "src")) &&
    hasNonGitkeepFile(join(root, "runs"));
  const figureDone =
    csvHasRows(join(root, "state", "figure-ledger.csv")) &&
    hasNonGitkeepFile(join(root, "figures"));
  const writingDone =
    csvHasRows(join(root, "state", "claim-ledger.csv")) &&
    !latexHasTodo(join(root, "paper"));
  const verificationReport = readText(join(root, "state", "verification-report.md"), 6000);
  const verificationReady =
    existsSync(join(root, "paper", "main.pdf")) && verificationReport.includes("- FAIL: 0");

  const statuses = {
    intake: intakeDone
      ? stage("done", "problem/rules/map/plan files are populated")
      : stage("todo", "populate official problem, rules, problem-map, and modeling-plan"),
    modeling: modelingDone
      ? stage("done", "result ledger, scripts, and run artifacts exist")
      : stage("todo", "create scripts, run artifacts, and result-ledger rows"),
    figure: figureDone
      ? stage("done", "figure ledger and generated figures exist")
      : stage("todo", "generate figures and register them in figure-ledger"),
    writing: writingDone
      ? stage("done", "claim ledger exists and LaTeX has no TODO markers")
      : stage("in_progress", "finish LaTeX sections and remove TODO markers after evidence is ready"),
    verification: writingDone && verificationReady
      ? stage("done", "PDF exists and latest verification report has zero FAIL")
      : verificationReady
        ? stage("blocked", "verification has zero FAIL but writing still has TODO/evidence gaps")
        : stage("todo", "run verify and build; resolve FAIL items before submission"),
  };
  const nextStage = STAGE_ORDER.find((name) => statuses[name].state !== "done") || "";
  const raw = STAGE_ORDER.map(
    (name) => `${name}: ${statuses[name].state} - ${statuses[name].note}`,
  ).join("\n");

  return { statuses, nextStage, raw };
}
