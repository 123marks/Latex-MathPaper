// SyncTeX parser (LaTeX Editor lesson): map PDF positions <-> source lines.
//
// The .synctex format (plain or gzip) is line-oriented:
//   Input:<tag>:<path>            — declares a source file tag
//   Magnification / X Offset / Y Offset / Unit — header, units are sp (scaled points)
//   {<page>  ...  }<page>         — page blocks
//   inside a page, boxes/records: [<tag>,<line>:<x>,<y>:<w>,<h>,<d>  (vbox)
//                                 (<tag>,<line>:<x>,<y>:<w>,<h>,<d>  (hbox)
//                                 x<tag>,<line>:<x>,<y>  k... g... $... v... h... (glue/kern/math/etc.)
// Coordinates are in sp with origin top-left; 1pt = 65536sp, 1in = 72.27pt.
// We only need records with tag+line+x+y — enough for robust forward
// (line -> page,y) and inverse (page,x,y -> nearest line) lookups.

const SP_PER_PT = 65536;
const PT_PER_IN = 72.27;
// PDF user space is 72 pt/in, so 1 TeX pt = 72/72.27 PDF pt.
const TEX_PT_TO_PDF_PT = 72 / PT_PER_IN;

export function parseSyncTeX(text) {
  const inputs = new Map(); // tag -> path
  const records = []; // { page, tag, line, x, y, w, h } in sp
  let page = 0;
  let unit = 1; // sp per unit (some engines set Unit:1)
  let xOffset = 0;
  let yOffset = 0;
  const lines = String(text || "").split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("Input:")) {
      const m = line.match(/^Input:(\d+):(.+)$/);
      if (m) inputs.set(Number(m[1]), m[2].trim());
      continue;
    }
    if (line.startsWith("Unit:")) { unit = Number(line.slice(5)) || 1; continue; }
    if (line.startsWith("X Offset:")) { xOffset = Number(line.slice(9)) || 0; continue; }
    if (line.startsWith("Y Offset:")) { yOffset = Number(line.slice(9)) || 0; continue; }
    if (line[0] === "{") { page = Number(line.slice(1)) || page + 1; continue; }
    if (line[0] === "}") { continue; }
    if (!page) continue;
    // Box-like: [tag,line:x,y:w,h,d  or  (tag,line:x,y:w,h,d
    let m = line.match(/^[[(](\d+),(\d+):(-?\d+),(-?\d+):(-?\d+),(-?\d+),(-?\d+)/);
    if (m) {
      records.push({ page, tag: Number(m[1]), line: Number(m[2]), x: Number(m[3]) * unit + xOffset, y: Number(m[4]) * unit + yOffset, w: Number(m[5]) * unit, h: Number(m[6]) * unit });
      continue;
    }
    // Point-like: x/k/g/$/v/h tag,line:x,y
    m = line.match(/^[xkg$vh](\d+),(\d+):(-?\d+),(-?\d+)/);
    if (m) {
      records.push({ page, tag: Number(m[1]), line: Number(m[2]), x: Number(m[3]) * unit + xOffset, y: Number(m[4]) * unit + yOffset, w: 0, h: 0 });
    }
  }
  return { inputs, records };
}

function normalizePath(p) {
  return String(p || "").replace(/\\/g, "/").replace(/^\.\//, "").toLowerCase();
}

// Match a declared input path to a workspace-relative source path: exact or
// suffix match (synctex often records "./sections/intro.tex" or an absolute path).
export function findTagForPath(inputs, relPath) {
  const want = normalizePath(relPath);
  for (const [tag, path] of inputs) {
    const have = normalizePath(path);
    if (have === want || have.endsWith(`/${want}`) || want.endsWith(`/${have}`)) return tag;
  }
  return null;
}

export function spToPdfPt(sp) {
  return (sp / SP_PER_PT) * TEX_PT_TO_PDF_PT;
}

// Forward: source line -> { page, x, y } (PDF points, top-left origin).
// Picks the record on the exact line, else the nearest following line in the
// same file (so a blank line still lands somewhere sensible).
export function forwardLookup(parsed, relPath, line) {
  const tag = findTagForPath(parsed.inputs, relPath);
  if (tag === null) return null;
  const mine = parsed.records.filter((r) => r.tag === tag);
  if (!mine.length) return null;
  let best = null;
  for (const r of mine) {
    const delta = r.line - line;
    if (delta < 0) continue;
    if (!best || delta < best.line - line || (delta === best.line - line && r.y < best.y)) best = r;
  }
  if (!best) best = mine.reduce((a, b) => (b.line > a.line ? b : a));
  return { page: best.page, x: spToPdfPt(best.x), y: spToPdfPt(best.y), line: best.line };
}

// Inverse: page + PDF-point position -> { path, line }. Nearest record by
// vertical distance first (reading lines), then horizontal.
export function inverseLookup(parsed, page, xPt, yPt) {
  const onPage = parsed.records.filter((r) => r.page === page);
  if (!onPage.length) return null;
  const xSp = (xPt / TEX_PT_TO_PDF_PT) * SP_PER_PT;
  const ySp = (yPt / TEX_PT_TO_PDF_PT) * SP_PER_PT;
  let best = null;
  let bestScore = Infinity;
  for (const r of onPage) {
    // For boxes, y is the baseline; treat the box as spanning [y-h, y].
    const top = r.y - (r.h || 0);
    const dy = ySp < top ? top - ySp : ySp > r.y ? ySp - r.y : 0;
    const dx = xSp < r.x ? r.x - xSp : r.w && xSp > r.x + r.w ? xSp - (r.x + r.w) : 0;
    const score = dy * 4 + dx; // vertical proximity dominates
    if (score < bestScore) { bestScore = score; best = r; }
  }
  if (!best) return null;
  return { path: parsed.inputs.get(best.tag) || null, line: best.line, page: best.page };
}
