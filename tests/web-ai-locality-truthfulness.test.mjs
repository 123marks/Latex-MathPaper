import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import test from "node:test";

// Product boundary: Workspace files and LaTeX compilation are local, but model
// inference is NOT local — it goes to the user's configured OpenAI-compatible
// provider. No page may claim AI inference runs on the user's machine, that AI
// works fully offline, or that data never leaves the machine.
const SRC_ROOT = resolve("web/src");

function collectSources(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectSources(full));
    else if (/\.(jsx?|tsx?)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const FORBIDDEN = [
  { name: "AI inference before locality", re: /AI\s*推理[^。\n]{0,24}(本机|本地|你(自己)?的机器|你电脑|CPU)/ },
  { name: "locality before AI inference", re: /(本机|本地|你(自己)?的机器|你电脑)[^。\n]{0,24}AI\s*推理/ },
  { name: "AI writing runs locally", re: /AI\s*写作[^。\n]{0,24}(在本地|本机|你电脑的\s*CPU)/ },
  { name: "data never leaves machine", re: /数据不出本机/ },
  { name: "server does zero compute", re: /服务器零算力/ },
];

test("no web source claims local AI inference, offline AI, or data-never-leaves", () => {
  const violations = [];
  for (const file of collectSources(SRC_ROOT)) {
    const source = readFileSync(file, "utf8");
    for (const rule of FORBIDDEN) {
      if (rule.re.test(source)) {
        violations.push(`${file.replace(SRC_ROOT, "web/src")} :: ${rule.name}`);
      }
    }
  }
  assert.deepEqual(violations, [], `AI-locality claims found:\n${violations.join("\n")}`);
});
