import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  describeDangerousTerminalCommand,
  isDangerousTerminalCommand,
  parseTerminalSse,
  validateTerminalCommand,
} from "../app/lib/terminal.mjs";

const ideSource = readFileSync(new URL("../apps/desktop/src/ide.jsx", import.meta.url), "utf8");
const buildScript = readFileSync(new URL("../apps/desktop/build-ide.mjs", import.meta.url), "utf8");
const packCatalog = JSON.parse(readFileSync(new URL("../product/workspace-packs.json", import.meta.url), "utf8"));

function slice(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.ok(start >= 0, `missing marker ${startMarker}`);
  const end = source.indexOf(endMarker, start);
  assert.ok(end > start, `missing end marker ${endMarker}`);
  return source.slice(start, end);
}

test("dangerous commands are named before confirm; read-only git stays quiet", () => {
  assert.equal(isDangerousTerminalCommand("git status"), false);
  assert.equal(isDangerousTerminalCommand("git log"), false);
  assert.equal(isDangerousTerminalCommand("node -v"), false);
  assert.equal(isDangerousTerminalCommand("rm -rf ."), false);
  assert.equal(isDangerousTerminalCommand("git reset --hard"), true);
  assert.equal(isDangerousTerminalCommand("git push origin main"), true);
  assert.equal(isDangerousTerminalCommand("npm install"), true);
  assert.match(describeDangerousTerminalCommand(validateTerminalCommand("git commit -m x")), /改写/);
});

test("terminal SSE frames keep event names", () => {
  const parsed = parseTerminalSse("event: stdout\ndata: {\"text\":\"ok\"}\n\nevent: exit\ndata: {\"code\":0}\n\npartial");
  assert.deepEqual(parsed.frames.map((frame) => frame.event), ["stdout", "exit"]);
  assert.equal(parsed.frames[0].data.text, "ok");
  assert.equal(parsed.rest, "partial");
});

test("desktop IDE aliases terminal policy and does not claim a full shell", () => {
  assert.match(buildScript, /["']terminal-policy["']\s*:/);
  assert.match(ideSource, /from "terminal-policy"/);
  assert.match(ideSource, /\/api\/editor\/terminal/);
  assert.match(ideSource, /\/api\/editor\/git-status\?workspace=/);
  assert.match(ideSource, /terminal-tab/);
  assert.match(ideSource, /data-testid="terminal-input"/);
  assert.match(ideSource, /data-testid="terminal-abort"/);
  assert.match(ideSource, /data-testid="status-git"/);
  assert.match(ideSource, /白名单/);
  assert.match(ideSource, /无 shell/);
  assert.match(ideSource, /不是完整 shell/);
  assert.doesNotMatch(ideSource, /完整交互式 shell|full interactive shell/i);
  for (const pack of packCatalog.packs) {
    assert.ok(!pack.capabilities.includes("terminal"), `${pack.id} must not claim a full terminal Capability`);
  }
});

test("safe terminal runs skip confirm; mutating git asks first", () => {
  const runFn = slice(ideSource, "async function runTerminal(", "function jumpToFile(");
  assert.match(runFn, /isDangerousTerminalCommand/);
  assert.match(runFn, /confirm\(/);
  assert.match(runFn, /AbortController/);
  assert.doesNotMatch(runFn, /shell:\s*true/);
});

test("status bar git chip distinguishes a missing repo from a real branch", () => {
  const bar = slice(ideSource, '<div className="statusbar">', "{/* Magnifier / Evidence drawer */}");
  assert.match(bar, /data-testid="status-git"/);
  assert.match(bar, /非 git/);
  assert.match(bar, /gitStatus\.branch/);
  assert.match(bar, /dirtyCount/);
});
