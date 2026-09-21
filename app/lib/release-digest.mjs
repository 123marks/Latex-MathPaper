import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";

const SHA256_RE = /^[a-fA-F0-9]{64}$/;

export function readSidecarSha256(sidecarPath) {
  try {
    const hash = String(readFileSync(sidecarPath, "utf8")).trim().split(/\s+/)[0] || "";
    return SHA256_RE.test(hash) ? hash.toLowerCase() : "";
  } catch {
    return "";
  }
}

export function readReleaseDigest(absolutePath) {
  let size = 0;
  try {
    const stat = statSync(absolutePath);
    if (!stat.isFile()) return { available: false, size: 0, sha256: "", source: "missing" };
    size = stat.size;
  } catch {
    return { available: false, size: 0, sha256: "", source: "missing" };
  }

  const sidecar = readSidecarSha256(`${absolutePath}.sha256`);
  if (sidecar) return { available: true, size, sha256: sidecar, source: "sidecar" };

  const data = readFileSync(absolutePath);
  return {
    available: true,
    size: data.length,
    sha256: createHash("sha256").update(data).digest("hex"),
    source: "computed",
  };
}
