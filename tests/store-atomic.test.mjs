import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { createStore } from "../app/lib/store.mjs";

test("store round-trips and defaults to initial on missing/corrupt files", () => {
  const dir = mkdtempSync(join(tmpdir(), "paperos-store-"));
  const file = join(dir, "data.json");
  try {
    const store = createStore(file, { items: [] });
    assert.deepEqual(store.read(), { items: [] }, "missing file -> initial clone");
    store.write({ items: [1, 2, 3] });
    assert.deepEqual(store.read(), { items: [1, 2, 3] });

    // Corrupt content must not throw; falls back to the initial shape.
    writeFileSync(file, "{ this is not json", "utf-8");
    assert.deepEqual(store.read(), { items: [] });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("update is a serialized read-modify-write", () => {
  const dir = mkdtempSync(join(tmpdir(), "paperos-store-"));
  const file = join(dir, "counter.json");
  try {
    const store = createStore(file, { n: 0 });
    for (let i = 0; i < 50; i++) store.update((d) => { d.n += 1; return d; });
    assert.equal(store.read().n, 50);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("writes are atomic and leave no temp files behind", () => {
  const dir = mkdtempSync(join(tmpdir(), "paperos-store-"));
  const file = join(dir, "atomic.json");
  try {
    const store = createStore(file, {});
    for (let i = 0; i < 10; i++) store.write({ tick: i });
    // Only the target file should remain — no dangling .tmp artifacts.
    const leftovers = readdirSync(dir).filter((n) => n.includes(".tmp"));
    assert.deepEqual(leftovers, [], `unexpected temp files: ${leftovers.join(", ")}`);
    // The file is always complete, parseable JSON.
    assert.deepEqual(JSON.parse(readFileSync(file, "utf-8")), { tick: 9 });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
