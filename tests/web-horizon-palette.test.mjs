import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const shaderSources = [
  "HorizonBackground.jsx",
  "AuroraBackground.jsx",
].map((name) => ({
  name,
  source: readFileSync(
    new URL(`../web/src/components/${name}`, import.meta.url),
    "utf8",
  ),
}));

for (const { name, source } of shaderSources) {
  test(`${name} keeps the warm band below the horizon and fades it upward`, () => {
    assert.match(source, /float d = uv\.y - edge;/);
    assert.match(source, /float band = 1\.0 - smoothstep\(0\.0, 0\.42, d\);/);
  });

  test(`${name} only uses ordered literal smoothstep edges`, () => {
    const literalCalls = [...source.matchAll(
      /smoothstep\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*,/g,
    )];
    assert.ok(literalCalls.length > 0, "expected literal smoothstep calls");
    for (const [, edge0, edge1] of literalCalls) {
      assert.ok(
        Number(edge0) < Number(edge1),
        `smoothstep edges must be ascending: ${edge0}, ${edge1}`,
      );
    }
  });
}
