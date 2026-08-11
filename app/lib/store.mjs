import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync, unlinkSync } from "node:fs";
import { dirname, basename, join } from "node:path";

// Tiny JSON-file store. Each store owns one file and reads/writes the whole
// document. This matches the product's local-first, low-dependency philosophy:
// no database engine, just reviewable JSON under app/data/.
//
// Durability: writes go to a sibling temp file and are atomically renamed over
// the target, so a crash mid-write can never leave a half-written (corrupt)
// JSON file — readers see either the old or the new complete document.
export function createStore(filePath, initial) {
  function ensureDir() {
    mkdirSync(dirname(filePath), { recursive: true });
  }
  function read() {
    if (!existsSync(filePath)) return structuredClone(initial);
    try {
      const raw = readFileSync(filePath, "utf-8");
      return raw.trim() ? JSON.parse(raw) : structuredClone(initial);
    } catch {
      // Corrupt/partial file: fall back to the initial shape rather than throw.
      return structuredClone(initial);
    }
  }
  function write(data) {
    ensureDir();
    const tmp = join(dirname(filePath), `.${basename(filePath)}.${process.pid}.${Date.now()}.tmp`);
    try {
      writeFileSync(tmp, JSON.stringify(data, null, 2), "utf-8");
      renameSync(tmp, filePath); // atomic replace on the same filesystem
    } catch (error) {
      try { if (existsSync(tmp)) unlinkSync(tmp); } catch { /* best-effort cleanup */ }
      throw error;
    }
    return data;
  }
  // Synchronous read-modify-write. Node runs this to completion without
  // interleaving (no awaits inside), so concurrent request handlers that each
  // call update() are effectively serialized per store.
  function update(mutator) {
    const data = read();
    const next = mutator(data) ?? data;
    write(next);
    return next;
  }
  return { read, write, update };
}
