// Extract every math span from a TeX buffer and render each independently.
// One broken formula must never prevent the others from rendering.

const ENV_RE = /\\begin\{(equation\*?|align\*?|gather\*?|multline\*?|eqnarray\*?)\}([\s\S]*?)\\end\{\1\}/g;
const SPANS = [
  { re: /\$\$([\s\S]+?)\$\$/g, display: true, kind: "$$" },
  { re: /\\\[([\s\S]+?)\\\]/g, display: true, kind: "\\[\\]" },
  { re: /\\\(([\s\S]+?)\\\)/g, display: false, kind: "\\(\\)" },
  // Inline $…$ must not start with a digit so prose like "$5 and $6" stays out.
  { re: /(^|[^\\$])\$([^$\d\n][^$\n]*?)\$/g, display: false, kind: "$", group: 2, lead: 1 },
];

function lineAt(source, index) {
  return source.slice(0, index).split("\n").length;
}

function overlaps(start, end, used) {
  return used.some((span) => start < span.end && end > span.start);
}

export function extractMathDrafts(text) {
  const src = String(text || "");
  const drafts = [];
  const used = [];

  ENV_RE.lastIndex = 0;
  let match;
  while ((match = ENV_RE.exec(src)) !== null) {
    const start = match.index;
    const end = match.index + match[0].length;
    used.push({ start, end });
    drafts.push({
      start,
      end,
      line: lineAt(src, start),
      tex: match[2].trim(),
      display: true,
      kind: match[1],
    });
  }

  for (const span of SPANS) {
    span.re.lastIndex = 0;
    while ((match = span.re.exec(src)) !== null) {
      const lead = span.lead ? match[span.lead].length : 0;
      const start = match.index + lead;
      const end = match.index + match[0].length;
      if (overlaps(start, end, used)) continue;
      used.push({ start, end });
      drafts.push({
        start,
        end,
        line: lineAt(src, start),
        tex: (span.group ? match[span.group] : match[1]).trim(),
        display: span.display,
        kind: span.kind,
      });
    }
  }

  return drafts
    .filter((draft) => draft.tex)
    .sort((a, b) => a.start - b.start)
    .map((draft, index) => ({ id: `${draft.start}:${index}`, ...draft }));
}

export function renderMathDraft(tex, { display = false, render } = {}) {
  if (typeof render !== "function") {
    throw new Error("renderMathDraft requires an injected render() — pass katex.renderToString");
  }
  try {
    return {
      ok: true,
      html: render(String(tex || ""), { displayMode: Boolean(display), throwOnError: true }),
      error: null,
    };
  } catch (error) {
    return {
      ok: false,
      html: "",
      error: String(error?.message || error).slice(0, 160),
    };
  }
}

export function draftMathList(text, render) {
  return extractMathDrafts(text).map((draft) => ({
    ...draft,
    ...renderMathDraft(draft.tex, { display: draft.display, render }),
  }));
}
