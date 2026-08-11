// Visual review annotations (docs/redesign/09-integrations Epic 1a/1d):
// vocabulary + pure target normalisation. Extracted from server.mjs with
// zero behaviour change; storage/IO glue stays in the server.

export const ANNOTATION_INTENTS = new Set(["edit", "fix", "question", "todo"]);
export const ANNOTATION_PRIORITIES = new Set(["low", "normal", "high"]);
export const ANNOTATION_STATUSES = new Set(["open", "proposed", "resolved", "dismissed"]);

export function normalizeAnnotationTarget(target) {
  if (!target || typeof target !== "object") return null;
  const kind = String(target.kind || "editor-range");
  const relPath = String(target.path || "").trim().replace(/^\/+/, "").replace(/\\/g, "/");
  if (!relPath || relPath.includes("..") || /^[a-zA-Z]:/.test(relPath)) return null;
  const excerpt = String(target.excerpt || "").slice(0, 400);
  if (kind === "editor-range") {
    const startLine = Math.max(1, Math.floor(Number(target.startLine) || 1));
    const endLine = Math.max(startLine, Math.floor(Number(target.endLine) || startLine));
    return { kind, path: relPath, startLine, endLine, excerpt };
  }
  // 09-integrations Epic 1d: a rectangle on a rendered PDF page. Coordinates
  // are normalised to 0..1 so they survive zoom changes.
  if (kind === "pdf-region") {
    const pageNum = Number(target.page);
    if (!Number.isFinite(pageNum) || pageNum < 1) return null;
    const rect = target.rect || {};
    const clamp01 = (v) => Math.min(1, Math.max(0, Number(v) || 0));
    const round4 = (v) => Number(v.toFixed(4));
    const x = clamp01(rect.x);
    const y = clamp01(rect.y);
    const w = Math.min(clamp01(rect.w), 1 - x);
    const h = Math.min(clamp01(rect.h), 1 - y);
    if (w <= 0 || h <= 0) return null;
    return {
      kind,
      path: relPath,
      page: Math.floor(pageNum),
      rect: { x: round4(x), y: round4(y), w: round4(w), h: round4(h) },
      excerpt,
    };
  }
  return null;
}
