import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const ideSource = readFileSync(new URL("../apps/desktop/src/ide.jsx", import.meta.url), "utf8");
const buildScript = readFileSync(new URL("../apps/desktop/build-ide.mjs", import.meta.url), "utf8");
const cssSource = readFileSync(new URL("../apps/desktop/src/assets/ide.css", import.meta.url), "utf8");

function slice(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.ok(start >= 0, `missing marker ${startMarker}`);
  const end = source.indexOf(endMarker, start);
  assert.ok(end > start, `missing end marker ${endMarker}`);
  return source.slice(start, end);
}

test("desktop Extensions panel is a real registry, not a decorative skill list", () => {
  assert.doesNotMatch(ideSource, /DEFAULT_SKILLS/);
  assert.doesNotMatch(ideSource, /Paper Excellence/);
  assert.doesNotMatch(ideSource, /Nature Figure/);
  assert.match(ideSource, /function ExtensionsPanel\(/);
  assert.match(ideSource, /data-testid="extensions-panel"/);
  assert.match(ideSource, /data-testid="extensions-matrix"/);
  assert.match(ideSource, /data-testid="extension-install"/);
  assert.match(ideSource, /\/api\/extensions/);
  assert.match(ideSource, /第一层：主题色 \+ 语言 id/);
  assert.match(ideSource, /不执行扩展 JS/);
  assert.match(ideSource, /不是完整 VS Code 插件兼容/);
});

test("desktop IDE aliases extensions-compat and applies theme colors plus language ids", () => {
  assert.match(buildScript, /["']extensions-compat["']\s*:/);
  assert.match(ideSource, /from "extensions-compat"/);
  assert.match(ideSource, /buildMonacoTheme/);
  assert.match(ideSource, /languageIdForFile/);
  assert.match(ideSource, /paperos-extension/);
  assert.doesNotMatch(ideSource, /new Function\(|\beval\(|createRequire\(/);
  assert.match(cssSource, /\.ext-panel-note/);
});
