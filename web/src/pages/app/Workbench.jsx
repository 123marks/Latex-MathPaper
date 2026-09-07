import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { api } from "../../lib/api.js";
import AIAssistantPanel from "../../components/workbench/AIAssistantPanel.jsx";
import PdfViewer from "../../components/workbench/PdfViewer.jsx";
import LaTeXEditor from "../../components/LaTeXEditor.jsx";
import Icon from "../../components/Icon.jsx";
import { usePaperOSWS } from "../../lib/ws.js";
import {
  buildApplyRequest,
  buildExecutionPlan,
  buildReplacementDiff,
  normalizeProviderState,
  parseFileBlocks,
  parseSSEBuffer,
} from "../../lib/ai-execution.js";

const TABS = [
  { name: "methodology.tex", dirty: true },
  { name: "preamble.sty", dirty: false },
  { name: "results.tex", dirty: false },
];

const STAGED = [
  { q: "Q1", label: "问题重述", state: "done" },
  { q: "Q2", label: "方法选择", state: "done" },
  { q: "Q3", label: "实验与结果", state: "in_progress" },
  { q: "Q4", label: "灵敏度与稳健性", state: "todo" },
  { q: "Q5", label: "论文写作", state: "todo" },
];

// Mimir lesson: a clickable outline of \part/\chapter/\section… with line numbers.
const OUTLINE_LEVEL = { part: 0, chapter: 1, section: 2, subsection: 3, subsubsection: 4, paragraph: 5 };
export function buildOutline(text) {
  const out = [];
  const lines = String(text || "").split("\n");
  const re = /^\s*\\(part|chapter|section|subsection|subsubsection|paragraph)\*?\s*(?:\[[^\]]*\])?\{([^}]*)\}/;
  for (let i = 0; i < lines.length; i += 1) {
    const m = lines[i].match(re);
    if (m) out.push({ level: OUTLINE_LEVEL[m[1]], kind: m[1], title: m[2].trim() || "(untitled)", line: i + 1 });
  }
  return out;
}

function flattenTree(nodes, out = []) {
  for (const n of nodes || []) {
    if (n.type === "file") out.push(n);
    else if (n.children) flattenTree(n.children, out);
  }
  return out;
}

function renderSource(line, i) {
  const parts = line.split(/(\\section|\\subsection|\\begin|\\end|\\min|\\sum|\\lambda|\\frac|\\label|\\ref|\\cite|%)/g);
  return (
    <motion.div
      key={i}
      initial={{ opacity: 0, x: -4 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: Math.min(i, 30) * 0.012, duration: 0.25 }}
    >
      <span className="ln">{i + 1}</span>
      {parts.map((p, j) => {
        if (/^\\(section|subsection|begin|end|label)$/.test(p))
          return <span key={j} className="k">{p}</span>;
        if (p === "%") return <span key={j} className="c">{p}</span>;
        if (/^\\cite/.test(p))
          return (
            <span key={j}>
              <span className="k">{p}</span>
            </span>
          );
        if (/^\\/.test(p)) return <span key={j} className="m">{p}</span>;
        return <span key={j}>{p}</span>;
      })}
    </motion.div>
  );
}

export default function Workbench() {
  const [contest] = useState(() => {
    if (typeof window === "undefined") return "sample-contest";
    return new URLSearchParams(window.location.search).get("workspace") || "sample-contest";
  });
  const [tree, setTree] = useState([]);
  const [active, setActive] = useState(null);
  const [editor, setEditor] = useState("");
  const [original, setOriginal] = useState("");
  const [log, setLog] = useState([]);
  const [chat, setChat] = useState([
    {
      role: "assistant",
      who: "Paper OS Assistant",
      text: "Provider state is checked separately. File edits are previewed before Apply.",
    },
  ]);
  const [msg, setMsg] = useState(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("prompt") || "";
  });
  const [busy, setBusy] = useState(false);
  const [provider, setProvider] = useState({
    mode: "loading",
    model: "Checking provider",
    source: "none",
    label: "Checking provider configuration",
  });
  const [chatRuntime, setChatRuntime] = useState(null);
  const [aiPhase, setAiPhase] = useState("idle");
  const [proposal, setProposal] = useState(null);
  const [openTabs, setOpenTabs] = useState([]); // [{path, name, dirty}]
  const [engine, setEngine] = useState(null);
  const [installing, setInstalling] = useState(false);
  const [installPct, setInstallPct] = useState(0);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [compiling, setCompiling] = useState(false);
  const [annotations, setAnnotations] = useState([]);
  const [annoSel, setAnnoSel] = useState(null);
  const { subscribe: wsSubscribe } = usePaperOSWS();

  async function loadTree() {
    try {
      const data = await api.get(`/api/editor/tree?contest=${encodeURIComponent(contest)}`);
      setTree(data.tree || []);
    } catch (e) {
      setLog((l) => [`[tree] ${e.message}`, ...l].slice(0, 50));
    }
  }
  useEffect(() => { loadTree(); }, [contest]); // eslint-disable-line

  // 深链：⌘K 搜索结果用 ?file= 直接打开目标文件（仅首次生效）。
  const openedFromUrlRef = useRef(false);
  useEffect(() => {
    if (openedFromUrlRef.current || typeof window === "undefined" || tree.length === 0) return;
    const fileParam = new URLSearchParams(window.location.search).get("file");
    if (fileParam) {
      openedFromUrlRef.current = true;
      openFile({ path: fileParam, name: fileParam.split("/").pop() });
    }
  }, [tree]); // eslint-disable-line

  // Visual review annotations (09-integrations Epic 1b).
  async function loadAnnotations() {
    try {
      const d = await api.get(`/api/editor/annotations?workspace=${encodeURIComponent(contest)}`);
      setAnnotations(d.annotations || []);
    } catch (e) {
      setLog((l) => [`[annotations] ${e.message}`, ...l].slice(0, 50));
    }
  }
  useEffect(() => { loadAnnotations(); }, [contest]); // eslint-disable-line

  async function addAnnotation({ note, intent, priority, target }) {
    // Default target: the current editor selection; callers（如 PDF 区域标注）
    // can pass an explicit target instead.
    const finalTarget = target || (active && annoSel
      ? {
          kind: "editor-range",
          path: active.path,
          startLine: annoSel.startLine,
          endLine: annoSel.endLine,
          excerpt: annoSel.excerpt,
        }
      : null);
    if (!finalTarget) return;
    try {
      const d = await api.post("/api/editor/annotations", {
        workspace: contest,
        target: finalTarget,
        note,
        intent,
        priority,
      });
      setAnnotations((xs) => [...xs, d.annotation]);
    } catch (e) {
      setLog((l) => [`[annotations] ${e.message}`, ...l].slice(0, 50));
    }
  }

  async function updateAnnotation(id, patch) {
    try {
      const d = await api.patch(`/api/editor/annotations/${id}?workspace=${encodeURIComponent(contest)}`, patch);
      setAnnotations((xs) => xs.map((a) => (a.id === id ? d.annotation : a)));
    } catch (e) {
      setLog((l) => [`[annotations] ${e.message}`, ...l].slice(0, 50));
    }
  }

  async function deleteAnnotation(id) {
    try {
      await api.del(`/api/editor/annotations/${id}?workspace=${encodeURIComponent(contest)}`);
      setAnnotations((xs) => xs.filter((a) => a.id !== id));
    } catch (e) {
      setLog((l) => [`[annotations] ${e.message}`, ...l].slice(0, 50));
    }
  }

  // Epic 1c: turn a file's open annotations into a structured AI edit request.
  // It only fills the AI input (human reviews, then sends -> existing
  // Preview -> Apply); it never auto-applies. The annotations become "proposed";
  // resolution stays manual so we never claim an edit the user has not verified.
  function composeFromAnnotations(items) {
    if (!active || !items || items.length === 0) return;
    const rows = items.map((a, i) => {
      const range = a.target.kind === "pdf-region"
        ? `PDF 第 ${a.target.page} 页选区（x${Math.round(a.target.rect.x * 100)}% y${Math.round(a.target.rect.y * 100)}%，约 ${Math.round(a.target.rect.w * 100)}%×${Math.round(a.target.rect.h * 100)}%）`
        : a.target.endLine !== a.target.startLine
          ? `行 ${a.target.startLine}–${a.target.endLine}`
          : `行 ${a.target.startLine}`;
      const excerpt = a.target.excerpt
        ? `\n   > ${a.target.excerpt.replace(/\s+/g, " ").trim().slice(0, 120)}`
        : "";
      return `${i + 1}. [${a.intent}·${a.priority}] ${range}：${a.note}${excerpt}`;
    });
    const prompt = `请按以下审阅标注修改 [file:${active.path}]，逐条处理，改完用 BEGIN_FILE/END_FILE 输出完整文件：\n\n${rows.join("\n")}`;
    setMsg(prompt);
    for (const a of items) updateAnnotation(a.id, { status: "proposed" });
  }

  async function loadEngine() {
    try {
      const d = await api.get("/api/engine/status");
      setEngine(d);
    } catch (e) {
      setLog((l) => [`[engine] ${e.message}`, ...l].slice(0, 50));
    }
  }
  useEffect(() => { loadEngine(); }, []);

  async function loadProvider() {
    try {
      setProvider(normalizeProviderState(await api.get("/api/provider")));
    } catch {
      setProvider(normalizeProviderState(null));
    }
  }
  useEffect(() => { loadProvider(); }, []);

  // Epic 4b: named provider profiles for the per-request model switch.
  const [aiProfiles, setAiProfiles] = useState([]);
  const [aiProfileId, setAiProfileId] = useState("");
  useEffect(() => {
    api
      .get("/api/account/overview")
      .then((d) => setAiProfiles(d.provider?.profiles || []))
      .catch(() => setAiProfiles([]));
  }, []);

  // Subscribe to live compile logs via WebSocket
  useEffect(() => {
    const off = wsSubscribe(`compile:${contest}`, (msg) => {
      if (msg.event === "start") {
        setLog((l) => [`[compile] start ${msg.engine} (${(msg.durationMs || 0)}ms ETA)`, ...l].slice(0, 80));
      } else if (msg.event === "stdout") {
        const lines = String(msg.text).split("\n");
        setLog((l) => [...lines.map((x) => x).filter(Boolean), ...l].slice(0, 80));
      } else if (msg.event === "stderr") {
        const lines = String(msg.text).split("\n").map((x) => "  " + x);
        setLog((l) => [...lines.filter(Boolean), ...l].slice(0, 80));
      } else if (msg.event === "done") {
        setLog((l) => [`[compile] done exit=${msg.code} ${msg.durationMs}ms${msg.snapshotId ? " · snapshot saved" : ""}`, ...l].slice(0, 80));
        if (msg.snapshotId) loadSnapshots(active?.path);
        if (msg.pdf) {
          const blob = base64ToBlob(msg.pdf, "application/pdf");
          if (pdfUrl) URL.revokeObjectURL(pdfUrl);
          setPdfUrl(URL.createObjectURL(blob));
        }
        setCompiling(false);
      } else if (msg.event === "error") {
        setLog((l) => [`[compile] error: ${msg.message}`, ...l].slice(0, 80));
        setCompiling(false);
      }
    });
    return off;
  }, [contest, wsSubscribe, pdfUrl]);

  function installTectonic() {
    setInstalling(true);
    setInstallPct(0);
    const es = new EventSource("/api/engine/install/tectonic", { withCredentials: true });
    es.addEventListener("start", (e) => {
      try { setLog((l) => [`[tectonic] start ${JSON.parse(e.data).url}`, ...l].slice(0, 50)); } catch {}
    });
    es.addEventListener("progress", (e) => {
      try { const d = JSON.parse(e.data); if (d.percent != null) setInstallPct(d.percent); } catch {}
    });
    es.addEventListener("done", (e) => {
      try { const d = JSON.parse(e.data); setLog((l) => [`[tectonic] ✓ ${d.version || ""}`, ...l].slice(0, 50)); } catch {}
      es.close();
      setInstalling(false);
      setInstallPct(100);
      loadEngine();
    });
    es.addEventListener("error", (e) => {
      try { const d = JSON.parse(e.data); setLog((l) => [`[tectonic] ✗ ${d.message || "error"}`, ...l].slice(0, 50)); } catch {}
      es.close();
      setInstalling(false);
    });
    es.onerror = () => { es.close(); setInstalling(false); };
  }

  async function realCompile() {
    if (!active) return;
    try {
      setCompiling(true);
      setLog((l) => [`[compile] ${active.path} ...`, ...l].slice(0, 80));
      await api.post("/api/editor/compile-live", { contest, path: active.path });
      // progress + PDF are streamed back via the `compile:<contest>` WS
      // channel handled in the useEffect above. If the engine is missing
      // or the file is invalid, /compile-live returns 4xx and we reset.
      setTimeout(() => {
        setCompiling((cur) => {
          if (cur) {
            setLog((l) => [`[compile] no live channel — see result below`, ...l].slice(0, 80));
            return false;
          }
          return cur;
        });
      }, 30_000);
    } catch (e) {
      setLog((l) => [`[compile] ${e.message}`, ...l].slice(0, 80));
      setCompiling(false);
    }
  }

  function base64ToBlob(b64, type) {
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type });
  }

  async function openFile(file) {
    try {
      const data = await api.get(`/api/editor/file?contest=${encodeURIComponent(contest)}&path=${encodeURIComponent(file.path)}`);
      setActive(file);
      setEditor(data.content || "");
      setOriginal(data.content || "");
      setOpenTabs((tabs) => {
        if (tabs.find((t) => t.path === file.path)) return tabs;
        return [...tabs, { path: file.path, name: file.name, dirty: false }];
      });
    } catch (e) {
      setLog((l) => [`[file] ${e.message}`, ...l].slice(0, 50));
    }
  }

  // ── 文件/文件夹管理（tree ops against the real editor API）──
  const [collapsedDirs, setCollapsedDirs] = useState(() => new Set());
  const [renaming, setRenaming] = useState(null); // { path, value, isDir }
  const [creating, setCreating] = useState(null); // { kind: "file"|"folder", value }

  // Monaco 实例引用：用于搜索/文献/标注结果的「跳转到行」。
  const monacoRef = useRef(null);

  async function openFileAt(path, line) {
    await openFile({ path, name: path.split("/").pop() });
    const jump = () => {
      const ed = monacoRef.current;
      if (!ed) return false;
      try {
        ed.revealLineInCenter(line);
        ed.setPosition({ lineNumber: line, column: 1 });
        ed.focus();
        return true;
      } catch {
        return false;
      }
    };
    // 内容经 React 渲染进 Monaco 需要一拍；失败则再重试一次。
    setTimeout(() => { if (!jump()) setTimeout(jump, 200); }, 60);
  }

  // ── VS Code 式外壳：底部面板（输出 / 终端）──
  const [showOutput, setShowOutput] = useState(false);
  const [bottomTab, setBottomTab] = useState("output"); // "output" | "terminal"
  const [termLines, setTermLines] = useState([]); // { kind: "cmd"|"out"|"err"|"sys", text }
  const [termInput, setTermInput] = useState("");
  const [termHistory, setTermHistory] = useState([]);
  const [termBusy, setTermBusy] = useState(false);
  const termAbortRef = useRef(null);
  const termEndRef = useRef(null);
  useEffect(() => { termEndRef.current?.scrollIntoView?.({ block: "end" }); }, [termLines]);

  async function runTerminal(commandText) {
    const command = String(commandText || "").trim();
    if (!command || termBusy) return;
    setTermHistory((h) => [command, ...h.filter((x) => x !== command)].slice(0, 50));
    setTermLines((l) => [...l, { kind: "cmd", text: `$ ${command}` }].slice(-800));
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
        setTermLines((l) => [...l, { kind: "err", text: err.error || `HTTP ${response.status}` }]);
        return;
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const consume = (raw) => {
        const frames = raw.split("\n\n");
        buffer = frames.pop() || "";
        for (const frame of frames) {
          const ev = (frame.match(/^event: (.+)$/m) || [])[1];
          const dataLine = (frame.match(/^data: (.+)$/m) || [])[1];
          if (!ev || !dataLine) continue;
          let data = {};
          try { data = JSON.parse(dataLine); } catch { continue; }
          if (ev === "stdout") setTermLines((l) => [...l, { kind: "out", text: data.text }].slice(-800));
          else if (ev === "stderr") setTermLines((l) => [...l, { kind: "err", text: data.text }].slice(-800));
          else if (ev === "exit") {
            setTermLines((l) => [...l, {
              kind: "sys",
              text: data.error ? `✗ ${data.error}` : `↳ 退出码 ${data.code} · ${data.durationMs}ms`,
            }].slice(-800));
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
      if (error.name !== "AbortError") setTermLines((l) => [...l, { kind: "err", text: error.message }]);
      else setTermLines((l) => [...l, { kind: "sys", text: "↳ 已中断" }]);
    } finally {
      termAbortRef.current = null;
      setTermBusy(false);
    }
  }

  // ── 大纲 / 文献键 / 快照（Mimir · OverCite · latex-stickies 迁移）──
  const outline = active ? buildOutline(editor) : [];
  const [citeKeys, setCiteKeys] = useState([]);
  useEffect(() => {
    api.get(`/api/editor/references?workspace=${encodeURIComponent(contest)}`)
      .then((d) => setCiteKeys((d.entries || []).map((e) => ({ key: e.key, title: e.title, author: e.author, year: e.year }))))
      .catch(() => setCiteKeys([]));
  }, [contest]);
  const [snapshots, setSnapshots] = useState([]);
  async function loadSnapshots(path) {
    if (!path) { setSnapshots([]); return; }
    try {
      const d = await api.get(`/api/editor/snapshots?workspace=${encodeURIComponent(contest)}&path=${encodeURIComponent(path)}`);
      setSnapshots(d.snapshots || []);
    } catch { setSnapshots([]); }
  }
  useEffect(() => { loadSnapshots(active?.path); }, [active?.path, contest]); // eslint-disable-line
  async function takeSnapshot() {
    if (!active) return;
    try {
      await save();
      const d = await api.post("/api/editor/snapshots", { workspace: contest, path: active.path, reason: "manual" });
      setSnapshots(d.snapshots || []);
      setLog((l) => [`[snapshot] saved ${active.path}`, ...l].slice(0, 80));
    } catch (e) {
      setLog((l) => [`[snapshot] ${e.message}`, ...l].slice(0, 80));
    }
  }
  async function restoreSnapshot(id) {
    if (!active) return;
    if (!window.confirm("回滚到该快照？当前内容会先自动存为一份「pre-restore」快照，可再回来。")) return;
    try {
      const d = await api.post(`/api/editor/snapshots/${id}/restore`, { workspace: contest });
      setEditor(d.content);
      setOriginal(d.content);
      setOpenTabs((tabs) => tabs.map((t) => (t.path === active.path ? { ...t, dirty: false } : t)));
      setSnapshots(d.snapshots || []);
      setLog((l) => [`[snapshot] restored ${d.path}`, ...l].slice(0, 80));
    } catch (e) {
      setLog((l) => [`[snapshot] ${e.message}`, ...l].slice(0, 80));
    }
  }

  // ── 可拖拽分栏：文件树宽 / AI 面板宽（localStorage 持久化，含钳制）──
  const clampPane = (v, lo, hi, fallback) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= lo && n <= hi ? n : fallback;
  };
  const [paneW, setPaneW] = useState(() => {
    if (typeof window === "undefined") return { tree: 220, right: 360 };
    try {
      const saved = JSON.parse(window.localStorage.getItem("paperos.panes") || "{}");
      return {
        tree: clampPane(saved.tree, 160, 420, 220),
        right: clampPane(saved.right, 280, 640, 360),
      };
    } catch {
      return { tree: 220, right: 360 };
    }
  });
  const paneDragRef = useRef(null); // { which, startX, startW }
  function startPaneDrag(which, e) {
    e.preventDefault();
    paneDragRef.current = { which, startX: e.clientX, startW: paneW[which] };
    const onMove = (ev) => {
      const d = paneDragRef.current;
      if (!d) return;
      const delta = ev.clientX - d.startX;
      setPaneW((w) => (d.which === "tree"
        ? { ...w, tree: Math.min(420, Math.max(160, d.startW + delta)) }
        : { ...w, right: Math.min(640, Math.max(280, d.startW - delta)) }));
    };
    const onUp = () => {
      paneDragRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.classList.remove("pane-dragging");
      setPaneW((w) => {
        try { window.localStorage.setItem("paperos.panes", JSON.stringify(w)); } catch { /* 忽略存储失败 */ }
        return w;
      });
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    document.body.classList.add("pane-dragging");
  }

  // ── 文件树右键菜单：复用既有 创建/重命名/删除 处理器 ──
  const [treeMenu, setTreeMenu] = useState(null); // { x, y, node|null }
  useEffect(() => {
    if (!treeMenu) return undefined;
    const close = () => setTreeMenu(null);
    const onKey = (e) => { if (e.key === "Escape") close(); };
    window.addEventListener("click", close);
    window.addEventListener("contextmenu", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("contextmenu", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [treeMenu]);

  function openTreeMenu(e, node) {
    e.preventDefault();
    e.stopPropagation();
    const x = Math.min(e.clientX, (window.innerWidth || 1200) - 190);
    const y = Math.min(e.clientY, (window.innerHeight || 800) - 200);
    setTreeMenu({ x, y, node: node || null });
  }

  function menuDirPrefix(node) {
    if (!node) return activeDirPrefix();
    if (node.type === "dir") return `${node.path}/`;
    return node.path.includes("/") ? node.path.slice(0, node.path.lastIndexOf("/") + 1) : "";
  }

  // ── 真编辑器四件套：左栏全文搜索 / Ctrl+S / 关闭保护 / 标签页持久化 ──
  const [railMode, setRailMode] = useState("files"); // "files" | "search"
  const [searchQ, setSearchQ] = useState("");
  const [searchHits, setSearchHits] = useState(null);
  const [searching, setSearching] = useState(false);

  async function runWorkspaceSearch(e) {
    if (e && typeof e.preventDefault === "function") e.preventDefault();
    const q = searchQ.trim();
    if (!q) { setSearchHits(null); return; }
    try {
      setSearching(true);
      const d = await api.get(`/api/editor/search?workspace=${encodeURIComponent(contest)}&q=${encodeURIComponent(q)}&limit=100`);
      setSearchHits(d.results || []);
    } catch (err) {
      setLog((l) => [`[search] ${err.message}`, ...l].slice(0, 50));
    } finally {
      setSearching(false);
    }
  }

  // Ctrl+S 保存当前文件（捕获阶段拦截浏览器的“另存为”）。
  const saveRef = useRef(() => {});
  useEffect(() => {
    const onKey = (event) => {
      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === "s") {
        event.preventDefault();
        saveRef.current();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  // 有未保存内容时阻止误关页面。
  const dirtyRef = useRef(false);
  useEffect(() => {
    const onBeforeUnload = (event) => {
      if (dirtyRef.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  // 标签页会话持久化（per workspace）：先恢复，再开始写入。
  const tabsRestoredRef = useRef(false);
  useEffect(() => {
    if (tabsRestoredRef.current || typeof window === "undefined") return;
    tabsRestoredRef.current = true;
    try {
      const raw = window.localStorage.getItem(`paperos.tabs.${contest}`);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (Array.isArray(saved.tabs) && saved.tabs.length > 0) {
        setOpenTabs(saved.tabs
          .filter((t) => t && t.path)
          .map((t) => ({ path: t.path, name: t.name || t.path.split("/").pop(), dirty: false })));
        const deepFile = new URLSearchParams(window.location.search).get("file");
        if (!deepFile && saved.active) {
          openFile({ path: saved.active, name: saved.active.split("/").pop() });
        }
      }
    } catch { /* 损坏的本地存储直接忽略 */ }
  }, [contest]); // eslint-disable-line

  useEffect(() => {
    if (!tabsRestoredRef.current || typeof window === "undefined") return;
    try {
      window.localStorage.setItem(`paperos.tabs.${contest}`, JSON.stringify({
        tabs: openTabs.map((t) => ({ path: t.path, name: t.name })),
        active: active?.path || "",
      }));
    } catch { /* 存储不可用时静默 */ }
  }, [openTabs, active, contest]);

  function toggleDir(path) {
    setCollapsedDirs((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  function activeDirPrefix() {
    if (!active?.path || !active.path.includes("/")) return "";
    return active.path.slice(0, active.path.lastIndexOf("/") + 1);
  }

  async function submitCreate() {
    const relPath = String(creating?.value || "").trim().replace(/^\/+/, "");
    if (!relPath) return;
    try {
      if (creating.kind === "folder") {
        await api.post("/api/editor/folder", { workspace: contest, path: relPath });
      } else {
        await api.post("/api/editor/file", { workspace: contest, path: relPath, content: "" });
      }
      setCreating(null);
      await loadTree();
      if (creating.kind === "file") {
        await openFile({ path: relPath, name: relPath.split("/").pop() });
      }
    } catch (e) {
      setLog((l) => [`[files] ${e.message}`, ...l].slice(0, 50));
    }
  }

  async function submitRename() {
    const from = renaming?.path;
    const to = String(renaming?.value || "").trim().replace(/^\/+/, "");
    if (!from || !to || from === to) { setRenaming(null); return; }
    try {
      await api.patch("/api/editor/file", { workspace: contest, from, to });
      setOpenTabs((tabs) => tabs.map((t) => {
        if (t.path === from) return { ...t, path: to, name: to.split("/").pop() };
        if (t.path.startsWith(`${from}/`)) {
          const moved = to + t.path.slice(from.length);
          return { ...t, path: moved, name: moved.split("/").pop() };
        }
        return t;
      }));
      setActive((cur) => {
        if (!cur) return cur;
        if (cur.path === from) return { path: to, name: to.split("/").pop() };
        if (cur.path.startsWith(`${from}/`)) {
          const moved = to + cur.path.slice(from.length);
          return { path: moved, name: moved.split("/").pop() };
        }
        return cur;
      });
      setRenaming(null);
      await loadTree();
    } catch (e) {
      setLog((l) => [`[files] ${e.message}`, ...l].slice(0, 50));
    }
  }

  async function deleteEntry(path, isDir) {
    const label = isDir ? `文件夹 ${path}（含其中所有文件）` : path;
    if (!window.confirm(`确定删除 ${label}？此操作不可恢复。`)) return;
    try {
      await api.del(`/api/editor/file?workspace=${encodeURIComponent(contest)}&path=${encodeURIComponent(path)}`);
      setOpenTabs((tabs) => tabs.filter((t) => t.path !== path && !t.path.startsWith(`${path}/`)));
      if (active && (active.path === path || active.path.startsWith(`${path}/`))) {
        setActive(null);
        setEditor("");
        setOriginal("");
      }
      await loadTree();
    } catch (e) {
      setLog((l) => [`[files] ${e.message}`, ...l].slice(0, 50));
    }
  }

  function closeTab(path) {
    setOpenTabs((tabs) => tabs.filter((t) => t.path !== path));
    if (active && active.path === path) {
      setActive(null);
      setEditor("");
      setOriginal("");
    }
  }

  async function save() {
    if (!active) return;
    try {
      setBusy(true);
      await api.put("/api/editor/file", { contest, path: active.path, content: editor });
      setOriginal(editor);
      setOpenTabs((tabs) => tabs.map((t) => (t.path === active.path ? { ...t, dirty: false } : t)));
      setLog((l) => [`[save] ${active.path}`, ...l].slice(0, 50));
    } catch (e) {
      setLog((l) => [`[save] ${e.message}`, ...l].slice(0, 50));
    } finally { setBusy(false); }
  }

  async function runCmd(cmd) {
    try {
      setBusy(cmd);
      setLog((l) => [`[run] ${cmd} ...`, ...l].slice(0, 50));
      const r = await api.post("/api/editor/run", { contest, command: cmd });
      const out = (r.stdout || r.stderr || "").toString();
      setLog((l) => [`[${cmd} exit=${r.code}] ${out.split("\n").slice(0, 8).join("\n")}`, ...l].slice(0, 50));
    } catch (e) {
      setLog((l) => [`[run] ${e.message}`, ...l].slice(0, 50));
    } finally { setBusy(""); }
  }

  async function previewFileProposal(text, parsed = parseFileBlocks(text)) {
    if (!parsed.length) {
      setProposal(null);
      setAiPhase("complete");
      return;
    }

    setAiPhase("previewing");
    try {
      const preview = await api.post(
        "/api/editor/apply-blocks",
        buildApplyRequest({ contest, text }),
      );
      const blocks = await Promise.all(preview.blocks.map(async (meta) => {
        const proposed = parsed.find((block) => block.path === meta.path);
        let previous = "";
        if (meta.exists) {
          const current = await api.get(
            `/api/editor/file?contest=${encodeURIComponent(contest)}&path=${encodeURIComponent(meta.path)}`,
          );
          previous = current.content || "";
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
        baseline: preview.blocks.map(({ path, mtime }) => ({ path, mtime })),
        blocks,
      });
      setAiPhase("ready");
    } catch (error) {
      setProposal({
        state: "preview-error",
        text,
        error: error.message,
        blocks: parsed.map((block) => ({
          ...block,
          bytes: new TextEncoder().encode(block.content).byteLength,
          exists: false,
          diff: buildReplacementDiff("", block.content),
        })),
      });
      setAiPhase("failed");
    }
  }

  async function applyProposal() {
    if (!proposal || proposal.state !== "ready" || busy) return;
    setBusy("apply");
    setAiPhase("applying");
    setProposal((current) => ({ ...current, state: "applying", error: "" }));
    try {
      const result = await api.post(
        "/api/editor/apply-blocks",
        buildApplyRequest({
          contest,
          text: proposal.text,
          baseline: proposal.baseline,
          apply: true,
        }),
      );
      setProposal((current) => ({ ...current, state: "applied", result }));
      setAiPhase("applied");
      await loadTree();

      const activeBlock = proposal.blocks.find((block) => block.path === active?.path);
      if (activeBlock && editor === original) {
        setEditor(activeBlock.content);
        setOriginal(activeBlock.content);
        setOpenTabs((tabs) => tabs.map((tab) => (
          tab.path === active.path ? { ...tab, dirty: false } : tab
        )));
      } else if (activeBlock) {
        setLog((items) => [
          "[apply] active buffer kept because it has unsaved edits",
          ...items,
        ].slice(0, 50));
      }
    } catch (error) {
      if (error.code === "APPLY_CONFLICT") {
        setProposal((current) => ({
          ...current,
          state: "conflict",
          error: error.message,
          conflicts: error.payload?.conflicts || [],
        }));
      } else if (error.code === "APPLY_ROLLBACK") {
        setProposal((current) => ({
          ...current,
          state: "rollback",
          error: error.message,
        }));
      } else {
        setProposal((current) => ({
          ...current,
          state: "preview-error",
          error: error.message,
        }));
      }
      setAiPhase("ready");
    } finally {
      setBusy("");
    }
  }

  function rejectProposal() {
    if (!proposal || busy) return;
    setProposal((current) => ({
      ...current,
      state: "rejected",
      error: "",
      conflicts: [],
    }));
    setAiPhase("rejected");
  }

  async function refreshProposalPreview() {
    if (!proposal?.text || busy) return;
    setBusy("preview");
    await previewFileProposal(proposal.text);
    setBusy("");
  }

  // SSE streaming chat. Buffer complete frames so JSON split across network
  // chunks is retained instead of being silently discarded.
  const chatAbortRef = useRef(null);
  useEffect(() => () => chatAbortRef.current?.abort(), []);

  async function sendChat() {
    const unresolvedProposal = ["ready", "conflict", "rollback"].includes(proposal?.state);
    if (!msg.trim() || busy || unresolvedProposal) return;

    const userText = msg.trim();
    const controller = new AbortController();
    chatAbortRef.current?.abort();
    chatAbortRef.current = controller;
    setChatRuntime(null);
    setProposal(null);
    setAiPhase("requesting");
    setChat((items) => [...items, { role: "user", who: "You", text: userText }]);
    setMsg("");
    setBusy("chat");
    setChat((items) => [...items, {
      role: "assistant",
      who: "Paper OS Assistant",
      text: "",
      streaming: true,
    }]);

    let acc = "";
    let buffer = "";
    const updateLastAssistant = (updates) => {
      setChat((items) => {
        const next = items.slice();
        const last = next[next.length - 1];
        if (last?.streaming) next[next.length - 1] = { ...last, ...updates };
        return next;
      });
    };
    const consume = (events) => {
      for (const event of events) {
        if (event.error) {
          throw new Error(event.error.message || event.error.code || "Provider stream failed");
        }
        if (event.meta) {
          const kind = event.meta.runtime;
          setChatRuntime(kind === "provider"
            ? {
                kind,
                label: (event.meta.model || provider.model || "Configured model")
                  + " - provider response",
              }
            : {
                kind: "mock-local",
                label: "mock-local - deterministic fallback"
                  + (event.meta.reason ? " (" + event.meta.reason + ")" : ""),
              });
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
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        signal: controller.signal,
        body: JSON.stringify({
          messages: [
            ...chat.filter((item) => !item.streaming).map((item) => ({
              role: item.role || (item.who === "You" ? "user" : "assistant"),
              content: item.text,
            })),
            { role: "user", content: userText },
          ],
          workspace: contest,
          ...(aiProfileId ? { profileId: aiProfileId } : {}),
        }),
      });
      if (!response.ok || !response.body) {
        throw new Error(`chat ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const parsed = parseSSEBuffer(buffer + decoder.decode(value, { stream: true }));
        buffer = parsed.rest;
        consume(parsed.events);
      }
      const tail = parseSSEBuffer(buffer + decoder.decode());
      consume(tail.events);
      updateLastAssistant({ text: acc, streaming: false });
      await previewFileProposal(acc);
    } catch (error) {
      if (error.name !== "AbortError") {
        updateLastAssistant({
          text: "Request failed: " + error.message,
          streaming: false,
        });
        setAiPhase("failed");
      }
    } finally {
      if (chatAbortRef.current === controller) chatAbortRef.current = null;
      setBusy("");
    }
  }

  const dirty = active && editor !== original;
  const allFiles = flattenTree(tree);
  saveRef.current = save;
  dirtyRef.current = Boolean(dirty) || openTabs.some((t) => t.dirty);
  const aiPlan = aiPhase === "idle"
    ? []
    : buildExecutionPlan({
        phase: aiPhase,
        runtime: chatRuntime?.kind || "unknown",
        activePath: active?.path || "",
        blockCount: proposal?.blocks?.length || 0,
      });

  return (
    <>
      <EngineBanner
        engine={engine}
        installing={installing}
        installPct={installPct}
        onInstall={installTectonic}
        onRefresh={loadEngine}
      />
      <div className="ide" style={{ "--tree-w": `${paneW.tree}px`, "--ide-right": `${paneW.right}px` }}>
      <div className="ide-left">
        <nav className="activity-bar" aria-label="工作台活动栏">
          <button
            type="button"
            className={`activity-btn ${railMode === "files" ? "active" : ""}`}
            title="文件"
            onClick={() => setRailMode("files")}
          >
            <Icon name="content" size={18} />
          </button>
          <button
            type="button"
            className={`activity-btn ${railMode === "search" ? "active" : ""}`}
            title="全文搜索"
            onClick={() => setRailMode("search")}
          >
            <Icon name="search" size={18} />
          </button>
          <button
            type="button"
            className={`activity-btn ${railMode === "outline" ? "active" : ""}`}
            title="文档大纲"
            onClick={() => setRailMode("outline")}
          >
            <Icon name="team" size={18} />
          </button>
          <button
            type="button"
            className={`activity-btn ${showOutput ? "active" : ""}`}
            title="输出面板（编译 / AI / 文件事件）"
            onClick={() => setShowOutput((v) => !v)}
          >
            <Icon name="terminal" size={18} />
          </button>
        </nav>
        <div
          className="pane-handle pane-handle-tree"
          title="拖拽调整文件栏宽度"
          onMouseDown={(e) => startPaneDrag("tree", e)}
        />
        <div className="file-tree" onContextMenu={(e) => openTreeMenu(e, null)}>
          <div className="row spread" style={{ padding: "0 6px 8px" }}>
            <h5 style={{ margin: 0 }}>{contest}</h5>
            <div className="row tree-toolbar" style={{ gap: 2 }}>
              {railMode === "files" && (
                <>
                  <button
                    className="btn btn-quiet btn-sm"
                    title="新建文件（支持嵌套路径）"
                    onClick={() => setCreating({ kind: "file", value: activeDirPrefix() })}
                  >
                    ＋文件
                  </button>
                  <button
                    className="btn btn-quiet btn-sm"
                    title="新建文件夹"
                    onClick={() => setCreating({ kind: "folder", value: activeDirPrefix() })}
                  >
                    ＋目录
                  </button>
                  <button className="btn btn-quiet btn-sm" title="刷新" onClick={loadTree}>⟲</button>
                </>
              )}
              <button
                className={`btn btn-quiet btn-sm ${railMode === "search" ? "rail-mode-on" : ""}`}
                title="在整个工作区里全文搜索"
                onClick={() => setRailMode((m) => (m === "files" ? "search" : "files"))}
              >
                {railMode === "files" ? "搜索" : "文件"}
              </button>
            </div>
          </div>
          {railMode === "search" && (
            <>
              <form className="tree-create" onSubmit={runWorkspaceSearch}>
                <input
                  autoFocus
                  placeholder="全文搜索（回车执行）…"
                  value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)}
                />
                <button className="btn btn-quiet btn-sm" disabled={searching}>{searching ? "…" : "搜"}</button>
              </form>
              {searching ? (
                <div className="spinner" />
              ) : searchHits === null ? (
                <div className="empty" style={{ padding: 10, fontSize: 11 }}>
                  跨文件搜索正文内容，点结果直接打开文件。
                </div>
              ) : searchHits.length === 0 ? (
                <div className="empty" style={{ padding: 10, fontSize: 11 }}>没有匹配。</div>
              ) : (
                <div className="search-results">
                  {[...searchHits.reduce((m, r) => {
                    const rows = m.get(r.file) || [];
                    rows.push(r);
                    m.set(r.file, rows);
                    return m;
                  }, new Map()).entries()].map(([file, rows]) => (
                    <div key={file} className="search-file">
                      <div
                        className="search-file-head"
                        onClick={() => openFile({ path: file, name: file.split("/").pop() })}
                      >
                        <span className="search-file-name">{file}</span>
                        <span className="search-file-count">{rows.length}</span>
                      </div>
                      {rows.map((r) => (
                        <div
                          key={`${r.line}-${r.text.slice(0, 24)}`}
                          className="search-hit"
                          title={`${file}:${r.line}`}
                          onClick={() => openFileAt(file, r.line)}
                        >
                          <span className="search-hit-ln">{r.line}</span>
                          <span className="search-hit-text">{r.text.trim().slice(0, 120)}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
          {railMode === "outline" && (
            !active ? (
              <div className="empty" style={{ padding: 10, fontSize: 11 }}>打开一个 .tex 文件后显示章节大纲。</div>
            ) : outline.length === 0 ? (
              <div className="empty" style={{ padding: 10, fontSize: 11 }}>本文件没有 \section 类结构。</div>
            ) : (
              <div className="outline-list">
                {outline.map((o) => (
                  <button
                    key={`${o.line}-${o.title}`}
                    type="button"
                    className={`outline-item level-${o.level}`}
                    title={`\\${o.kind} · 第 ${o.line} 行`}
                    onClick={() => openFileAt(active.path, o.line)}
                  >
                    <span className="outline-kind">{o.kind === "subsubsection" ? "§§§" : o.kind === "subsection" ? "§§" : "§"}</span>
                    <span className="outline-title">{o.title}</span>
                    <span className="outline-line">{o.line}</span>
                  </button>
                ))}
              </div>
            )
          )}
          {railMode === "files" && (
            <>
          {creating && (
            <form className="tree-create" onSubmit={(e) => { e.preventDefault(); submitCreate(); }}>
              <input
                autoFocus
                placeholder={creating.kind === "folder" ? "如 paper/sections" : "如 paper/sections/intro.tex"}
                value={creating.value}
                onChange={(e) => setCreating((c) => (c ? { ...c, value: e.target.value } : c))}
                onKeyDown={(e) => { if (e.key === "Escape") setCreating(null); }}
              />
              <button className="btn btn-quiet btn-sm">{creating.kind === "folder" ? "建目录" : "建文件"}</button>
            </form>
          )}
          {tree.length === 0 ? (
            <div className="empty" style={{ padding: 10, fontSize: 11 }}>空</div>
          ) : (
            <FileTreeView
              nodes={tree}
              activePath={active?.path || ""}
              collapsedDirs={collapsedDirs}
              renaming={renaming}
              onToggle={toggleDir}
              onOpen={openFile}
              onRenameStart={(n) => setRenaming({ path: n.path, value: n.path, isDir: n.type === "dir" })}
              onRenameChange={(v) => setRenaming((r) => (r ? { ...r, value: v } : r))}
              onRenameSubmit={submitRename}
              onRenameCancel={() => setRenaming(null)}
              onDelete={(n) => deleteEntry(n.path, n.type === "dir")}
              onMenu={openTreeMenu}
            />
          )}
            </>
          )}
        </div>

        <div className="editor-area">
          <div className="tabs">
            {openTabs.length === 0 ? (
              <div className="tab" style={{ color: "var(--faint)", fontStyle: "italic" }}>
                点击左侧文件打开
              </div>
            ) : (
              openTabs.map((t) => (
                <div
                  key={t.path}
                  className={`tab ${active && active.path === t.path ? "active" : ""} ${t.dirty ? "dirty" : ""}`}
                  onClick={() => {
                    const f = allFiles.find((x) => x.path === t.path);
                    if (f) openFile(f);
                  }}
                >
                  {t.name}
                  {t.dirty ? (
                    <span className="dot" style={{ background: "var(--amber)" }} />
                  ) : (
                    <span
                      className="close"
                      onClick={(e) => { e.stopPropagation(); closeTab(t.path); }}
                    >×</span>
                  )}
                </div>
              ))
            )}
          </div>

          {active && (
            <div className="breadcrumbs" aria-label="当前文件路径">
              {active.path.split("/").map((seg, i, arr) => {
                const isLast = i === arr.length - 1;
                const dirPath = arr.slice(0, i + 1).join("/");
                return (
                  <span key={dirPath} className="crumb-wrap">
                    {isLast ? (
                      <b className="crumb current">{seg}</b>
                    ) : (
                      <button
                        type="button"
                        className="crumb"
                        title={`在文件树中展开 ${dirPath}`}
                        onClick={() => {
                          setRailMode("files");
                          setCollapsedDirs((prev) => {
                            const next = new Set(prev);
                            next.delete(dirPath);
                            return next;
                          });
                        }}
                      >
                        {seg}
                      </button>
                    )}
                    {!isLast && <span className="crumb-sep">›</span>}
                  </span>
                );
              })}
            </div>
          )}

          <div className="editor-body">
            {active ? (
              <LaTeXEditor
                value={editor}
                onChange={(v) => {
                  setEditor(v);
                  if (active) setOpenTabs((tabs) => tabs.map((t) => (t.path === active.path ? { ...t, dirty: true } : t)));
                }}
                onSelectionChange={setAnnoSel}
                editorRef={monacoRef}
                citeKeys={citeKeys}
                language="latex"
                height="100%"
              />
            ) : (
              <pre className="editor-source" style={{ color: "var(--faint)" }}>
                {`# Paper OS · LaTeX IDE

点击左侧文件,开始编辑。
选中任意行 → 右栏 AI Chat 用 ⌘↩ 发送。
右侧 ⟲ Recompile 用本地引擎编译出 PDF。`}
              </pre>
            )}

            <div className="editor-pdf">
              <div className="pdf-controls">
                <button
                  className="pdf-btn"
                  onClick={realCompile}
                  disabled={compiling || !active || !engine?.tectonic?.present}
                  title={!engine?.tectonic?.present ? "需要先下载 Tectonic" : "用 Tectonic 编译当前文件"}
                >
                  {compiling ? "⟳ 编译中" : "⟲ Recompile"}
                </button>
                <span>·</span>
                <span>{engine?.tectonic?.present ? `tectonic ${engine.tectonic.detail || ""}` : "no engine"}</span>
                <span>·</span>
                <span>{active ? active.path : "—"}</span>
                {active && (
                  <>
                    <span>·</span>
                    <button className="pdf-btn" onClick={takeSnapshot} title="保存并为当前文件存一份快照">◎ 快照</button>
                    {snapshots.length > 0 && (
                      <select
                        className="snapshot-select"
                        defaultValue=""
                        title="回滚到历史快照（编译成功时自动保存）"
                        onChange={(e) => { if (e.target.value) { restoreSnapshot(e.target.value); e.target.value = ""; } }}
                      >
                        <option value="" disabled>回滚 · {snapshots.length} 份</option>
                        {snapshots.map((s) => (
                          <option key={s.id} value={s.id}>
                            {new Date(s.createdAt).toLocaleString()} · {s.reason} · {(s.bytes / 1024).toFixed(1)}KB
                          </option>
                        ))}
                      </select>
                    )}
                  </>
                )}
              </div>
              {pdfUrl ? (
                <PdfViewer
                  url={pdfUrl}
                  regions={annotations
                    .filter((a) => a.target?.kind === "pdf-region"
                      && a.target.path === active?.path
                      && a.status !== "dismissed")
                    .map((a) => ({
                      id: a.id,
                      page: a.target.page,
                      rect: a.target.rect,
                      note: a.note,
                      status: a.status,
                    }))}
                  onAskSelection={(text) => {
                    setMsg(`关于编译 PDF 中选中的这段内容：\n> ${text.replace(/\n/g, "\n> ")}\n\n请检查它与源码是否一致，并给出改进建议。`);
                  }}
                  onRegionAnnotate={async ({ page, rect }) => {
                    const note = window.prompt(`PDF 第 ${page} 页选中区域：这里要改什么？`);
                    if (!note || !note.trim()) return;
                    await addAnnotation({
                      note: note.trim(),
                      intent: "edit",
                      priority: "normal",
                      target: {
                        kind: "pdf-region",
                        path: active?.path || "paper/main.tex",
                        page,
                        rect,
                      },
                    });
                  }}
                />
              ) : (
                <div className="pdf-page">
                  <h3>{active ? active.name.replace(".tex", "") : "Preview"}</h3>
                  <p style={{ fontWeight: 600 }}>2.1 Problem Formulation</p>
                  <p>
                    Given the dataset <em>D</em> = {"{"}(x<sub>i</sub>, y<sub>i</sub>){")"}, we
                    formulate the objective as the minimization of a
                    regularized risk:
                  </p>
                  <div className="formula" style={{ fontStyle: "italic" }}>
                    min<sub>x</sub> f(x) = ∑ c<sub>i</sub> x<sub>i</sub> + λ ‖x‖<sup>2</sup>
                  </div>
                  <p>
                    点击右上 ⟲ Recompile 触发 Tectonic 编译,真实 PDF 将在此处渲染。
                  </p>
                </div>
              )}
            </div>
          </div>

          <AnnotationsPanel
            active={active}
            selection={annoSel}
            annotations={annotations}
            onAdd={addAnnotation}
            onStatus={(id, status) => updateAnnotation(id, { status })}
            onDelete={deleteAnnotation}
            onCompose={composeFromAnnotations}
            onJump={(a) => {
              if (a.target?.kind === "editor-range") openFileAt(a.target.path, a.target.startLine);
            }}
          />

          <ReferencesPanel
            contest={contest}
            onOpenFile={(p, line) => (line
              ? openFileAt(p, line)
              : openFile({ path: p, name: p.split("/").pop() }))}
          />

          {showOutput && (
            <div className="output-panel">
              <div className="output-head">
                <button type="button" className={`bottom-tab ${bottomTab === "output" ? "active" : ""}`} onClick={() => setBottomTab("output")}>输出</button>
                <button type="button" className={`bottom-tab ${bottomTab === "terminal" ? "active" : ""}`} onClick={() => setBottomTab("terminal")}>终端</button>
                <span className="muted" style={{ fontSize: 11 }}>
                  {bottomTab === "output" ? `${log.length} 条 · 编译 / AI / 文件事件` : `cwd = ${contest}/ · 白名单程序 · 无 shell 语法`}
                </span>
                <span style={{ marginLeft: "auto", display: "inline-flex", gap: 6 }}>
                  {bottomTab === "output" ? (
                    <button type="button" className="btn btn-quiet btn-sm" onClick={() => setLog([])}>清空</button>
                  ) : (
                    <>
                      {termBusy && <button type="button" className="btn btn-quiet btn-sm" onClick={() => termAbortRef.current?.abort()}>中断</button>}
                      <button type="button" className="btn btn-quiet btn-sm" onClick={() => setTermLines([])}>清空</button>
                    </>
                  )}
                  <button type="button" className="btn btn-quiet btn-sm" onClick={() => setShowOutput(false)}>收起</button>
                </span>
              </div>
              {bottomTab === "output" ? (
                <pre className="output-body">
                  {log.length === 0 ? "（暂无输出。编译、AI 请求与文件操作的日志会出现在这里。）" : log.slice().reverse().join("\n")}
                </pre>
              ) : (
                <div className="terminal">
                  <pre className="terminal-body">
                    {termLines.length === 0
                      ? "（集成终端。在工作区目录里运行 python / git / tectonic / latexmk 等白名单程序，例如：git status）"
                      : termLines.map((ln, i) => <span key={i} className={`term-${ln.kind}`}>{ln.text}{ln.text.endsWith("\n") ? "" : "\n"}</span>)}
                    <span ref={termEndRef} />
                  </pre>
                  <form
                    className="terminal-input"
                    onSubmit={(e) => { e.preventDefault(); runTerminal(termInput); }}
                  >
                    <span className="terminal-prompt">{termBusy ? "…" : "$"}</span>
                    <input
                      value={termInput}
                      disabled={termBusy}
                      placeholder="git status"
                      spellCheck={false}
                      autoComplete="off"
                      onChange={(e) => setTermInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "ArrowUp" && termHistory.length) { e.preventDefault(); setTermInput(termHistory[0]); }
                      }}
                    />
                  </form>
                </div>
              )}
            </div>
          )}

          <div className="statusbar">
            <span className="seg branch">⎇ main</span>
            <span className="seg">LaTeX</span>
            <span className="seg">UTF-8</span>
            <span className="seg">
              {annoSel ? `Ln ${annoSel.line ?? annoSel.startLine}, Col ${annoSel.column ?? 1}` : "Ln —, Col —"}
            </span>
            <span className="seg">
              {active ? `${editor.split("\n").length} 行` : "—"}
            </span>
            <span className="seg">
              {dirty ? "● 未保存" : "● 已保存"}
            </span>
            <div className="right">
              <button className="btn btn-quiet btn-sm" onClick={save} disabled={!active || busy === "save"}>
                {busy === "save" ? "保存中…" : "⌘S 保存"}
              </button>
              <span className="seg">● 本地引擎</span>
            </div>
          </div>
        </div>
      </div>

      <div
        className="pane-handle pane-handle-right"
        title="拖拽调整 AI 面板宽度"
        onMouseDown={(e) => startPaneDrag("right", e)}
      />
      <AIAssistantPanel
        activePath={active?.path || ""}
        provider={provider}
        runtime={chatRuntime}
        messages={chat}
        input={msg}
        busy={Boolean(busy)}
        plan={aiPlan}
        proposal={proposal}
        profiles={aiProfiles}
        profileId={aiProfileId}
        onProfileChange={setAiProfileId}
        onInput={setMsg}
        onSubmit={sendChat}
        onApply={applyProposal}
        onReject={rejectProposal}
        onRefreshPreview={refreshProposalPreview}
      />

      {treeMenu && (
        <div className="tree-menu" style={{ left: treeMenu.x, top: treeMenu.y }}>
          {treeMenu.node?.type === "file" && (
            <button
              type="button"
              onClick={() => { openFile({ path: treeMenu.node.path, name: treeMenu.node.name }); setTreeMenu(null); }}
            >
              打开
            </button>
          )}
          <button
            type="button"
            onClick={() => { setRailMode("files"); setCreating({ kind: "file", value: menuDirPrefix(treeMenu.node) }); setTreeMenu(null); }}
          >
            新建文件
          </button>
          <button
            type="button"
            onClick={() => { setRailMode("files"); setCreating({ kind: "folder", value: menuDirPrefix(treeMenu.node) }); setTreeMenu(null); }}
          >
            新建文件夹
          </button>
          {treeMenu.node ? (
            <>
              <button
                type="button"
                onClick={() => {
                  const n = treeMenu.node;
                  setRailMode("files");
                  setRenaming({ path: n.path, value: n.path, isDir: n.type === "dir" });
                  setTreeMenu(null);
                }}
              >
                重命名 / 移动
              </button>
              <button
                type="button"
                className="danger"
                onClick={() => { const n = treeMenu.node; setTreeMenu(null); deleteEntry(n.path, n.type === "dir"); }}
              >
                删除
              </button>
            </>
          ) : (
            <button type="button" onClick={() => { loadTree(); setTreeMenu(null); }}>刷新</button>
          )}
        </div>
      )}

      <div className="statusbar" style={{ position: "fixed", bottom: 0, right: 0, left: "var(--ide-rail)", zIndex: 5, display: log.length ? "flex" : "none" }}>
        <span className="seg" style={{ color: "var(--text-soft)" }}>last log:</span>
        <span style={{ color: "var(--muted)", fontSize: 11, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1 }}>{log[0] || ""}</span>
        <button className="btn btn-quiet btn-sm" onClick={() => setLog([])}>清空</button>
      </div>
    </div>
    </>
  );
}

const ANNO_INTENTS = [["edit", "改写"], ["fix", "修复"], ["question", "疑问"], ["todo", "待办"]];
const ANNO_PRIORITIES = [["low", "低"], ["normal", "中"], ["high", "高"]];

// 文件树（真实 /api/editor/tree 层级）：折叠、打开、重命名/移动、删除。
// Top-level component so the inline rename input keeps focus across renders.
function FileTreeView({
  nodes,
  depth = 0,
  activePath,
  collapsedDirs,
  renaming,
  onToggle,
  onOpen,
  onRenameStart,
  onRenameChange,
  onRenameSubmit,
  onRenameCancel,
  onDelete,
  onMenu,
}) {
  const childProps = {
    activePath,
    collapsedDirs,
    renaming,
    onToggle,
    onOpen,
    onRenameStart,
    onRenameChange,
    onRenameSubmit,
    onRenameCancel,
    onDelete,
    onMenu,
  };
  return (
    <>
      {nodes.map((n) => {
        const isRenaming = renaming?.path === n.path;
        const pad = 6 + depth * 12;
        const actions = !isRenaming && (
          <span className="tree-actions">
            <button
              type="button"
              title="重命名 / 移动（可改完整路径）"
              onClick={(e) => { e.stopPropagation(); onRenameStart(n); }}
            >
              ✎
            </button>
            <button
              type="button"
              title="删除"
              onClick={(e) => { e.stopPropagation(); onDelete(n); }}
            >
              ×
            </button>
          </span>
        );
        if (n.type === "dir") {
          const closed = collapsedDirs.has(n.path);
          return (
            <div key={n.path}>
              <div
                className="item dir"
                style={{ paddingLeft: pad }}
                onClick={() => { if (!isRenaming) onToggle(n.path); }}
                onContextMenu={(e) => onMenu?.(e, n)}
              >
                <span className="tree-caret">{closed ? "▸" : "▾"}</span>
                {isRenaming ? (
                  <TreeRenameInput
                    value={renaming.value}
                    onChange={onRenameChange}
                    onSubmit={onRenameSubmit}
                    onCancel={onRenameCancel}
                  />
                ) : (
                  <span className="tree-name">{n.name}</span>
                )}
                {actions}
              </div>
              {!closed && <FileTreeView nodes={n.children || []} depth={depth + 1} {...childProps} />}
            </div>
          );
        }
        return (
          <div
            key={n.path}
            className={`item ${activePath === n.path ? "active" : ""}`}
            style={{ paddingLeft: pad + 14 }}
            onClick={() => { if (!isRenaming) onOpen(n); }}
            onContextMenu={(e) => onMenu?.(e, n)}
          >
            {isRenaming ? (
              <TreeRenameInput
                value={renaming.value}
                onChange={onRenameChange}
                onSubmit={onRenameSubmit}
                onCancel={onRenameCancel}
              />
            ) : (
              <span className="tree-name">{n.name}</span>
            )}
            {actions}
            {!isRenaming && n.name.includes(".") && (
              <span className="ext">{n.name.split(".").pop()}</span>
            )}
          </div>
        );
      })}
    </>
  );
}

function TreeRenameInput({ value, onChange, onSubmit, onCancel }) {
  return (
    <input
      className="tree-rename"
      autoFocus
      value={value}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") { e.preventDefault(); onSubmit(); }
        if (e.key === "Escape") onCancel();
      }}
      onBlur={onCancel}
    />
  );
}

// 09-integrations Epic 3b: workspace bibliography panel. Entries and citation
// locations come from the server's real .bib/.tex scan; nothing is fabricated.
function ReferencesPanel({ contest, onOpenFile }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [doi, setDoi] = useState("");
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState("");

  useEffect(() => {
    setData(null);
    setOpen(false);
    setImportMsg("");
  }, [contest]);

  async function importDoi(e) {
    e.preventDefault();
    if (!doi.trim() || importing) return;
    try {
      setImporting(true);
      setImportMsg("");
      const d = await api.post("/api/editor/references/import", { workspace: contest, doi: doi.trim() });
      setImportMsg(`已导入 ${d.key} → ${d.file}`);
      setDoi("");
      await load();
    } catch (err) {
      setImportMsg(err.message);
    } finally {
      setImporting(false);
    }
  }

  async function load() {
    try {
      setLoading(true);
      setError("");
      setData(await api.get(`/api/editor/references?workspace=${encodeURIComponent(contest)}`));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && !data && !loading) load();
  }

  return (
    <div className="refs-panel">
      <div className="refs-head">
        <button className="refs-toggle" onClick={toggle}>
          <b>文献</b>
          {data ? (
            <>
              <span className="chip muted">{data.entries.length} 条</span>
              {data.missing.length > 0 && <span className="chip warn">缺失 {data.missing.length}</span>}
            </>
          ) : null}
          <span className="muted">{open ? "收起 ▾" : "展开 ▸"}</span>
        </button>
        {open && (
          <button className="btn btn-quiet btn-sm" onClick={load} disabled={loading}>刷新</button>
        )}
      </div>
      {open && (
        loading ? (
          <div className="spinner" />
        ) : error ? (
          <div className="alert error">{error}</div>
        ) : !data ? null : (
          <div className="refs-body">
            <form className="refs-import" onSubmit={importDoi}>
              <input
                placeholder="DOI 或 arXiv ID / 链接 → 联网导入 BibTeX"
                value={doi}
                onChange={(e) => { setDoi(e.target.value); setImportMsg(""); }}
                disabled={importing}
              />
              <button className="btn btn-quiet btn-sm" disabled={importing || !doi.trim()}>
                {importing ? "导入中…" : "导入"}
              </button>
            </form>
            {importMsg && <div className="refs-import-msg">{importMsg}</div>}
            {data.bibFiles.length === 0 ? (
              <div className="empty">工作区里还没有 .bib 文件。导入一个 DOI，或把 references.bib 放进 paper/ 即可在这里管理。</div>
            ) : (
              <>
                <div className="refs-meta muted">{data.bibFiles.join(" · ")}</div>
                <div className="refs-list">
                  {data.entries.map((e) => (
                    <div key={`${e.file}:${e.key}`} className="ref-row">
                      <div className="ref-main">
                        <code className="ref-key">{e.key}</code>
                        <span className="ref-title">{e.title || "（无标题）"}</span>
                      </div>
                      <div className="ref-sub">
                        <span>{e.author || "—"}</span>
                        <span>{e.venue}{e.venue && e.year ? " · " : ""}{e.year}</span>
                        <span className={`chip ${e.citedCount > 0 ? "" : "muted"}`}>
                          {e.citedCount > 0 ? `被引用 ${e.citedCount} 处` : "未被引用"}
                        </span>
                        {(data.citations[e.key] || []).slice(0, 4).map((loc, i) => (
                          <button
                            key={`${loc.file}:${loc.line}:${i}`}
                            className="ref-loc"
                            onClick={() => onOpenFile(loc.file, loc.line)}
                            title={`${loc.file}:${loc.line}`}
                          >
                            {loc.file.split("/").pop()}:{loc.line}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                {data.missing.length > 0 && (
                  <div className="refs-missing">
                    <b>引用了但 .bib 里没有:</b>
                    {data.missing.map((m) => (
                      <span key={m.key} className="ref-missing-item">
                        <code className="ref-key">{m.key}</code>
                        {m.locations.slice(0, 2).map((loc, i) => (
                          <button
                            key={`${loc.file}:${loc.line}:${i}`}
                            className="ref-loc"
                            onClick={() => onOpenFile(loc.file, loc.line)}
                          >
                            {loc.file.split("/").pop()}:{loc.line}
                          </button>
                        ))}
                      </span>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )
      )}
    </div>
  );
}

function AnnotationsPanel({ active, selection, annotations, onAdd, onStatus, onDelete, onCompose, onJump }) {
  const [note, setNote] = useState("");
  const [intent, setIntent] = useState("edit");
  const [priority, setPriority] = useState("normal");
  const fileAnnotations = active
    ? annotations.filter((a) => a.target?.path === active.path)
    : [];
  const openForFile = fileAnnotations.filter((a) => a.status === "open");
  const canAdd = Boolean(active && selection && note.trim());

  function submit(event) {
    event.preventDefault();
    if (!canAdd) return;
    onAdd({ note: note.trim(), intent, priority });
    setNote("");
  }

  return (
    <div className="annotations">
      <div className="annotations-head">
        <b>标注</b>
        <span className="muted">
          {active ? `${active.path} · ${fileAnnotations.length}` : "打开文件后可在编辑器选区上标注"}
        </span>
        {active && openForFile.length > 0 && (
          <button
            className="btn btn-quiet btn-sm annotations-compose"
            onClick={() => onCompose(openForFile)}
            title="把本文件的待处理标注整理成 AI 修改请求（复核后发送）"
          >
            交给 AI 修改 ({openForFile.length})
          </button>
        )}
      </div>
      {active && (
        <form className="annotation-new" onSubmit={submit}>
          <span className="annotation-range">
            {selection ? `行 ${selection.startLine}${selection.endLine !== selection.startLine ? `–${selection.endLine}` : ""}` : "先在编辑器选中行"}
          </span>
          <input
            className="input"
            placeholder="批注：这段要怎么改…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <select value={intent} onChange={(e) => setIntent(e.target.value)} aria-label="意图">
            {ANNO_INTENTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <select value={priority} onChange={(e) => setPriority(e.target.value)} aria-label="优先级">
            {ANNO_PRIORITIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <button className="btn btn-primary btn-sm" disabled={!canAdd}>加批注</button>
        </form>
      )}
      <div className="annotation-list">
        {fileAnnotations.length === 0 ? (
          <div className="annotation-empty">本文件暂无标注。</div>
        ) : (
          fileAnnotations.map((a) => (
            <div key={a.id} className={`annotation-item status-${a.status}`}>
              {a.target.kind === "pdf-region" ? (
                <span className="annotation-loc">PDF p.{a.target.page}</span>
              ) : (
                <button
                  type="button"
                  className="annotation-loc annotation-loc-jump"
                  title="跳转到对应源码行"
                  onClick={() => onJump?.(a)}
                >
                  L{a.target.startLine}{a.target.endLine !== a.target.startLine ? `–${a.target.endLine}` : ""}
                </button>
              )}
              <span className={`chip anno-intent anno-intent-${a.intent}`}>{a.intent}</span>
              <span className={`chip anno-pri anno-pri-${a.priority}`}>{a.priority}</span>
              <span className="annotation-note">{a.note}</span>
              <span className={`annotation-status annotation-status-${a.status}`}>{a.status}</span>
              <span className="annotation-actions">
                {a.status === "resolved" ? (
                  <button className="btn btn-quiet btn-sm" onClick={() => onStatus(a.id, "open")}>重开</button>
                ) : (
                  <button className="btn btn-quiet btn-sm" onClick={() => onStatus(a.id, "resolved")}>解决</button>
                )}
                <button className="btn btn-quiet btn-sm" onClick={() => onDelete(a.id)}>删除</button>
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function EngineBanner({ engine, installing, installPct, onInstall, onRefresh }) {
  if (!engine) return null;
  const t = engine.tectonic || {};
  const present = t.present;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 16px",
        margin: "8px 8px 0",
        borderRadius: "var(--radius-sm)",
        background: present
          ? "rgba(77,153,120,0.08)"
          : "rgba(212,163,65,0.08)",
        border: `1px solid ${present ? "rgba(77,153,120,0.3)" : "rgba(212,163,65,0.3)"}`,
        fontSize: 12.5,
        color: "var(--text-soft)",
      }}
    >
      <span
        className={present ? "dot" : "amber-dot"}
        style={present ? { background: "var(--signal)" } : {}}
      />
      {present ? (
        <>
          <strong style={{ color: "var(--signal-2)" }}>Tectonic ready</strong>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)" }}>
            {t.detail || ""}
          </span>
          <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)" }}>
            {engine.platform} / {engine.arch}
          </span>
        </>
      ) : installing ? (
        <>
          <strong style={{ color: "var(--amber)" }}>Downloading Tectonic…</strong>
          <div
            style={{
              flex: 1,
              height: 6,
              background: "rgba(232,227,218,0.08)",
              borderRadius: 999,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${installPct}%`,
                height: "100%",
                background: "var(--grad-amber)",
                transition: "width 0.2s",
              }}
            />
          </div>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>{installPct}%</span>
        </>
      ) : (
        <>
          <strong style={{ color: "var(--amber)" }}>Tectonic not installed</strong>
          <span>
            用户机器上没有 LaTeX 环境,需要下载自包含的 Tectonic(~30MB)来本地编译。
          </span>
          <button
            className="btn btn-primary btn-sm"
            style={{ marginLeft: "auto" }}
            onClick={onInstall}
          >
            ⬇ Download Tectonic
          </button>
          <button className="btn btn-quiet btn-sm" onClick={onRefresh}>⟲</button>
        </>
      )}
    </div>
  );
}
