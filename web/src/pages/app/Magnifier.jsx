import { useEffect, useState } from "react";
import { api } from "../../lib/api.js";

const CONTESTS = ["sample-contest"];

export default function Magnifier() {
  const [contest, setContest] = useState(CONTESTS[0]);
  const [file, setFile] = useState("paper/sections/02-analysis.tex");
  const [line, setLine] = useState(5);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function query() {
    try {
      setLoading(true);
      setError("");
      const d = await api.get(
        `/api/editor/evidence?contest=${encodeURIComponent(contest)}&file=${encodeURIComponent(file)}&line=${line}`,
      );
      setData(d);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { query(); }, []); // eslint-disable-line

  return (
    <>
      <div className="page-head">
        <h1>放大镜 · 证据反查</h1>
        <p>
          选中任何一段,看到它背后的脚本 / 数据 / 源文献 / 图表。点 ⌘↩
          重新查询,所有结果来自真实账本。
        </p>
      </div>

      <div className="dash-grid">
        <section className="panel c12">
          <div className="row wrap" style={{ gap: 10, alignItems: "end" }}>
            <label className="field" style={{ marginBottom: 0, minWidth: 160 }}>
              <span>工作区</span>
              <select value={contest} onChange={(e) => setContest(e.target.value)}>
                {CONTESTS.map((c) => <option key={c}>{c}</option>)}
              </select>
            </label>
            <label className="field" style={{ marginBottom: 0, flex: 1, minWidth: 240 }}>
              <span>文件</span>
              <input value={file} onChange={(e) => setFile(e.target.value)} />
            </label>
            <label className="field" style={{ marginBottom: 0, width: 100 }}>
              <span>行</span>
              <input
                type="number"
                min="1"
                value={line}
                onChange={(e) => setLine(e.target.value)}
              />
            </label>
            <button
              className={`btn btn-primary ${loading ? "is-running" : ""}`}
              disabled={loading}
              onClick={query}
            >
              {loading ? "查询中" : "反查"}
            </button>
          </div>
        </section>

        <section className="panel c12" style={{ position: "relative" }}>
          <div className="magnifier-stage" style={{ minHeight: 520 }}>
            <div className="dim-page">
              <h3>{(file || "").split("/").pop().replace(".tex", "")}</h3>
              <p style={{ fontWeight: 600 }}>选定行 {line}</p>
              <p>
                给定数据集 <em>D</em> = {"{"}(x<sub>i</sub>, y<sub>i</sub>){")"},我们构建
                目标函数,并在 §2.3 中讨论凸松弛的取舍。
              </p>
              <div className="formula" style={{ fontStyle: "italic" }}>
                min<sub>x</sub> f(x) = ∑ c<sub>i</sub> x<sub>i</sub> + λ ‖x‖<sup>2</sup>
              </div>
              <p>
                数据、来源、模型脚本与图注主张见右侧 evidence drawer。
              </p>
            </div>

            <div className="magnifier-glass">
              <div className="lens">
                <div style={{ fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", opacity: 0.6 }}>
                  Selected · {file.split("/").pop()}:{line}
                </div>
                <div style={{ marginTop: 6 }}>给定数据集</div>
                <div className="formula">
                  min<sub>x</sub> f(x) = ∑ c<sub>i</sub> x<sub>i</sub>
                </div>
                <div style={{ fontSize: 10, marginTop: 6, opacity: 0.7 }}>
                  1.4× zoom · STIX Two Math
                </div>
              </div>
            </div>
            <div className="magnifier-handle" />

            <div className="evidence-drawer">
              <h4>
                证据
                <span style={{ fontSize: 11, color: "var(--muted)" }}>
                  {file.split("/").pop()}:{line}
                </span>
              </h4>
              {loading ? (
                <div className="spinner" />
              ) : error ? (
                <div className="alert error">{error}</div>
              ) : (
                <>
                  <EvidenceList
                    title="claim-ledger"
                    items={(data?.claims || []).map((c) => ({
                      k: c.claim_id,
                      v: c.claim_text || c.section,
                    }))}
                  />
                  <EvidenceList
                    title="result-ledger"
                    items={(data?.results || []).map((r) => ({
                      k: r.run_id || r.metric,
                      v: `${r.metric || ""} = ${r.value || ""} ${r.unit || ""}`,
                    }))}
                  />
                  <EvidenceList
                    title="script"
                    items={(data?.results || []).map((r) => ({
                      k: r.script,
                      v: r.source_data,
                    }))}
                  />
                  <EvidenceList
                    title="figure-ledger"
                    items={(data?.figures || []).map((f) => ({
                      k: f.figure_id,
                      v: f.caption_claim || f.path,
                    }))}
                  />
                  <EvidenceList
                    title="source-ledger"
                    items={(data?.sources || []).map((s) => ({
                      k: s.source_id,
                      v: s.title,
                    }))}
                  />
                </>
              )}
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

function EvidenceList({ title, items }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="ev">
      <div className="k">{title}</div>
      {items.slice(0, 3).map((it, i) => (
        <div key={`${title}-${i}`} className="v">
          <strong style={{ color: "var(--text)" }}>{it.k || "—"}</strong>
          {it.v ? <>: {it.v}</> : null}
        </div>
      ))}
    </div>
  );
}
