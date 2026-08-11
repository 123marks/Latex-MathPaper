import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api.js";
import { parseFileBlocks } from "../../lib/ai-execution.js";
import { formatRelative } from "../../lib/format.js";

// 09-integrations Epic 2b: browse, search, inspect, and reuse recorded AI chat
// sessions. All data is the caller's own real chat history from /api/chat/history.
export default function Sessions() {
  const [q, setQ] = useState("");
  const [threads, setThreads] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  async function load(query = "") {
    try {
      setLoading(true);
      setError("");
      const d = await api.get(`/api/chat/history${query ? `?q=${encodeURIComponent(query)}` : ""}`);
      setThreads(d.threads || []);
      setTotal(d.total || 0);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function openDetail(id) {
    try {
      setDetailLoading(true);
      const d = await api.get(`/api/chat/history?id=${encodeURIComponent(id)}`);
      setSelected(d.thread);
    } catch (e) {
      setError(e.message);
    } finally {
      setDetailLoading(false);
    }
  }

  const fileBlocks = useMemo(() => parseFileBlocks(selected?.reply || ""), [selected]);

  return (
    <>
      <div className="page-head">
        <h1>AI 会话</h1>
        <p>历史 AI 对话都保存在本机。搜索、查看提问与回答，或复用到工作台。</p>
      </div>
      {error && <div className="alert error">{error}</div>}

      <div className="sessions">
        <div className="session-list-col">
          <form className="session-search" onSubmit={(e) => { e.preventDefault(); load(q); }}>
            <input className="input" placeholder="搜索提问 / 回答…" value={q} onChange={(e) => setQ(e.target.value)} />
            <button className="btn btn-quiet btn-sm">搜索</button>
            <span className="muted">{total} 条</span>
          </form>
          {loading ? (
            <div className="spinner" />
          ) : threads.length === 0 ? (
            <div className="empty">还没有会话。去工作台与 AI 对话后会出现在这里。</div>
          ) : (
            <div className="session-list">
              {threads.map((t) => (
                <button
                  key={t.id}
                  className={`session-item ${selected?.id === t.id ? "active" : ""}`}
                  onClick={() => openDetail(t.id)}
                >
                  <div className="session-item-head">
                    <span className={`chip ${t.mode === "inline" ? "" : "muted"}`}>{t.mode}</span>
                    <span className="session-time">{formatRelative(t.createdAt)}</span>
                  </div>
                  <div className="session-prompt">{t.prompt || "（空提问）"}</div>
                  {t.fileBlocks?.length > 0 && (
                    <div className="session-files">
                      {t.fileBlocks.map((p) => <span key={p} className="chip file">{p}</span>)}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="session-detail-col">
          {!selected ? (
            <div className="empty">选择左侧一条会话查看详情。</div>
          ) : detailLoading ? (
            <div className="spinner" />
          ) : (
            <div className="session-detail">
              <div className="session-detail-head">
                <span className={`chip ${selected.mode === "inline" ? "" : "muted"}`}>{selected.mode}</span>
                <span className="session-time">{formatRelative(selected.createdAt)}</span>
                <Link
                  className="btn btn-primary btn-sm session-resume"
                  to={`/app/workbench?prompt=${encodeURIComponent(selected.prompt || "")}`}
                >
                  在工作台复用
                </Link>
              </div>
              <div className="session-block">
                <div className="k">提问</div>
                <pre className="session-text">{selected.prompt}</pre>
              </div>
              <div className="session-block">
                <div className="k">回答</div>
                <pre className="session-text">{selected.reply}</pre>
              </div>
              {fileBlocks.length > 0 && (
                <div className="session-block">
                  <div className="k">提案文件（{fileBlocks.length}）</div>
                  {fileBlocks.map((b) => (
                    <details key={b.path} className="session-fileblock">
                      <summary>{b.path} · {b.content.split("\n").length} 行</summary>
                      <pre className="session-text">{b.content}</pre>
                    </details>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
