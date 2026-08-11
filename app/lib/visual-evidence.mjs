import { createHash } from "node:crypto";

function canonicalize(value, key = "") {
  if (key === "screenshot") return { path: value.path };
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value * 10) / 10;
  }
  if (Array.isArray(value)) return value.map((child) => canonicalize(child));
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([childKey, child]) => [childKey, canonicalize(child, childKey)]),
  );
}

export function stableEvidenceSha256(report) {
  const { generatedAt: _generatedAt, evidenceSha256: _evidenceSha256, ...evidence } = report;
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(evidence)))
    .digest("hex");
}
