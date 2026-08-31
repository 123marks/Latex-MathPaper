import Editor, { loader } from "@monaco-editor/react";

// Configure Monaco workers (Vite-friendly via CDN-less @monaco-editor/react loader).
// We use a single bundled worker; this avoids per-file worker imports in Vite.
loader.config({ monaco: null });

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

export default function LaTeXEditor({ value, onChange, onSelectionChange, editorRef, language = "latex", height = "100%" }) {
  function handleBeforeMount(monaco) {
    registerLatex(monaco);
  }
  function handleMount(editor, monaco) {
    registerLatex(monaco);
    // Expose the Monaco instance so the host can reveal lines / focus (跳转).
    if (editorRef) editorRef.current = editor;
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
    <Editor
      value={value}
      language={language}
      theme="paper-os-dark"
      height={height}
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
  );
}
