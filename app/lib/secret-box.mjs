import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

// Authenticated symmetric encryption for secrets at rest (per-user API keys).
// AES-256-GCM: confidentiality + integrity. The master key is 32 random bytes,
// sourced from PAPER_OS_SECRET (base64/hex, >=32 bytes) when provided so the
// operator controls it, otherwise generated once and persisted with 0600
// permissions. Ciphertext format (base64url): v1.<iv>.<tag>.<ciphertext>.
const VERSION = "v1";
const IV_LENGTH = 12; // GCM standard nonce length
const KEY_LENGTH = 32; // AES-256

function coerceEnvKey(raw) {
  const value = String(raw || "").trim();
  if (!value) return null;
  // Accept hex (64 chars) or base64/base64url; must decode to >=32 bytes.
  if (/^[0-9a-fA-F]{64,}$/.test(value)) {
    const buf = Buffer.from(value, "hex");
    if (buf.length >= KEY_LENGTH) return buf.subarray(0, KEY_LENGTH);
  }
  try {
    const buf = Buffer.from(value, "base64");
    if (buf.length >= KEY_LENGTH) return buf.subarray(0, KEY_LENGTH);
  } catch {
    /* not base64 */
  }
  // Fallback: use raw UTF-8 bytes if long enough (discouraged but explicit).
  const utf8 = Buffer.from(value, "utf-8");
  if (utf8.length >= KEY_LENGTH) return utf8.subarray(0, KEY_LENGTH);
  return null;
}

function loadOrCreateKey(keyPath) {
  const fromEnv = coerceEnvKey(process.env.PAPER_OS_SECRET);
  if (fromEnv) return fromEnv;
  if (keyPath && existsSync(keyPath)) {
    try {
      const stored = readFileSync(keyPath, "utf-8").trim();
      const buf = Buffer.from(stored, "base64");
      if (buf.length === KEY_LENGTH) return buf;
    } catch {
      /* regenerate below */
    }
  }
  const generated = randomBytes(KEY_LENGTH);
  if (keyPath) {
    mkdirSync(dirname(keyPath), { recursive: true });
    writeFileSync(keyPath, generated.toString("base64"), { mode: 0o600 });
    try {
      chmodSync(keyPath, 0o600);
    } catch {
      /* best-effort on platforms without POSIX perms */
    }
  }
  return generated;
}

export function createSecretBox({ keyPath } = {}) {
  const key = loadOrCreateKey(keyPath);

  function encrypt(plaintext) {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const enc = Buffer.concat([
      cipher.update(String(plaintext), "utf-8"),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return [
      VERSION,
      iv.toString("base64url"),
      tag.toString("base64url"),
      enc.toString("base64url"),
    ].join(".");
  }

  function decrypt(token) {
    const parts = String(token || "").split(".");
    if (parts.length !== 4 || parts[0] !== VERSION) return null;
    try {
      const iv = Buffer.from(parts[1], "base64url");
      const tag = Buffer.from(parts[2], "base64url");
      const data = Buffer.from(parts[3], "base64url");
      if (iv.length !== IV_LENGTH || tag.length !== 16) return null;
      const decipher = createDecipheriv("aes-256-gcm", key, iv);
      decipher.setAuthTag(tag);
      const dec = Buffer.concat([decipher.update(data), decipher.final()]);
      return dec.toString("utf-8");
    } catch {
      // Wrong key or tampered ciphertext — never expose details to the caller.
      return null;
    }
  }

  // Constant-time equality helper for comparing user-supplied secrets.
  function safeEqual(a, b) {
    const bufA = Buffer.from(String(a), "utf-8");
    const bufB = Buffer.from(String(b), "utf-8");
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
  }

  return { encrypt, decrypt, safeEqual };
}
