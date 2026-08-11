import { useEffect, useMemo, useState } from "react";
import Reveal from "../components/Reveal.jsx";
import { api } from "../lib/api.js";

const CATEGORIES = [
  ["all", "全部"],
  ["writing", "写作辅助"],
  ["figure", "数据图表"],
  ["model", "建模方法"],
  ["proof", "评审校对"],
  ["layout", "排版样式"],
  ["team", "团队协作"],
  ["custom", "自定义"],
];

export default function Market() {
  const [skills, setSkills] = useState([]);
  const [cat, setCat] = useState("all");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [runTarget, setRunTarget] = useState(null);
  const [runInput, setRunInput] = useState("");
  const [runContext, setRunContext] = useState("");
  const [runResult, setRunResult] = useState(null);
  const [runBusy, setRunBusy] = useState(false);

  async function load() {
    try {
      setLoading(true);
      const data = await api.get("/api/market/skills");
      setSkills(data.skills || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function install(id) {
    try {
      setBusy(id);
      await api.post(`/api/market/skills/${id}/install`);
      setSkills((s) => s.map((x) => (x.id === id ? { ...x, installed: true, installs: x.installs + 1 } : x)));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }

  function openRun(skill) {
    setRunTarget(skill);
    setRunInput("");
    setRunContext("");
    setRunResult(null);
  }
  function closeRun() {
    setRunTarget(null);
    setRunResult(null);
  }
  async function runSkillNow() {
    if (!runTarget || !runInput.trim()) return;
    try {
      setRunBusy(true);
      setRunResult(null);
      const r = await api.post(`/api/skills/${runTarget.id}/run`, {
        input: runInput,
        context: { path: runContext },
      });
      setRunResult(r);
    } catch (e) {
      setRunResult({ ok: false, error: e.message });
    } finally {
      setRunBusy(false);
    }
  }

  const filtered = useMemo(() => {
    let out = cat === "all" ? skills : skills.filter((s) => s.cat === cat);
    if (q.trim()) {
      const k = q.trim().toLowerCase();
      out = out.filter(
        (s) =>
          s.name.toLowerCase().includes(k) ||
          s.team.toLowerCase().includes(k) ||
          s.desc.toLowerCase().includes(k),
      );
    }
    return out;
  }, [skills, cat, q]);

  return (
    <div className="container section">
      <Reveal className="section-head">
        <span className="eyebrow">技能市场</span>
        <h2>一行代码,一类能力。</h2>
        <p>
          Paper OS 的技能 = SKILL.md + 可选资产 + MCP 工具。安装后,在任何 .tex
          文件里行级触发。也可以把你的团队工作流写成一个 SKILL.md,共享给队友。
        </p>
      </Reveal>

      {error && <div className="alert error">{error}</div>}

      <div className="row wrap" style={{ marginBottom: 18, gap: 12 }}>
        <input
          className="input"
          style={{ flex: 1, minWidth: 220, maxWidth: 360 }}
          placeholder="搜索技能 / 团队 / 描述"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="market-filters">
        {CATEGORIES.map(([v, l]) => (
          <button
            key={v}
            className={`chip ${cat === v ? "" : "muted"}`}
            style={{ cursor: "pointer" }}
            onClick={() => setCat(v)}
          >
            {l}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="spinner" />
      ) : (
        <div className="market-grid">
          {filtered.map((s, i) => (
            <Reveal key={s.id} delay={i * 0.04} className="card lift market-card">
              <div className="ico">
                {s.name
                  .split(" ")
                  .map((w) => w[0])
                  .slice(0, 2)
                  .join("")}
              </div>
              <div>
                <div className="name">{s.name}</div>
                <div className="meta">
                  <span>{s.team}</span>
                  <span>·</span>
                  <span>v{s.ver}</span>
                </div>
              </div>
              <div className="desc">{s.desc}</div>
              <div className="row spread">
                <span className="stars">★ {s.stars} · {(s.installs || 0).toLocaleString()} 安装</span>
                {s.installed ? (
                  <div className="row" style={{ gap: 6 }}>
                    <span className="chip signal" style={{ padding: "2px 10px" }}>已安装</span>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => openRun(s)}
                      disabled={busy === s.id}
                    >
                      ▶ 运行
                    </button>
                  </div>
                ) : (
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => install(s.id)}
                    disabled={busy === s.id}
                  >
                    {busy === s.id ? "安装中…" : "安装"}
                  </button>
                )}
              </div>
            </Reveal>
          ))}
        </div>
      )}

      {runTarget && (
        <div className="cmdk-overlay" onClick={closeRun}>
          <div
            className="cmdk glass"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 720, padding: 0 }}
          >
            <div
              className="row spread"
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid var(--ink-line)",
                background: "var(--bg-2)",
              }}
            >
              <div>
                <div className="kicker">运行技能</div>
                <h3 className="display" style={{ fontSize: 22, marginTop: 4 }}>
                  {runTarget.name}
                </h3>
                <p style={{ color: "var(--muted)", fontSize: 12.5, marginTop: 4, maxWidth: 520 }}>
                  {runTarget.desc}
                </p>
              </div>
              <button className="btn btn-quiet btn-sm" onClick={closeRun}>
                ×
              </button>
            </div>
            <div style={{ padding: 20, display: "grid", gap: 14 }}>
              <label className="field">
                <span>输入(给技能的内容)</span>
                <textarea
                  value={runInput}
                  onChange={(e) => setRunInput(e.target.value)}
                  placeholder={
                    runTarget.execute === "citation"
                      ? "粘一段 BibTeX 或包含 URL 的引用:\n\\cite{einstein1905}\n或 https://example.org/paper.pdf"
                      : runTarget.execute === "csv"
                      ? "在下方填 CSV 相对路径,或先粘几行 CSV 文本"
                      : runTarget.execute === "review"
                      ? "粘一段论文段落,产出同行评审批注"
                      : runTarget.execute === "writing"
                      ? "粘一段方法 / 实验描述,产出去重后的紧凑版本"
                      : "粘任意内容"
                  }
                  rows={6}
                />
              </label>
              <label className="field">
                <span>上下文(可选,data-sniffer 用:CSV 相对路径)</span>
                <input
                  value={runContext}
                  onChange={(e) => setRunContext(e.target.value)}
                  placeholder="例如 data/raw/train.csv"
                />
              </label>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <span style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>
                  mode: {runTarget.execute || "envelope"}
                </span>
                <button
                  className={`btn btn-primary ${runBusy ? "is-running" : ""}`}
                  disabled={runBusy || !runInput.trim()}
                  onClick={runSkillNow}
                >
                  {runBusy ? "运行中" : "▶ 运行"}
                </button>
              </div>

              {runResult && (
                <div
                  style={{
                    background: "var(--bg-1)",
                    border: "1px solid var(--ink-line-2)",
                    borderRadius: "var(--radius-sm)",
                    padding: 16,
                    fontSize: 13,
                    maxHeight: 320,
                    overflow: "auto",
                    fontFamily: "var(--font-mono)",
                    whiteSpace: "pre-wrap",
                    color: runResult.ok ? "var(--text)" : "#ffb3c8",
                  }}
                >
                  {runResult.ok === false
                    ? `✗ ${runResult.error || "运行失败"}`
                    : renderResult(runResult)}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function renderResult(r) {
  if (r.mode === "citation") {
    const lines = (r.citations || []).map(
      (c) => "  · " + c.url + "  →  " + c.status + "  " + (c.contentType || ""),
    );
    return "verdict: " + (r.verdict || "—") + "\n" + lines.join("\n");
  }
  if (r.mode === "csv") {
    return (
      "path: " + r.path + "\n" +
      "rows: " + r.rows + "\n" +
      "columns: " + ((r.columns || []).join(", ")) + "\n" +
      "numeric: " + ((r.numericColumns || []).join(", ")) + "\n" +
      "preview:\n" + ((r.preview || []).map((l) => "  " + l).join("\n")) + "\n" +
      "suggested charts: " + ((r.suggestedCharts || []).join(", "))
    );
  }
  if (r.mode === "review") {
    const lines = (r.comments || []).map((c) => "  [" + c.severity + "] " + c.note);
    return (
      "stats: words=" + r.stats?.words + " sentences=" + r.stats?.sentences +
      " avgLen=" + r.stats?.avgLen + " evidenceHits=" + r.stats?.evidenceHits +
      "\ncomments:\n" + lines.join("\n")
    );
  }
  if (r.mode === "writing") {
    return (
      "before (" + ((r.before || "").length) + " chars):\n" +
      (r.before || "").slice(0, 600) + "\n---\n" +
      "after (" + ((r.after || "").length) + " chars, ratio=" + (r.ratio || 0).toFixed(2) + "):\n" +
      (r.after || "").slice(0, 600)
    );
  }
  if (r.mode === "envelope") {
    return (
      "skill: " + r.skill?.name + "\n" +
      "systemPrompt:\n" + r.skill?.systemPrompt + "\n\n" +
      "→ suggestedSeed:\n" + r.suggestedSeed + "\n\n" +
      "(把 suggestedSeed 粘到 AI Chat,会按该技能的系统提示回答。)"
    );
  }
  return JSON.stringify(r, null, 2);
}
