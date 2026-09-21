import { useEffect, useRef, useState } from "react";
import Editor, { loader } from "@monaco-editor/react";
import katex from "katex";
import "katex/dist/katex.min.css";

// Find the math environment surrounding a cursor offset: $…$, $$…$$, \[…\],
// \(…\), or equation/align-family environments. Returns { tex, display } or null.
export function mathAtOffset(text, offset) {
  const src = String(text || "");
  const envs = ["equation\\*?", "align\\*?", "gather\\*?", "multline\\*?", "eqnarray\\*?"];
  const envRe = new RegExp(`\\\\begin\\{(${envs.join("|")})\\}([\\s\\S]*?)\\\\end\\{\\1\\}`, "g");
  let m;
  while ((m = envRe.exec(src)) !== null) {
    if (offset >= m.index && offset <= m.index + m[0].length) {
      return { tex: m[2].trim(), display: true };
    }
  }
  const spans = [
    { re: /\$\$([\s\S]+?)\$\$/g, display: true },
    { re: /\\\[([\s\S]+?)\\\]/g, display: true },
    { re: /\\\(([\s\S]+?)\\\)/g, display: false },
    { re: /(^|[^\\$])\$([^$\n]+?)\$/g, display: false, group: 2, lead: 1 },
  ];
  for (const span of spans) {
    span.re.lastIndex = 0;
    while ((m = span.re.exec(src)) !== null) {
      const lead = span.lead ? m[span.lead].length : 0;
      const start = m.index + lead;
      const end = m.index + m[0].length;
      if (offset >= start && offset <= end) {
        return { tex: (span.group ? m[span.group] : m[1]).trim(), display: span.display };
      }
    }
  }
  return null;
}

// Load Monaco from the local package. The previous `monaco: null` config fell
// back to the CDN loader, so an offline or headed capture never painted lines.
let localMonacoPromise = null;
function loadLocalMonaco() {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (!localMonacoPromise) {
    localMonacoPromise = (async () => {
      const monaco = await import("monaco-editor");
      await import("monaco-editor/min/vs/editor/editor.main.css");
      const workerModule = await import("monaco-editor/esm/vs/editor/editor.worker?worker");
      const EditorWorker = workerModule.default;
      window.MonacoEnvironment = {
        getWorker() {
          return new EditorWorker();
        },
      };
      loader.config({ monaco });
      return monaco;
    })();
  }
  return localMonacoPromise;
}

// Register a LaTeX language with a Monarch tokenizer the first time the editor mounts.
let LATEX_REGISTERED = false;
function registerLatex(monaco) {
  if (LATEX_REGISTERED) return;
  LATEX_REGISTERED = true;
  monaco.languages.register({ id: "latex" });
  monaco.languages.setMonarchTokensProvider("latex", {
    defaultToken: "",
    tokenizer: {
      root: [
        // block comments aren't standard in LaTeX, but % is line comment
        [/^%.*$/, "comment"],
        // line comment starting mid-line
        [/%.*$/, "comment"],
        // math: $$ ... $$  and  \[ ... \]
        [/\$\$/, { token: "delimiter.bracket", next: "@displaymath" }],
        [/\\\[/, { token: "delimiter.bracket", next: "@displaymath" }],
        // inline math: $...$
        [/\$/, { token: "delimiter.bracket", next: "@inlinemath" }],
        // \begin{...} ... \end{...}
        [/\\begin\{[a-zA-Z*]+\}/, "tag"],
        [/\\end\{[a-zA-Z*]+\}/, "tag"],
        // preamble
        [/\\documentclass\b/, "keyword"],
        [/\\usepackage\b/, "keyword"],
        [/\\(section|subsection|subsubsection|paragraph|chapter|part)\b\*?\{/, [
          "keyword",
          "delimiter.bracket",
        ], "@sectionarg"],
        // bold/italic inline
        [/\\(textbf|textit|emph|underline)\b\*?\{/, ["keyword", "delimiter.bracket"]],
        // references and citations
        [/\\(ref|eqref|label|cite|bibitem|input|include)\b\*?\{/, [
          "keyword",
          "delimiter.bracket",
        ]],
        // generic command
        [/\\[a-zA-Z@]+/, "keyword"],
        // braces
        [/[\{\}]/, "delimiter.bracket"],
        // numbers
        [/\d+(\.\d+)?/, "number"],
        // strings
        [/"[^"]*"/, "string"],
      ],
      displaymath: [
        [/\$\$/, { token: "delimiter.bracket", next: "@pop" }],
        [/\\\]/, { token: "delimiter.bracket", next: "@pop" }],
        [/\\[a-zA-Z]+/, "keyword"],
        [/\d+(\.\d+)?/, "number"],
        [/[^$]+/, "string"],
      ],
      inlinemath: [
        [/\$/, { token: "delimiter.bracket", next: "@pop" }],
        [/\\[a-zA-Z]+/, "keyword"],
        [/\d+(\.\d+)?/, "number"],
        [/[^$\\]+/, "string"],
      ],
      sectionarg: [
        [/\}/, { token: "delimiter.bracket", next: "@pop" }],
        [/[^}]+/, "string"],
      ],
    },
  });
  monaco.editor.defineTheme("paper-os-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "6b6157", fontStyle: "italic" },
      { token: "keyword", foreground: "e2b564" },
      { token: "tag", foreground: "d4a341", fontStyle: "bold" },
      { token: "string", foreground: "c4beb1" },
      { token: "number", foreground: "7e9bb8" },
      { token: "delimiter.bracket", foreground: "e2b564" },
    ],
    colors: {
      "editor.background": "#08080a",
      "editor.foreground": "#e8e3da",
      "editorCursor.foreground": "#d4a341",
      "editor.lineHighlightBackground": "#0f0f12",
      "editorLineNumber.foreground": "#3a3631",
      "editorLineNumber.activeForeground": "#a59f95",
      "editor.selectionBackground": "#d4a341",
      "editor.inactiveSelectionBackground": "#d4a34155",
    },
  });
}

// Module-level so re-mounts never register a second \cite provider.
let citeProviderDisposable = null;
let citeKeysRef = { current: [] };

export default function LaTeXEditor({
  value,
  onChange,
  onSelectionChange,
  editorRef,
  citeKeys = [],
  language = "latex",
  height = "100%",
}) {
  // latex-stickies lesson: render the formula under the caret live.
  const [mathPreview, setMathPreview] = useState(null); // { html, display, top }
  const [monacoReady, setMonacoReady] = useState(false);
  const [monacoError, setMonacoError] = useState("");
  const containerRef = useRef(null);
  citeKeysRef.current = citeKeys;

  useEffect(() => {
    let alive = true;
    loadLocalMonaco()
      .then(() => {
        if (alive) setMonacoReady(true);
      })
      .catch((error) => {
        if (alive) setMonacoError(String(error?.message || error || "Monaco failed to load"));
      });
    return () => {
      alive = false;
    };
  }, []);

  function handleBeforeMount(monaco) {
    registerLatex(monaco);
  }
  function handleMount(editor, monaco) {
    registerLatex(monaco);
    // Expose the Monaco instance so the host can reveal lines / focus (跳转).
    if (editorRef) editorRef.current = editor;

    // OverCite lesson: complete bibliography keys inside \cite{…}. Keys come
    // from the host's real references scan; the provider reads the ref so the
    // list refreshes without re-registering.
    if (!citeProviderDisposable) {
      citeProviderDisposable = monaco.languages.registerCompletionItemProvider("latex", {
        triggerCharacters: ["{", ","],
        provideCompletionItems(model, position) {
          const line = model.getLineContent(position.lineNumber).slice(0, position.column - 1);
          const open = line.match(/\\(?:no)?(?:cite|citep|citet|parencite|textcite|autocite|footcite)\*?(?:\[[^\]]*\]){0,2}\{([^}]*)$/);
          if (!open) return { suggestions: [] };
          const typed = open[1].split(",").pop().trim();
          const word = { startLineNumber: position.lineNumber, endLineNumber: position.lineNumber, startColumn: position.column - typed.length, endColumn: position.column };
          return {
            suggestions: (citeKeysRef.current || []).map((k) => ({
              label: k.key,
              kind: monaco.languages.CompletionItemKind.Reference,
              detail: [k.author, k.year].filter(Boolean).join(" · "),
              documentation: k.title || "",
              insertText: k.key,
              range: word,
            })),
          };
        },
      });
    }

    // Live math preview: recompute on cursor moves with a small debounce.
    let timer = null;
    editor.onDidChangeCursorPosition((event) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        const model = editor.getModel();
        if (!model) return;
        const offset = model.getOffsetAt(event.position);
        const hit = mathAtOffset(model.getValue(), offset);
        if (!hit || !hit.tex) { setMathPreview(null); return; }
        try {
          const html = katex.renderToString(hit.tex, { displayMode: hit.display, throwOnError: true });
          const top = editor.getTopForLineNumber(event.position.lineNumber) - editor.getScrollTop();
          setMathPreview({ html, display: hit.display, top, error: null });
        } catch (err) {
          setMathPreview({ html: "", display: hit.display, top: 0, error: String(err?.message || "无法渲染").slice(0, 160) });
        }
      }, 120);
    });
    editor.onDidBlurEditorText(() => setMathPreview(null));
    if (typeof onSelectionChange === "function") {
      editor.onDidChangeCursorSelection((event) => {
        const sel = event.selection;
        const model = editor.getModel();
        const startLine = sel.startLineNumber;
        const endLine = sel.endLineNumber;
        let excerpt = "";
        try {
          excerpt = model
            ? model.getValueInRange({
                startLineNumber: startLine,
                startColumn: 1,
                endLineNumber: endLine,
                endColumn: model.getLineMaxColumn(endLine),
              })
            : "";
        } catch {
          excerpt = "";
        }
        onSelectionChange({
          startLine,
          endLine,
          line: sel.positionLineNumber,
          column: sel.positionColumn,
          excerpt: excerpt.slice(0, 400),
        });
      });
    }
  }
  return (
    <div ref={containerRef} className="latex-editor-host" style={{ position: "relative", height }}>
      {mathPreview && (
        <div
          className={`math-preview ${mathPreview.display ? "display" : ""} ${mathPreview.error ? "error" : ""}`}
          style={{ top: Math.max(8, mathPreview.top + 26) }}
          aria-live="polite"
        >
          {mathPreview.error ? (
            <span className="math-preview-error">✗ {mathPreview.error}</span>
          ) : (
            // KaTeX output is generated from the user's own TeX by a trusted renderer.
            <span dangerouslySetInnerHTML={{ __html: mathPreview.html }} />
          )}
        </div>
      )}
    {monacoError ? (
      <div className="empty" data-testid="monaco-load-error" style={{ padding: 16 }}>
        编辑器未能从本机加载：{monacoError}
      </div>
    ) : monacoReady ? (
    <Editor
      value={value}
      language={language}
      theme="paper-os-dark"
      height="100%"
      onChange={(v) => onChange(v ?? "")}
      beforeMount={handleBeforeMount}
      onMount={handleMount}
      options={{
        fontFamily: "var(--font-mono)",
        fontSize: 13,
        fontLigatures: true,
        lineHeight: 1.65,
        // VS Code 式概览：字符块渲染关闭，保持低噪。
        minimap: { enabled: true, renderCharacters: false, maxColumn: 96 },
        scrollBeyondLastLine: false,
        wordWrap: "on",
        renderLineHighlight: "gutter",
        smoothScrolling: true,
        cursorBlinking: "phase",
        cursorSmoothCaretAnimation: "on",
        renderWhitespace: "none",
        tabSize: 2,
        padding: { top: 14, bottom: 14 },
        scrollbar: {
          verticalScrollbarSize: 8,
          horizontalScrollbarSize: 8,
        },
      }}
    />
    ) : (
      <div className="empty" data-testid="monaco-loading">正在加载编辑器…</div>
    )}
    </div>
  );
}
