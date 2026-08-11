import { scryptSync, randomBytes, timingSafeEqual } from "node:crypto";

// Local-first authentication primitives. Passwords are salted and hashed with
// scrypt; sessions are opaque random tokens. No secrets are hardcoded and no
// third-party service is contacted. Storage is the caller's responsibility.
const KEY_LENGTH = 64;

export function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(String(password), salt, KEY_LENGTH).toString("hex");
  return `${salt}:${derived}`;
}

export function verifyPassword(password, stored) {
  if (typeof stored !== "string" || !stored.includes(":")) return false;
  const [salt, hash] = stored.split(":");
  const known = Buffer.from(hash, "hex");
  let test;
  try {
    test = scryptSync(String(password), salt, KEY_LENGTH);
  } catch {
    return false;
  }
  return known.length === test.length && timingSafeEqual(known, test);
}

export function newToken() {
  return randomBytes(24).toString("hex");
}

export function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(value);
  }
  return out;
}

export function serializeCookie(name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  parts.push(`Path=${options.path || "/"}`);
  if (options.maxAge != null) parts.push(`Max-Age=${options.maxAge}`);
  parts.push("HttpOnly");
  parts.push(`SameSite=${options.sameSite || "Lax"}`);
  return parts.join("; ");
}
