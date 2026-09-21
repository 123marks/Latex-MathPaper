// Paper OS Desktop — IDE main entry. Bundled standalone (no imports from
// the web/ frontend) so the Tauri webview loads a self-contained Cursor/
// VSCode-like editor that talks to the embedded Node API at the same host.

import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { createRoot } from "react-dom/client";
import Editor, { loader } from "@monaco-editor/react";
import * as monacoApi from "monaco-editor";
import "monaco-editor/min/vs/editor/editor.main.css";
import { Icon, BrandLogo, fileIconName, shouldHideNode } from "./icons.jsx";
import {
  createTextBuffer,
  dirtyTextBuffers,
  editTextBuffer,
  loadTextBuffer,
  markTextBufferSaved,
  renameTextBuffer,
} from "./text-buffer.mjs";
import {
  applyCompileAccepted,
  applyCompileEvent,
  applyCompileHttpError,
  applyCompileStatus,
  compileIsRunning,
  compilePhaseLabel,
  createCompileState,
  keepExistingPdf,
} from "./compile-lifecycle.mjs";
import { describeSynctexError, preferSynctexHit, synctexQuery } from "./synctex-client.mjs";
import DesktopPdfPreview from "./pdf-preview.jsx";
import LiveMathDrafts from "./live-math-drafts.jsx";
import AiHarnessPanel from "./ai-harness-panel.jsx";
import {
  annotatePlanDurations,
  appendHarnessTrace,
  buildHarnessContext,
  describeChatRuntime,
  loadHarnessTrace,
  saveHarnessTrace,
  stampDuration,
} from "./ai-harness.mjs";
import {
  buildApplyRequest,
  buildExecutionPlan,
  buildReplacementDiff,
  normalizeProviderState,
  parseFileBlocks,
  parseSSEBuffer,
} from "ai-execution";
import {
  describeDangerousTerminalCommand,
  isDangerousTerminalCommand,
  parseTerminalSse,
  validateTerminalCommand,
} from "terminal-policy";
import {
  buildMonacoTheme,
  languageIdForFile,
} from "extensions-compat";
import {
  appendCapped,
  CHAT_MESSAGE_CAP,
  describeOversizedFile,
  EDITOR_OPEN_MAX_BYTES,
  LOG_LINE_CAP,
  prependCapped,
  TERM_LINE_CAP,
} from "ui-budget";

// Bundle monaco locally (WebView2 must not depend on CDN). Theme is defined
// in setupLatex beforeMount so we never paint dark chrome with light "vs" text.
loader.config({ monaco: monacoApi });

// ───────────── Monaco LaTeX language + theme (duplicated here so the IDE
// bundle is self-contained) ─────────────
let LATEX_READY = false;
function setupLatex(monaco) {
  if (LATEX_READY) return;
  LATEX_READY = true;
  monaco.languages.register({ id: "latex" });
  monaco.languages.setMonarchTokensProvider("latex", {
    defaultToken: "",
    tokenizer: {
      root: [
        [/^%.*$/, "comment"],
        [/%.*$/, "comment"],
        [/\$\$/, { token: "delimiter.bracket", next: "@displaymath" }],
        [/\\\[/, { token: "delimiter.bracket", next: "@displaymath" }],
        [/\$/, { token: "delimiter.bracket", next: "@inlinemath" }],
        [/\\begin\{[a-zA-Z*]+\}/, "tag"],
        [/\\end\{[a-zA-Z*]+\}/, "tag"],
        [/\\documentclass\b/, "keyword"],
        [/\\usepackage\b/, "keyword"],
        [/\\(section|subsection|subsubsection|paragraph|chapter|part)\b\*?\{/, ["keyword", "delimiter.bracket"]],
        [/\\(textbf|textit|emph|underline)\b\*?\{/, ["keyword", "delimiter.bracket"]],
        [/\\(ref|eqref|label|cite|bibitem|input|include)\b\*?\{/, ["keyword", "delimiter.bracket"]],
        [/\\[a-zA-Z@]+/, "keyword"],
        [/[\{\}]/, "delimiter.bracket"],
        [/\d+(\.\d+)?/, "number"],
        [/\"[^\"]*\"/, "string"],
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
    },
  });
  // High-contrast dark theme. inherit:false so we never fall back to light
  // "vs" foreground (black text on charcoal = unreadable).
  monaco.editor.defineTheme("paperos-dark", {
    base: "vs-dark",
    inherit: false,
    rules: [
      { token: "", foreground: "EDE8DF", background: "0E0E12" },
      { token: "comment", foreground: "AAA39B", fontStyle: "italic" },
      { token: "keyword", foreground: "F0C35A" },
      { token: "tag", foreground: "E2B564", fontStyle: "bold" },
      { token: "string", foreground: "C8D4E0" },
      { token: "number", foreground: "8EB6D8" },
      { token: "delimiter", foreground: "E2B564" },
      { token: "delimiter.bracket", foreground: "E2B564" },
      { token: "identifier", foreground: "EDE8DF" },
    ],
    colors: {
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
    },
  });
  monaco.editor.setTheme("paperos-dark");
}

// ───────────── fetch wrapper ─────────────
async function req(path, opts = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    ...opts,
  });
  let data = {};
  try { data = await res.json(); } catch { /* */ }
  if (!res.ok) {
    const error = new Error(data.error || `请求失败 (${res.status})`);
    error.status = res.status;
    error.code = data.code || "";
    error.payload = data;
    throw error;
  }
  return data;
}
const api = {
  get: (p) => req(p),
  post: (p, body) => req(p, { method: "POST", body: JSON.stringify(body || {}) }),
  put: (p, body) => req(p, { method: "PUT", body: JSON.stringify(body || {}) }),
  patch: (p, body) => req(p, { method: "PATCH", body: JSON.stringify(body || {}) }),
  del: (p) => req(p, { method: "DELETE" }),
};

function base64ToBlob(b64, type) {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type });
}

function mediaKind(name) {
  const lower = String(name || "").toLowerCase();
  if (lower.endsWith(".pdf")) return "pdf";
  if (/\.(png|jpe?g|gif|webp|bmp|svg)$/.test(lower)) return "image";
  if (/\.(exe|dll|so|dylib|bin|zip|7z|rar|gz|xz|woff2?|ttf|otf|eot|wasm|pyc|class|o|obj|lib|pdb|dat)$/.test(lower)) {
    return "binary";
  }
  return null;
}

function monacoLanguage(name, extraLanguages = []) {
  const fromExtension = languageIdForFile(name, extraLanguages);
  if (fromExtension) return fromExtension;
  const lower = String(name || "").toLowerCase();
  if (lower.endsWith(".tex") || lower.endsWith(".sty") || lower.endsWith(".cls") || lower.endsWith(".bib")) return "latex";
  if (lower.endsWith(".py")) return "python";
  if (lower.endsWith(".md")) return "markdown";
  if (lower.endsWith(".json")) return "json";
  if (lower.endsWith(".csv") || lower.endsWith(".tsv")) return "plaintext";
  if (lower.endsWith(".js") || lower.endsWith(".mjs")) return "javascript";
  if (lower.endsWith(".ts")) return "typescript";
  if (lower.endsWith(".css")) return "css";
  if (lower.endsWith(".html")) return "html";
  return "plaintext";
}

// Minimal but functional LaTeX templates for new files
function templateFor(name) {
  const lower = name.toLowerCase();
  if (lower.endsWith(".sty")) {
    return `% ${name} — shared style file
\\NeedsTeXFormat{LaTeX2e}
\\ProvidesPackage{${name.replace(/\\.sty$/i, "")}}[2026/01 v0.1]
`;
  }
  if (lower.endsWith(".bib")) {
    return `@article{einstein1905,
  author  = {Einstein, Albert},
  title   = {On the Electrodynamics of Moving Bodies},
  journal = {Annalen der Physik},
  year    = {1905},
  volume  = {17},
  pages   = {891--921}
}
`;
  }
  if (lower.endsWith(".cls")) {
    return `% ${name} — class file scaffold
\\NeedsTeXFormat{LaTeX2e}
\\ProvidesClass{${name.replace(/\\.cls$/i, "")}}[2026/01 v0.1]
\\LoadClass{article}
`;
  }
  if (lower.endsWith(".bib") || lower === "refs.bib") {
    return templateFor("refs.bib");
  }
  // default .tex
  return `\\documentclass[UTF8,a4paper,12pt]{ctexart}
\\usepackage{amsmath,amssymb,graphicx}
\\title{${name.replace(/\\.tex$/i, "")}}
\\author{Paper OS}
\\date{\\today}
\\begin{document}
\\maketitle
\\section{Introduction}
Put your content here.
\\end{document}
`;
};

// ───────────── helpers ─────────────
function flattenTree(nodes, out = []) {
  for (const n of nodes || []) {
    if (n.type === "file") out.push(n);
    else if (n.children) flattenTree(n.children, out);
  }
  return out;
}
function isTauri() {
  return typeof window !== "undefined" && (window.__TAURI__ || window.isTauri);
}
async function oauthStart(provider) {
  // Open the OAuth start URL via the Node server. Tauri webview will
  // open it in the system browser; after callback the browser is sent
  // to paperos://auth?token=... which Tauri re-broadcasts to the webview
  // via a custom protocol, or the user pastes the code back in.
  const data = await api.get(`/api/auth/oauth/${provider}/start?redirect=1`);
  if (data.url) {
    if (isTauri() && window.__TAURI__?.shell?.open) {
      await window.__TAURI__.shell.open(data.url);
    } else {
      window.open(data.url, "_blank", "noopener,noreferrer");
    }
  }
  return data;
}

// ───────────── Login Overlay ─────────────
function LoginOverlay({ onEmail, oauthStart, error, busy }) {
  return (
    <div className="login-overlay">
      <div className="login-card">
        <div className="logo">
          <BrandLogo size={30} badge />
          <div>
            <div className="name">Paper OS</div>
            <div style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-mono)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
              Editorial LaTeX IDE
            </div>
          </div>
        </div>
        <h1>登录以继续</h1>
        <p className="sub">登录后可同步团队空间、技能市场与 AI 用量。</p>
        {error && <div className="err">{error}</div>}
        <div className="oauth">
          <button onClick={() => oauthStart("google")} disabled={busy}>
            <span className="ico" style={{ background: "#fff", color: "#1a1a1a" }}>G</span>
            使用 Google 账号继续
          </button>
          <button onClick={() => oauthStart("github")} disabled={busy}>
            <span className="ico" style={{ background: "#0d1117", color: "#fff", border: "1px solid #30363d" }}>GH</span>
            使用 GitHub 继续
          </button>
          <button onClick={() => oauthStart("wechat-work")} disabled={busy}>
            <span className="ico" style={{ background: "#1aad19", color: "#fff" }}>微</span>
            使用企业微信继续
          </button>
        </div>
        <div className="divider">或</div>
        <form className="email" onSubmit={onEmail}>
          <input name="username" placeholder="用户名" required />
          <input name="password" type="password" placeholder="密码 (≥ 8 位)" required />
          <button type="submit" disabled={busy}>
            {busy ? "处理中..." : "用账号继续"}
          </button>
        </form>
        <p className="hint">
          首次注册的第一个账号会成为本机 owner。OAuth 会通过系统浏览器完成授权,
          然后通过 <code>paperos://auth?token=...</code> 深链回到桌面端。
        </p>
      </div>
    </div>
  );
}

// ───────────── Outline parser ─────────────
function parseOutline(src) {
  const sections = [];
  const labels = [];
  const lines = String(src || "").split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const sec = line.match(/\\(part|chapter|section|subsection|subsubsection)\*?\{([^}]*)\}/);
    if (sec) {
      const depth = { part: 0, chapter: 1, section: 2, subsection: 3, subsubsection: 4 }[sec[1]] ?? 2;
      sections.push({ line: i + 1, kind: sec[1], title: sec[2], depth });
    }
    const lab = line.match(/\\label\{([^}]*)\}/);
    if (lab) labels.push({ line: i + 1, id: lab[1] });
  }
  return { sections, labels };
}

function parseProblems(logLines) {
  const problems = [];
  const seen = new Set();
  for (const raw of logLines || []) {
    const line = String(raw);
    let file = "";
    let ln = 0;
    let text = line;
    let severity = /error/i.test(line) ? "error" : /warning|undefined/i.test(line) ? "warning" : null;

    const m1 = line.match(/([^:\s\\/]+(?:\/[^:\s]+)*\.tex):(\d+)(?::\d+)?:\s*(.*)/i);
    const m2 = line.match(/(?:^|\s)l\.(\d+)\s+(.*)/);
    const m3 = line.match(/^(?:error|warning):\s*(.*)/i);
    if (m1) {
      file = m1[1].replace(/\\/g, "/");
      ln = Number(m1[2]);
      text = m1[3] || line;
      severity = severity || "error";
    } else if (m2) {
      ln = Number(m2[1]);
      text = m2[2] || line;
      severity = severity || "error";
    } else if (m3) {
      text = m3[1];
      severity = /^warning/i.test(line) ? "warning" : "error";
    } else if (!severity) {
      continue;
    }

    const key = `${severity}|${file}|${ln}|${text}`;
    if (seen.has(key)) continue;
    seen.add(key);
    problems.push({ file, line: ln, text, severity });
  }
  return problems.slice(0, 80);
}

function parseSelectionBlock(text) {
  const m = String(text || "").match(/BEGIN_SELECTION\r?\n([\s\S]*?)END_SELECTION/);
  if (m) return m[1].replace(/\n$/, "");
  // fallback: if model returned raw rewrite without markers
  const trimmed = String(text || "").trim();
  if (trimmed && !trimmed.includes("BEGIN_FILE")) return trimmed;
  return "";
}

function InlineEditBar({ state, onChangePrompt, onSubmit, onAccept, onReject, onClose }) {
  const inputRef = useRef(null);
  useEffect(() => {
    if (state) setTimeout(() => inputRef.current?.focus(), 40);
  }, [state?.openTick]);
  if (!state) return null;
  const lines = Math.max(1, state.endLineNumber - state.startLineNumber + 1);
  return (
    <div className="inline-edit" role="dialog" aria-label="Inline Edit">
      <div className="inline-edit-head">
        <Icon name="sparkle" size={14} />
        <strong>Inline Edit</strong>
        <span className="inline-edit-meta">L{state.startLineNumber}–{state.endLineNumber} · {lines} 行</span>
        <button type="button" className="ghost-btn sm" onClick={onClose} title="Esc">
          <Icon name="close" size={12} />
        </button>
      </div>
      {!state.preview ? (
        <form
          className="inline-edit-form"
          onSubmit={(e) => { e.preventDefault(); onSubmit(); }}
        >
          <input
            ref={inputRef}
            value={state.prompt}
            onChange={(e) => onChangePrompt(e.target.value)}
            placeholder="描述如何改写选区…（Enter 生成，Esc 取消）"
            disabled={state.busy}
            onKeyDown={(e) => {
              if (e.key === "Escape") { e.preventDefault(); onClose(); }
            }}
          />
          <button type="submit" className="send" disabled={state.busy}>
            {state.busy ? "生成中…" : "生成"}
          </button>
        </form>
      ) : (
        <div className="inline-edit-preview">
          <pre>{state.preview}</pre>
          <div className="inline-edit-actions">
            <button type="button" className="ghost-btn sm" onClick={onReject}>重新生成</button>
            <button type="button" className="ghost-btn sm" onClick={onClose}>拒绝</button>
            <button type="button" className="ghost-btn sm amber" onClick={onAccept}>接受</button>
          </div>
        </div>
      )}
    </div>
  );
}

function buildSyncAnchors(src) {
  const lines = String(src || "").split("\n");
  const anchors = [];
  for (let i = 0; i < lines.length; i++) {
    const sec = lines[i].match(/\\(part|chapter|section|subsection|subsubsection)\*?\{([^}]*)\}/);
    const lab = lines[i].match(/\\label\{([^}]*)\}/);
    const eq = lines[i].match(/\\begin\{(equation|align|figure|table)\*?\}/);
    if (sec) anchors.push({ line: i + 1, kind: sec[1], title: sec[2], key: `sec:${sec[2]}` });
    else if (lab) anchors.push({ line: i + 1, kind: "label", title: lab[1], key: `lab:${lab[1]}` });
    else if (eq) anchors.push({ line: i + 1, kind: eq[1], title: eq[1], key: `env:${eq[1]}:${i}` });
  }
  const total = Math.max(lines.length, 1);
  return anchors.map((a, idx) => ({
    ...a,
    page: Math.max(1, Math.min(12, Math.ceil((a.line / total) * Math.max(3, Math.ceil(anchors.length / 2))) || idx + 1)),
  }));
}

function nearestAnchor(anchors, line) {
  if (!anchors?.length) return null;
  let best = anchors[0];
  let bestDist = Math.abs(best.line - line);
  for (const a of anchors) {
    const d = Math.abs(a.line - line);
    if (d < bestDist || (d === bestDist && a.line <= line)) {
      best = a;
      bestDist = d;
    }
  }
  return best;
}

function TreeNode({ node, depth, activePath, onOpen, onRename, onDelete, expanded, toggle }) {
  if (shouldHideNode(node)) return null;
  const isDir = node.type === "dir";
  const open = expanded.has(node.path);
  const pad = 8 + depth * 14;
  const visibleChildren = (node.children || []).filter((ch) => !shouldHideNode(ch));
  if (isDir && visibleChildren.length === 0 && !(node.children || []).length) {
    // keep empty dirs
  }
  const ico = fileIconName(node.name, isDir, open);
  return (
    <>
      <div
        className={`row ${!isDir && activePath === node.path ? "active" : ""}`}
        style={{ paddingLeft: pad }}
        title={node.path}
        onClick={() => {
          if (isDir) toggle(node.path);
          else onOpen(node);
        }}
      >
        {isDir ? (
          <span className={`twist ${open ? "open" : ""}`}>
            <Icon name="chevron" size={12} />
          </span>
        ) : (
          <span className="twist spacer" />
        )}
        <span className={`file-ico ${isDir ? "dir" : ico}`}>
          <Icon name={ico} size={14} />
        </span>
        <span className="name">{node.name}</span>
        {!isDir && (
          <span className="row-actions">
            <button className="tree-act" onClick={(e) => { e.stopPropagation(); onRename(node.path); }} title="Rename">
              <Icon name="pencil" size={12} />
            </button>
            <button className="tree-act danger" onClick={(e) => { e.stopPropagation(); onDelete(node.path, node.name); }} title="Delete">
              <Icon name="close" size={12} />
            </button>
          </span>
        )}
      </div>
      {isDir && open && visibleChildren.map((ch) => (
        <TreeNode
          key={ch.path}
          node={ch}
          depth={depth + 1}
          activePath={activePath}
          onOpen={onOpen}
          onRename={onRename}
          onDelete={onDelete}
          expanded={expanded}
          toggle={toggle}
        />
      ))}
    </>
  );
}

function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => (
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia(query).matches
      : false
  ));
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return undefined;
    const list = window.matchMedia(query);
    const onChange = (event) => setMatches(event.matches);
    setMatches(list.matches);
    list.addEventListener("change", onChange);
    return () => list.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}

// Below this width the eight menu roots no longer fit beside the Workspace
// chip and mode switch; the same menus fold into one "≡" dropdown.
const MENUBAR_COMPACT_QUERY = "(max-width: 1100px)";

function MenuBar({ onAction, capabilities = [] }) {
  const [open, setOpen] = useState(null);
  const rootRef = useRef(null);
  const compact = useMediaQuery(MENUBAR_COMPACT_QUERY);
  const menus = [
    {
      id: "file", label: "文件(F)", items: [
        { id: "new", label: "新建文件", hint: "Ctrl+N" },
        { id: "save", label: "保存", hint: "Ctrl+S" },
        { id: "save-all", label: "全部保存" },
        { sep: true },
        { id: "workspace", label: "切换工作区…" },
        { sep: true },
        { id: "settings", label: "设置", hint: "Ctrl+," },
      ],
    },
    {
      id: "edit", label: "编辑(E)", items: [
        { id: "undo", label: "撤销", hint: "Ctrl+Z" },
        { id: "redo", label: "重做", hint: "Ctrl+Y" },
        { sep: true },
        { id: "find", label: "查找", hint: "Ctrl+F" },
        { id: "replace", label: "替换", hint: "Ctrl+H" },
        { id: "snippets", label: "插入片段", hint: "Ctrl+Shift+K" },
      ],
    },
    {
      id: "selection", label: "选择(S)", items: [
        { id: "select-all", label: "全选", hint: "Ctrl+A" },
        { id: "expand-sel", label: "扩大选区" },
      ],
    },
    {
      id: "view", label: "查看(V)", items: [
        { id: "view-explorer", label: "资源管理器" },
        { id: "view-search", label: "搜索" },
        { id: "view-outline", label: "大纲" },
        { id: "view-tasks", label: "Paperctl 任务", capability: "paperctl" },
        { id: "view-terminal", label: "终端", hint: "Ctrl+`" },
        { id: "view-extensions", label: "扩展" },
        { id: "cmd", label: "命令面板", hint: "Ctrl+Shift+P" },
        { id: "magnifier", label: "证据放大镜", hint: "Ctrl+Shift+E", capability: "evidence" },
      ],
    },
    {
      id: "go", label: "转到(G)", items: [
        { id: "goto-file", label: "转到文件…", hint: "Ctrl+P" },
        { id: "goto-line", label: "转到行…" },
        { id: "goto-symbol", label: "转到符号…" },
      ],
    },
    {
      id: "run", label: "运行(R)", items: [
        { id: "compile", label: "编译 LaTeX", hint: "Ctrl+Shift+B", capability: "latex" },
        { id: "install-tectonic", label: "安装 / 重装 Tectonic", capability: "latex" },
      ],
    },
    {
      id: "tasks", label: "任务(T)", capability: "paperctl", items: [
        { id: "view-tasks", label: "Paperctl 任务", capability: "paperctl" },
        { id: "clear-log", label: "清空输出" },
      ],
    },
    {
      id: "help", label: "帮助(H)", items: [
        { id: "shortcuts", label: "键盘快捷键" },
        { id: "about", label: "关于 Paper OS" },
      ],
    },
  ];

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(null);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(null);
    };
    // mousedown captures before blur; avoids flicker when clicking items
    document.addEventListener("mousedown", onDoc, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const visibleMenus = menus.filter((menu) => !menu.capability || capabilities.includes(menu.capability));
  const renderItems = (m) => m.items
    .filter((item) => !item.capability || capabilities.includes(item.capability))
    .map((it, i) => (
      it.sep ? <div key={`${m.id}-sep-${i}`} className="menu-sep" /> : (
        <button
          type="button"
          key={`${m.id}-${it.id}`}
          role="menuitem"
          onClick={(e) => {
            e.stopPropagation();
            setOpen(null);
            onAction(it.id);
          }}
        >
          <span>{it.label}</span>
          {it.hint && <kbd>{it.hint}</kbd>}
        </button>
      )
    ));

  if (compact) {
    return (
      <div className="menubar compact" ref={rootRef} role="menubar">
        <div className={`menu-root ${open === "all" ? "open" : ""}`}>
          <button
            type="button"
            className={open === "all" ? "on" : ""}
            role="menuitem"
            aria-haspopup="true"
            aria-expanded={open === "all"}
            aria-label="菜单"
            title="菜单"
            data-testid="menubar-compact"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(open === "all" ? null : "all");
            }}
          >
            <Icon name="menu" size={15} />
          </button>
          {open === "all" && (
            <div className="menu-dropdown menu-dropdown-compact" role="menu" onMouseDown={(e) => e.stopPropagation()}>
              {visibleMenus.map((m) => (
                <div key={m.id} className="menu-section">
                  <div className="menu-section-title">{m.label.replace(/\([A-Z]\)$/, "")}</div>
                  {renderItems(m)}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="menubar" ref={rootRef} role="menubar">
      {visibleMenus.map((m) => (
        <div key={m.id} className={`menu-root ${open === m.id ? "open" : ""}`}>
          <button
            type="button"
            className={open === m.id ? "on" : ""}
            role="menuitem"
            aria-haspopup="true"
            aria-expanded={open === m.id}
            onMouseEnter={() => { if (open) setOpen(m.id); }}
            onClick={(e) => {
              e.stopPropagation();
              setOpen(open === m.id ? null : m.id);
            }}
          >
            {m.label}
          </button>
          {open === m.id && (
            <div
              className="menu-dropdown"
              role="menu"
              onMouseDown={(e) => e.stopPropagation()}
            >
              {renderItems(m)}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function OutlinePanel({ source, onJump }) {
  const { sections, labels } = useMemo(() => parseOutline(source), [source]);
  return (
    <div className="sidebar-section">
      <h6>Outline <span style={{ color: "var(--faint)" }}>{sections.length}</span></h6>
      <div className="tree">
        {sections.length === 0 ? (
          <div className="empty-hint">打开 .tex 后显示章节</div>
        ) : sections.map((s) => (
          <div key={`${s.line}-${s.title}`} className="row" style={{ paddingLeft: 6 + s.depth * 10 }} onClick={() => onJump(s.line)}>
            <span className="file-ico outline"><Icon name="outline" size={13} /></span>
            <span className="name">{s.title || s.kind}</span>
            <span className="ext">{s.line}</span>
          </div>
        ))}
      </div>
      <h6>Labels <span style={{ color: "var(--faint)" }}>{labels.length}</span></h6>
      <div className="tree">
        {labels.length === 0 ? (
          <div className="empty-hint">无 \\label</div>
        ) : labels.map((l) => (
          <div key={`${l.line}-${l.id}`} className="row" onClick={() => onJump(l.line)}>
            <span className="file-ico hash"><Icon name="hash" size={13} /></span>
            <span className="name mono">{l.id}</span>
            <span className="ext">{l.line}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SourceControlPanel({ dirtyTabs, onSaveAll, onOpen }) {
  return (
    <div className="sidebar-section">
      <h6>
        Changes
        <button className="link-btn" onClick={onSaveAll} disabled={!dirtyTabs.length}>Save All</button>
      </h6>
      <div className="tree">
        {dirtyTabs.length === 0 ? (
          <div className="empty-hint">工作区干净</div>
        ) : dirtyTabs.map((t) => (
          <div key={t.path} className="row" onClick={() => onOpen({ name: t.name, path: t.path, type: "file" })}>
            <span className="git-badge">M</span>
            <span className="file-ico"><Icon name={fileIconName(t.name, false, false)} size={13} /></span>
            <span className="name">{t.path}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function applyExtensionTheme(monaco, colors) {
  if (!monaco) return;
  if (colors && Object.keys(colors).length) {
    monaco.editor.defineTheme("paperos-extension", buildMonacoTheme(colors));
    monaco.editor.setTheme("paperos-extension");
    return;
  }
  monaco.editor.setTheme("paperos-dark");
}

function registerExtensionLanguages(monaco, languages) {
  if (!monaco) return;
  for (const lang of languages || []) {
    try {
      monaco.languages.register({ id: lang.id, aliases: lang.aliases, extensions: lang.extensions });
    } catch { /* already registered */ }
  }
}

function ExtensionsPanel({ catalog, busy, onInstall, onEnable, onDisable, onUninstall }) {
  const fileRef = useRef(null);
  const extensions = catalog.extensions || [];
  return (
    <div className="sidebar-section" data-testid="extensions-panel">
      <h6>Extensions <span style={{ color: "var(--faint)" }}>{extensions.length}</span></h6>
      <p className="ext-panel-note" data-testid="extensions-note">
        第一层：主题色 + 语言 id。不执行扩展 JS，不是完整 VS Code 插件兼容。
      </p>
      <div className="ext-actions">
        <button
          type="button"
          className="ghost-btn"
          data-testid="extension-install"
          disabled={!!busy}
          onClick={() => fileRef.current?.click()}
        >
          {busy === "install" ? "安装中…" : "安装 .vsix"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".vsix,application/zip"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) onInstall(file);
          }}
        />
      </div>
      {catalog.error ? <p className="ext-panel-note" data-testid="extensions-error">{catalog.error}</p> : null}
      <div className="tree">
        {extensions.length === 0 ? (
          <div className="row" data-testid="extensions-empty">未安装扩展</div>
        ) : extensions.map((ext) => (
          <div
            key={ext.id}
            className="row ext-row"
            data-testid="extension-row"
            data-id={ext.id}
            data-enabled={ext.enabled ? "1" : "0"}
          >
            <span className="file-ico extensions"><Icon name="extensions" size={14} /></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5 }}>{ext.displayName || ext.name}</div>
              <div className="ext-meta">{ext.publisher} · v{ext.version}{ext.enabled ? "" : " · 已禁用"}</div>
              <div className="ext-flags">
                {(ext.compatibility?.supported || []).join(" · ") || "无第一层贡献"}
              </div>
            </div>
            <div className="ext-row-actions">
              {ext.enabled ? (
                <button type="button" className="ghost-btn" data-testid="extension-disable" disabled={!!busy} onClick={() => onDisable(ext.id)}>禁用</button>
              ) : (
                <button type="button" className="ghost-btn" data-testid="extension-enable" disabled={!!busy} onClick={() => onEnable(ext.id)}>启用</button>
              )}
              <button type="button" className="ghost-btn" data-testid="extension-uninstall" disabled={!!busy} onClick={() => onUninstall(ext.id)}>卸载</button>
            </div>
          </div>
        ))}
      </div>
      <div className="ext-matrix" data-testid="extensions-matrix">
        <h6>Compatibility</h6>
        <ul>
          {(catalog.matrix || []).map((row) => (
            <li key={row.id} data-status={row.status}>
              <span className={`ext-status-${row.status}`}>{row.status}</span>
              <span>{row.id}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ───────────── Compile target selection ─────────────
// Deterministic entry choice shared by the compile command and the Render
// stage so the UI always names the file that would actually be compiled.
function pickCompileTarget(tree, active) {
  if (active?.path && /\.tex$/i.test(active.path)) return active.path;
  const texFiles = flattenTree(tree).filter((f) => /\.tex$/i.test(f.path || f.name || ""));
  const prefer = texFiles.find((f) => /(^|\/)main\.tex$/i.test(f.path))
    || texFiles.find((f) => /(^|\/)paper\.tex$/i.test(f.path))
    || texFiles[0];
  return prefer?.path || null;
}

// ───────────── Render stage ─────────────
// Shown in Render mode when there is no compiled PDF on screen. It names
// the real compile target and engine state. When the buffer has math,
// Live drafts fill the body; they never replace the editor.
function RenderStage({
  workspace,
  canCompile,
  compileTarget,
  engine,
  compileJob,
  hiddenPdfVersion,
  source,
  onJumpLine,
  onCompile,
  onCancel,
  onShowPdf,
  onInstallEngine,
  activePath,
}) {
  const tectonicReady = Boolean(engine?.tectonic?.present);
  const latexmkReady = Boolean(engine?.latexmk?.present);
  const engineKnown = engine != null;
  const engineReady = tectonicReady || latexmkReady;
  const running = compileIsRunning(compileJob);
  const engineLabel = !engineKnown
    ? "正在探测本地引擎…"
    : tectonicReady
      ? `Tectonic 就绪${engine.tectonic.source === "bundled" ? "（内置）" : "（系统）"}`
      : latexmkReady
        ? "latexmk 就绪（系统 TeX）"
        : "未检测到 LaTeX 引擎";

  let body;
  if (!workspace) {
    body = (
      <div className="render-empty">
        <strong>没有打开的 Workspace</strong>
        <span>在标题栏选择或创建 Workspace 后，编译产物和可预览的 Resource 会显示在这里。</span>
      </div>
    );
  } else if (hiddenPdfVersion) {
    body = (
      <div className="render-empty">
        <strong>PDF 预览已隐藏</strong>
        <span>
          最近一次编译产物 v{hiddenPdfVersion} 仍然可用。
          {compileJob?.pdfFresh === false ? " 它来自更早的成功运行，本次编译没有写出新 PDF。" : ""}
        </span>
        <button type="button" className="ghost-btn sm amber" onClick={onShowPdf}>
          <Icon name="pdf" size={12} /> 显示 PDF
        </button>
      </div>
    );
  } else if (running) {
    body = (
      <div className="render-empty">
        <strong>正在编译</strong>
        <span>
          {compileJob?.entry ? <>正在编译 <code>{compileJob.entry}</code>。</> : "编译已开始。"}
          成功后 PDF 会显示在这里；失败会保留上次成功的产物并标为过期。
        </span>
        <div className="render-actions">
          <button type="button" className="ghost-btn sm" onClick={onCancel} data-testid="compile-cancel">
            取消编译
          </button>
        </div>
      </div>
    );
  } else if (canCompile && (compileJob?.phase === "failed" || compileJob?.phase === "timeout" || compileJob?.phase === "cancelled" || compileJob?.phase === "no-engine")) {
    body = (
      <div className="render-empty">
        <strong>{compilePhaseLabel(compileJob.phase)}</strong>
        <span>{compileJob.message || "这次运行没有写出新的 PDF。"}</span>
        <span className={`render-engine ${engineReady ? "ok" : engineKnown ? "missing" : ""}`} data-testid="render-engine">
          {engineLabel}
        </span>
        <div className="render-actions">
          <button
            type="button"
            className="ghost-btn sm amber"
            onClick={onCompile}
            disabled={!compileTarget || !engineReady}
            data-testid="compile-run"
            title={!engineReady ? "先安装或配置 LaTeX 引擎" : "重新编译"}
          >
            <Icon name="play" size={12} /> 重新编译
          </button>
          {engineKnown && !tectonicReady ? (
            <button type="button" className="ghost-btn sm" onClick={onInstallEngine}>
              <Icon name="download" size={12} /> 安装 Tectonic
            </button>
          ) : null}
        </div>
        <LiveMathDrafts source={source} onJump={onJumpLine} />
      </div>
    );
  } else if (canCompile) {
    body = (
      <div className="render-empty">
        <strong>尚无编译产物</strong>
        <span>
          编译成功后 PDF 会显示在这里；源码编辑区在 Render 模式下保持可用。
          {compileTarget ? <> 将编译 <code>{compileTarget}</code>。</> : " 当前 Workspace 还没有 .tex 文件。"}
        </span>
        <span className={`render-engine ${engineReady ? "ok" : engineKnown ? "missing" : ""}`} data-testid="render-engine">
          {engineLabel}
        </span>
        <div className="render-actions">
          {running ? (
            <button
              type="button"
              className="ghost-btn sm"
              onClick={onCancel}
              data-testid="compile-cancel"
              title="取消正在进行的编译"
            >
              取消编译
            </button>
          ) : (
            <button
              type="button"
              className="ghost-btn sm amber"
              onClick={onCompile}
              disabled={!compileTarget || !engineReady}
              data-testid="compile-run"
              title={!engineReady ? "先安装或配置 LaTeX 引擎" : "编译并预览 PDF（Ctrl+Shift+B）"}
            >
              <Icon name="play" size={12} /> 编译 PDF
            </button>
          )}
          {engineKnown && !tectonicReady ? (
            <button type="button" className="ghost-btn sm" onClick={onInstallEngine}>
              <Icon name="download" size={12} /> 安装 Tectonic
            </button>
          ) : null}
        </div>
        <LiveMathDrafts source={source} onJump={onJumpLine} />
      </div>
    );
  } else {
    body = (
      <div className="render-empty">
        <strong>当前 Pack 没有编译预览</strong>
        <span>
          {workspace.packName || workspace.pack} 没有 LaTeX Capability。Render 模式会直接显示已打开的图片和 PDF Resource；
          {activePath ? <> <code>{activePath}</code> 是文本文件，请在左侧编辑区查看。</> : " 打开文件后可在左侧编辑区查看。"}
        </span>
      </div>
    );
  }

  return (
    <div className="render-stage" data-testid="render-stage" role="region" aria-label="Render preview">
      <div className="render-stage-head">
        <span className="render-eyebrow">Render</span>
        <strong>预览</strong>
        <span className="render-stage-note">编译产物与可预览 Resource</span>
      </div>
      <div className="render-stage-body">{body}</div>
    </div>
  );
}

// ───────────── Top-level IDE ─────────────
function IDE() {
  const [user, setUser] = useState(null);
  const [bootError, setBootError] = useState("");
  const [tree, setTree] = useState([]);
  const [openTabs, setOpenTabs] = useState([]);
  const [active, setActive] = useState(null);
  const [editor, setEditor] = useState("");
  const [original, setOriginal] = useState("");
  const [log, setLog] = useState([]);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [mediaPreview, setMediaPreview] = useState(null); // { path, kind, url }
  const [pdfVer, setPdfVer] = useState(0);
  const [compileJob, setCompileJob] = useState(createCompileState);
  const [newFileName, setNewFileName] = useState("");
  const [creating, setCreating] = useState(false);
  const [chat, setChat] = useState([
    { who: "Paper OS Assistant", text: "已连接本地 API。描述文档任务，我会给出执行计划；⌘↩ 发送。", streaming: false },
  ]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState("explorer");
  const [oauth, setOauth] = useState({ busy: false, error: "" });
  const [showWelcome, setShowWelcome] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [replaceQuery, setReplaceQuery] = useState("");
  const [engine, setEngine] = useState(null);
  const [installPct, setInstallPct] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [showSnippets, setShowSnippets] = useState(false);
  const [showCmd, setShowCmd] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [cmdQuery, setCmdQuery] = useState("");
  const [fsStatus, setFsStatus] = useState("");
  const [recentProjects, setRecentProjects] = useState([]);
  const [expanded, setExpanded] = useState(() => new Set(["paper", "sections", "figures", "src", "docs", "notes"]));
  const [bottomTab, setBottomTab] = useState("output");
  const [aiPhase, setAiPhase] = useState("idle");
  const [chatRuntime, setChatRuntime] = useState(null);
  const [proposal, setProposal] = useState(null);
  const [selectionText, setSelectionText] = useState("");
  const [harnessTrace, setHarnessTrace] = useState([]);
  const [harnessTimings, setHarnessTimings] = useState({});
  const [gitStatus, setGitStatus] = useState(null);
  const [termLines, setTermLines] = useState([]);
  const [termInput, setTermInput] = useState("");
  const [termHistory, setTermHistory] = useState([]);
  const [termBusy, setTermBusy] = useState(false);
  const [extensionCatalog, setExtensionCatalog] = useState({
    extensions: [],
    languages: [],
    themes: [],
    matrix: [],
    host: null,
    error: "",
  });
  const [extensionBusy, setExtensionBusy] = useState("");
  const [provider, setProvider] = useState(null); // real gateway config (GET /api/provider)
  const [aiTool, setAiTool] = useState("files");
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });
  const [showPdf, setShowPdf] = useState(true);
  const [workMode, setWorkMode] = useState(() => {
    try { return localStorage.getItem("paperos.workMode") === "render" ? "render" : "agent"; } catch { return "agent"; }
  });
  const [syncHit, setSyncHit] = useState(null);
  const [pdfSyncTarget, setPdfSyncTarget] = useState(null);
  const [synctexNote, setSynctexNote] = useState(null);
  const [magnifier, setMagnifier] = useState(false);
  const [evidence, setEvidence] = useState(null);
  const [evidenceBusy, setEvidenceBusy] = useState(false);
  const [applyBusy, setApplyBusy] = useState("");
  const [contest, setContest] = useState("");
  const [contestList, setContestList] = useState([]);
  const [catalogState, setCatalogState] = useState({ loading: false, error: "" });
  const [packs, setPacks] = useState([]);
  const [inlineEdit, setInlineEdit] = useState(null);
  const [toast, setToast] = useState("");
  const esRef = useRef(null);
  const monacoRef = useRef(null);
  const editorRef = useRef(null);
  const splitRef = useRef(null);
  const syncAnchorsRef = useRef([]);
  const chatAbortRef = useRef(null);
  const chatRuntimeRef = useRef(null);
  const harnessClockRef = useRef({ request: 0, preview: 0, apply: 0 });
  const termAbortRef = useRef(null);
  const termEndRef = useRef(null);
  const compiledTexRef = useRef(null);
  // Monotonic request tokens: any in-flight openFile()/loadTree() response
  // whose token no longer matches is stale (workspace switched, another file
  // opened, file renamed) and must be dropped instead of overwriting state.
  const openRequestRef = useRef(0);
  const treeRequestRef = useRef(0);
  // Saves bump the file mtime; absorb our own writes so the "externally
  // modified" banner only fires for genuinely external edits.
  const selfSaveRef = useRef(0);

  const currentWorkspace = contestList.find((workspace) => workspace.id === contest) || null;
  const currentCapabilities = currentWorkspace?.capabilities || [];
  const canCompile = currentCapabilities.includes("latex");
  const canUseEvidence = currentCapabilities.includes("evidence");

  const canRunPaperctl = currentCapabilities.includes("paperctl");
  const compileRunning = compileIsRunning(compileJob);

  function switchWorkMode(nextMode) {
    const next = nextMode === "render" ? "render" : "agent";
    setWorkMode(next);
    try { localStorage.setItem("paperos.workMode", next); } catch { /* private mode */ }
    if (next === "render") setShowPdf(true);
  }

  useEffect(() => {
    if (
      (bottomTab === "latex" && !canCompile) ||
      (bottomTab === "tasks" && !canRunPaperctl)
    ) {
      setBottomTab("output");
    }
  }, [bottomTab, canCompile, canRunPaperctl]);
  function rememberWorkspace(workspaceId) {
    if (!workspaceId) return;
    setRecentProjects((prev) => {
      const validIds = new Set(contestList.map((workspace) => workspace.id));
      validIds.add(workspaceId);
      const next = [
        { id: workspaceId, openedAt: Date.now() },
        ...prev.filter((item) => item.id !== workspaceId && validIds.has(item.id)),
      ].slice(0, 8);
      try { localStorage.setItem("paperos.recent", JSON.stringify(next)); } catch { /* */ }
      return next;
    });
  }

  function resetWorkspaceSession() {
    openRequestRef.current += 1;
    treeRequestRef.current += 1;
    setTree([]);
    setOpenTabs([]);
    setActive(null);
    setEditor("");
    setOriginal("");
    setExternalMtime(null);
    setInlineEdit(null);
    setEvidence(null);
    setMagnifier(false);
    setSyncHit(null);
    setPdfSyncTarget(null);
    setSynctexNote(null);
    compiledTexRef.current = null;
    setCursorPos({ line: 1, col: 1 });
    setBottomTab("output");
    setMediaPreview((previous) => {
      if (previous?.url) URL.revokeObjectURL(previous.url);
      return null;
    });
    setPdfUrl((previous) => {
      if (previous) URL.revokeObjectURL(previous.split("#")[0]);
      return null;
    });
    setPdfVer(0);
    setShowPdf(true);
    setCompileJob(createCompileState());
    setAiPhase("idle");
    setChatRuntime(null);
    setProposal(null);
    setSelectionText("");
    setHarnessTimings({});
    chatRuntimeRef.current = null;
    chatAbortRef.current?.abort();
    termAbortRef.current?.abort();
    setGitStatus(null);
    setTermLines([]);
    setTermInput("");
    setTermBusy(false);
  }

  function switchWorkspace(nextId, options = {}) {
    const { skipConfirm = false, record = true, closeChooser = true } = options;
    if (!nextId) return false;
    if (nextId === contest) {
      if (record) rememberWorkspace(nextId);
      if (closeChooser) setShowWelcome(false);
      return true;
    }
    const hasDirtyBuffers = openTabs.some((tab) => tab.dirty);
    if (!skipConfirm && hasDirtyBuffers && !confirm("当前 Workspace 有未保存更改。切换后将丢弃这些缓冲区，是否继续？")) {
      return false;
    }
    resetWorkspaceSession();
    setContest(nextId);
    if (record) rememberWorkspace(nextId);
    if (closeChooser) setShowWelcome(false);
    return true;
  }

  async function refreshWorkspaces(preferredId = "", options = {}) {
    setCatalogState({ loading: true, error: "" });
    let data;
    try {
      data = await api.get("/api/editor/projects");
    } catch (error) {
      setCatalogState({ loading: false, error: error.message || "Failed to load Workspaces." });
      throw error;
    }
    setCatalogState({ loading: false, error: "" });
    const workspaces = data.projects || [];
    setContestList(workspaces);
    setPacks(data.packs || []);
    const nextId = preferredId || (workspaces.some((workspace) => workspace.id === contest) ? contest : workspaces[0]?.id || "");
    if (!nextId) {
      resetWorkspaceSession();
      setContest("");
      setShowWelcome(true);
      return { workspaces, packs: data.packs || [] };
    }
    if (nextId !== contest) {
      switchWorkspace(nextId, {
        skipConfirm: true,
        record: options.record === true,
        closeChooser: options.closeChooser === true,
      });
    }
    return { workspaces, packs: data.packs || [] };
  }

  async function createOrRegisterWorkspace(payload) {
    const hasDirtyBuffers = openTabs.some((tab) => tab.dirty);
    if (hasDirtyBuffers && !confirm("创建或登记 Workspace 后将切换过去，当前未保存缓冲区会被丢弃。是否继续？")) {
      return null;
    }
    const created = await api.post("/api/editor/projects", payload);
    const workspaceId = created.workspace?.id || created.id;
    await refreshWorkspaces(workspaceId, { record: true, closeChooser: true });
    return created.workspace || contestList.find((workspace) => workspace.id === workspaceId) || { id: workspaceId };
  }

  // Deep link handler + local desktop auto-login (skip account for now)
  useEffect(() => {
    const url = new URL(window.location.href);
    const tokenFromLink = url.searchParams.get("token") || localStorage.getItem("paperos.token");
    if (tokenFromLink) localStorage.setItem("paperos.token", tokenFromLink);

    async function boot() {
      try {
        const d = await api.get("/api/auth/me");
        if (d.user) {
          setUser(d.user);
          setShowWelcome(false);
          return;
        }
      } catch { /* fall through */ }
      try {
        // Local trust handshake: the server hands out a one-time bootstrap
        // cookie that authorizes exactly one local login. Never retry blindly.
        await api.get("/api/auth/bootstrap");
        const local = await api.post("/api/auth/local", {});
        setUser(local.user);
        setShowWelcome(false);
      } catch (e) {
        setBootError(e.message || "本地登录失败");
      }
    }
    boot();
  }, []);

  function handleCompileMessage(msg) {
    if (msg.event === "stdout" || msg.event === "stderr") {
      const lines = String(msg.text).split("\n");
      setLog((l) => [...lines.filter(Boolean), ...l].slice(0, LOG_LINE_CAP));
      return;
    }
    if (msg.event === "start") {
      setCompileJob((prev) => applyCompileEvent(prev, msg));
      setLog((l) => [`[compile] start ${msg.engine}`, ...l].slice(0, LOG_LINE_CAP));
      setBottomTab("latex");
      return;
    }
    if (msg.event === "error") {
      setCompileJob((prev) => applyCompileEvent(prev, msg));
      setLog((l) => [`[compile] ✗ ${msg.message || "engine error"}`, ...l].slice(0, LOG_LINE_CAP));
      return;
    }
    if (msg.event === "done") {
      setCompileJob((prev) => applyCompileEvent(prev, msg));
      setLog((l) => [
        `[compile] done exit=${msg.code} ${msg.durationMs}ms pdf=${msg.pdf ? "ready" : "stale-or-none"}${msg.pdfPath ? ` ${msg.pdfPath}` : ""}${msg.timedOut ? " timedOut" : ""}${msg.cancelled ? " cancelled" : ""}`,
        ...l,
      ].slice(0, LOG_LINE_CAP));
      if (msg.pdf && !keepExistingPdf(msg)) {
        const blob = base64ToBlob(msg.pdf, "application/pdf");
        const next = URL.createObjectURL(blob) + `#v=${Date.now()}`;
        setPdfUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev.split("#")[0]);
          return next;
        });
        setPdfVer((v) => v + 1);
        setShowPdf(true);
        setBottomTab("latex");
      } else if (!msg.succeeded) {
        setBottomTab("problems");
      }
    }
  }

  // WebSocket: live compile log + team events
  useEffect(() => {
    if (!user || !contest) return;
    const proto = location.protocol === "https:" ? "wss" : "ws";
    const url = `${proto}://${location.host}/ws/api`;
    let ws;
    try { ws = new WebSocket(url); } catch { return; }
    esRef.current = ws;
    const channel = `compile:${contest}`;
    ws.onopen = () => {
      ws.send(JSON.stringify({ op: "subscribe", channel }));
    };
    ws.onmessage = (e) => {
      let msg;
      try { msg = JSON.parse(e.data); } catch { return; }
      if (!msg.channel) return;
      if (msg.channel.startsWith("compile:")) handleCompileMessage(msg);
    };
    return () => { try { ws.close(); } catch { /* */ } };
  }, [user, contest]);

  useEffect(() => {
    if (!user || !contest) return;
    let cancelled = false;
    api.get(`/api/editor/compile-status?workspace=${encodeURIComponent(contest)}`)
      .then((status) => {
        if (cancelled) return;
        setCompileJob((prev) => applyCompileStatus(prev, status));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [user, contest]);

  // Load the Workspace catalog once authentication is ready.
  useEffect(() => {
    if (!user) return;
    refreshWorkspaces().catch((error) => {
      setLog((lines) => [`[workspace] ${error.message}`, ...lines].slice(0, 50));
      setShowWelcome(true);
    });
  }, [user]); // eslint-disable-line

  const loadTree = useCallback(async () => {
    if (!user || !contest) {
      setTree([]);
      return;
    }
    const requestId = ++treeRequestRef.current;
    try {
      const d = await api.get(`/api/editor/tree?workspace=${encodeURIComponent(contest)}`);
      if (treeRequestRef.current !== requestId) return; // stale response for a previous workspace
      setTree(d.tree || []);
      if (d.truncated) {
        setLog((l) => ["[tree] 目录过大，文件树已截断显示（可用搜索定位文件）", ...l].slice(0, 50));
      }
    } catch (e) {
      if (treeRequestRef.current !== requestId) return;
      setLog((l) => [`[tree] ${e.message}`, ...l].slice(0, 50));
    }
  }, [user, contest]);
  useEffect(() => { loadTree(); }, [loadTree]);

  // Auto-open main.tex so the center is never a dead landing page
  useEffect(() => {
    if (!user || active || openTabs.length > 0) return;
    if (!tree?.length) return;
    const files = flattenTree(tree);
    const main = files.find((f) => /(^|\/)main\.tex$/i.test(f.path));
    if (main) openFile(main);
  }, [user, tree]); // eslint-disable-line

  // Engine status (Tectonic) + auto-install
  async function loadEngine() {
    try { setEngine(await api.get("/api/engine/status")); } catch (e) { /* */ }
  }
  useEffect(() => { if (user) loadEngine(); }, [user]); // eslint-disable-line
  useEffect(() => { setHarnessTrace(loadHarnessTrace()); }, []);

  // Real AI gateway status — drives the model chip in the AI panel.
  async function loadProviderInfo() {
    try { setProvider(await api.get("/api/provider")); } catch { setProvider(null); }
  }
  useEffect(() => { if (user) loadProviderInfo(); }, [user]); // eslint-disable-line

  function acceptExtensionCatalog(data) {
    setExtensionCatalog({
      extensions: data.extensions || [],
      languages: data.languages || [],
      themes: data.themes || [],
      matrix: data.matrix || [],
      host: data.host || null,
      error: "",
    });
  }
  async function loadExtensions() {
    try {
      acceptExtensionCatalog(await api.get("/api/extensions"));
    } catch (error) {
      setExtensionCatalog((current) => ({ ...current, error: error.message || "扩展目录不可用" }));
    }
  }
  useEffect(() => { if (user) loadExtensions(); }, [user]); // eslint-disable-line
  useEffect(() => { if (user && view === "skills") loadExtensions(); }, [user, view]); // eslint-disable-line
  useEffect(() => {
    const monaco = monacoRef.current;
    if (!monaco) return;
    registerExtensionLanguages(monaco, extensionCatalog.languages);
    applyExtensionTheme(monaco, extensionCatalog.themes?.[0]?.colors);
  }, [extensionCatalog.languages, extensionCatalog.themes]);

  async function mutateExtension(busyKey, work) {
    setExtensionBusy(busyKey);
    try {
      acceptExtensionCatalog(await work());
    } catch (error) {
      setExtensionCatalog((current) => ({ ...current, error: error.message || "扩展操作失败" }));
    } finally {
      setExtensionBusy("");
    }
  }
  async function installExtensionFile(file) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    await mutateExtension("install", () => api.post("/api/extensions/install", {
      filename: file.name,
      content: btoa(binary),
    }));
  }
  useEffect(() => {
    if (!user || !contest) {
      setGitStatus(null);
      return undefined;
    }
    let cancelled = false;
    const load = () => api.get(`/api/editor/git-status?workspace=${encodeURIComponent(contest)}`)
      .then((data) => { if (!cancelled) setGitStatus(data); })
      .catch(() => { if (!cancelled) setGitStatus({ isRepo: false }); });
    load();
    const timer = setInterval(load, 8000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [user, contest]);
  useEffect(() => { termEndRef.current?.scrollIntoView?.({ block: "end" }); }, [termLines]);

  // File watching — poll mtime every 3s; show a "Reload?" banner when the
  // open file changed externally (e.g. the user edited it in another tool,
  // or a Pack task rewrote it).
  const [externalMtime, setExternalMtime] = useState(null);
  useEffect(() => {
    if (!active) return;
    let stopped = false;
    let lastMtime = null;
    let seenSelfSaves = selfSaveRef.current;
    async function tick() {
      if (stopped) return;
      try {
        const r = await fetch(`/api/editor/file?workspace=${encodeURIComponent(contest)}&path=${encodeURIComponent(active.path)}`, { credentials: "same-origin" });
        if (r.ok) {
          const j = await r.json();
          if (lastMtime == null) lastMtime = j.mtime;
          else if (j.mtime !== lastMtime) {
            lastMtime = j.mtime;
            if (selfSaveRef.current !== seenSelfSaves) {
              // mtime moved because we saved — not an external edit
              seenSelfSaves = selfSaveRef.current;
            } else {
              setExternalMtime(j.mtime);
            }
          } else {
            seenSelfSaves = selfSaveRef.current;
          }
        }
      } catch { /* */ }
      if (!stopped) setTimeout(tick, 3000);
    }
    tick();
    return () => { stopped = true; };
  }, [active, contest]); // eslint-disable-line
  function reloadFromDisk() {
    if (!active) return;
    // Explicit user intent: replace the memory buffer with disk state.
    openFile(active, { reload: true });
    setExternalMtime(null);
  }

  // Track recent projects in localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem("paperos.recent");
      if (raw) setRecentProjects(JSON.parse(raw));
    } catch { /* */ }
  }, []);

  async function installTectonic(opts = {}) {
    const force = !!opts.force;
    if (engine?.tectonic?.present && !force) {
      setLog((l) => [`[tectonic] 已就绪 · ${engine.tectonic.detail || engine.tectonic.path || "ok"}（菜单「运行 → 安装/重装」可强制重装）`, ...l].slice(0, LOG_LINE_CAP));
      setBottomTab("latex");
      return;
    }
    if (installPct > 0 && installPct < 100) return;
    setInstallPct(1);
    setBottomTab("latex");
    setLog((l) => ["[tectonic] downloading…", ...l].slice(0, LOG_LINE_CAP));
    let finished = false;
    const es = new EventSource(`/api/engine/install/tectonic${force ? "?force=1" : ""}`, { withCredentials: true });
    const fail = (msg) => {
      if (finished) return;
      finished = true;
      setLog((l) => [`[tectonic] ✗ ${msg}`, ...l].slice(0, LOG_LINE_CAP));
      try { es.close(); } catch { /* */ }
      setInstallPct(0);
    };
    es.addEventListener("start", (e) => {
      setInstallPct(5);
      try {
        const d = JSON.parse(e.data);
        if (d.skipped) {
          finished = true;
          setInstallPct(100);
          setLog((l) => [`[tectonic] ✓ already present ${d.version || ""}`.trim(), ...l].slice(0, LOG_LINE_CAP));
          es.close();
          setTimeout(() => { setInstallPct(0); loadEngine(); }, 400);
          return;
        }
        if (d.version) setLog((l) => [`[tectonic] fetching ${d.version} (${d.asset || ""})`, ...l].slice(0, LOG_LINE_CAP));
      } catch { /* */ }
    });
    es.addEventListener("progress", (e) => {
      try {
        const d = JSON.parse(e.data);
        if (d.phase === "extract") setLog((l) => ["[tectonic] extracting…", ...l].slice(0, LOG_LINE_CAP));
        if (d.percent != null) setInstallPct(Math.max(5, Math.min(99, d.percent)));
      } catch { /* */ }
    });
    es.addEventListener("downloaded", (e) => {
      setInstallPct(95);
      try {
        const d = JSON.parse(e.data);
        setLog((l) => [`[tectonic] downloaded ${Math.round((d.bytes || 0) / 1024 / 1024 * 10) / 10} MB`, ...l].slice(0, LOG_LINE_CAP));
      } catch { /* */ }
    });
    es.addEventListener("done", (e) => {
      if (finished) return;
      finished = true;
      setInstallPct(100);
      let ver = "";
      try { ver = JSON.parse(e.data)?.version || ""; } catch { /* */ }
      setLog((l) => [`[tectonic] ✓ installed ${ver}`.trim(), ...l].slice(0, LOG_LINE_CAP));
      es.close();
      setTimeout(() => { setInstallPct(0); loadEngine(); }, 800);
    });
    es.addEventListener("error", (e) => {
      if (finished) return;
      if (typeof e.data === "string" && e.data.length) {
        try { fail(JSON.parse(e.data).message || e.data); }
        catch { fail(e.data); }
        return;
      }
      if (es.readyState === EventSource.CLOSED) {
        fail("connection closed before install finished");
      }
    });
  }

  // File operations
  async function createFile() {
    if (!newFileName.trim() || creating) return;
    const name = newFileName.trim();
    // Create exactly where the user asked; directory layout is a Pack
    // concern and the generic IDE must not impose a paper/ hierarchy.
    const rel = name;
    try {
      setCreating(true);
      await api.post("/api/editor/file", {
        workspace: contest,
        path: rel,
        content: templateFor(name),
      });
      setNewFileName("");
      await loadTree();
      // open the newly created file
      openFile({ name: rel.split("/").pop(), path: rel, type: "file" });
      setLog((l) => [`[file] created ${rel}`, ...l].slice(0, 50));
    } catch (e) {
      setLog((l) => [`[file] create failed: ${e.message}`, ...l].slice(0, 50));
    } finally {
      setCreating(false);
    }
  }

  async function deleteFile(path, name) {
    if (!confirm(`Delete ${name}? This cannot be undone.`)) return;
    try {
      await api.del(`/api/editor/file?workspace=${encodeURIComponent(contest)}&path=${encodeURIComponent(path)}`);
      setLog((l) => [`[file] deleted ${path}`, ...l].slice(0, 50));
      closeTab(path, { force: true });
      if (active && active.path === path) setActive(null);
      await loadTree();
    } catch (e) {
      setLog((l) => [`[file] delete failed: ${e.message}`, ...l].slice(0, 50));
    }
  }

  async function renameFile(from) {
    const newName = prompt(`Rename to:`, from.split("/").pop());
    if (!newName || newName === from.split("/").pop()) return;
    const to = from.replace(/[^/]+$/, newName);
    try {
      await api.patch("/api/editor/file", { workspace: contest, from, to });
      setLog((l) => [`[file] renamed ${from} → ${to}`, ...l].slice(0, 50));
      setOpenTabs((tabs) => tabs.map((tab) => {
        if (tab.path !== from) return tab;
        return tab.kind === "text"
          ? renameTextBuffer(tab, to, newName)
          : { ...tab, path: to, name: newName };
      }));
      setMediaPreview((preview) => (
        preview?.path === from ? { ...preview, path: to } : preview
      ));
      if (active && active.path === from) {
        openRequestRef.current += 1;
        setActive({ ...active, path: to, name: newName });
      }
      await loadTree();
    } catch (e) {
      setLog((l) => [`[file] rename failed: ${e.message}`, ...l].slice(0, 50));
    }
  }

  const allFiles = useMemo(() => flattenTree(tree), [tree]);
  const activeBuffer = active
    ? openTabs.find((tab) => tab.path === active.path)
    : null;
  const dirty = Boolean(activeBuffer?.dirty);

  async function openFile(file, options = {}) {
    const { reload = false } = options;
    const kind = mediaKind(file.name);
    const requestId = ++openRequestRef.current;
    setActive(file);
    if (kind) {
      setOpenTabs((tabs) => tabs.find((t) => t.path === file.path)
        ? tabs
        : [...tabs, { path: file.path, name: file.name, kind: "media", dirty: false }]);
      setEditor("");
      setOriginal("");
      if (kind === "binary") {
        setMediaPreview({ path: file.path, kind: "binary", url: null, size: null });
        return;
      }
      try {
        const r = await fetch(
          `/api/editor/raw?workspace=${encodeURIComponent(contest)}&path=${encodeURIComponent(file.path)}`,
          { credentials: "same-origin" },
        );
        if (!r.ok) throw new Error(`preview failed (${r.status})`);
        let blob = await r.blob();
        if (openRequestRef.current !== requestId) return; // stale preview response
        if (kind === "pdf" && blob.type !== "application/pdf") {
          blob = blob.slice(0, blob.size, "application/pdf");
        }
        const url = URL.createObjectURL(blob);
        setMediaPreview((prev) => {
          if (prev?.url && prev.path !== file.path) URL.revokeObjectURL(prev.url);
          return { path: file.path, kind, url };
        });
        if (kind === "pdf") {
          setShowPdf(true);
        }
      } catch (e) {
        if (openRequestRef.current !== requestId) return;
        setLog((l) => [`[preview] ${e.message}`, ...l].slice(0, 50));
        setMediaPreview({ path: file.path, kind: "binary", url: null });
      }
      return;
    }
    setMediaPreview((prev) => {
      if (prev?.url) URL.revokeObjectURL(prev.url);
      return null;
    });
    // Restore from the in-memory buffer first: switching tabs must never
    // clobber unsaved edits with disk state.
    const existing = openTabs.find((tab) => tab.path === file.path);
    if (!reload && existing?.kind === "text" && existing.loaded) {
      setEditor(existing.content);
      setOriginal(existing.savedContent);
      return;
    }
    setOpenTabs((tabs) => tabs.find((t) => t.path === file.path)
      ? tabs
      : [...tabs, createTextBuffer({ path: file.path, name: file.name })]);
    // First load: blank the editor so the previous file's content never
    // shows under the newly focused tab while the request is in flight.
    setEditor("");
    setOriginal("");
    try {
      const data = await api.get(`/api/editor/file?workspace=${encodeURIComponent(contest)}&path=${encodeURIComponent(file.path)}`);
      if (openRequestRef.current !== requestId) return; // stale file response
      const content = data.content || "";
      setEditor(content);
      setOriginal(content);
      // loadTextBuffer normalizes kind to "text", so a tab that previously
      // fell back to a binary placeholder recovers once the read succeeds.
      setOpenTabs((tabs) => tabs.map((tab) => (
        tab.path === file.path ? loadTextBuffer(tab, content) : tab
      )));
    } catch (e) {
      if (openRequestRef.current !== requestId) return;
      const msg = String(e.message || "");
      if (e.status === 413 || e.code === "FILE_TOO_LARGE" || /too large|FILE_TOO_LARGE/i.test(msg)) {
        const info = describeOversizedFile(e.payload?.size || EDITOR_OPEN_MAX_BYTES + 1, e.payload?.max || EDITOR_OPEN_MAX_BYTES);
        setMediaPreview({ path: file.path, kind: "oversized", url: null, ...info });
        setOpenTabs((tabs) => tabs.map((tab) => (
          tab.path === file.path ? { ...tab, kind: "media", dirty: false } : tab
        )));
        setEditor("");
        setOriginal("");
      } else if (/binary|415/i.test(msg)) {
        setMediaPreview({ path: file.path, kind: "binary", url: null });
        setOpenTabs((tabs) => tabs.map((tab) => (
          tab.path === file.path ? { ...tab, kind: "media", dirty: false } : tab
        )));
        setEditor("");
        setOriginal("");
      } else {
        setLog((l) => prependCapped(l, [`[file] ${e.message}`], LOG_LINE_CAP));
      }
    }
  }
  function closeTab(path, options = {}) {
    const { force = false } = options;
    const tab = openTabs.find((t) => t.path === path);
    if (!force && tab?.kind === "text" && tab.dirty
      && !confirm(`${tab.name} 有未保存更改。关闭将丢弃这些更改，是否继续？`)) {
      return;
    }
    setOpenTabs((tabs) => tabs.filter((t) => t.path !== path));
    setMediaPreview((prev) => {
      if (prev?.path === path) {
        if (prev.url) URL.revokeObjectURL(prev.url);
        return null;
      }
      return prev;
    });
    if (active && active.path === path) {
      openRequestRef.current += 1; // drop in-flight loads for the closed file
      setActive(null); setEditor(""); setOriginal("");
    }
  }
  // Single writer for editor content: keeps the visible editor and the
  // owning text buffer in lockstep, and recomputes dirty against savedContent.
  function updateActiveBufferContent(value) {
    setEditor(value);
    if (!active) return;
    setOpenTabs((tabs) => tabs.map((tab) => (
      tab.path === active.path && tab.kind === "text"
        ? editTextBuffer(tab, value)
        : tab
    )));
  }
  async function save() {
    if (!active || mediaKind(active.name)) return;
    const snapshot = editor; // per-buffer snapshot at the moment save started
    try {
      setBusy(true);
      await api.put("/api/editor/file", { workspace: contest, path: active.path, content: snapshot });
      selfSaveRef.current += 1;
      setOriginal(snapshot);
      // markTextBufferSaved keeps the buffer dirty when the user kept typing
      // while the request was in flight (content !== snapshot).
      setOpenTabs((tabs) => tabs.map((tab) => (
        tab.path === active.path && tab.kind === "text"
          ? markTextBufferSaved(tab, snapshot)
          : tab
      )));
      setLog((l) => [`[save] ${active.path}`, ...l].slice(0, LOG_LINE_CAP));
    } catch (e) {
      // Save failed: the buffer stays dirty so nothing is silently lost.
      setLog((l) => [`[save] ${e.message}`, ...l].slice(0, LOG_LINE_CAP));
      flash(`保存失败: ${e.message}`);
    } finally { setBusy(false); }
  }
  async function compile() {
    if (!canCompile) {
      flash("当前 Workspace 未启用 LaTeX Capability");
      return;
    }
    if (compileIsRunning(compileJob)) {
      flash("编译进行中 — 先取消再重新编译");
      return;
    }
    const texPath = pickCompileTarget(tree, active);
    if (!texPath) {
      setLog((l) => ["[compile] 未找到 .tex 文件", ...l].slice(0, LOG_LINE_CAP));
      setBottomTab("latex");
      return;
    }
    compiledTexRef.current = texPath;
    setBottomTab("latex");
    setLog((l) => [`[compile] ${texPath} ...`, ...l].slice(0, LOG_LINE_CAP));
    try {
      const accepted = await api.post("/api/editor/compile-live", { workspace: contest, path: texPath });
      setCompileJob((prev) => applyCompileAccepted(prev, accepted, texPath));
    } catch (e) {
      setCompileJob((prev) => applyCompileHttpError(prev, e));
      setLog((l) => [`[compile] ${e.message}`, ...l].slice(0, LOG_LINE_CAP));
    }
  }

  async function cancelCompile() {
    if (!compileIsRunning(compileJob)) return;
    try {
      await api.post("/api/editor/compile-cancel", { workspace: contest });
      setLog((l) => ["[compile] 正在取消…", ...l].slice(0, LOG_LINE_CAP));
    } catch (e) {
      if (e.code !== "NO_ACTIVE_COMPILE") {
        setLog((l) => [`[compile] 取消失败: ${e.message}`, ...l].slice(0, LOG_LINE_CAP));
      }
    }
  }

  function openInlineEdit() {
    const ed = editorRef.current;
    const model = ed?.getModel?.();
    const sel = ed?.getSelection?.();
    if (!ed || !model || !sel || sel.isEmpty()) {
      setShowCmd(true);
      return;
    }
    const text = model.getValueInRange(sel);
    setShowCmd(false);
    setInlineEdit({
      openTick: Date.now(),
      startLineNumber: sel.startLineNumber,
      startColumn: sel.startColumn,
      endLineNumber: sel.endLineNumber,
      endColumn: sel.endColumn,
      text,
      prompt: "",
      preview: "",
      busy: false,
    });
  }

  async function runInlineEdit() {
    if (!inlineEdit || inlineEdit.busy) return;
    const prompt = inlineEdit.prompt.trim() || "Improve clarity and keep valid LaTeX.";
    setInlineEdit((s) => s ? { ...s, busy: true, preview: "" } : s);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          mode: "inline",
          selection: inlineEdit.text,
          prompt,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (!res.ok || !res.body) throw new Error("inline edit failed");
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let acc = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = dec.decode(value, { stream: true });
        for (const line of chunk.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (!data || data === "[DONE]") continue;
          try {
            const obj = JSON.parse(data);
            if (obj.delta) acc += obj.delta;
          } catch { /* */ }
        }
      }
      const preview = parseSelectionBlock(acc) || acc.trim();
      setInlineEdit((s) => s ? { ...s, busy: false, preview } : s);
    } catch (e) {
      setInlineEdit((s) => s ? { ...s, busy: false } : s);
      setLog((l) => [`[inline] ${e.message}`, ...l].slice(0, 50));
    }
  }

  function acceptInlineEdit() {
    if (!inlineEdit?.preview) return;
    const ed = editorRef.current;
    if (!ed) return;
    const range = {
      startLineNumber: inlineEdit.startLineNumber,
      startColumn: inlineEdit.startColumn,
      endLineNumber: inlineEdit.endLineNumber,
      endColumn: inlineEdit.endColumn,
    };
    ed.executeEdits("paperos.inline", [{ range, text: inlineEdit.preview, forceMoveMarkers: true }]);
    const next = ed.getValue();
    updateActiveBufferContent(next);
    setInlineEdit(null);
    ed.focus();
  }

  function flash(msg) {
    setToast(String(msg || ""));
    setLog((l) => [`[ui] ${msg}`, ...l].slice(0, 80));
    window.clearTimeout(flash._t);
    flash._t = window.setTimeout(() => setToast(""), 2600);
  }

  async function openMainOrFirst() {
    const files = flattenTree(tree);
    const prefer = files.find((f) => /(^|\/)main\.tex$/i.test(f.path))
      || files.find((f) => /\.tex$/i.test(f.path))
      || files.find((f) => /\.(md|py|csv|bib)$/i.test(f.path));
    if (!prefer) {
      flash("工作区里还没有可编辑文件");
      setView("explorer");
      return null;
    }
    setView("explorer");
    await openFile(prefer);
    return prefer;
  }

  function requireEditor(actionLabel) {
    if (editorRef.current && active && !mediaKind(active.name)) return true;
    flash(`请先打开文本文件再${actionLabel}`);
    openMainOrFirst();
    return false;
  }

  function handleMenuAction(id) {
    const ed = editorRef.current;
    switch (id) {
      case "new":
        setView("explorer");
        setNewFileName(canCompile ? "untitled.tex" : "untitled.md");
        flash("在左侧输入文件名后回车创建");
        break;
      case "save":
        if (!active) { flash("没有打开的文件"); break; }
        save();
        break;
      case "save-all":
        commitAllDirty();
        break;
      case "workspace":
        setShowWelcome(true);
        break;
      case "settings":
        setShowSettings(true);
        break;
      case "undo":
        if (!requireEditor("撤销")) break;
        ed.trigger("menu", "undo", null);
        break;
      case "redo":
        if (!requireEditor("重做")) break;
        ed.trigger("menu", "redo", null);
        break;
      case "find":
        if (!requireEditor("查找")) break;
        ed.trigger("menu", "actions.find", null);
        break;
      case "replace":
        if (!requireEditor("替换")) break;
        ed.trigger("menu", "editor.action.startFindReplaceAction", null);
        break;
      case "snippets":
        if (!requireEditor("插入片段")) break;
        setShowSnippets(true);
        break;
      case "select-all":
        if (!requireEditor("全选")) break;
        ed.trigger("menu", "editor.action.selectAll", null);
        break;
      case "expand-sel":
        if (!requireEditor("扩大选区")) break;
        ed.trigger("menu", "editor.action.smartSelect.expand", null);
        break;
      case "view-explorer":
        setView("explorer");
        break;
      case "view-search":
        setView("search");
        setSearchOpen(true);
        break;
      case "view-outline":
        setView("outline");
        if (!active) openMainOrFirst();
        break;
      case "view-tasks":
        setBottomTab("tasks");
        flash("任务面板已打开");
        break;
      case "view-terminal":
        openTerminal();
        flash("终端：白名单程序，无 shell 语法");
        break;
      case "view-extensions":
        setView("skills");
        flash("扩展：第一层主题色与语言 id");
        break;
      case "cmd":
        setShowCmd(true);
        break;
      case "magnifier":
        if (!active) { openMainOrFirst().then(() => lookupEvidence(1)); break; }
        lookupEvidence(cursorPos.line);
        break;
      case "goto-file":
        setQuickOpen(true);
        break;
      case "goto-line": {
        if (!requireEditor("转到行")) break;
        const n = Number(prompt("转到行号:", String(cursorPos.line)));
        if (n > 0) jumpToLine(n);
        break;
      }
      case "goto-symbol":
        setView("outline");
        if (!active) openMainOrFirst();
        break;
      case "compile":
        compile();
        break;
      case "install-tectonic":
        installTectonic({ force: true });
        break;
      case "clear-log":
        setLog([]);
        setBottomTab("output");
        flash("输出已清空");
        break;
      case "shortcuts":
        setShowCmd(true);
        flash("在命令面板查看快捷操作");
        break;
      case "about":
        flash("Paper OS IDE v0.5.0 · Local-first LaTeX");
        break;
      default:
        flash(`未实现: ${id}`);
        break;
    }
  }

  // ── Search (Ctrl+Shift+F opens the modal) ──
  async function runSearch(q) {
    if (!q.trim()) { setSearchResults([]); return; }
    try {
      const d = await api.get(`/api/editor/search?workspace=${encodeURIComponent(contest)}&q=${encodeURIComponent(q)}`);
      setSearchResults(d.results || []);
    } catch (e) {
      setLog((l) => [`[search] ${e.message}`, ...l].slice(0, 50));
    }
  }

  // Outline click handler: jump Monaco to line
  function jumpToLine(line) {
    const ed = editorRef.current;
    if (!ed) return;
    ed.revealLineInCenter(line);
    ed.setPosition({ lineNumber: line, column: 1 });
    ed.focus();
  }

  function toggleDir(path) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  const problems = useMemo(() => parseProblems(log), [log]);
  const errorCount = problems.filter((p) => p.severity === "error").length;
  const warnCount = problems.filter((p) => p.severity === "warning").length;
  // Buffers are the single source of truth for dirty state.
  const dirtyTabs = useMemo(() => openTabs.filter((t) => t.dirty), [openTabs]);
  const syncAnchors = useMemo(() => buildSyncAnchors(editor), [editor]);
  useEffect(() => { syncAnchorsRef.current = syncAnchors; }, [syncAnchors]);
  useEffect(() => {
    if (!editor) return;
    updateSyncFromLine(cursorPos.line);
  }, [editor, cursorPos.line, syncAnchors]);

  function updateSyncFromLine(line) {
    setSyncHit((previous) => {
      if (previous?.source === "synctex" && (previous.sourceLine === line || previous.line === line)) {
        return previous;
      }
      const hit = nearestAnchor(syncAnchorsRef.current, line);
      if (!hit) return null;
      return { ...hit, sourceLine: line, source: "estimate" };
    });
  }

  function currentSyncEstimate(line) {
    const hit = nearestAnchor(syncAnchorsRef.current, line);
    if (hit) return { ...hit, sourceLine: line };
    return {
      page: 1,
      title: active?.path || "line",
      kind: "line",
      line,
      sourceLine: line,
    };
  }

  async function jumpPdfToSync(hit) {
    const estimate = hit || currentSyncEstimate(cursorPos.line);
    if (!pdfUrl) {
      flash("先编译出 PDF，再做源码定位");
      return;
    }
    setShowPdf(true);
    const tex = compiledTexRef.current || pickCompileTarget(tree, active) || active?.path;
    try {
      const payload = await api.get(synctexQuery({
        workspace: contest,
        tex,
        mode: "forward",
        path: active?.path || tex,
        line: estimate.sourceLine || estimate.line || cursorPos.line,
      }));
      const preferred = preferSynctexHit(payload, estimate);
      setSyncHit(preferred);
      setSynctexNote(null);
      setPdfSyncTarget({
        page: preferred.page,
        x: preferred.x,
        y: preferred.y,
        token: Date.now(),
      });
      setLog((l) => [`[synctex] ${active?.path || tex}:${preferred.line || estimate.sourceLine} → PDF p.${preferred.page}`, ...l].slice(0, LOG_LINE_CAP));
    } catch (error) {
      const desc = describeSynctexError(error);
      const fallback = preferSynctexHit(null, estimate);
      setSyncHit(fallback);
      setSynctexNote(desc);
      if (fallback?.page) setPdfSyncTarget({ page: fallback.page, x: null, y: null, token: Date.now() });
      flash(desc.message);
      setLog((l) => [`[synctex] ${desc.code}: ${desc.message}`, ...l].slice(0, LOG_LINE_CAP));
    }
  }

  function forwardSyncFromCursor() {
    jumpPdfToSync(currentSyncEstimate(cursorPos.line));
  }

  async function inverseSyncFromPdf({ page, x, y }) {
    const tex = compiledTexRef.current || pickCompileTarget(tree, active) || active?.path;
    if (!tex) {
      flash("没有可对照的 .tex 入口");
      return;
    }
    try {
      const payload = await api.get(synctexQuery({
        workspace: contest,
        tex,
        mode: "inverse",
        page,
        x,
        y,
      }));
      const rel = String(payload.path || tex).replace(/^\.\//, "");
      setSyncHit(preferSynctexHit({ ...payload, path: rel }, null));
      setSynctexNote(null);
      setLog((l) => [`[synctex] PDF p.${page} → ${rel}:${payload.line}`, ...l].slice(0, LOG_LINE_CAP));
      if (active?.path === rel) {
        jumpToLine(payload.line);
        return;
      }
      const file = flattenTree(tree).find((node) => node.path === rel) || {
        name: rel.split("/").pop(),
        path: rel,
        type: "file",
      };
      await openFile(file);
      setTimeout(() => jumpToLine(payload.line), 120);
    } catch (error) {
      const desc = describeSynctexError(error);
      setSynctexNote(desc);
      flash(desc.message);
      setLog((l) => [`[synctex] ${desc.code}: ${desc.message}`, ...l].slice(0, LOG_LINE_CAP));
    }
  }

  async function lookupEvidence(line, q = "") {
    if (!canUseEvidence) {
      flash("当前 Workspace 未启用 Evidence Capability");
      return;
    }
    if (!active) return;
    try {
      setEvidenceBusy(true);
      const params = new URLSearchParams({
        workspace: contest,
        file: active.path,
        line: String(line || cursorPos.line || 1),
      });
      if (q) params.set("q", q);
      const data = await api.get(`/api/editor/evidence?${params}`);
      setEvidence(data);
      setMagnifier(true);
    } catch (e) {
      setLog((l) => [`[evidence] ${e.message}`, ...l].slice(0, LOG_LINE_CAP));
    } finally {
      setEvidenceBusy(false);
    }
  }

  function recordHarness(phase, extra = {}) {
    const durationMs = extra.durationMs ?? stampDuration(harnessClockRef.current[extra.clock]);
    const entry = {
      at: new Date().toISOString(),
      workspace: contest,
      runtime: extra.runtime || chatRuntimeRef.current?.kind || chatRuntime?.kind || "unknown",
      phase,
      blockCount: extra.blockCount ?? proposal?.blocks?.length ?? 0,
      durationMs,
    };
    setHarnessTrace((prev) => {
      const next = appendHarnessTrace(prev, entry);
      saveHarnessTrace(next);
      return next;
    });
    if (extra.clock && durationMs != null) {
      setHarnessTimings((prev) => ({ ...prev, [extra.clock]: durationMs }));
    }
  }

  async function previewFileProposal(text) {
    const parsed = parseFileBlocks(text);
    if (!parsed.length) {
      setProposal(null);
      setAiPhase("complete");
      recordHarness("complete", { blockCount: 0, clock: "request" });
      return;
    }
    setAiPhase("previewing");
    harnessClockRef.current.preview = Date.now();
    try {
      const preview = await api.post("/api/editor/apply-blocks", buildApplyRequest({ workspace: contest, text }));
      const blocks = await Promise.all((preview.blocks || []).map(async (meta) => {
        const proposed = parsed.find((block) => block.path === meta.path);
        let previous = "";
        if (meta.exists) {
          try {
            const current = await api.get(`/api/editor/file?workspace=${encodeURIComponent(contest)}&path=${encodeURIComponent(meta.path)}`);
            previous = current.content || "";
          } catch { previous = ""; }
        }
        return {
          ...meta,
          content: proposed?.content || "",
          diff: buildReplacementDiff(previous, proposed?.content || ""),
        };
      }));
      setProposal({
        state: "ready",
        text,
        baseline: (preview.blocks || []).map(({ path, mtime }) => ({ path, mtime })),
        blocks,
      });
      setAiPhase("ready");
      recordHarness("ready", { blockCount: blocks.length, clock: "preview" });
    } catch (error) {
      setProposal({
        state: "preview-error",
        text,
        error: error.message,
        blocks: parsed.map((block) => ({
          ...block,
          exists: false,
          diff: buildReplacementDiff("", block.content),
        })),
      });
      setAiPhase("failed");
      recordHarness("failed", { blockCount: parsed.length, clock: "preview" });
    }
  }

  async function applyProposal() {
    if (!proposal || proposal.state !== "ready" || applyBusy) return;
    setApplyBusy("apply");
    setAiPhase("applying");
    setProposal((current) => ({ ...current, state: "applying", error: "" }));
    harnessClockRef.current.apply = Date.now();
    try {
      const result = await api.post("/api/editor/apply-blocks", buildApplyRequest({
        workspace: contest,
        text: proposal.text,
        baseline: proposal.baseline,
        apply: true,
      }));
      setProposal((current) => ({ ...current, state: "applied", result }));
      setAiPhase("applied");
      recordHarness("applied", { blockCount: proposal.blocks?.length || 0, clock: "apply" });
      setLog((l) => [`[apply] wrote ${(result.written || []).join(", ")}`, ...l].slice(0, LOG_LINE_CAP));
      await loadTree();
      if (active && (result.written || []).includes(active.path)) {
        await openFile(active, { reload: true });
      }
    } catch (error) {
      if (error.code === "APPLY_CONFLICT") {
        setProposal((current) => ({
          ...current,
          state: "conflict",
          error: error.message,
          conflicts: error.payload?.conflicts || [],
        }));
        recordHarness("conflict", { clock: "apply" });
        flash("文件在预览后被修改，Apply 已中止；请重新预览");
      } else if (error.code === "APPLY_ROLLBACK") {
        setProposal((current) => ({ ...current, state: "rollback", error: error.message }));
        recordHarness("rollback", { clock: "apply" });
        flash("写入失败，所有更改已回滚");
      } else {
        setProposal((current) => ({ ...current, state: "preview-error", error: error.message }));
        recordHarness("failed", { clock: "apply" });
      }
      setAiPhase("ready");
    } finally {
      setApplyBusy("");
    }
  }

  function rejectProposal() {
    if (!proposal || applyBusy) return;
    setProposal((current) => ({ ...current, state: "rejected", error: "", conflicts: [] }));
    setAiPhase("rejected");
    recordHarness("rejected");
  }

  async function refreshProposalPreview() {
    if (!proposal?.text || applyBusy) return;
    setApplyBusy("preview");
    await previewFileProposal(proposal.text);
    setApplyBusy("");
  }

  function cancelChat() {
    chatAbortRef.current?.abort();
    setAiPhase((phase) => (phase === "requesting" || phase === "streaming" ? "idle" : phase));
  }

  function openTerminal() {
    setBottomTab("terminal");
  }

  async function refreshGitStatus() {
    if (!contest) {
      setGitStatus(null);
      return;
    }
    try {
      setGitStatus(await api.get(`/api/editor/git-status?workspace=${encodeURIComponent(contest)}`));
    } catch {
      setGitStatus({ isRepo: false });
    }
  }

  function abortTerminal() {
    termAbortRef.current?.abort();
  }

  async function runTerminal(commandText) {
    const command = String(commandText ?? termInput).trim();
    if (!command || termBusy || !contest) return;
    if (isDangerousTerminalCommand(command)) {
      let parsed;
      try { parsed = validateTerminalCommand(command); } catch { parsed = null; }
      const reason = parsed ? describeDangerousTerminalCommand(parsed) : "该命令可能改写工作区。";
      if (!confirm(`${reason}\n\n确认运行：${command}`)) return;
    }
    setTermHistory((history) => [command, ...history.filter((item) => item !== command)].slice(0, 50));
    setTermLines((lines) => [...lines, { kind: "cmd", text: `$ ${command}` }].slice(-TERM_LINE_CAP));
    setTermInput("");
    setTermBusy(true);
    const controller = new AbortController();
    termAbortRef.current = controller;
    try {
      const response = await fetch("/api/editor/terminal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        signal: controller.signal,
        body: JSON.stringify({ workspace: contest, command }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        setTermLines((lines) => [...lines, { kind: "err", text: err.error || `HTTP ${response.status}` }].slice(-TERM_LINE_CAP));
        return;
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const consume = (raw) => {
        const parsed = parseTerminalSse(raw);
        buffer = parsed.rest;
        for (const frame of parsed.frames) {
          if (frame.event === "stdout") {
            setTermLines((lines) => [...lines, { kind: "out", text: frame.data.text || "" }].slice(-TERM_LINE_CAP));
          } else if (frame.event === "stderr") {
            setTermLines((lines) => [...lines, { kind: "err", text: frame.data.text || "" }].slice(-TERM_LINE_CAP));
          } else if (frame.event === "exit") {
            setTermLines((lines) => [...lines, {
              kind: "sys",
              text: frame.data.error ? `✗ ${frame.data.error}` : `↳ 退出码 ${frame.data.code} · ${frame.data.durationMs}ms`,
            }].slice(-TERM_LINE_CAP));
          }
        }
      };
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        consume(buffer + decoder.decode(value, { stream: true }));
      }
      consume(buffer + decoder.decode());
    } catch (error) {
      if (error.name === "AbortError") {
        setTermLines((lines) => [...lines, { kind: "sys", text: "↳ 已中断" }].slice(-TERM_LINE_CAP));
      } else {
        setTermLines((lines) => [...lines, { kind: "err", text: error.message }].slice(-TERM_LINE_CAP));
      }
    } finally {
      if (termAbortRef.current === controller) termAbortRef.current = null;
      setTermBusy(false);
      refreshGitStatus();
    }
  }

  // "Save All": persist every dirty text buffer with its own snapshot.
  // Buffers whose write fails keep their dirty flag — no silent data loss.
  async function commitAllDirty() {
    const buffers = dirtyTextBuffers(openTabs);
    if (!buffers.length) {
      flash("没有未保存的更改");
      return;
    }
    setBusy(true);
    try {
      const results = await Promise.allSettled(buffers.map((buffer) => (
        api.put("/api/editor/file", { workspace: contest, path: buffer.path, content: buffer.content })
      )));
      const saved = new Map();
      const failed = [];
      results.forEach((result, index) => {
        const buffer = buffers[index];
        if (result.status === "fulfilled") saved.set(buffer.path, buffer.content);
        else failed.push({ path: buffer.path, reason: result.reason?.message || "write failed" });
      });
      setOpenTabs((tabs) => tabs.map((tab) => (
        tab.kind === "text" && saved.has(tab.path)
          ? markTextBufferSaved(tab, saved.get(tab.path))
          : tab
      )));
      if (active && saved.has(active.path)) {
        selfSaveRef.current += 1;
        setOriginal(saved.get(active.path));
      }
      if (saved.size) {
        setLog((l) => [`[save] ${saved.size} buffer${saved.size > 1 ? "s" : ""} saved`, ...l].slice(0, LOG_LINE_CAP));
      }
      if (failed.length) {
        setLog((l) => [
          ...failed.map((f) => `[save] ✗ ${f.path}: ${f.reason}`),
          ...l,
        ].slice(0, LOG_LINE_CAP));
        flash(`${failed.length} 个文件保存失败，已保留未保存状态`);
      } else {
        flash(`已保存全部更改 (${saved.size})`);
      }
    } finally {
      setBusy(false);
    }
  }

  // Breadcrumb click: find the file in the DOM tree and click it.
  // Falls back to a no-op if the tree hasn't rendered yet.
  function jumpToFile(targetPath) {
    const rows = document.querySelectorAll(".tree .row");
    for (const el of rows) {
      if (el.getAttribute("title") === targetPath) { el.click(); return; }
    }
    // try to open via API if not in tree yet
    const name = targetPath.split("/").pop();
    openFile({ name, path: targetPath, type: "file" });
  }
  function jumpToSearchResult(r) {
    setSearchOpen(false);
    setSearchQuery("");
    setSearchResults([]);
    const fname = r.file.split("/").pop();
    openFile({ name: fname, path: r.file, type: "file" }).then(() => {
      setTimeout(() => jumpToLine(r.line), 200);
    });
  }
  // Keyboard shortcut: Ctrl/Cmd+Shift+F search, Cmd+Shift+P palette, Cmd+S save, Cmd+Shift+B compile
  // Ctrl+K: Inline Edit when selection exists, otherwise Command Palette
  useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "F") {
        e.preventDefault();
        setView("search");
        setSearchOpen(true);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "P") {
        e.preventDefault();
        setShowCmd(true);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "K") {
        e.preventDefault();
        setShowSnippets(true);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === "E" || e.key === "e")) {
        e.preventDefault();
        lookupEvidence(cursorPos.line);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.altKey && (e.key === "j" || e.key === "J")) {
        e.preventDefault();
        forwardSyncFromCursor();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.altKey && (e.key === "m" || e.key === "M")) {
        e.preventDefault();
        switchWorkMode(workMode === "agent" ? "render" : "agent");
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.altKey && (e.key === "p" || e.key === "P")) {
        e.preventDefault();
        setShowPdf((v) => !v);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === "B" || e.key === "b")) {
        e.preventDefault();
        compile();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === "s" || e.key === "S")) {
        e.preventDefault();
        commitAllDirty();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === "s" || e.key === "S")) {
        e.preventDefault();
        save();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && (e.key === "p" || e.key === "P")) {
        e.preventDefault();
        setQuickOpen(true);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        openInlineEdit();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && (e.key === "`" || e.code === "Backquote")) {
        e.preventDefault();
        openTerminal();
        return;
      }
      if (e.key === "Escape") {
        if (inlineEdit) { setInlineEdit(null); return; }
        if (searchOpen) setSearchOpen(false);
        if (showCmd) setShowCmd(false);
        if (quickOpen) setQuickOpen(false);
        if (showSnippets) setShowSnippets(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [searchOpen, showCmd, quickOpen, showSnippets, inlineEdit, active, editor, dirty, cursorPos.line, tree, contest, workMode]); // eslint-disable-line


  async function sendChat() {
    const unresolvedProposal = ["ready", "conflict", "rollback"].includes(proposal?.state);
    if (!msg.trim() || busy || applyBusy || unresolvedProposal) return;
    const userText = msg.trim();
    const controller = new AbortController();
    chatAbortRef.current?.abort();
    chatAbortRef.current = controller;
    chatRuntimeRef.current = null;
    setChatRuntime(null);
    setProposal(null);
    setHarnessTimings({});
    setAiPhase("requesting");
    harnessClockRef.current.request = Date.now();
    setChat((c) => appendCapped(c, [
      { who: "你", text: userText, streaming: false },
      { who: "Paper OS Assistant", text: "", streaming: true },
    ], CHAT_MESSAGE_CAP));
    setMsg("");
    setBusy(true);

    let acc = "";
    let buffer = "";
    const updateLastAssistant = (updates) => {
      setChat((c) => {
        const out = c.slice();
        const last = out[out.length - 1];
        if (last?.streaming) out[out.length - 1] = { ...last, ...updates };
        return out;
      });
    };
    const consume = (events) => {
      for (const event of events) {
        if (event.error) {
          throw new Error(event.error.message || event.error.code || "Provider stream failed");
        }
        if (event.meta) {
          const runtime = describeChatRuntime(event.meta);
          chatRuntimeRef.current = runtime;
          setChatRuntime(runtime);
          setAiPhase("streaming");
        }
        if (event.delta) {
          acc += event.delta;
          updateLastAssistant({ text: acc });
        }
        if (event.done) updateLastAssistant({ streaming: false });
      }
    };

    try {
      esRef.current?.close();
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        signal: controller.signal,
        body: JSON.stringify({
          workspace: contest,
          messages: [
            ...chat.filter((c) => !c.streaming).map((c) => ({
              role: c.who === "你" ? "user" : "assistant",
              content: c.text,
            })),
            {
              role: "user",
              content: active
                ? `[file:${active.path}]\n[tool:${aiTool}]\n${userText}`
                : userText,
            },
          ],
        }),
      });
      if (!res.ok || !res.body) throw new Error("chat 失败");
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const parsed = parseSSEBuffer(buffer + dec.decode(value, { stream: true }));
        buffer = parsed.rest;
        consume(parsed.events);
      }
      const tail = parseSSEBuffer(buffer + dec.decode());
      consume(tail.events);
      updateLastAssistant({ text: acc, streaming: false });
      recordHarness("streaming", {
        runtime: chatRuntimeRef.current?.kind,
        clock: "request",
        blockCount: parseFileBlocks(acc).length,
      });
      await previewFileProposal(acc);
    } catch (e) {
      if (e.name === "AbortError") {
        updateLastAssistant({ text: acc || "已取消", streaming: false });
        return;
      }
      updateLastAssistant({ text: `⚠ ${e.message}`, streaming: false });
      setAiPhase("failed");
      recordHarness("failed", { clock: "request", runtime: chatRuntimeRef.current?.kind });
    } finally {
      if (chatAbortRef.current === controller) chatAbortRef.current = null;
      setBusy(false);
    }
  }

  // Auth handlers
  async function handleEmail(e) {
    e.preventDefault();
    setOauth({ busy: true, error: "" });
    try {
      const data = new FormData(e.currentTarget);
      const username = data.get("username");
      const password = data.get("password");
      const r = await api.post("/api/auth/login", { identifier: username, password });
      setUser(r.user);
    } catch (err) {
      setOauth({ busy: false, error: err.message });
    }
  }
  async function startOAuth(provider) {
    setOauth({ busy: true, error: "" });
    try {
      await oauthStart(provider);
      // poll for token in localStorage (set by deep-link handler)
      for (let i = 0; i < 30; i++) {
        await new Promise((r) => setTimeout(r, 1000));
        try {
          const me = await api.get("/api/auth/me");
          if (me.user) { setUser(me.user); return; }
        } catch { /* still 401 */ }
      }
      setOauth({ busy: false, error: "OAuth 等待超时,请重试。" });
    } catch (err) {
      setOauth({ busy: false, error: err.message });
    }
  }

  if (!user) {
    return (
      <div className="ide-app">
        <div className="titlebar">
          <div className="titlebar-left">
            <div className="titlebar-logo"><BrandLogo size={22} /></div>
            <div className="titlebar-title">Paper OS<span className="ver">starting…</span></div>
          </div>
        </div>
        <div style={{ display: "grid", placeItems: "center", color: "var(--muted)" }}>
          {bootError ? (
            <div style={{ color: "#ffb3a3", padding: 24, maxWidth: 480 }}>
              <div style={{ marginBottom: 12 }}>启动失败: {bootError}</div>
              <button
                onClick={() => window.location.reload()}
                style={{ background: "var(--amber)", color: "#1a0f02", border: 0, borderRadius: 8, padding: "8px 14px", fontWeight: 700 }}
              >重试</button>
            </div>
          ) : (
            <div style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: 22, color: "var(--amber-bright)" }}>
              Paper OS IDE
            </div>
          )}
        </div>
        <div className="statusbar">
          <span className="seg"><span className="dot" />本地模式</span>
        </div>
      </div>
    );
  }

  const initial = (user.displayName || user.username).slice(0, 1).toUpperCase();
  // Layout emphasis only: the mode never changes which state exists, just
  // which column is primary. Media Resources already render in the editor
  // column, so the Render stage only fills in when nothing renders anywhere.
  const pdfVisible = Boolean(pdfUrl && showPdf);
  const activeIsMedia = Boolean(active && mediaPreview && mediaPreview.path === active.path);
  const showRenderStage = workMode === "render" && !pdfVisible && !activeIsMedia;
  const compileTarget = canCompile ? pickCompileTarget(tree, active) : null;
  const providerState = normalizeProviderState(provider);
  const harnessContext = buildHarnessContext({
    workspaceId: contest,
    workspaceName: currentWorkspace?.name || currentWorkspace?.id || "",
    pack: currentWorkspace?.packName || currentWorkspace?.pack || "",
    path: active?.path || "",
    selection: selectionText,
    errorCount,
  });
  const aiPlan = aiPhase === "idle"
    ? []
    : annotatePlanDurations(buildExecutionPlan({
        phase: aiPhase,
        runtime: chatRuntime?.kind || "unknown",
        activePath: active?.path || "",
        blockCount: proposal?.blocks?.length || 0,
      }), harnessTimings);
  const proposalBlocking = ["ready", "conflict", "rollback"].includes(proposal?.state);
  return (
    <div className="ide-app">
      {/* Title bar — Cursor-style: brand · menu · project · Cmd+K · status */}
      <div className="titlebar">
        <div className="titlebar-left">
          <div className="titlebar-logo"><BrandLogo size={22} /></div>
          <div className="titlebar-title">
            Paper OS
            <span className="ver">v0.5.0</span>
          </div>
          <MenuBar onAction={handleMenuAction} capabilities={currentCapabilities} />
          <div className="project-chip" data-testid="workspace-switcher" title={currentWorkspace?.path || "Choose a Workspace"}>
            <span className="chip-label">WORKSPACE</span>
            <select
              aria-label="Switch Workspace"
              value={contest}
              onChange={(e) => switchWorkspace(e.target.value)}
            >
              <option value="" disabled>Choose Workspace</option>
              {contestList.map((workspace) => (
                <option key={workspace.id} value={workspace.id}>
                  {workspace.name || workspace.id}
                </option>
              ))}
            </select>
            {currentWorkspace ? (
              <span className="workspace-pack">{currentWorkspace.packName || currentWorkspace.pack}</span>
            ) : null}
            <button
              className="workspace-add"
              onClick={() => setShowWelcome(true)}
              title="Create or register Workspace"
              aria-label="Create or register Workspace"
            >
              <Icon name="plus" size={12} />
            </button>
          </div>
          <button className="cmdk-btn" onClick={() => setShowCmd(true)} title="Command palette">
            <Icon name="command" size={13} />
            <span>Ctrl+K</span>
            <em>Search commands…</em>
          </button>
        </div>
        <div className="titlebar-right">
          <div className="work-mode-switch" role="group" aria-label="工作模式" data-testid="work-mode-switch">
            <button
              type="button"
              data-testid="work-mode-agent"
              aria-pressed={workMode === "agent"}
              aria-label="Agent 模式"
              className={workMode === "agent" ? "active" : ""}
              onClick={() => switchWorkMode("agent")}
              title="Agent 模式：以编辑器和 AI 任务流为主"
            >
              <Icon name="sparkle" size={13} />
              <span className="mode-label">Agent</span>
            </button>
            <button
              type="button"
              data-testid="work-mode-render"
              aria-pressed={workMode === "render"}
              aria-label="Render 模式"
              className={workMode === "render" ? "active" : ""}
              onClick={() => switchWorkMode("render")}
              title="Render 模式：以 PDF 与预览为主，源码仍可编辑"
            >
              <Icon name="pdf" size={13} />
              <span className="mode-label">Render</span>
            </button>
          </div>
          <span className="status-pill live" data-testid="workspace-status"><span className="dot" />Local</span>
          <span className="status-pill">{currentWorkspace?.packName || "No Pack"}</span>
          <span className="user-chip">
            <span className="user-avatar">{initial}</span>
            <span>{user.displayName || user.username}</span>
          </span>
          <button className="ghost-btn" onClick={() => setShowWelcome(true)}>工作区</button>
        </div>
      </div>

      {/* Activity bar */}
      <div className="activity">
        <button className={view === "explorer" ? "active" : ""} onClick={() => setView("explorer")} title="资源管理器">
          <Icon name="files" size={18} />
        </button>
        <button className={view === "search" ? "active" : ""} onClick={() => { setView("search"); setSearchOpen(false); }} title="搜索">
          <Icon name="search" size={18} />
        </button>
        <button className={view === "outline" ? "active" : ""} onClick={() => setView("outline")} title="大纲">
          <Icon name="outline" size={18} />
        </button>
        <button className={view === "source" ? "active" : ""} onClick={() => setView("source")} title="源代码管理">
          <Icon name="git" size={18} />
        </button>
        <button
          className={view === "skills" ? "active" : ""}
          onClick={() => setView("skills")}
          title="扩展"
          data-testid="extensions-activity"
        >
          <Icon name="extensions" size={18} />
        </button>
        {canUseEvidence ? (
          <button className={magnifier ? "active" : ""} onClick={() => {
            if (magnifier) setMagnifier(false);
            else lookupEvidence(cursorPos.line);
          }} title="证据放大镜">
            <Icon name="magnifier" size={18} />
          </button>
        ) : null}
        <div className="spacer" />
        <button title="设置" onClick={() => setShowSettings(true)}>
          <Icon name="settings" size={17} />
        </button>
      </div>

      {/* Sidebar */}
      <div className="sidebar">
        <div className="sidebar-head">
          <span>{view === "explorer" ? "Explorer" : view === "search" ? "Search" : view === "outline" ? "Outline" : view === "source" ? "Changes" : "Extensions"}</span>
          <span className="badge">{currentWorkspace?.name || "No Workspace"}</span>
        </div>

        {view === "explorer" && (
          <div className="sidebar-section">
            <h6>
              Files <span style={{ color: "var(--faint)" }}>{allFiles.length}</span>
              <button
                onClick={createFile}
                disabled={creating || !newFileName.trim()}
                title="New file"
                className="link-btn"
              >+</button>
            </h6>
            <div className="new-file-row">
              <input
                placeholder={canCompile ? "sections/new.tex…" : "notes/new.md…"}
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") createFile(); }}
              />
            </div>
            <div className="tree">
              {tree.length === 0 ? (
                <div className="empty-hint">空工作区 — 新建或导入文件</div>
              ) : tree.map((n) => (
                <TreeNode
                  key={n.path}
                  node={n}
                  depth={0}
                  activePath={active?.path}
                  onOpen={openFile}
                  onRename={renameFile}
                  onDelete={deleteFile}
                  expanded={expanded}
                  toggle={toggleDir}
                />
              ))}
            </div>
            <OutlinePanel source={editor} onJump={jumpToLine} />
          </div>
        )}

        {view === "search" && (
          <div className="sidebar-section">
            <h6>Find in files</h6>
            <div className="new-file-row">
              <input
                placeholder="搜索内容…"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (e.target.value.length > 1) runSearch(e.target.value);
                  else setSearchResults([]);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && searchQuery.length > 1) runSearch(searchQuery);
                }}
              />
            </div>
            <div className="new-file-row">
              <input
                placeholder="替换为…（当前打开文件）"
                value={replaceQuery}
                onChange={(e) => setReplaceQuery(e.target.value)}
              />
              <button
                className="link-btn"
                title="替换当前文件中全部匹配"
                disabled={!active || !searchQuery || mediaKind(active.name)}
                onClick={() => {
                  if (!active || !searchQuery || !editor.includes(searchQuery)) return;
                  const next = editor.split(searchQuery).join(replaceQuery);
                  updateActiveBufferContent(next);
                  setLog((l) => [`[replace] ${active.path} “${searchQuery}” → “${replaceQuery}”`, ...l].slice(0, 50));
                }}
              >替换</button>
            </div>
            <div className="tree">
              {(searchResults || []).length === 0 ? (
                <div className="empty-hint">{searchQuery ? "无匹配" : "输入关键词 · Ctrl+Shift+F"}</div>
              ) : searchResults.map((r, i) => (
                <div key={`${r.file}-${r.line}-${i}`} className="row" onClick={() => jumpToSearchResult(r)}>
                  <span className="file-ico search"><Icon name="search" size={13} /></span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, color: "var(--amber-bright)", fontFamily: "var(--font-mono)" }}>{r.file}:{r.line}</div>
                    <div style={{ fontSize: 11.5, color: "var(--text-soft)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.text}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {view === "outline" && <OutlinePanel source={editor} onJump={jumpToLine} />}
        {view === "source" && (
          <SourceControlPanel
            dirtyTabs={dirtyTabs}
            onSaveAll={commitAllDirty}
            onOpen={openFile}
          />
        )}
        {view === "skills" && (
          <ExtensionsPanel
            catalog={extensionCatalog}
            busy={extensionBusy}
            onInstall={installExtensionFile}
            onEnable={(id) => mutateExtension("enable", () => api.post(`/api/extensions/${encodeURIComponent(id)}/enable`))}
            onDisable={(id) => mutateExtension("disable", () => api.post(`/api/extensions/${encodeURIComponent(id)}/disable`))}
            onUninstall={(id) => mutateExtension("uninstall", () => api.del(`/api/extensions/${encodeURIComponent(id)}`))}
          />
        )}
      </div>

      {/* Main */}
      <div className="main">
        <div className="tabs-row">
          {active && (
            <div className="breadcrumb">
              <span className="crumb-root">{currentWorkspace?.name || contest}</span>
              {active.path.split("/").map((seg, i, arr) => (
                <React.Fragment key={`${seg}-${i}`}>
                  <span className="crumb-sep">/</span>
                  <button
                    className={`crumb ${i === arr.length - 1 ? "current" : ""}`}
                    onClick={() => {
                      if (i === arr.length - 1) return;
                      const partial = arr.slice(0, i + 1).join("/");
                      setExpanded((prev) => new Set([...prev, partial]));
                    }}
                  >{seg}</button>
                </React.Fragment>
              ))}
              {dirty && <span className="crumb-dirty">● 未保存</span>}
            </div>
          )}
          <div className="tabs">
            {openTabs.length === 0 ? (
              <div className="tab" style={{ color: "var(--faint)" }}>点击左侧文件开始</div>
            ) : openTabs.map((t) => (
              <div
                key={t.path}
                className={`tab ${active && active.path === t.path ? "active" : ""}`}
                onClick={() => {
                  const f = allFiles.find((x) => x.path === t.path);
                  if (f) openFile(f);
                  else openFile({ name: t.name, path: t.path, type: "file" });
                }}
                onAuxClick={(e) => {
                  // middle-click closes, matching mainstream editor muscle memory
                  if (e.button === 1) { e.preventDefault(); closeTab(t.path); }
                }}
              >
                <span className={`tab-ico ${fileIconName(t.name, false, false)}`}>
                  <Icon name={fileIconName(t.name, false, false)} size={13} />
                </span>
                <span>{t.name}</span>
                <span className="tab-tail">
                  {t.dirty ? <span className="dot" /> : null}
                  <span
                    className={`close${t.dirty ? " only-hover" : ""}`}
                    title={t.dirty ? "关闭（有未保存更改）" : "关闭"}
                    onClick={(e) => { e.stopPropagation(); closeTab(t.path); }}
                  >
                    <Icon name="close" size={11} />
                  </span>
                </span>
              </div>
            ))}
            {pdfUrl && (
              <div className={`tab ${showPdf ? "active" : ""}`} onClick={() => setShowPdf(true)}>
                <span className="tab-ico pdf"><Icon name="pdf" size={13} /></span>
                <span>paper.pdf</span>
                <span className="close" onClick={(e) => {
                  e.stopPropagation();
                  if (pdfUrl) URL.revokeObjectURL(pdfUrl.split("#")[0]);
                  setPdfUrl(null);
                  setCompileJob((prev) => ({ ...prev, pdfFresh: null }));
                }}><Icon name="close" size={11} /></span>
              </div>
            )}
          </div>
        </div>

        <div
          className={`split ${pdfVisible ? "with-pdf" : ""} ${showRenderStage ? "with-stage" : ""} ${workMode === "render" ? "render-mode" : "agent-mode"}`}
          data-testid="workbench-split"
          data-mode={workMode}
          data-show-pdf={showPdf ? "1" : "0"}
          ref={splitRef}
        >
          <div className="editor-wrap">
            <div className="editor-host" style={{ position: "relative" }}>
              {externalMtime && (
                <div className="ext-banner">
                  <span>⟲ 文件已外部修改</span>
                  <button onClick={reloadFromDisk}>重新加载</button>
                  <button onClick={() => setExternalMtime(null)} title="忽略">×</button>
                </div>
              )}
              {active && mediaPreview && mediaPreview.path === active.path ? (
                mediaPreview.kind === "oversized" ? (
                  <div className="media-stage binary" data-testid="file-oversized">
                    <div className="binary-card">
                      <Icon name="file" size={28} />
                      <h3>{active.name}</h3>
                      <p>{mediaPreview.message || "文件过大，未载入编辑器"}</p>
                      <p className="mono">{active.path}</p>
                      <button type="button" className="ghost-btn" onClick={() => closeTab(active.path)}>关闭标签</button>
                    </div>
                  </div>
                ) : mediaPreview.kind === "pdf" ? (
                  <div className="media-stage">
                    <div className="media-stage-bar">
                      <Icon name="pdf" size={14} />
                      <span>{active.path}</span>
                      <span className="badge">PDF 预览</span>
                    </div>
                    <iframe src={mediaPreview.url} title={active.name} className="pdf-frame media-frame" />
                  </div>
                ) : mediaPreview.kind === "image" ? (
                  <div className="media-stage image">
                    <div className="media-stage-bar">
                      <Icon name="file" size={14} />
                      <span>{active.path}</span>
                      <span className="badge">图片预览</span>
                    </div>
                    <div className="image-frame">
                      <img src={mediaPreview.url} alt={active.name} />
                    </div>
                  </div>
                ) : (
                  <div className="media-stage binary">
                    <div className="binary-card">
                      <Icon name="file" size={28} />
                      <h3>{active.name}</h3>
                      <p>二进制文件，不能在文本编辑器中打开。</p>
                      <p className="mono">{active.path}</p>
                      <button type="button" className="ghost-btn" onClick={() => closeTab(active.path)}>关闭标签</button>
                    </div>
                  </div>
                )
              ) : active ? (
                <Editor
                  value={editor}
                  language={monacoLanguage(active.name, extensionCatalog.languages)}
                  theme="vs-dark"
                  beforeMount={(m) => {
                    setupLatex(m);
                  }}
                  onMount={(ed, m) => {
                    setupLatex(m);
                    monacoRef.current = m;
                    registerExtensionLanguages(m, extensionCatalog.languages);
                    applyExtensionTheme(m, extensionCatalog.themes?.[0]?.colors);
                    editorRef.current = ed;
                    ed.updateOptions({
                      fontFamily: "JetBrains Mono, Cascadia Code, Consolas, monospace",
                      fontSize: 14,
                      lineHeight: 22,
                      letterSpacing: 0,
                      renderLineHighlight: "line",
                      cursorBlinking: "smooth",
                      cursorWidth: 2,
                      theme: "paperos-dark",
                    });
                    ed.onDidChangeCursorPosition((e) => {
                      setCursorPos({ line: e.position.lineNumber, col: e.position.column });
                      updateSyncFromLine(e.position.lineNumber);
                    });
                    const syncSelection = () => {
                      const model = ed.getModel();
                      const sel = ed.getSelection();
                      if (!model || !sel || sel.isEmpty()) {
                        setSelectionText("");
                        return;
                      }
                      setSelectionText(model.getValueInRange(sel));
                    };
                    syncSelection();
                    ed.onDidChangeCursorSelection(syncSelection);
                    ed.addAction({
                      id: "paperos.evidence",
                      label: "Paper OS: Evidence Lookup",
                      keybindings: [m.KeyMod.CtrlCmd | m.KeyMod.Shift | m.KeyCode.KeyE],
                      run: (editor) => {
                        const pos = editor.getPosition();
                        lookupEvidence(pos?.lineNumber || 1, editor.getModel()?.getLineContent(pos?.lineNumber || 1) || "");
                      },
                    });
                    ed.addAction({
                      id: "paperos.inlineEdit",
                      label: "Paper OS: Inline Edit",
                      keybindings: [m.KeyMod.CtrlCmd | m.KeyCode.KeyK],
                      run: () => openInlineEdit(),
                    });
                    ed.addAction({
                      id: "paperos.compile",
                      label: "Paper OS: Compile",
                      keybindings: [m.KeyMod.CtrlCmd | m.KeyMod.Shift | m.KeyCode.KeyB],
                      run: () => compile(),
                    });
                  }}
                  onChange={(v) => updateActiveBufferContent(v ?? "")}
                  options={{
                    fontFamily: "JetBrains Mono, Cascadia Code, Consolas, monospace",
                    fontSize: 14,
                    lineHeight: 22,
                    letterSpacing: 0,
                    minimap: { enabled: false },
                    wordWrap: "on",
                    padding: { top: 14, bottom: 48 },
                    cursorBlinking: "smooth",
                    cursorWidth: 2,
                    automaticLayout: true,
                    renderLineHighlight: "line",
                    scrollBeyondLastLine: false,
                    readOnly: false,
                  }}
                />
              ) : (
                <div className="empty-editor">
                  <div className="empty-editor-mark"><BrandLogo size={54} badge /></div>
                  <div className="empty-editor-title">开始写作</div>
                  <div className="empty-editor-sub">从工作区打开文件，或直接进入主文档编译预览。</div>
                  <div className="empty-editor-actions">
                    <button type="button" className="primary" onClick={() => openMainOrFirst()}>打开主文档</button>
                    <button type="button" onClick={() => { setView("explorer"); flash("在左侧文件树点击文件"); }}>浏览文件</button>
                    <button type="button" onClick={() => setShowCmd(true)}>命令面板</button>
                    {canCompile ? <button type="button" onClick={() => compile()}>编译 PDF</button> : null}
                  </div>
                  <div className="empty-quick">
                    {flattenTree(tree).filter((f) => /\.(tex|md|py|csv|bib)$/i.test(f.path)).slice(0, 8).map((f) => (
                      <button key={f.path} type="button" className="empty-file" onClick={() => openFile(f)}>
                        <Icon name={fileIconName(f.name, false, false)} size={13} />
                        <span>{f.path}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {syncHit && (
                <div className="sync-chip">
                  <span>L{syncHit.sourceLine || syncHit.line} → {syncHit.kind} “{syncHit.title}”</span>
                  <span className="sync-source" data-testid="sync-source" data-source={syncHit.source || "estimate"}>
                    {syncHit.source === "synctex" ? "SyncTeX" : "估算"}
                  </span>
                  {pdfUrl ? (
                    <button
                      className="sync-page"
                      data-testid="sync-forward"
                      onClick={() => jumpPdfToSync(syncHit)}
                    >
                      PDF p.{syncHit.page}
                    </button>
                  ) : null}
                  <button onClick={() => lookupEvidence(syncHit.sourceLine || syncHit.line, syncHit.title)} title="证据反查">
                    <Icon name="magnifier" size={13} />
                  </button>
                </div>
              )}
              <InlineEditBar
                state={inlineEdit}
                onChangePrompt={(v) => setInlineEdit((s) => s ? { ...s, prompt: v } : s)}
                onSubmit={runInlineEdit}
                onAccept={acceptInlineEdit}
                onReject={() => setInlineEdit((s) => s ? { ...s, preview: "", busy: false } : s)}
                onClose={() => setInlineEdit(null)}
              />
            </div>
          </div>

          {showRenderStage && (
            <RenderStage
              workspace={currentWorkspace}
              canCompile={canCompile}
              compileTarget={compileTarget}
              engine={engine}
              compileJob={compileJob}
              hiddenPdfVersion={pdfUrl && !showPdf ? pdfVer : 0}
              source={editor}
              onJumpLine={jumpToLine}
              onCompile={compile}
              onCancel={cancelCompile}
              onShowPdf={() => setShowPdf(true)}
              onInstallEngine={installTectonic}
              activePath={active?.path || ""}
            />
          )}

          {pdfVisible && (
            <div
              className={`pdf-pane ${compileJob.pdfFresh === false ? "is-stale" : ""}`}
              data-testid="pdf-pane"
              data-fresh={compileJob.pdfFresh === false ? "stale" : "fresh"}
            >
              {syncHit && <div className="sync-bridge" aria-hidden="true" />}
              {synctexNote ? (
                <div
                  className="synctex-note"
                  data-testid="synctex-note"
                  data-code={synctexNote.code}
                  data-degraded={synctexNote.degraded ? "1" : "0"}
                >
                  {synctexNote.message}
                </div>
              ) : null}
              <DesktopPdfPreview
                url={pdfUrl}
                version={pdfVer}
                stale={compileJob.pdfFresh === false}
                syncTarget={pdfSyncTarget}
                onInverseSync={inverseSyncFromPdf}
                onHide={() => setShowPdf(false)}
                onClose={() => {
                  if (pdfUrl) URL.revokeObjectURL(pdfUrl.split("#")[0]);
                  setPdfUrl(null);
                  setPdfSyncTarget(null);
                  setCompileJob((prev) => ({ ...prev, pdfFresh: null }));
                }}
              />
            </div>
          )}

          <div className="ai-panel">
            <div className="ai-head">
              <div className="name">
                <span className="qmark"><BrandLogo size={20} /></span>
                Paper OS Assistant
              </div>
              <div className="ai-head-meta">
                <span
                  className={`ai-mode ai-mode--${workMode}`}
                  data-testid="ai-mode-label"
                  title={workMode === "agent" ? "Agent 模式：编辑器与 AI 任务流为主" : "Render 模式：PDF 与预览为主"}
                >
                  {workMode === "agent" ? "Agent 模式" : "Render 模式"}
                </span>
                <span className="ctx" title={active ? active.path : ""}>{active ? active.path : "no file"}</span>
              </div>
            </div>
            <AiHarnessPanel
              context={harnessContext}
              providerLabel={providerState.label}
              runtime={chatRuntime}
              plan={aiPlan}
              proposal={proposal}
              trace={harnessTrace[0] || null}
              busy={Boolean(applyBusy)}
              streaming={busy || aiPhase === "requesting" || aiPhase === "streaming"}
              onApply={applyProposal}
              onReject={rejectProposal}
              onRefresh={refreshProposalPreview}
              onCancel={cancelChat}
            />
            <div className="ai-stream">
              {chat.map((m, i) => (
                <div key={i} className={`msg ${m.who === "你" ? "user" : "assistant"}`}>
                  <div className="who">{m.who}{m.streaming ? " · 正在输入…" : ""}</div>
                  <div style={{ whiteSpace: "pre-wrap" }}>{m.text}</div>
                </div>
              ))}
            </div>
            <form className="ai-input" onSubmit={(e) => { e.preventDefault(); sendChat(); }}>
              <textarea
                data-testid="ai-input"
                placeholder="描述你想完成的文档任务…"
                value={msg}
                onChange={(e) => setMsg(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault(); sendChat();
                  }
                }}
              />
              <div className="ai-toolbar">
                <button
                  type="button"
                  className="chip model-chip"
                  title={provider?.active?.keyPresent
                    ? `模型网关: ${provider.active.base_url}`
                    : "模型网关未就绪 — 点击配置 provider"}
                  onClick={() => setShowSettings(true)}
                >
                  {provider?.active?.model
                    ? `${provider.active.model}${provider.active.keyPresent ? "" : " (未配 Key)"}`
                    : "配置模型…"}
                </button>
                {[
                  { id: "files", label: "@ Files" },
                  { id: "citations", label: "Citations" },
                  { id: "skills", label: "Extensions" },
                  { id: "mcp", label: "MCP" },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={aiTool === t.id ? "chip on" : "chip"}
                    onClick={() => {
                      setAiTool(t.id);
                      if (t.id === "files") {
                        const ref = active ? `@${active.path} ` : "@";
                        setMsg((m) => (m.includes(ref) ? m : `${m}${m && !m.endsWith(" ") ? " " : ""}${ref}`));
                        flash(active ? `已引用 ${active.path}` : "输入 @ 后接文件路径");
                      } else if (t.id === "citations") {
                        setMsg((m) => `${m}${m ? "\n" : ""}请根据参考文献补全 \\cite{}：`);
                        flash("已插入引用任务提示");
                      } else if (t.id === "skills") {
                        setView("skills");
                        flash("已打开 Extensions 面板");
                      } else if (t.id === "mcp") {
                        setBottomTab("output");
                        setLog((l) => ["[mcp] 本地 MCP 连接器尚未实现，不是已交付能力", ...l].slice(0, 80));
                        flash("MCP：尚未实现");
                      }
                    }}
                  >{t.label}</button>
                ))}
                <button type="submit" className="send" data-testid="ai-send" disabled={!msg.trim() || busy || Boolean(applyBusy) || proposalBlocking}>
                  {busy ? "…" : <><Icon name="send" size={13} /> 发送</>}
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="terminal">
          <div className="terminal-head">
            {[
              { id: "problems", label: `PROBLEMS${problems.length ? ` (${problems.length})` : ""}` },
              { id: "output", label: "OUTPUT" },
              { id: "terminal", label: "TERMINAL" },
              canRunPaperctl ? { id: "tasks", label: "TASKS" } : null,
              canCompile ? { id: "latex", label: "LaTeX" } : null,
            ].filter(Boolean).map((t) => (
              <button
                key={t.id}
                type="button"
                className={bottomTab === t.id ? "label on" : "label"}
                data-testid={t.id === "terminal" ? "terminal-tab" : undefined}
                onClick={() => setBottomTab(t.id)}
              >{t.label}</button>
            ))}
            <span className="term-path">
              {bottomTab === "terminal"
                ? "白名单程序 · 无 shell · cwd = 工作区根"
                : (active ? active.path : "—")}
            </span>
            <span style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>
              {bottomTab === "terminal" ? (
                <>
                  <button type="button" className="ghost-btn sm" data-testid="terminal-abort" onClick={abortTerminal} disabled={!termBusy}>
                    中断
                  </button>
                  <button type="button" onClick={() => setTermLines([])} className="ghost-btn sm">清空</button>
                </>
              ) : (
                <button onClick={() => setLog([])} className="ghost-btn sm">清空</button>
              )}
              {canCompile ? (
                compileRunning ? (
                  <button type="button" onClick={cancelCompile} className="ghost-btn sm" data-testid="compile-cancel">
                    取消编译
                  </button>
                ) : (
                  <button type="button" onClick={compile} className="ghost-btn sm amber" data-testid="compile-run">
                    <Icon name="play" size={12} /> 编译
                  </button>
                )
              ) : null}
              <button onClick={save} disabled={!active || !dirty} className="ghost-btn sm amber">
                <Icon name="save" size={12} /> 保存
              </button>
            </span>
          </div>
          <div className="terminal-stream">
            {bottomTab === "terminal" ? (
              <div data-testid="terminal-stream">
                {termLines.length === 0 ? (
                  <span style={{ color: "var(--faint)" }}>
                    集成终端不是完整 shell。只运行 python / git / node / tectonic 等白名单程序，例如：git status
                  </span>
                ) : termLines.map((line, index) => (
                  <div key={index} className={line.kind === "err" ? "err" : line.kind === "sys" ? "warn" : line.kind === "cmd" ? "ok" : ""}>
                    {line.text}
                  </div>
                ))}
                <span ref={termEndRef} />
              </div>
            ) : bottomTab === "problems" ? (
              problems.length === 0 ? (
                <span style={{ color: "var(--faint)" }}>No problems</span>
              ) : problems.map((p, i) => (
                <div
                  key={i}
                  className={p.severity === "error" ? "err" : "warn"}
                  style={{ cursor: p.line ? "pointer" : "default" }}
                  onClick={async () => {
                    if (p.file && (!active || active.path !== p.file && !active.path.endsWith(p.file))) {
                      const hit = allFiles.find((f) => f.path === p.file || f.path.endsWith("/" + p.file) || f.name === p.file);
                      if (hit) await openFile(hit);
                    }
                    if (p.line) {
                      setBottomTab("problems");
                      setTimeout(() => jumpToLine(p.line), 120);
                    }
                  }}
                >
                  [{p.severity}] {p.file ? `${p.file}:` : ""}{p.line || ""} {p.text}
                </div>
              ))
            ) : log.length === 0 ? (
              <span style={{ color: "var(--faint)" }}>等待输出…</span>
            ) : log.map((l, i) => (
              <div key={i} className={l.startsWith("✓") || l.includes("done exit=0") ? "ok" : l.startsWith("✗") || /error/i.test(l) ? "err" : ""}>
                {l}
              </div>
            ))}
          </div>
          {bottomTab === "terminal" ? (
            <form className="terminal-input" onSubmit={(e) => { e.preventDefault(); runTerminal(termInput); }}>
              <span className="prompt">{termBusy ? "…" : "$"}</span>
              <input
                data-testid="terminal-input"
                value={termInput}
                disabled={termBusy || !contest}
                placeholder="git status"
                spellCheck={false}
                autoComplete="off"
                onChange={(e) => setTermInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowUp" && termHistory.length) {
                    e.preventDefault();
                    setTermInput(termHistory[0]);
                  }
                }}
              />
              <button type="submit" data-testid="terminal-run" disabled={termBusy || !termInput.trim() || !contest}>↵</button>
            </form>
          ) : null}
          {bottomTab === "tasks" && canRunPaperctl && (
            <div className="terminal-input">
              <span className="prompt">$</span>
              <input
                placeholder="paperctl status · verify · build …"
                onKeyDown={async (e) => {
                  if (e.key !== "Enter") return;
                  const cmd = e.currentTarget.value.trim();
                  if (!cmd) return;
                  e.currentTarget.value = "";
                  setBottomTab("tasks");
                  setLog((l) => [`$ paperctl ${cmd}`, ...l].slice(0, LOG_LINE_CAP));
                  try {
                    const r = await api.post("/api/run", { contestId: contest, workspace: contest, command: cmd });
                    setLog((l) => [...(r.stdout ? r.stdout.split("\n").filter(Boolean) : []), ...l].slice(0, LOG_LINE_CAP));
                  } catch (err) {
                    setLog((l) => [`error: ${err.message}`, ...l].slice(0, LOG_LINE_CAP));
                  }
                }}
              />
              <button>↵</button>
            </div>
          )}
        </div>
      </div>

      {toast ? <div className="toast" role="status">{toast}</div> : null}

      {/* Status bar — git chip is live /api/editor/git-status, never a fake branch */}
      <div className="statusbar">
        <span className="seg" title={currentWorkspace?.path || "No Workspace"}>
          <Icon name="folder" size={12} />
          {currentWorkspace ? `${currentWorkspace.name || currentWorkspace.id} · ${currentWorkspace.packName || currentWorkspace.pack}` : "No Workspace"}
        </span>
        <button
          type="button"
          className="seg status-btn"
          data-testid="status-git"
          data-repo={gitStatus?.isRepo ? "1" : "0"}
          title={gitStatus?.isRepo
            ? `git 分支 ${gitStatus.branch}${gitStatus.dirtyCount ? ` · ${gitStatus.dirtyCount} 个未提交变更` : " · 工作树干净"}${gitStatus.ahead ? ` · 领先远端 ${gitStatus.ahead}` : ""}`
            : "此工作区不是 git 仓库（可在终端里 git init）"}
          onClick={() => { refreshGitStatus(); openTerminal(); }}
        >
          <Icon name="git-branch" size={12} />
          {gitStatus == null ? "…" : gitStatus.isRepo
            ? `${gitStatus.branch}${gitStatus.dirtyCount ? ` ·${gitStatus.dirtyCount}` : ""}`
            : "非 git"}
        </button>
        {dirtyTabs.length > 0 ? (
          <button
            className="seg amber status-btn"
            title="有未保存的缓冲区 — 点击查看"
            onClick={() => setView("source")}
          >
            ● {dirtyTabs.length} 未保存
          </button>
        ) : null}
        <span
          className="seg"
          title="Problems"
          style={{ cursor: "pointer" }}
          onClick={() => setBottomTab("problems")}
        >
          <Icon name="error" size={12} /> {errorCount}
          <Icon name="warn" size={12} /> {warnCount}
        </span>
        <span className="seg live"><span className="dot" />本地模式</span>
        <button
          type="button"
          className={`seg status-btn mode-seg ${workMode}`}
          data-testid="status-work-mode"
          onClick={() => switchWorkMode(workMode === "agent" ? "render" : "agent")}
          title={`当前 ${workMode === "agent" ? "Agent" : "Render"} 模式 — 点击切换`}
          aria-label={`当前 ${workMode === "agent" ? "Agent" : "Render"} 模式，点击切换`}
        >
          <Icon name={workMode === "agent" ? "sparkle" : "pdf"} size={12} />
          {workMode === "agent" ? "Agent 模式" : "Render 模式"}
        </button>
        {canCompile ? (
          <button
            type="button"
            className={`seg status-btn compile-seg ${compileJob.phase}`}
            data-testid="status-compile"
            onClick={() => setBottomTab("latex")}
            title={compileJob.message || compilePhaseLabel(compileJob.phase)}
          >
            {compileRunning ? <span className="dot" /> : null}
            {compilePhaseLabel(compileJob.phase)}
          </button>
        ) : null}
        {canCompile ? (
          engine?.tectonic?.present ? (
            <span className="seg live"><span className="dot" />Tectonic</span>
          ) : installPct > 0 ? (
            <span className="seg amber"><span className="dot" />Tectonic {installPct}%</span>
          ) : (
            <button onClick={installTectonic} className="seg amber status-btn" title="下载 Tectonic">
              <Icon name="download" size={12} /> Install Tectonic
            </button>
          )
        ) : null}
        <div className="right">
          <span className="seg">Ln {cursorPos.line}, Col {cursorPos.col}</span>
          <span className="seg">UTF-8</span>
          <span className="seg">
            {!active ? "—" : mediaKind(active.name) === "pdf" ? "PDF" : mediaKind(active.name) === "image" ? "Image" : (monacoLanguage(active.name) === "latex" ? "LaTeX" : monacoLanguage(active.name))}
          </span>
          <button onClick={() => setShowSettings(true)} className="seg status-btn" title="设置">
            <Icon name="settings" size={12} />
          </button>
          <span className="seg">{user.role}</span>
        </div>
      </div>

      {/* Magnifier / Evidence drawer */}
      {magnifier && (
        <div className="magnifier-overlay" onClick={() => setMagnifier(false)}>
          <div className="magnifier-stage" onClick={(e) => e.stopPropagation()}>
            <div className="magnifier-lens">
              <div className="lens-glow" />
              <div className="lens-body">
                <div className="lens-meta">
                  {active?.path || "—"} · L{evidence?.line || cursorPos.line}
                </div>
                <div className="lens-quote">
                  {evidence?.lineText || syncHit?.title || "选中源码行后反查"}
                </div>
              </div>
            </div>
            <aside className="magnifier-drawer">
              <div className="drawer-head">
                <strong>反查</strong>
                <span>{evidenceBusy ? "查询中…" : "claim → result → figure → source"}</span>
                <button onClick={() => setMagnifier(false)}>×</button>
              </div>
              <div className="drawer-body">
                {(evidence?.chain || []).length === 0 && !evidenceBusy && (
                  <div className="empty-hint">未命中 claim-ledger。可在 state/claim-ledger.csv 登记论断。</div>
                )}
                {(evidence?.chain || []).map((c, i) => (
                  <div key={i} className="ev-card">
                    <div className="ev-k">Claim</div>
                    <div className="ev-v">{c.claim}</div>
                    <div className="ev-k">Section</div>
                    <div className="ev-v mono">{c.section || "—"} · {c.status || ""}</div>
                    <div className="ev-k">Results</div>
                    <div className="ev-v mono">{c.results || "—"}</div>
                    <div className="ev-k">Figures</div>
                    <div className="ev-v mono">{c.figures || "—"}</div>
                    <div className="ev-k">Sources</div>
                    <div className="ev-v mono">{c.sources || "—"}</div>
                  </div>
                ))}
                {(evidence?.results || []).slice(0, 3).map((r, i) => (
                  <div key={`r-${i}`} className="ev-card soft">
                    <div className="ev-k">Result row</div>
                    <div className="ev-v mono">{r.metric || r.result_id || "result"} = {r.value} {r.unit}</div>
                    <div className="ev-v mono">{r.script || ""}</div>
                  </div>
                ))}
                {(evidence?.figures || []).slice(0, 3).map((f, i) => (
                  <div key={`f-${i}`} className="ev-card soft">
                    <div className="ev-k">Figure</div>
                    <div className="ev-v mono">{f.path || f.figure_id}</div>
                    <div className="ev-v">{f.caption_claim || f.purpose || ""}</div>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </div>
      )}

      {/* Welcome Screen — shows on first launch / when no project selected */}
      {showWelcome && (
        <WorkspaceChooser
          user={user}
          recent={recentProjects}
          workspaces={contestList}
          packs={packs}
          current={currentWorkspace}
          loading={catalogState.loading}
          loadError={catalogState.error}
          onRetry={() => refreshWorkspaces().catch(() => { /* surfaced via loadError */ })}
          onOpenWorkspace={switchWorkspace}
          onSubmitWorkspace={createOrRegisterWorkspace}
          onDismiss={currentWorkspace ? () => setShowWelcome(false) : null}
        />
      )}

      {/* Quick Open (Ctrl+P) */}
      <QuickOpenModal
        open={quickOpen}
        files={allFiles}
        onPick={(file) => { setQuickOpen(false); openFile(file); }}
        onClose={() => setQuickOpen(false)}
      />

      {/* Search modal (Ctrl+Shift+F) */}
      <SearchModal
        open={searchOpen}
        query={searchQuery}
        onQuery={setSearchQuery}
        results={searchResults}
        onJump={jumpToSearchResult}
        onClose={() => { setSearchOpen(false); setSearchQuery(""); setSearchResults([]); }}
        onQueryChange={(q) => { if (q.length > 2) runSearch(q); else setSearchResults([]); }}
      />

      {/* Settings (AI provider config) */}
      <SettingsModal open={showSettings} onClose={() => setShowSettings(false)} onSaved={loadProviderInfo} />

      {/* Snippets (Ctrl+Shift+K) */}
      <SnippetsPanel
        open={showSnippets}
        onClose={() => setShowSnippets(false)}
        onInsert={(body) => {
          // insert at cursor (replace %CURSOR% with empty string and append)
          const clean = body.replace(/%CURSOR%/g, "").replace(/%FILE%/g, "placeholder").replace(/%LABEL%/g, "fig:1");
          if (active) {
            updateActiveBufferContent(editor + (editor.endsWith("\n") ? "" : "\n") + clean);
          }
        }}
      />

      {/* Command palette (Ctrl+Shift+P) */}
      <CommandPalette
        open={showCmd}
        onClose={() => setShowCmd(false)}
        commands={[
          { id: "cmd.quickopen", cat: "Go",    label: "转到文件…",          hint: "Ctrl+P", run: () => setQuickOpen(true) },
          { id: "cmd.save",    cat: "File",    label: "保存当前文件",       hint: "Ctrl+S", run: () => save() },
          { id: "cmd.saveall", cat: "File",    label: "全部保存",           hint: "Ctrl+Shift+S", run: () => commitAllDirty() },
          { id: "cmd.compile", cat: "Run",     label: "编译 LaTeX",         hint: "Ctrl+Shift+B", capability: "latex", run: () => compile() },
          { id: "cmd.synctex.forward", cat: "Go", label: "源码 → PDF（SyncTeX）", hint: "Ctrl+Alt+J", capability: "latex", run: () => forwardSyncFromCursor() },
          { id: "cmd.compile.cancel", cat: "Run", label: "取消编译", hint: "", capability: "latex", run: () => cancelCompile() },
          { id: "cmd.mode.agent", cat: "View", label: "切换到 Agent 模式",  hint: "Ctrl+Alt+M", run: () => switchWorkMode("agent") },
          { id: "cmd.mode.render", cat: "View", label: "切换到 Render 模式", hint: "Ctrl+Alt+M", run: () => switchWorkMode("render") },
          { id: "cmd.preview.toggle", cat: "View", label: "显示/隐藏 PDF 预览", hint: "Ctrl+Alt+P", run: () => setShowPdf((v) => !v) },
          { id: "cmd.terminal", cat: "View", label: "打开终端", hint: "Ctrl+`", run: () => openTerminal() },
          { id: "cmd.extensions", cat: "View", label: "打开扩展", hint: "", run: () => setView("skills") },
          { id: "cmd.inline",  cat: "AI",      label: "Inline Edit 选区",   hint: "Ctrl+K", run: () => openInlineEdit() },
          { id: "cmd.snippets", cat: "Editor", label: "插入 LaTeX 片段",    hint: "Ctrl+Shift+K", capability: "latex", run: () => setShowSnippets(true) },
          { id: "cmd.search",  cat: "Search",  label: "在文件中搜索",       hint: "Ctrl+Shift+F", run: () => { setView("search"); setSearchOpen(true); } },
          { id: "cmd.evidence", cat: "Review", label: "放大镜证据反查", hint: "Ctrl+Shift+E", capability: "evidence", run: () => lookupEvidence(cursorPos.line) },
          { id: "cmd.settings", cat: "System",  label: "打开设置",          hint: "",     run: () => setShowSettings(true) },
          { id: "cmd.welcome", cat: "System",  label: "打开欢迎页",         hint: "",     run: () => setShowWelcome(true) },
          { id: "cmd.logout",  cat: "Account", label: "退出登录",           hint: "",     run: async () => { await api.post("/api/auth/logout"); setUser(null); } },
          { id: "cmd.install", cat: "Engine",  label: "安装 / 重装 Tectonic", hint: "", capability: "latex", run: () => installTectonic({ force: true }) },
        ].filter((command) => !command.capability || currentCapabilities.includes(command.capability))}
        onRun={(c) => c.run && c.run()}
      />
    </div>
  );
}

// ───────────── Welcome Screen (first launch / no project) ─────────────
// ───────────── Settings modal (AI provider config) ─────────────
function SettingsModal({ open, onClose, onSaved }) {
  const [form, setForm] = useState({ base_url: "", api_key_env: "OPENAI_API_KEY", model: "", temperature: 0.2 });
  const [savedAt, setSavedAt] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [keyPresent, setKeyPresent] = useState(null);

  // Prefill from the live provider config so the form reflects reality
  // instead of hardcoded placeholder values.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    api.get("/api/provider").then((data) => {
      if (cancelled || !data.active) return;
      setForm({
        base_url: data.active.base_url || "",
        api_key_env: data.active.api_key_env || "OPENAI_API_KEY",
        model: data.active.model || "",
        temperature: data.active.temperature ?? 0.2,
      });
      setKeyPresent(data.active.keyPresent);
    }).catch(() => { /* keep defaults; POST will surface errors */ });
    return () => { cancelled = true; };
  }, [open]);

  if (!open) return null;
  return (
    <div className="login-overlay" onClick={onClose}>
      <div
        className="login-card"
        style={{ maxWidth: 540, padding: 28 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="logo" style={{ marginBottom: 16 }}>
          <div className="qmark" style={{ width: 30, height: 30, display: "grid", placeItems: "center" }}>
            <Icon name="settings" size={16} />
          </div>
          <div>
            <div className="name">Paper OS 设置</div>
            <div style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-mono)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
              AI 模型网关 · Tectonic 编译
            </div>
          </div>
        </div>
        {err && <div className="err" style={{ marginBottom: 10 }}>{err}</div>}
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              setBusy(true);
              setErr("");
              await api.post("/api/provider", { ...form, provider: "default" });
              setSavedAt(Date.now());
              if (onSaved) onSaved();
            } catch (err) { setErr(err.message); }
            finally { setBusy(false); }
          }}
        >
          <div className="field">
            <span>Base URL</span>
            <input
              value={form.base_url}
              onChange={(e) => setForm({ ...form, base_url: e.target.value })}
              placeholder="https://api.openai.com/v1"
            />
          </div>
          <div className="grid-2">
            <div className="field">
              <span>API Key 环境变量名 {keyPresent == null ? "" : keyPresent ? "· ✓ 已检测到" : "· ✗ 未设置"}</span>
              <input
                value={form.api_key_env}
                onChange={(e) => setForm({ ...form, api_key_env: e.target.value })}
                placeholder="OPENAI_API_KEY"
              />
            </div>
            <div className="field">
              <span>Model</span>
              <input
                value={form.model}
                onChange={(e) => setForm({ ...form, model: e.target.value })}
                placeholder="gpt-4o"
              />
            </div>
          </div>
          <div className="field">
            <span>Temperature</span>
            <input
              type="number"
              step="0.1"
              min="0"
              max="2"
              value={form.temperature}
              onChange={(e) => setForm({ ...form, temperature: Number(e.target.value) })}
            />
          </div>
          <div className="row" style={{ justifyContent: "space-between", marginTop: 8 }}>
            <span style={{ fontSize: 11, color: "var(--muted)" }}>
              {savedAt ? `✓ 已保存 ${new Date(savedAt).toLocaleTimeString()}` : "配置会写入 product/runtime/providers.local.json"}
            </span>
            <button
              type="submit"
              disabled={busy}
              className={busy ? "is-running" : ""}
              style={{ background: "var(--amber)", color: "#1a0f02", border: 0, borderRadius: 8, padding: "10px 18px", fontWeight: 700, fontSize: 13 }}
            >
              {busy ? "保存中" : "保存"}
            </button>
          </div>
        </form>
        <button
          onClick={onClose}
          style={{ position: "absolute", top: 12, right: 14, background: "transparent", border: 0, color: "var(--muted)", fontSize: 18, cursor: "pointer" }}
        >×</button>
      </div>
    </div>
  );
}

// ───────────── Snippets panel (Cmd+Shift+P) — quick-insert LaTeX blocks ─────────────
const SNIPPETS = [
  { label: "\\begin{figure}",       category: "Floats",    body: "\\begin{figure}[ht]\n  \\centering\n  \\includegraphics[width=0.7\\linewidth]{%FILE%}\n  \\caption{%CURSOR%}\n  \\label{fig:%LABEL%}\n\\end{figure}" },
  { label: "\\begin{table}",        category: "Floats",    body: "\\begin{table}[ht]\n  \\centering\n  \\caption{%CURSOR%}\n  \\label{tab:%LABEL%}\n  \\begin{tabular}{%lcr%}\n    \\hline\n    A & B & C \\\\\n    \\hline\n  \\end{tabular}\n\\end{table}" },
  { label: "\\begin{equation}",    category: "Math",      body: "\\begin{equation}\n  %CURSOR%\n  \\label{eq:%LABEL%}\n\\end{equation}" },
  { label: "\\begin{theorem}",      category: "Theorems",   body: "\\begin{theorem}\n  %CURSOR%\n\\end{theorem}\n\n\\begin{proof}\n  \n\\end{proof}" },
  { label: "\\begin{itemize}",     category: "Lists",     body: "\\begin{itemize}\n  \\item %CURSOR%\n  \\item \n\\end{itemize}" },
  { label: "\\begin{enumerate}",   category: "Lists",     body: "\\begin{enumerate}\n  \\item %CURSOR%\n  \\item \n\\end{enumerate}" },
  { label: "\\input{...}",          category: "Structure", body: "\\input{%CURSOR%}" },
  { label: "\\ref{...}",            category: "References", body: "\\ref{%CURSOR%}" },
  { label: "\\cite{...}",          category: "References", body: "\\cite{%CURSOR%}" },
];

function SnippetsPanel({ open, onClose, onInsert }) {
  const [filter, setFilter] = useState("");
  const filtered = SNIPPETS.filter((s) => !filter || (s.label + s.category).toLowerCase().includes(filter.toLowerCase()));
  if (!open) return null;
  return (
    <div className="login-overlay" onClick={onClose}>
      <div
        className="login-card"
        style={{ maxWidth: 540, padding: 0, overflow: "hidden", maxHeight: "70vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        <input
          autoFocus
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="搜索 LaTeX 片段 (figure, table, equation…)"
          style={{ width: "100%", padding: "14px 18px", background: "transparent", border: 0, borderBottom: "1px solid var(--ink-line)", color: "var(--text)", fontSize: 14, outline: 0 }}
        />
        <div style={{ maxHeight: "calc(70vh - 56px)", overflow: "auto", padding: 4 }}>
          {filtered.length === 0 ? (
            <div style={{ padding: 18, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>无匹配项</div>
          ) : filtered.map((s, i) => (
            <div
              key={i}
              onClick={() => { onInsert(s.body); onClose(); }}
              style={{ padding: "10px 14px", borderRadius: 6, cursor: "pointer", display: "flex", gap: 10, alignItems: "center" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-3)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <span style={{ fontSize: 11, color: "var(--amber-bright)", fontFamily: "var(--font-mono)", width: 64, flexShrink: 0 }}>{s.category}</span>
              <code style={{ fontSize: 12, color: "var(--text)", fontFamily: "var(--font-mono)" }}>{s.label}</code>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ───────────── Command palette (Cmd+Shift+P) ─────────────
function CommandPalette({ open, onClose, onRun, commands }) {
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const ref = useRef(null);
  useEffect(() => { if (open) { setQ(""); setIdx(0); } }, [open]);
  useEffect(() => { setIdx(0); }, [q]);
  // Hooks must all run before the early return — a conditional hook here
  // crashes React with a hook-count mismatch the first time the palette opens.
  useEffect(() => { if (open) setTimeout(() => ref.current?.focus(), 30); }, [open]);
  if (!open) return null;
  const filtered = q ? commands.filter((c) => (c.label + (c.hint || "")).toLowerCase().includes(q.toLowerCase())) : commands;
  return (
    <div className="login-overlay" data-testid="command-palette" onClick={onClose}>
      <div
        className="login-card"
        style={{ maxWidth: 520, padding: 0, overflow: "hidden" }}
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={ref}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(filtered.length - 1, i + 1)); }
            if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)); }
            if (e.key === "Enter" && filtered[idx]) { e.preventDefault(); onRun(filtered[idx]); onClose(); }
            if (e.key === "Escape") onClose();
          }}
          placeholder="输入命令 (Cmd+Shift+P)"
          style={{ width: "100%", padding: "16px 20px", background: "transparent", border: 0, borderBottom: "1px solid var(--ink-line)", color: "var(--text)", fontSize: 15, outline: 0 }}
        />
        <div style={{ maxHeight: 360, overflow: "auto", padding: 4 }}>
          {filtered.length === 0 ? (
            <div style={{ padding: 18, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>无匹配命令</div>
          ) : filtered.map((c, i) => (
            <div
              key={c.id}
              onClick={() => { onRun(c); onClose(); }}
              onMouseEnter={() => setIdx(i)}
              style={{ padding: "10px 14px", borderRadius: 6, cursor: "pointer", display: "flex", alignItems: "center", background: i === idx ? "var(--bg-3)" : "transparent" }}
            >
              <span style={{ fontSize: 11, color: "var(--amber)", fontFamily: "var(--font-mono)", width: 80, flexShrink: 0 }}>{c.cat}</span>
              <span style={{ flex: 1, color: "var(--text)", fontSize: 13 }}>{c.label}</span>
              {c.hint && <span style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>{c.hint}</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ───────────── Quick Open (Ctrl+P) — fuzzy file picker ─────────────
// Subsequence scorer: consecutive runs, word boundaries, and basename hits
// rank higher; long paths get a mild penalty. Returns -1 for non-matches.
function fuzzyScore(query, path) {
  const q = query.toLowerCase();
  const p = path.toLowerCase();
  if (!q) return 0;
  const base = p.lastIndexOf("/") + 1;
  let qi = 0;
  let score = 0;
  let streak = 0;
  for (let i = 0; i < p.length && qi < q.length; i++) {
    if (p[i] === q[qi]) {
      qi += 1;
      streak += 1;
      score += 2 + streak;
      if (i === 0 || i === base) score += 8;
      else if ("/._-".includes(p[i - 1])) score += 6;
      if (i >= base) score += 2;
    } else {
      streak = 0;
    }
  }
  if (qi < q.length) return -1;
  return score - Math.floor(p.length / 8);
}

function QuickOpenModal({ open, files, onPick, onClose }) {
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const ref = useRef(null);
  useEffect(() => {
    if (open) {
      setQ("");
      setIdx(0);
      setTimeout(() => ref.current?.focus(), 30);
    }
  }, [open]);
  useEffect(() => { setIdx(0); }, [q]);
  if (!open) return null;
  const ranked = (q
    ? files
      .map((file) => ({ file, score: fuzzyScore(q, file.path) }))
      .filter((entry) => entry.score >= 0)
      .sort((a, b) => b.score - a.score)
    : files.map((file) => ({ file, score: 0 }))
  ).slice(0, 50);
  return (
    <div className="login-overlay" data-testid="quick-open" onClick={onClose}>
      <div
        className="login-card"
        style={{ maxWidth: 560, padding: 0, overflow: "hidden" }}
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={ref}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(ranked.length - 1, i + 1)); }
            if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)); }
            if (e.key === "Enter" && ranked[idx]) { e.preventDefault(); onPick(ranked[idx].file); }
            if (e.key === "Escape") onClose();
          }}
          placeholder="转到文件… (Ctrl+P)"
          style={{ width: "100%", padding: "16px 20px", background: "transparent", border: 0, borderBottom: "1px solid var(--ink-line)", color: "var(--text)", fontSize: 15, outline: 0 }}
        />
        <div style={{ maxHeight: 380, overflow: "auto", padding: 4 }}>
          {ranked.length === 0 ? (
            <div style={{ padding: 18, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
              {files.length ? "无匹配文件" : "工作区暂无文件"}
            </div>
          ) : ranked.map(({ file }, i) => {
            const slash = file.path.lastIndexOf("/");
            const dir = slash >= 0 ? file.path.slice(0, slash) : "";
            return (
              <div
                key={file.path}
                onClick={() => onPick(file)}
                onMouseEnter={() => setIdx(i)}
                style={{ padding: "9px 14px", borderRadius: 6, cursor: "pointer", display: "flex", gap: 10, alignItems: "center", background: i === idx ? "var(--bg-3)" : "transparent" }}
              >
                <span className={`file-ico ${fileIconName(file.name, false, false)}`} style={{ flexShrink: 0 }}>
                  <Icon name={fileIconName(file.name, false, false)} size={14} />
                </span>
                <span style={{ color: "var(--text)", fontSize: 13, whiteSpace: "nowrap" }}>{file.name}</span>
                <span style={{ color: "var(--faint)", fontSize: 11.5, fontFamily: "var(--font-mono)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{dir}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function WorkspaceChooser({
  user,
  workspaces,
  packs,
  recent = [],
  current,
  loading = false,
  loadError = "",
  onRetry,
  onOpenWorkspace,
  onSubmitWorkspace,
  onDismiss,
}) {
  const initialPack = packs.find((pack) => pack.id === "latex")?.id || packs[0]?.id || "latex";
  const [mode, setMode] = useState("create");
  const [form, setForm] = useState({
    id: "",
    name: "",
    path: "",
    pack: initialPack,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!packs.length || packs.some((pack) => pack.id === form.pack)) return;
    setForm((previous) => ({
      ...previous,
      pack: packs.find((pack) => pack.id === "latex")?.id || packs[0].id,
    }));
  }, [packs, form.pack]);

  // Dialog semantics: trap focus inside, close on Escape, and restore focus
  // to the trigger element when the chooser unmounts.
  useEffect(() => {
    const node = dialogRef.current;
    if (!node) return undefined;
    const previouslyFocused = document.activeElement;
    const focusableSelector = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const firstFocusable = node.querySelector(focusableSelector);
    (firstFocusable || node).focus();

    function onKeyDown(event) {
      if (event.key === "Escape") {
        if (onDismiss) {
          event.stopPropagation();
          onDismiss();
        }
        return;
      }
      if (event.key !== "Tab") return;
      const items = Array.from(node.querySelectorAll(focusableSelector))
        .filter((el) => el.offsetParent !== null);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    node.addEventListener("keydown", onKeyDown);
    return () => {
      node.removeEventListener("keydown", onKeyDown);
      if (previouslyFocused && typeof previouslyFocused.focus === "function") {
        previouslyFocused.focus();
      }
    };
  }, [onDismiss]);

  const recentIds = new Set((recent || []).map((item) => item.id || item).filter(Boolean));
  const ordered = [
    ...(workspaces || []).filter((workspace) => recentIds.has(workspace.id)),
    ...(workspaces || []).filter((workspace) => !recentIds.has(workspace.id)),
  ];
  const selectedPack = packs.find((pack) => pack.id === form.pack);
  const selectedPackRequiresAdapter = Boolean(selectedPack?.adapter);

  function selectMode(nextMode) {
    setMode(nextMode);
    setError("");
    setForm((previous) => ({
      ...previous,
      pack: nextMode === "register"
        ? (packs.find((pack) => pack.id === "general")?.id || previous.pack)
        : previous.pack,
    }));
  }

  async function submit(event) {
    event.preventDefault();
    const id = form.id.trim();
    const name = form.name.trim();
    const folderPath = form.path.trim();
    if (mode === "create" && !id) {
      setError("Workspace ID is required.");
      return;
    }
    if (mode === "register" && !folderPath) {
      setError("Folder path is required.");
      return;
    }
    try {
      setBusy(true);
      setError("");
      const payload = { pack: form.pack };
      if (id) payload.id = id;
      if (name) payload.name = name;
      if (mode === "register") payload.path = folderPath;
      const created = await onSubmitWorkspace(payload);
      if (created) {
        setForm({ id: "", name: "", path: "", pack: initialPack });
      }
    } catch (submitError) {
      setError(submitError.message || "Workspace request failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="login-overlay workspace-overlay"
      data-testid="workspace-chooser"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && onDismiss) onDismiss();
      }}
    >
      <section
        className="workspace-chooser"
        role="dialog"
        aria-modal="true"
        aria-labelledby="workspace-chooser-title"
        ref={dialogRef}
        tabIndex={-1}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="workspace-chooser-head">
          <div className="workspace-brand">
            <div className="workspace-brand-mark"><BrandLogo size={30} badge /></div>
            <div>
              <strong>Paper OS</strong>
              <span>Workspace Kernel</span>
            </div>
          </div>
          <div className="workspace-chooser-title">
            <h1 id="workspace-chooser-title">Open a Workspace</h1>
            <p>Choose a recent folder or start from a Workspace Pack.</p>
          </div>
          {onDismiss ? (
            <button className="workspace-close" onClick={onDismiss} title="Close" aria-label="Close Workspace chooser">
              <Icon name="close" size={15} />
            </button>
          ) : null}
        </header>

        <div className="workspace-chooser-body">
          <div className="workspace-create-pane">
            <div className="workspace-mode" role="tablist" aria-label="Workspace source">
              <button
                type="button"
                role="tab"
                aria-selected={mode === "create"}
                className={mode === "create" ? "active" : ""}
                data-testid="workspace-create"
                onClick={() => selectMode("create")}
              >
                <Icon name="plus" size={14} />
                New from Pack
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === "register"}
                className={mode === "register" ? "active" : ""}
                data-testid="workspace-register"
                onClick={() => selectMode("register")}
              >
                <Icon name="folder" size={14} />
                Existing folder
              </button>
            </div>

            <form className="workspace-form" onSubmit={submit}>
              <div className="workspace-fields">
                <label>
                  <span>Workspace name</span>
                  <input
                    value={form.name}
                    onChange={(event) => setForm({ ...form, name: event.target.value })}
                    placeholder="Research notes"
                    autoComplete="off"
                  />
                </label>
                <label>
                  <span>Workspace ID {mode === "register" ? "(optional)" : ""}</span>
                  <input
                    value={form.id}
                    onChange={(event) => setForm({ ...form, id: event.target.value })}
                    placeholder="research-notes"
                    autoComplete="off"
                    required={mode === "create"}
                  />
                </label>
              </div>

              {mode === "register" ? (
                <label className="workspace-folder-field">
                  <span>Folder path</span>
                  <input
                    value={form.path}
                    onChange={(event) => setForm({ ...form, path: event.target.value })}
                    placeholder="C:\\Users\\name\\Documents\\paper"
                    autoComplete="off"
                    required
                  />
                </label>
              ) : null}

              <fieldset className="pack-picker">
                <legend>Workspace Pack</legend>
                <div className="pack-options">
                  {packs.map((pack) => {
                    const requiresAdapter = Boolean(pack.adapter);
                    const icon = pack.id === "latex"
                      ? "file"
                      : pack.id === "markdown"
                        ? "outline"
                        : pack.id === "math-modeling"
                          ? "magnifier"
                          : "folder";
                    return (
                      <button
                        key={pack.id}
                        type="button"
                        className={form.pack === pack.id ? "pack-option selected" : "pack-option"}
                        onClick={() => setForm({ ...form, pack: pack.id })}
                        aria-pressed={form.pack === pack.id}
                        disabled={busy || requiresAdapter}
                        title={requiresAdapter ? "Compatibility adapter only; open an existing legacy Workspace." : pack.description}
                      >
                        <span className="pack-icon"><Icon name={icon} size={15} /></span>
                        <span className="pack-copy">
                          <strong>{pack.name}</strong>
                          <small>{requiresAdapter ? "Compatibility adapter only" : pack.description}</small>
                        </span>
                        <span className="pack-radio" aria-hidden="true" />
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <div className="workspace-submit-row">
                <div className="workspace-pack-summary">
                  <span>{selectedPack?.name || form.pack}</span>
                  <small>{mode === "register" ? "Folder stays in place" : "Managed by Paper OS"}</small>
                </div>
                <button className="workspace-submit" type="submit" disabled={busy || !packs.length || selectedPackRequiresAdapter}>
                  {busy ? "Working..." : mode === "register" ? "Register folder" : "Create Workspace"}
                  <Icon name="chevron" size={14} />
                </button>
              </div>
              {error ? <div className="workspace-error" role="alert">{error}</div> : null}
            </form>
          </div>

          <aside className="workspace-list-pane">
            <div className="workspace-list-head">
              <div>
                <span>Workspaces</span>
                <strong>{ordered.length}</strong>
              </div>
              <small>{current ? current.name : "No active Workspace"}</small>
            </div>
            <div className="workspace-list" data-testid="workspace-list" aria-busy={loading}>
              {loadError ? (
                <div className="workspace-load-error" role="alert">
                  <strong>Workspaces failed to load</strong>
                  <small>{loadError}</small>
                  {onRetry ? (
                    <button type="button" className="workspace-retry" onClick={onRetry} disabled={loading}>
                      {loading ? "Retrying…" : "Retry"}
                    </button>
                  ) : null}
                </div>
              ) : loading && !ordered.length ? (
                <div className="workspace-loading">Loading Workspaces…</div>
              ) : ordered.length ? ordered.map((workspace) => {
                const isCurrent = workspace.id === current?.id;
                const isMissing = workspace.status === "missing";
                const source = workspace.source === "legacy-contest"
                  ? "Legacy adapter"
                  : workspace.source === "external"
                    ? "External"
                    : "Managed";
                const status = isMissing
                  ? "Missing"
                  : workspace.status === "verified"
                    ? "Verified"
                    : workspace.status === "built"
                      ? "Built"
                      : workspace.status === "failing"
                        ? "Build failed"
                        : "Ready";
                return (
                  <button
                    key={workspace.id}
                    className={isCurrent ? "workspace-row current" : "workspace-row"}
                    onClick={() => onOpenWorkspace(workspace.id)}
                    disabled={isMissing}
                    title={workspace.path}
                  >
                    <span className="workspace-row-main">
                      <span className="workspace-row-name">
                        <strong>{workspace.name || workspace.id}</strong>
                        {isCurrent ? <em>Current</em> : null}
                      </span>
                      <span className="workspace-row-path">{workspace.path}</span>
                    </span>
                    <span className="workspace-row-meta">
                      <span>{workspace.packName || workspace.pack}</span>
                      <span>{source}</span>
                      <span className={isMissing ? "state missing" : "state"}>{status}</span>
                    </span>
                  </button>
                );
              }) : (
                <div className="workspace-empty">
                  <span className="workspace-empty-mark"><BrandLogo size={34} /></span>
                  <strong>No Workspaces registered</strong>
                  <small>Create one from a Pack or register an existing folder.</small>
                </div>
              )}
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}

// ───────────── Search modal (Ctrl+Shift+F) ─────────────
function SearchModal({ open, query, onQuery, results, onJump, onClose, onQueryChange }) {
  const inputRef = useRef(null);
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 30);
  }, [open]);
  if (!open) return null;
  // Group by file
  const grouped = {};
  for (const r of results || []) {
    if (!grouped[r.file]) grouped[r.file] = [];
    grouped[r.file].push(r);
  }
  return (
    <div className="login-overlay" onClick={onClose}>
      <div
        className="login-card"
        style={{ maxWidth: 640, padding: 0, overflow: "hidden" }}
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => { onQuery(e.target.value); onQueryChange(e.target.value); }}
          placeholder="在文件中搜索 (Ctrl+Shift+F)"
          style={{ width: "100%", padding: "16px 20px", background: "transparent", border: 0, borderBottom: "1px solid var(--ink-line)", color: "var(--text)", fontSize: 15, outline: 0 }}
        />
        <div style={{ maxHeight: 360, overflow: "auto", padding: 6 }}>
          {query && results?.length === 0 && (
            <div style={{ padding: 18, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>无匹配项</div>
          )}
          {Object.entries(grouped).map(([file, matches]) => (
            <div key={file} style={{ padding: "4px 8px" }}>
              <div style={{ fontSize: 11, color: "var(--amber-bright)", fontFamily: "var(--font-mono)", padding: "4px 0" }}>{file}</div>
              {matches.map((m, i) => (
                <div
                  key={i}
                  onClick={() => onJump(m)}
                  style={{ padding: "6px 10px", borderRadius: 4, cursor: "pointer", fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--text-soft)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-3)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <span style={{ color: "var(--faint)" }}>{m.line}:</span> {m.text}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const root = createRoot(document.getElementById("root"));
root.render(<IDE />);
