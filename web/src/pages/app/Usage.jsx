import { useEffect, useState } from "react";
import { api } from "../../lib/api.js";
import { useAuth } from "../../lib/auth.jsx";

// API-relay style usage dashboard (sub2api/newapi-inspired).
// Shows per-model tokens, requests, cost (USD), 30-day daily chart.
const DAYS_OPTS = [
  ["7", "7 天"],
  ["30", "30 天"],
  ["90", "90 天"],
];

export default function Usage() {
  const { user } = useAuth();
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setError("");
    api
      .get(`/api/usage/me?days=${days}`)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [days]);

  const max = data ? Math.max(1, ...(data.daily || []).map((d) => d.tokens)) : 1;
  const hourMax = data ? Math.max(1, ...(data.hours || [0])) : 1;
  const wsMax = data ? Math.max(1, ...(data.workspaces || []).map((w) => w.tokens)) : 1;

  return (
    <>
      <div className="page-head">
        <h1>API 用量</h1>
        <p>你的模型调用记录(每个 chat 调用、技能运行、编译都会被记在这里)。</p>
      </div>

      <div className="row spread" style={{ marginBottom: 18 }}>
        <div className="row" style={{ gap: 8 }}>
          {DAYS_OPTS.map(([v, l]) => (
            <button
              key={v}
              className={`chip ${Number(days) === Number(v) ? "" : "muted"}`}
              style={{ cursor: "pointer" }}
              onClick={() => setDays(Number(v))}
            >
              {l}
            </button>
          ))}
        </div>
        <span className="chip muted" style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>
          {user?.username} · provider {data ? "已配置" : "—"}
        </span>
      </div>

      {error && <div className="alert error">{error}</div>}

      {loading ? (
        <div className="spinner" />
      ) : !data ? null : (
        <>
          <div className="stat-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
            <div className="stat">
              <b>{data.totalRequests.toLocaleString()}</b>
              <span>请求数 · past {data.days}d</span>
            </div>
            <div className="stat">
              <b>{(data.totalTokens).toLocaleString()}</b>
              <span>total tokens</span>
            </div>
            <div className="stat">
              <b style={{ fontSize: 24 }}>${data.costUsd.toFixed(4)}</b>
              <span>estimated cost</span>
            </div>
            <div className="stat">
              <b>{data.models.length}</b>
              <span>活跃模型</span>
            </div>
          </div>

          <section className="panel glass" style={{ marginTop: 18, padding: 22 }}>
            <div className="panel-head" style={{ marginBottom: 14 }}>
              <h3>Token 构成</h3>
              <span className="chip muted" style={{ fontSize: 11 }}>输入 vs 输出</span>
            </div>
            {(() => {
              const comp = data.promptTokens + data.completionTokens;
              const p = comp > 0 ? Math.round((data.promptTokens / comp) * 100) : 0;
              const c = comp > 0 ? 100 - p : 0;
              return (
                <div className="token-comp">
                  <div className="token-comp-bar">
                    <span className="token-comp-prompt" style={{ width: `${p}%` }} />
                    <span className="token-comp-completion" style={{ width: `${c}%` }} />
                  </div>
                  <div className="token-comp-legend">
                    <span><i className="dot dot-prompt" /> 输入 {data.promptTokens.toLocaleString()}（{p}%）</span>
                    <span><i className="dot dot-completion" /> 输出 {data.completionTokens.toLocaleString()}（{c}%）</span>
                  </div>
                </div>
              );
            })()}
          </section>

          <section className="panel glass" style={{ marginTop: 18, padding: 22 }}>
            <div className="panel-head" style={{ marginBottom: 14 }}>
              <h3>每日调用量</h3>
              <span className="chip muted" style={{ fontSize: 11 }}>
                tokens / day
              </span>
            </div>
            <div className="bars">
              {(data.daily || []).map((d) => (
                <div
                  key={d.day}
                  className="bar"
                  style={{
                    height: `${Math.max(8, (d.tokens / max) * 100)}%`,
                  }}
                  title={`${d.day} · ${d.tokens.toLocaleString()} tok`}
                />
              ))}
            </div>
            <div className="bar-label">
              {(data.daily || [])
                .filter((_, i) => i % Math.max(1, Math.ceil((data.daily || []).length / 8)) === 0)
                .map((d) => (
                  <span key={d.day}>{d.day.slice(5)}</span>
                ))}
            </div>
          </section>

          <div className="grid-2" style={{ marginTop: 18, gap: 18, alignItems: "stretch" }}>
            <section className="panel glass" style={{ padding: 22, margin: 0 }}>
              <div className="panel-head" style={{ marginBottom: 14 }}>
                <h3>24h 分布</h3>
                <span className="chip muted" style={{ fontSize: 11 }}>tokens / 小时 · 本机时区</span>
              </div>
              <div className="bars">
                {(data.hours || []).map((tok, h) => (
                  <div
                    key={h}
                    className="bar"
                    style={{ height: `${Math.max(6, (tok / hourMax) * 100)}%` }}
                    title={`${h}:00 – ${h}:59 · ${tok.toLocaleString()} tok`}
                  />
                ))}
              </div>
              <div className="bar-label">
                <span>0h</span><span>6h</span><span>12h</span><span>18h</span><span>23h</span>
              </div>
            </section>
            <section className="panel glass" style={{ padding: 22, margin: 0 }}>
              <div className="panel-head" style={{ marginBottom: 14 }}>
                <h3>按工作区</h3>
                <span className="chip muted" style={{ fontSize: 11 }}>tokens 排名</span>
              </div>
              {(data.workspaces || []).length === 0 ? (
                <div className="empty">过去 {data.days} 天还没有用量记录。</div>
              ) : (
                <div className="ws-rank">
                  {data.workspaces.map((w) => (
                    <div key={w.workspace} className="ws-rank-row" title={`${w.requests} 次请求`}>
                      <span className="ws-name">{w.workspace}</span>
                      <span className="ws-meter"><i style={{ width: `${Math.max(2, (w.tokens / wsMax) * 100)}%` }} /></span>
                      <span className="ws-val">{w.tokens.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <section className="panel glass" style={{ marginTop: 18, padding: 22 }}>
            <div className="panel-head">
              <h3>按模型拆分</h3>
            </div>
            <table className="table">
              <thead>
                <tr>
                  <th>模型</th>
                  <th>请求数</th>
                  <th>tokens</th>
                  <th>费用 (USD)</th>
                </tr>
              </thead>
              <tbody>
                {(data.models || []).map((m) => (
                  <tr key={m.model}>
                    <td>
                      <code style={{ background: "rgba(212,163,65,0.08)", padding: "2px 8px", borderRadius: 4 }}>
                        {m.model}
                      </code>
                    </td>
                    <td>{(m.requests || 0).toLocaleString()}</td>
                    <td>{(m.tokens || 0).toLocaleString()}</td>
                    <td style={{ color: "var(--amber)" }}>${(m.costUsd || 0).toFixed(4)}</td>
                  </tr>
                ))}
                {data.models.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ textAlign: "center", color: "var(--muted)" }}>
                      过去 {data.days} 天内还没有用量记录。打开任意 .tex 文件试试 Workbench 右栏的 Q · Compose,即可看到数据出现。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>

          <div
            className="row spread"
            style={{
              marginTop: 18,
              padding: 14,
              fontSize: 12,
              color: "var(--muted)",
              fontFamily: "var(--font-mono)",
            }}
          >
            <span>
              配置 provider 后才会真正消耗 token。本机直连不上传消息内容,但会写模型/数量/费用到 {`<app>/data/usage.json`}。
            </span>
            <span className="chip muted">past {data.days} 天</span>
          </div>
        </>
      )}
    </>
  );
}
