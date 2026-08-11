import { generateKeyPairSync, createPrivateKey, createPublicKey, sign as cryptoSign, verify as cryptoVerify } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

// Ed25519 signer for release manifests (and any artifact that must be
// verifiable offline). The private key is generated once and persisted as a
// PKCS#8 PEM with 0600 perms; operators may instead supply PAPER_OS_SIGNING_KEY
// (a PKCS#8 PEM) to control the identity across machines. The public key is
// safe to publish so clients / the desktop launcher can verify downloads.
export function createSigner({ keyPath } = {}) {
  let privateKey;

  function loadFromEnv() {
    const pem = process.env.PAPER_OS_SIGNING_KEY;
    if (!pem) return null;
    try {
      return createPrivateKey({ key: pem, format: "pem" });
    } catch {
      return null;
    }
  }

  function loadFromDisk() {
    if (!keyPath || !existsSync(keyPath)) return null;
    try {
      return createPrivateKey({ key: readFileSync(keyPath, "utf-8"), format: "pem" });
    } catch {
      return null;
    }
  }

  function generateAndPersist() {
    const { privateKey: priv } = generateKeyPairSync("ed25519");
    if (keyPath) {
      const pem = priv.export({ type: "pkcs8", format: "pem" });
      mkdirSync(dirname(keyPath), { recursive: true });
      writeFileSync(keyPath, pem, { mode: 0o600 });
      try { chmodSync(keyPath, 0o600); } catch { /* non-POSIX */ }
    }
    return priv;
  }

  privateKey = loadFromEnv() || loadFromDisk() || generateAndPersist();
  const publicKey = createPublicKey(privateKey);
  const publicKeyPem = publicKey.export({ type: "spki", format: "pem" }).toString();
  // Compact base64 of the raw SPKI DER — handy for embedding in clients.
  const publicKeyBase64 = publicKey.export({ type: "spki", format: "der" }).toString("base64");

  function sign(message) {
    // Ed25519 signs the message directly (no pre-hash), algorithm arg is null.
    return cryptoSign(null, Buffer.from(String(message), "utf-8"), privateKey).toString("base64");
  }

  function verify(message, signatureBase64) {
    try {
      return cryptoVerify(
        null,
        Buffer.from(String(message), "utf-8"),
        publicKey,
        Buffer.from(String(signatureBase64), "base64"),
      );
    } catch {
      return false;
    }
  }

  return { sign, verify, publicKeyPem, publicKeyBase64, algorithm: "ed25519" };
}
