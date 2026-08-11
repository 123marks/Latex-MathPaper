import assert from "node:assert/strict";
import { createPublicKey, verify as cryptoVerify } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { createSigner } from "../app/lib/signer.mjs";

test("Ed25519 signer signs, verifies, and rejects tampering", () => {
  const dir = mkdtempSync(join(tmpdir(), "paperos-sign-"));
  try {
    const signer = createSigner({ keyPath: join(dir, ".signing-key.pem") });
    assert.equal(signer.algorithm, "ed25519");
    const msg = JSON.stringify({ version: "0.5.0", asset: "PaperOS.exe", sha256: "abc" });
    const sig = signer.sign(msg);
    assert.ok(sig.length > 0);
    assert.equal(signer.verify(msg, sig), true);
    assert.equal(signer.verify(msg + "x", sig), false, "tampered message must fail");
    assert.equal(signer.verify(msg, "AAAA"), false, "bad signature must fail");

    // The published base64 SPKI key verifies independently with node:crypto.
    const pub = createPublicKey({ key: Buffer.from(signer.publicKeyBase64, "base64"), format: "der", type: "spki" });
    assert.equal(
      cryptoVerify(null, Buffer.from(msg, "utf-8"), pub, Buffer.from(sig, "base64")),
      true,
      "external verifier must accept the published public key",
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("signing key persists (0600) and is reused across instances", () => {
  const dir = mkdtempSync(join(tmpdir(), "paperos-sign-"));
  const keyPath = join(dir, ".signing-key.pem");
  try {
    const a = createSigner({ keyPath });
    const b = createSigner({ keyPath });
    assert.equal(a.publicKeyBase64, b.publicKeyBase64, "second instance reuses the persisted key");
    const sig = a.sign("hello");
    assert.equal(b.verify("hello", sig), true);
    assert.match(readFileSync(keyPath, "utf-8"), /BEGIN PRIVATE KEY/);
    if (process.platform !== "win32") {
      assert.equal(statSync(keyPath).mode & 0o777, 0o600);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("PAPER_OS_SIGNING_KEY env overrides the on-disk key", async () => {
  const dir = mkdtempSync(join(tmpdir(), "paperos-sign-"));
  const keyPath = join(dir, ".signing-key.pem");
  const previous = process.env.PAPER_OS_SIGNING_KEY;
  try {
    // Seed a persisted key, capture its identity, then override via env.
    const disk = createSigner({ keyPath });
    const diskPub = disk.publicKeyBase64;
    const { generateKeyPairSync } = await import("node:crypto");
    const { privateKey } = generateKeyPairSync("ed25519");
    process.env.PAPER_OS_SIGNING_KEY = privateKey.export({ type: "pkcs8", format: "pem" });
    const env = createSigner({ keyPath });
    assert.notEqual(env.publicKeyBase64, diskPub, "env key must take precedence over disk");
  } finally {
    if (previous === undefined) delete process.env.PAPER_OS_SIGNING_KEY;
    else process.env.PAPER_OS_SIGNING_KEY = previous;
    rmSync(dir, { recursive: true, force: true });
  }
});
