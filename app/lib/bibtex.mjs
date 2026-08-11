// Pragmatic BibTeX parser (09-integrations Epic 3a): balanced-brace scan good
// enough for common entries; @comment/@preamble/@string are skipped.
// Extracted from server.mjs with zero behaviour change.
export function parseBibTeX(text) {
  const src = String(text || "");
  const entries = [];
  let i = 0;
  while (i < src.length && entries.length < 500) {
    const at = src.indexOf("@", i);
    if (at === -1) break;
    let j = at + 1;
    while (j < src.length && /[a-zA-Z]/.test(src[j])) j += 1;
    const type = src.slice(at + 1, j).toLowerCase();
    while (j < src.length && /\s/.test(src[j])) j += 1;
    if (src[j] !== "{") { i = at + 1; continue; }
    let depth = 1;
    let k = j + 1;
    while (k < src.length && depth > 0) {
      if (src[k] === "{") depth += 1;
      else if (src[k] === "}") depth -= 1;
      k += 1;
    }
    const body = src.slice(j + 1, k - 1);
    i = k;
    if (type === "comment" || type === "preamble" || type === "string") continue;
    const comma = body.indexOf(",");
    if (comma === -1) continue;
    const key = body.slice(0, comma).trim();
    if (!key) continue;
    const fields = {};
    let p = comma + 1;
    while (p < body.length) {
      while (p < body.length && /[\s,]/.test(body[p])) p += 1;
      let q = p;
      while (q < body.length && /[a-zA-Z_-]/.test(body[q])) q += 1;
      const name = body.slice(p, q).toLowerCase();
      if (!name) break;
      while (q < body.length && /\s/.test(body[q])) q += 1;
      if (body[q] !== "=") break;
      q += 1;
      while (q < body.length && /\s/.test(body[q])) q += 1;
      let value = "";
      if (body[q] === "{") {
        let d = 1;
        let r = q + 1;
        while (r < body.length && d > 0) {
          if (body[r] === "{") d += 1;
          else if (body[r] === "}") d -= 1;
          if (d > 0) value += body[r];
          r += 1;
        }
        p = r;
      } else if (body[q] === '"') {
        let r = q + 1;
        while (r < body.length && body[r] !== '"') { value += body[r]; r += 1; }
        p = r + 1;
      } else {
        let r = q;
        while (r < body.length && body[r] !== ",") { value += body[r]; r += 1; }
        p = r;
      }
      fields[name] = value.replace(/[{}]/g, "").replace(/\s+/g, " ").trim();
    }
    entries.push({
      key,
      type,
      title: fields.title || "",
      author: fields.author || "",
      year: fields.year || "",
      venue: fields.journal || fields.booktitle || fields.publisher || "",
    });
  }
  return entries;
}
