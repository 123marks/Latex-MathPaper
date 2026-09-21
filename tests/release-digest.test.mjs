import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import test from "node:test";

import { readReleaseDigest, readSidecarSha256 } from "../app/lib/release-digest.mjs";

test("missing artifacts stay unavailable", () => {
  const missing = readReleaseDigest(join(tmpdir(), "paperos-no-such-release.bin"));
  assert.equal(missing.available, false);
  assert.equal(missing.size, 0);
  assert.equal(missing.sha256, "");
  assert.equal(missing.source, "missing");
});

test("sidecar hash is used instead of hashing the whole file", () => {
  const dir = join(tmpdir(), `paperos-digest-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, "PaperOS-test.zip");
  const bytes = Buffer.from("not-a-real-zip-but-enough-for-digest");
  writeFileSync(file, bytes);
  const expected = "a".repeat(64);
  writeFileSync(`${file}.sha256`, `${expected}  PaperOS-test.zip\n`);
  const digest = readReleaseDigest(file);
  assert.equal(digest.available, true);
  assert.equal(digest.size, bytes.length);
  assert.equal(digest.sha256, expected);
  assert.equal(digest.source, "sidecar");
  assert.equal(readSidecarSha256(`${file}.sha256`), expected);
});

test("files without a sidecar fall back to a computed digest", () => {
  const dir = join(tmpdir(), `paperos-digest-computed-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, "plain.bin");
  const bytes = Buffer.from("plain-release-bytes");
  writeFileSync(file, bytes);
  const digest = readReleaseDigest(file);
  assert.equal(digest.source, "computed");
  assert.equal(digest.sha256, createHash("sha256").update(bytes).digest("hex"));
});
