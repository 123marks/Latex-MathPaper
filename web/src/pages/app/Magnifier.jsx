import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../../lib/api.js";
import EvidenceFlow from "../../components/motifs/EvidenceFlow.jsx";

// Evidence categories the Magnifier traces back from a selected line.
const CATEGORIES = [
  { id: "claim", title: "Claim", label: "论断" },
  { id: "result", title: "Result", label: "结果" },
  { id: "script", title: "Script", label: "脚本" },
  { id: "dataset", title: "Dataset", label: "数据集" },
  { id: "source", title: "Source", label: "源文献" },
];

function uniqueBy(items, keyFn) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const key = keyFn(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

// Map the raw ledger response into the five reviewable evidence categories.
function toCategories(data) {
  const results = data?.results || [];
  return {
    claim: (data?.claims || []).map((c) => ({ k: c.claim_id, v: c.claim_text || c.section })),
    result: results.map((r) => ({ k: r.run_id || r.metric, v: `${r.metric || ""} = ${r.value || ""} ${r.unit || ""}`.trim() })),
    script: uniqueBy(results, (r) => r.script).map((r) => ({ k: r.script, v: r.source_data })),
    dataset: uniqueBy(results, (r) => r.source_data).map((r) => ({ k: r.source_data, v: r.metric })),
    source: (data?.sources || []).map((s) => ({ k: s.source_id, v: s.title })),
  };
}

export default function Magnifier() {
  const [params, setParams] = useSearchParams();
  const [projects, setProjects] = useState([]);
  const [workspaceId, setWorkspaceId] = useState(params.get("workspace") || "");
  const [file, setFile] = useState("paper/main.tex");
  const [line, setLine] = useState(5);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [projectsError, setProjectsError] = useState("");

  const active = projects.find((p) => p.id === workspaceId) || null;
  const hasEvidence = Boolean(active?.capabilities?.includes("evidence"));

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const d = await api.get("/api/editor/projects");
        if (!alive) return;
        const list = d.projects || [];
        setProjects(list);
        if (!workspaceId && list.length > 0) {
          const preferred = list.find((p) => p.capabilities?.includes("evidence")) || list[0];
          setWorkspaceId(preferred.id);
        }
      } catch (e) {
        if (alive) setProjectsError(e.message);
      }
    })();
    return () => { alive = false; };
  }, []); // eslint-disable-line

  async function query() {
    if (!workspaceId || !hasEvidence) return;
    try {
      setLoading(true);
      setError("");
      const d = await api.get(
        `/api/editor/evidence?workspace=${encodeURIComponent(workspaceId)}&file=${encodeURIComponent(file)}&line=${line}`,
      );
      setData(d);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (workspaceId && hasEvidence) query();
    else setData(null);
  }, [workspaceId, hasEvidence]); // eslint-disable-line

  function pickWorkspace(id) {
    setWorkspaceId(id);
    const next = new URLSearchParams(params);
    if (id) next.set("workspace", id); else next.delete("workspace");
    setParams(next, { replace: true });
  }

  const categories = useMemo(() => toCategories(data), [data]);
  // Build EvidenceFlow links from the selection anchor to each populated category.
  const populated = CATEGORIES.filter((cat) => (categories[cat.id] || []).length > 0);
  const flowLinks = populated.map((cat, index) => {
    const y = populated.length === 1 ? 50 : 12 + (index * (76 / (populated.length - 1)));
    return { id: cat.id, points: [{ x: 8, y: 50 }, { x: 52, y: (50 + y) / 2 }, { x: 94, y }] };
  });

  return (
    <>
      <div className="page-head">
        <h1>放大镜 · 证据反查</h1>
        <p>
          选中任意一段，反查它背后的论断、结果、脚本、数据集与源文献。结果来自当前
          Workspace 的真实账本，仅在其 Pack 启用 Evidence 能力时可用。
        </p>
      </div>

      <div className="dash-grid">
        <section className="panel c12">
          <div className="row wrap" style={{ gap: 10, alignItems: "end" }}>
            <label className="field" style={{ marginBottom: 0, minWidth: 200 }}>
              <span>Workspace</span>
              <select
                value={workspaceId}
                onChange={(e) => pickWorkspace(e.target.value)}
                disabled={projects.length === 0}
              >
                {projects.length === 0 ? <option value="">（无可用 Workspace）</option> : null}
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name || p.id}{p.capabilities?.includes("evidence") ? " · evidence" : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="field" style={{ marginBottom: 0, flex: 1, minWidth: 240 }}>
              <span>文件</span>
              <input value={file} onChange={(e) => setFile(e.target.value)} />
            </label>
            <label className="field" style={{ marginBottom: 0, width: 100 }}>
              <span>行</span>
              <input type="number" min="1" value={line} onChange={(e) => setLine(e.target.value)} />
            </label>
            <button
              className={`btn btn-primary ${loading ? "is-running" : ""}`}
              disabled={loading || !hasEvidence}
              onClick={query}
            >
              {loading ? "查询中" : "反查"}
            </button>
          </div>
          {projectsError ? <div className="alert error" style={{ marginTop: 10 }}>{projectsError}</div> : null}
        </section>

        {!hasEvidence ? (
          <section className="panel c12">
            <div className="empty-state" style={{ padding: "48px 24px", textAlign: "center" }}>
              <h3 style={{ margin: "0 0 8px" }}>此 Workspace 未启用 Evidence 能力</h3>
              <p style={{ color: "var(--muted)", maxWidth: 520, margin: "0 auto" }}>
                证据反查是 Pack 贡献的能力。切换到声明了 <code>evidence</code> Capability 的
                Workspace（例如 math-modeling Pack）即可使用镜片与证据抽屉。
              </p>
            </div>
          </section>
        ) : (
          <section className="panel c12" style={{ position: "relative" }}>
            <div className="magnifier-stage" style={{ minHeight: 520 }}>
              <div className="dim-page">
                <h3>{(file || "").split("/").pop().replace(".tex", "")}</h3>
                <p style={{ fontWeight: 600 }}>选定行 {line}</p>
                <p>
                  {data?.lineText
                    ? data.lineText
                    : "选中一行源码并反查，右侧证据抽屉会列出与之关联的账本行。"}
                </p>
                <p>数据、来源、模型脚本与图注主张见右侧 evidence drawer。</p>
                <EvidenceFlow
                  className="magnifier-flow"
                  links={flowLinks}
                  label="证据关联"
                  animated={!loading}
                />
              </div>

              <div className="magnifier-glass">
                <div className="lens">
                  <div style={{ fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", opacity: 0.6 }}>
                    Selected · {(file || "").split("/").pop()}:{line}
                  </div>
                  <div style={{ marginTop: 6 }}>{data?.lineText ? data.lineText.slice(0, 40) : "选定内容"}</div>
                  <div style={{ fontSize: 10, marginTop: 6, opacity: 0.7 }}>1.4× zoom · STIX Two Math</div>
                </div>
              </div>
              <div className="magnifier-handle" />

              <div className="evidence-drawer">
                <h4>
                  证据
                  <span style={{ fontSize: 11, color: "var(--muted)" }}>
                    {(file || "").split("/").pop()}:{line}
                  </span>
                </h4>
                {loading ? (
                  <div className="spinner" />
                ) : error ? (
                  <div className="alert error">{error}</div>
                ) : (
                  <>
                    {CATEGORIES.map((cat) => (
                      <EvidenceList key={cat.id} title={cat.title} items={categories[cat.id]} />
                    ))}
                    {populated.length === 0 ? (
                      <div className="v" style={{ color: "var(--muted)" }}>
                        此文件/行未匹配到账本记录。
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            </div>
          </section>
        )}
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
