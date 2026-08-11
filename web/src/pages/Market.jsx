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

const DETAIL_TABS = [
  { id: "overview", label: "概览" },
  { id: "perms", label: "权限与能力" },
  { id: "mcp", label: "MCP" },
];

// Capabilities are derived from each skill's real execute mode (what the server
// actually does), never invented. "writes" is always Preview-gated: skills emit
// drafts/results, and any file change still goes through the editor Apply flow.
const EXECUTE_CAPS = {
  csv: { reads: "Workspace 内指定的 CSV 文件（相对路径）", writes: "不直接写入文件", calls: "本地 CSV 解析与统计摘要" },
  citation: { reads: "你粘贴的 BibTeX / 引用行", writes: "不直接写入文件", calls: "引用可达性与字段核验" },
  review: { reads: "你粘贴的论文段落", writes: "不直接写入文件", calls: "本地启发式评审批注" },
  writing: { reads: "你粘贴的方法 / 实验段落", writes: "改写结果需你在编辑器确认 Apply", calls: "文本改写（不新增事实）" },
  figure: { reads: "你提供的数据与图注描述", writes: "生成脚本草稿，写入前需 Apply", calls: "图表脚本生成" },
  layout: { reads: "你提供的数据矩阵", writes: "生成表格片段，写入前需 Apply", calls: "LaTeX 表格样式生成" },
  model: { reads: "你描述的问题 / 模型", writes: "不直接写入文件", calls: "方法建议生成" },
};

function capsFor(skill) {
  return (
    EXECUTE_CAPS[skill?.execute] || {
      reads: "你提供的输入内容",
      writes: "不直接写入文件",
      calls: skill?.execute || "envelope",
    }
  );
}

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
  const [detailTarget, setDetailTarget] = useState(null);
  const [detailTab, setDetailTab] = useState("overview");

  function openDetail(skill) {
    setDetailTarget(skill);
    setDetailTab("overview");
  }
  function closeDetail() {
    setDetailTarget(null);
  }

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
                <div className="row" style={{ gap: 6 }}>
                  <button className="btn btn-quiet btn-sm" onClick={() => openDetail(s)}>详情</button>
                  {s.installed ? (
                    <>
                      <span className="chip signal" style={{ padding: "2px 10px" }}>已安装</span>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => openRun(s)}
                        disabled={busy === s.id}
                      >
                        ▶ 运行
                      </button>
                    </>
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

      {detailTarget && (
        <div className="cmdk-overlay" onClick={closeDetail}>
          <div
            className="cmdk glass"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 680, padding: 0 }}
          >
            <div
              className="row spread"
              style={{ padding: "16px 20px", borderBottom: "1px solid var(--ink-line)", background: "var(--bg-2)" }}
            >
              <div>
                <div className="kicker">技能详情</div>
                <h3 className="display" style={{ fontSize: 22, marginTop: 4 }}>{detailTarget.name}</h3>
                <p style={{ color: "var(--muted)", fontSize: 12.5, marginTop: 4 }}>
                  {detailTarget.team} · v{detailTarget.ver} · ★ {detailTarget.stars} · {(detailTarget.installs || 0).toLocaleString()} 安装
                </p>
              </div>
              <button className="btn btn-quiet btn-sm" onClick={closeDetail}>×</button>
            </div>
            <div className="market-detail-tabs">
              {DETAIL_TABS.map((t) => (
                <button
                  key={t.id}
                  className={`chip ${detailTab === t.id ? "" : "muted"}`}
                  style={{ cursor: "pointer" }}
                  onClick={() => setDetailTab(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div style={{ padding: 20, display: "grid", gap: 14 }}>
              {detailTab === "overview" && (
                <>
                  <p style={{ fontSize: 13.5, color: "var(--text-soft)", lineHeight: 1.7 }}>{detailTarget.desc}</p>
                  <label className="field">
                    <span>系统提示（技能实际使用的指令）</span>
                    <pre className="market-detail-pre">{detailTarget.systemPrompt || "—"}</pre>
                  </label>
                </>
              )}
              {detailTab === "perms" && (
                <ul className="market-perms">
                  <li><b>读取</b><span>{capsFor(detailTarget).reads}</span></li>
                  <li><b>写入</b><span>{capsFor(detailTarget).writes}</span></li>
                  <li><b>调用</b><span>{capsFor(detailTarget).calls}</span></li>
                  <li className="market-perms__note">权限依据技能真实的执行模式（{detailTarget.execute || "envelope"}）推导；写入一律经编辑器 Preview → Apply。</li>
                </ul>
              )}
              {detailTab === "mcp" && (
                <div style={{ background: "var(--bg-1)", border: "1px solid var(--ink-line-2)", borderRadius: "var(--radius-sm)", padding: 16 }}>
                  <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>
                    此技能未声明 MCP 工具调用；运行仅使用本地能力与你配置的 provider。MCP 服务需在设置中显式启用并授权。
                  </p>
                </div>
              )}
              <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
                {detailTarget.installed ? (
                  <button className="btn btn-primary btn-sm" onClick={() => { const t = detailTarget; closeDetail(); openRun(t); }}>▶ 运行</button>
                ) : (
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => install(detailTarget.id)}
                    disabled={busy === detailTarget.id}
                  >
                    {busy === detailTarget.id ? "安装中…" : "安装"}
                  </button>
                )}
              </div>
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
