import { useEffect, useState, useCallback } from "react";
import { api } from "../../lib/api.js";
import { AreaSpark } from "../../components/Chart.jsx";

const DAYS_OPTS = [
  [7, "7 天"],
  [30, "30 天"],
  [90, "90 天"],
];

function abbrev(n) {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
  return String(n);
}

export default function AdminUsage() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (d) => {
    setLoading(true);
    setError("");
    try {
      setData(await api.get(`/api/admin/usage?days=${d}`));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(days);
  }, [days, load]);

  const tokenSeries = (data?.daily || []).map((d) => ({ count: d.tokens }));
  const maxUserTok = Math.max(1, ...(data?.users || []).map((u) => u.tokens));

  return (
    <>
      <div className="page-head spread">
        <div>
          <h1>用量统计</h1>
          <p>全站 API 消耗：按天趋势、按模型拆分、按用户排行。</p>
        </div>
        <div className="row" style={{ gap: 6 }}>
          {DAYS_OPTS.map(([v, label]) => (
            <button
              key={v}
              className={`btn btn-sm ${days === v ? "btn-primary" : "btn-glass"}`}
              onClick={() => setDays(v)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {error && <div className="alert error">{error}</div>}

      {loading ? (
        <div className="spinner" />
      ) : !data ? null : (
        <>
          <div className="admin-metrics">
            <div className="card metric-card">
              <div className="k">请求数</div>
              <div className="v">{data.totalRequests.toLocaleString()}</div>
              <div className="metric-sub">近 {data.days} 天</div>
            </div>
            <div className="card metric-card">
              <div className="k">总 Tokens</div>
              <div className="v">{abbrev(data.totalTokens)}</div>
              <div className="metric-sub">
                {abbrev(data.promptTokens)} 输入 · {abbrev(data.completionTokens)} 输出
              </div>
            </div>
            <div className="card metric-card">
              <div className="k">估算费用</div>
              <div className="v" style={{ color: "var(--amber-bright)" }}>${data.costUsd.toFixed(3)}</div>
              <div className="metric-sub">USD · 近 {data.days} 天</div>
            </div>
            <div className="card metric-card">
              <div className="k">活跃用户</div>
              <div className="v">{data.users.length}</div>
              <div className="metric-sub">{data.models.length} 个模型被调用</div>
            </div>
          </div>

          <section className="panel c12 glass" style={{ marginBottom: 18 }}>
            <div className="panel-head">
              <h3>Token 消耗趋势</h3>
              <span className="chip muted">tokens / day</span>
            </div>
            {tokenSeries.length ? (
              <AreaSpark data={tokenSeries} height={150} id="adm-tok" />
            ) : (
              <div className="empty">该时间范围内暂无消耗记录。</div>
            )}
          </section>

          <div className="grid">
            <section className="panel c7 glass">
              <div className="panel-head">
                <h3>用户消耗排行</h3>
                <span className="chip muted">{data.users.length} 人</span>
              </div>
              {data.users.length === 0 ? (
                <div className="empty">暂无消耗记录。</div>
              ) : (
                <div className="stack" style={{ gap: 16 }}>
                  {data.users.map((u, i) => (
                    <div key={u.id}>
                      <div className="spread" style={{ fontSize: 13, marginBottom: 6 }}>
                        <span>
                          <span style={{ color: "var(--faint)", fontFamily: "var(--font-mono)", marginRight: 10 }}>
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          {u.displayName}
                          <span style={{ color: "var(--faint)", fontSize: 12, marginLeft: 6 }}>@{u.username}</span>
                        </span>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>
                          <span style={{ color: "var(--amber)" }}>{abbrev(u.tokens)} tok</span>
                          <span style={{ color: "var(--faint)", marginLeft: 10 }}>{u.requests} 次</span>
                          <span style={{ color: "var(--muted)", marginLeft: 10 }}>${u.costUsd.toFixed(4)}</span>
                        </span>
                      </div>
                      <div className="rank-bar">
                        <div className="rank-bar-fill" style={{ width: `${(u.tokens / maxUserTok) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="panel c5 glass">
              <div className="panel-head">
                <h3>按模型拆分</h3>
              </div>
              {data.models.length === 0 ? (
                <div className="empty">暂无模型调用。</div>
              ) : (
                <table className="table">
                  <thead>
                    <tr><th>模型</th><th>请求</th><th>tokens</th><th>费用</th></tr>
                  </thead>
                  <tbody>
                    {data.models.map((mm) => (
                      <tr key={mm.model}>
                        <td><code className="code-chip">{mm.model}</code></td>
                        <td>{mm.requests}</td>
                        <td style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>{abbrev(mm.tokens)}</td>
                        <td style={{ color: "var(--amber)" }}>${mm.costUsd.toFixed(4)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          </div>
        </>
      )}
    </>
  );
}
