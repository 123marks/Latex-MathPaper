import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { api } from "../../lib/api.js";
import AIAssistantPanel from "../../components/workbench/AIAssistantPanel.jsx";
import LaTeXEditor from "../../components/LaTeXEditor.jsx";
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

  async function addAnnotation({ note, intent, priority }) {
    if (!active || !annoSel) return;
    try {
      const d = await api.post("/api/editor/annotations", {
        workspace: contest,
        target: {
          kind: "editor-range",
          path: active.path,
          startLine: annoSel.startLine,
          endLine: annoSel.endLine,
          excerpt: annoSel.excerpt,
        },
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
      const range = a.target.endLine !== a.target.startLine
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
        setLog((l) => [`[compile] done exit=${msg.code} ${msg.durationMs}ms`, ...l].slice(0, 80));
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
      <div className="ide">
      <div className="ide-left">
        <div className="file-tree">
          <div className="row spread" style={{ padding: "0 6px 8px" }}>
            <h5 style={{ margin: 0 }}>{contest}</h5>
            <button className="btn btn-quiet btn-sm" onClick={loadTree}>⟲</button>
          </div>
          {allFiles.length === 0 ? (
            <div className="empty" style={{ padding: 10, fontSize: 11 }}>空</div>
          ) : (
            allFiles.map((f) => (
              <div
                key={f.path}
                className={`item ${active && active.path === f.path ? "active" : ""}`}
                onClick={() => openFile(f)}
              >
                {f.name}
                <span className="ext">{f.path.split(".").pop()}</span>
              </div>
            ))
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

          <div className="editor-body">
            {active ? (
              <LaTeXEditor
                value={editor}
                onChange={(v) => {
                  setEditor(v);
                  if (active) setOpenTabs((tabs) => tabs.map((t) => (t.path === active.path ? { ...t, dirty: true } : t)));
                }}
                onSelectionChange={setAnnoSel}
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
              </div>
              {pdfUrl ? (
                <iframe
                  src={pdfUrl}
                  title="PDF preview"
                  style={{
                    width: "100%",
                    maxWidth: 520,
                    height: 520,
                    background: "#fefcf6",
                    border: 0,
                    borderRadius: 6,
                    boxShadow: "0 12px 40px -16px rgba(0,0,0,0.6)",
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
          />

          <ReferencesPanel
            contest={contest}
            onOpenFile={(p) => openFile({ path: p, name: p.split("/").pop() })}
          />

          <div className="statusbar">
            <span className="seg branch">⎇ main</span>
            <span className="seg">LaTeX</span>
            <span className="seg">UTF-8</span>
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

// 09-integrations Epic 3b: workspace bibliography panel. Entries and citation
// locations come from the server's real .bib/.tex scan; nothing is fabricated.
function ReferencesPanel({ contest, onOpenFile }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setData(null);
    setOpen(false);
  }, [contest]);

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
            {data.bibFiles.length === 0 ? (
              <div className="empty">工作区里还没有 .bib 文件。把 references.bib 放进 paper/ 即可在这里管理。</div>
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
                            onClick={() => onOpenFile(loc.file)}
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
                            onClick={() => onOpenFile(loc.file)}
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

function AnnotationsPanel({ active, selection, annotations, onAdd, onStatus, onDelete, onCompose }) {
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
              <span className="annotation-loc">
                L{a.target.startLine}{a.target.endLine !== a.target.startLine ? `–${a.target.endLine}` : ""}
              </span>
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
