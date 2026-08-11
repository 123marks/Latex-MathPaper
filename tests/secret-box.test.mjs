import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { createSecretBox } from "../app/lib/secret-box.mjs";

test("round-trips secrets and rejects tampering", () => {
  const dir = mkdtempSync(join(tmpdir(), "paperos-secret-"));
  const box = createSecretBox({ keyPath: join(dir, ".secret") });
  try {
    const secret = "sk-proj-abc123-VERY-secret-key";
    const token = box.encrypt(secret);
    assert.match(token, /^v1\./);
    assert.notEqual(token, secret);
    assert.ok(!token.includes(secret), "ciphertext must not leak plaintext");
    assert.equal(box.decrypt(token), secret);

    // Tampered ciphertext fails the GCM auth tag -> null, never throws.
    const parts = token.split(".");
    const flipped = Buffer.from(parts[3], "base64url");
    flipped[0] ^= 0xff;
    parts[3] = flipped.toString("base64url");
    assert.equal(box.decrypt(parts.join(".")), null);
    assert.equal(box.decrypt("garbage"), null);
    assert.equal(box.decrypt("v9.a.b.c"), null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("persists a 0600 key file and reuses it across instances", () => {
  const dir = mkdtempSync(join(tmpdir(), "paperos-secret-"));
  const keyPath = join(dir, ".secret");
  try {
    const box1 = createSecretBox({ keyPath });
    const token = box1.encrypt("hello");
    const box2 = createSecretBox({ keyPath });
    assert.equal(box2.decrypt(token), "hello", "a second box must read the persisted key");
    const stored = readFileSync(keyPath, "utf-8").trim();
    assert.equal(Buffer.from(stored, "base64").length, 32);
    if (process.platform !== "win32") {
      const mode = statSync(keyPath).mode & 0o777;
      assert.equal(mode, 0o600, "key file must be owner-only");
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("PAPER_OS_SECRET env overrides the on-disk key", () => {
  const dir = mkdtempSync(join(tmpdir(), "paperos-secret-"));
  const keyPath = join(dir, ".secret");
  const previous = process.env.PAPER_OS_SECRET;
  process.env.PAPER_OS_SECRET = Buffer.alloc(32, 7).toString("base64");
  try {
    const boxA = createSecretBox({ keyPath });
    const token = boxA.encrypt("env-keyed");
    // A different instance with the same env key decrypts; the on-disk file is
    // irrelevant when the env key is present.
    const boxB = createSecretBox({ keyPath });
    assert.equal(boxB.decrypt(token), "env-keyed");
  } finally {
    if (previous === undefined) delete process.env.PAPER_OS_SECRET;
    else process.env.PAPER_OS_SECRET = previous;
    rmSync(dir, { recursive: true, force: true });
  }
});
