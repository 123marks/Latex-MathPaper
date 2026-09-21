// Desktop client for GET /api/editor/synctex.
// Missing SyncTeX is a first-class degraded state, not a crash or a fake hit.

export function synctexQuery({ workspace, tex, mode, path, line, page, x, y }) {
  const query = new URLSearchParams({
    workspace: String(workspace || ""),
    tex: String(tex || ""),
    mode: String(mode || ""),
  });
  if (path) query.set("path", path);
  if (line != null) query.set("line", String(line));
  if (page != null) query.set("page", String(page));
  if (x != null) query.set("x", Number(x).toFixed(2));
  if (y != null) query.set("y", Number(y).toFixed(2));
  return `/api/editor/synctex?${query}`;
}

export function describeSynctexError(error) {
  const code = error?.code || error?.payload?.code || "";
  const status = error?.status;
  if (code === "SYNCTEX_MISSING") {
    return {
      degraded: true,
      code: "SYNCTEX_MISSING",
      message: error?.message || "还没有 SyncTeX 记录。先成功编译，或使用章节估算。",
    };
  }
  if (code === "SYNCTEX_NO_MATCH") {
    return {
      degraded: true,
      code: "SYNCTEX_NO_MATCH",
      message: error?.message || "该位置没有 SyncTeX 记录。",
    };
  }
  if (status === 404) {
    return {
      degraded: true,
      code: "SYNCTEX_MISSING",
      message: error?.message || "还没有 SyncTeX 记录。先成功编译，或使用章节估算。",
    };
  }
  return {
    degraded: false,
    code: code || "SYNCTEX_ERROR",
    message: error?.message || "SyncTeX 定位失败",
  };
}

export function preferSynctexHit(synctex, estimate) {
  if (synctex?.page) {
    return {
      source: "synctex",
      page: synctex.page,
      x: synctex.x ?? null,
      y: synctex.y ?? null,
      path: synctex.path || null,
      line: synctex.line || estimate?.sourceLine || null,
      title: synctex.path ? `${synctex.path}:${synctex.line}` : (estimate?.title || "SyncTeX"),
      kind: "synctex",
      sourceLine: synctex.line || estimate?.sourceLine || null,
    };
  }
  if (!estimate) return null;
  return { ...estimate, source: "estimate", kind: estimate.kind || "estimate" };
}
