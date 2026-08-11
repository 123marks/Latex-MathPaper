import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

async function loadStatusModule() {
  return import("../app/lib/modeling-status.mjs");
}

test("empty modeling Workspace reports the intake gate first", async (t) => {
  const root = mkdtempSync(join(tmpdir(), "paperos-modeling-empty-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const { readModelingStatus } = await loadStatusModule();
  const status = readModelingStatus(root);

  assert.equal(status.statuses.intake.state, "todo");
  assert.equal(status.statuses.writing.state, "in_progress");
  assert.equal(status.nextStage, "intake");
});

test("populated modeling Workspace reports every stage done", async (t) => {
  const root = mkdtempSync(join(tmpdir(), "paperos-modeling-done-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const path of ["problem", "state", "src", "runs", "figures", "paper/sections"]) {
    mkdirSync(join(root, path), { recursive: true });
  }
  for (const path of ["contest-rules.md", "problem/problem.md", "state/problem-map.md", "state/modeling-plan.md"]) {
    writeFileSync(join(root, path), "complete\n", "utf8");
  }
  writeFileSync(join(root, "state/result-ledger.csv"), "id,value\nr1,1\n", "utf8");
  writeFileSync(join(root, "state/figure-ledger.csv"), "id,path\nf1,figures/a.png\n", "utf8");
  writeFileSync(join(root, "state/claim-ledger.csv"), "id,claim\nc1,complete\n", "utf8");
  writeFileSync(join(root, "state/verification-report.md"), "- FAIL: 0\n", "utf8");
  writeFileSync(join(root, "src/model.py"), "print(1)\n", "utf8");
  writeFileSync(join(root, "runs/result.txt"), "1\n", "utf8");
  writeFileSync(join(root, "figures/a.png"), "fixture\n", "utf8");
  writeFileSync(join(root, "paper/sections/main.tex"), "Complete document.\n", "utf8");
  writeFileSync(join(root, "paper/main.pdf"), "fixture\n", "utf8");

  const { readModelingStatus } = await loadStatusModule();
  const status = readModelingStatus(root);

  assert.deepEqual(
    Object.fromEntries(Object.entries(status.statuses).map(([stage, value]) => [stage, value.state])),
    { intake: "done", modeling: "done", figure: "done", writing: "done", verification: "done" },
  );
  assert.equal(status.nextStage, "");
});
