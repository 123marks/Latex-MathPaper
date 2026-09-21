// VS Code .vsix compatibility — first layer only.
//
// Host boundary: Paper OS never executes extension JavaScript. `main`,
// `browser`, and `activationEvents` are recorded and ignored. TextMate
// grammars and tokenColors are classified as planned. Commands, views,
// webview, debug, and native APIs are unsupported. Do not claim full
// VS Code plugin compatibility.

export const VSIX_HOST = {
  executesExtensionJs: false,
  layer: "theme-colors-and-language-ids",
  claim: "not-full-vscode-compat",
};

export const COMPATIBILITY_MATRIX = [
  { id: "themes.colors", status: "supported", note: "subset of editor.* colors mapped to Monaco" },
  { id: "languages", status: "supported", note: "id / aliases / extensions only; no tokenizer" },
  { id: "themes.tokenColors", status: "planned", note: "no TextMate engine" },
  { id: "grammars", status: "planned", note: "no TextMate engine" },
  { id: "languageConfiguration", status: "planned", note: "brackets/comments not applied yet" },
  { id: "commands", status: "unsupported", note: "extension JS is not executed" },
  { id: "keybindings", status: "unsupported", note: "extension JS is not executed" },
  { id: "menus", status: "unsupported", note: "extension JS is not executed" },
  { id: "views", status: "unsupported", note: "no contribution host" },
  { id: "viewContainers", status: "unsupported", note: "no contribution host" },
  { id: "webview", status: "unsupported", note: "no webview bridge" },
  { id: "debug", status: "unsupported", note: "no debug adapter host" },
  { id: "terminal", status: "unsupported", note: "terminal is host-owned" },
  { id: "authentication", status: "unsupported", note: "no auth provider host" },
  { id: "main", status: "unsupported", note: "Node entry is recorded and ignored" },
  { id: "browser", status: "unsupported", note: "webview entry is recorded and ignored" },
];

export const SUPPORTED_THEME_KEYS = [
  "editor.background",
  "editor.foreground",
  "editorCursor.foreground",
  "editorCursor.background",
  "editor.lineHighlightBackground",
  "editor.lineHighlightBorder",
  "editorLineNumber.foreground",
  "editorLineNumber.activeForeground",
  "editor.selectionBackground",
  "editor.inactiveSelectionBackground",
  "editor.selectionHighlightBackground",
  "editorIndentGuide.background",
  "editorIndentGuide.activeBackground",
  "editorWidget.background",
  "editorWidget.foreground",
  "editorSuggestWidget.background",
  "editorSuggestWidget.foreground",
  "editorSuggestWidget.selectedBackground",
  "input.background",
  "input.foreground",
  "focusBorder",
  "scrollbarSlider.background",
  "scrollbarSlider.hoverBackground",
];

export const PAPEROS_DARK_COLORS = {
  "editor.background": "#0E0E12",
  "editor.foreground": "#EDE8DF",
  "editorCursor.foreground": "#F0C35A",
  "editorCursor.background": "#0E0E12",
  "editor.lineHighlightBackground": "#1A1A22",
  "editor.lineHighlightBorder": "#00000000",
  "editorLineNumber.foreground": "#929BA8",
  "editorLineNumber.activeForeground": "#D0D6DE",
  "editor.selectionBackground": "#D4A34166",
  "editor.inactiveSelectionBackground": "#D4A34133",
  "editor.selectionHighlightBackground": "#D4A34128",
  "editorIndentGuide.background": "#2A2A32",
  "editorIndentGuide.activeBackground": "#4A4A55",
  "editorWidget.background": "#1A1A22",
  "editorWidget.foreground": "#EDE8DF",
  "editorSuggestWidget.background": "#1A1A22",
  "editorSuggestWidget.foreground": "#EDE8DF",
  "editorSuggestWidget.selectedBackground": "#2A2A32",
  "input.background": "#141418",
  "input.foreground": "#EDE8DF",
  "focusBorder": "#D4A341",
  "scrollbarSlider.background": "#D4A34133",
  "scrollbarSlider.hoverBackground": "#D4A34155",
};

export const PAPEROS_DARK_RULES = [
  { token: "", foreground: "EDE8DF", background: "0E0E12" },
  { token: "comment", foreground: "AAA39B", fontStyle: "italic" },
  { token: "keyword", foreground: "F0C35A" },
  { token: "tag", foreground: "E2B564", fontStyle: "bold" },
  { token: "string", foreground: "C8D4E0" },
  { token: "number", foreground: "8EB6D8" },
  { token: "delimiter", foreground: "E2B564" },
  { token: "delimiter.bracket", foreground: "E2B564" },
  { token: "identifier", foreground: "EDE8DF" },
];

const IDENT = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const SEMVER = /^\d+\.\d+\.\d+([.+-][A-Za-z0-9.+-]+)?$/;
const COLOR = /^#([0-9A-Fa-f]{3,4}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/;
const LANG_ID = /^[A-Za-z][A-Za-z0-9._-]*$/;
const FILE_EXT = /^\.[A-Za-z0-9]+$/;

export function extensionId(publisher, name) {
  return `${String(publisher).toLowerCase()}.${String(name).toLowerCase()}`;
}

function manifestError(message) {
  const error = new Error(message);
  error.code = "MANIFEST_INVALID";
  return error;
}

export function validateManifest(pkg) {
  if (!pkg || typeof pkg !== "object" || Array.isArray(pkg)) {
    throw manifestError("package.json 不是对象");
  }
  const name = String(pkg.name || "").trim();
  const publisher = String(pkg.publisher || "").trim();
  const version = String(pkg.version || "").trim();
  if (!IDENT.test(name)) throw manifestError("缺少合法 name");
  if (!IDENT.test(publisher)) throw manifestError("缺少合法 publisher");
  if (!SEMVER.test(version)) throw manifestError("缺少合法 version");
  return {
    id: extensionId(publisher, name),
    name,
    publisher,
    version,
    displayName: String(pkg.displayName || name),
    description: String(pkg.description || ""),
    engines: pkg.engines && typeof pkg.engines === "object" ? pkg.engines : {},
    contributes: pkg.contributes && typeof pkg.contributes === "object" && !Array.isArray(pkg.contributes)
      ? pkg.contributes
      : {},
    main: pkg.main ? String(pkg.main) : "",
    browser: pkg.browser ? String(pkg.browser) : "",
    activationEvents: Array.isArray(pkg.activationEvents) ? pkg.activationEvents.map(String) : [],
  };
}

function unique(values) {
  return [...new Set(values)];
}

export function classifyContributes(manifest) {
  const contributes = manifest.contributes || {};
  const keys = Object.keys(contributes);
  const supported = [];
  const planned = [];
  const unsupported = [];
  const known = Object.fromEntries(COMPATIBILITY_MATRIX.map((row) => [row.id, row]));

  if (Array.isArray(contributes.themes) && contributes.themes.length) {
    supported.push("themes.colors");
    planned.push("themes.tokenColors");
  }
  if (Array.isArray(contributes.languages) && contributes.languages.length) {
    supported.push("languages");
    if (contributes.languages.some((lang) => lang?.configuration)) {
      planned.push("languageConfiguration");
    }
  }
  if (Array.isArray(contributes.grammars) && contributes.grammars.length) {
    planned.push("grammars");
  }

  for (const key of keys) {
    if (key === "themes" || key === "languages" || key === "grammars") continue;
    const row = known[key];
    if (!row) unsupported.push(key);
    else if (row.status === "planned") planned.push(key);
    else if (row.status === "unsupported") unsupported.push(key);
  }
  if (manifest.main) unsupported.push("main");
  if (manifest.browser) unsupported.push("browser");
  return {
    supported: unique(supported),
    planned: unique(planned),
    unsupported: unique(unsupported),
  };
}

export function mapThemeColors(colors) {
  const mapped = {};
  if (!colors || typeof colors !== "object") return mapped;
  for (const key of SUPPORTED_THEME_KEYS) {
    const value = colors[key];
    if (typeof value === "string" && COLOR.test(value)) mapped[key] = value;
  }
  return mapped;
}

export function collectLanguages(contributes) {
  const list = Array.isArray(contributes?.languages) ? contributes.languages : [];
  return list.map((lang) => {
    const id = String(lang?.id || "").trim();
    if (!LANG_ID.test(id)) return null;
    const extensions = (Array.isArray(lang.extensions) ? lang.extensions : [])
      .map((ext) => String(ext).toLowerCase())
      .map((ext) => (ext.startsWith(".") ? ext : `.${ext}`))
      .filter((ext) => FILE_EXT.test(ext));
    const aliases = (Array.isArray(lang.aliases) ? lang.aliases : []).map(String).filter(Boolean);
    return { id, extensions, aliases };
  }).filter(Boolean);
}

export function collectThemes(contributes) {
  const list = Array.isArray(contributes?.themes) ? contributes.themes : [];
  return list.map((theme) => ({
    label: String(theme?.label || "Untitled"),
    path: String(theme?.path || "").replace(/\\/g, "/"),
    uiTheme: String(theme?.uiTheme || "vs-dark"),
  })).filter((theme) => {
    if (!theme.path || theme.path.includes("..") || theme.path.startsWith("/")) return false;
    return !/^[A-Za-z]:/.test(theme.path);
  });
}

export function languageIdForFile(name, languages = []) {
  const lower = String(name || "").toLowerCase();
  for (const lang of languages) {
    for (const ext of lang.extensions || []) {
      if (lower.endsWith(ext)) return lang.id;
    }
  }
  return null;
}

export function buildMonacoTheme(extensionColors) {
  return {
    base: "vs-dark",
    inherit: false,
    rules: PAPEROS_DARK_RULES,
    colors: { ...PAPEROS_DARK_COLORS, ...mapThemeColors(extensionColors) },
  };
}
