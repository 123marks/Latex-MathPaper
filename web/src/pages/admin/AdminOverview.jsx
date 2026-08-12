import { useEffect, useState } from "react";
import { api } from "../../lib/api.js";
import { AreaSpark } from "../../components/Chart.jsx";
import { formatUptime } from "../../lib/format.js";

function Metric({ k, v, sub, accent }) {
  return (
    <div className="card metric-card">
      <div className="k">{k}</div>
      <div className="v" style={accent ? { color: "var(--amber-bright)" } : undefined}>{v}</div>
      {sub ? <div className="metric-sub">{sub}</div> : null}
    </div>
  );
}

export default function AdminOverview() {
  const [m, setM] = useState(null);
  const [usage, setUsage] = useState(null);
  const [live, setLive] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/api/admin/metrics").then(setM).catch((e) => setError(e.message));
    api.get("/api/admin/usage?days=30").then(setUsage).catch(() => {});
  }, []);

  // live metrics stream
  useEffect(() => {
    let es;
    try {
      es = new EventSource("/api/admin/stream");
      es.onmessage = (ev) => {
        try {
          setM(JSON.parse(ev.data));
          setLive(true);
        } catch { /* ignore malformed frame */ }
      };
      es.onerror = () => setLive(false);
    } catch {
      setLive(false);
    }
    return () => { try { es && es.close(); } catch { /* noop */ } };
  }, []);

  const t = m?.totals;
  const signupSeries = (m?.signupSeries || []).map((d) => ({ count: d.count }));
  const tokenSeries = (usage?.daily || []).map((d) => ({ count: d.tokens }));
  const topUsers = (usage?.users || []).slice(0, 5);
  const topModels = (usage?.models || []).slice(0, 5);
  const maxUserTok = Math.max(1, ...topUsers.map((u) => u.tokens));

  return (
    <>
      <div className="page-head spread">
        <div>
          <h1>管理总览</h1>
          <p>全站用户、用量与运行时的实时看板。</p>
        </div>
        <span className="chip" style={{ opacity: live ? 1 : 0.4 }}>
          <span className="dot" /> {live ? "实时连接" : "轮询模式"}
        </span>
      </div>
      {error && <div className="alert error">{error}</div>}

      <div className="admin-metrics">
        <Metric k="用户总数" v={t?.users ?? "—"} sub={`+${(m?.signupSeries || []).reduce((a, b) => a + b.count, 0)} / 7d`} />
        <Metric k="30天请求" v={usage ? usage.totalRequests.toLocaleString() : "—"} sub="API 调用次数" />
        <Metric
          k="30天 Tokens"
          v={usage ? abbrev(usage.totalTokens) : "—"}
          sub={`${usage?.models?.length ?? 0} 个活跃模型`}
        />
        <Metric
          k="30天消耗"
          v={usage ? `$${usage.costUsd.toFixed(3)}` : "—"}
          sub="估算费用 (USD)"
          accent
        />
      </div>

      <div className="grid" style={{ marginTop: 18 }}>
        <section className="panel c8 glass">
          <div className="panel-head">
            <h3>Token 消耗趋势</h3>
            <span className="chip muted">近 30 天</span>
          </div>
          {usage && tokenSeries.length ? (
            <AreaSpark data={tokenSeries} height={150} id="tok" />
          ) : (
            <div className="empty">近 30 天暂无用 token 记录。</div>
          )}
        </section>
        <section className="panel c4 glass">
          <div className="panel-head"><h3>角色分布</h3></div>
          <div className="stack" style={{ gap: 12 }}>
            {["owner", "admin", "member"].map((r) => (
              <div key={r} className="spread">
                <span className={`role-badge ${r}`}>{r}</span>
                <b style={{ fontFamily: "var(--font-display)", fontSize: 22 }}>{m?.roles?.[r] ?? 0}</b>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid var(--ink-line)" }}>
            <div className="spread" style={{ fontSize: 12, color: "var(--muted)" }}>
              <span>活跃会话</span><b style={{ color: "var(--signal-2)" }}>{t?.activeSessions ?? 0}</b>
            </div>
            <div className="spread" style={{ fontSize: 12, color: "var(--muted)", marginTop: 8 }}>
              <span>运行时长</span><b>{formatUptime(m?.uptimeSeconds)}</b>
            </div>
          </div>
        </section>

        <section className="panel c6 glass">
          <div className="panel-head">
            <h3>消耗 Top 用户</h3>
            <span className="chip muted">近 30 天</span>
          </div>
          {topUsers.length === 0 ? (
            <div className="empty">暂无消耗记录。</div>
          ) : (
            <div className="stack" style={{ gap: 14 }}>
              {topUsers.map((u, i) => (
                <div key={u.id}>
                  <div className="spread" style={{ fontSize: 13, marginBottom: 6 }}>
                    <span>
                      <span style={{ color: "var(--faint)", fontFamily: "var(--font-mono)", marginRight: 8 }}>
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      {u.displayName}
                      <span style={{ color: "var(--faint)", fontSize: 12, marginLeft: 6 }}>@{u.username}</span>
                    </span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--amber)" }}>
                      {abbrev(u.tokens)} tok
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

        <section className="panel c6 glass">
          <div className="panel-head">
            <h3>活跃模型</h3>
            <span className="chip muted">近 30 天</span>
          </div>
          {topModels.length === 0 ? (
            <div className="empty">暂无模型调用。</div>
          ) : (
            <table className="table">
              <thead>
                <tr><th>模型</th><th>请求</th><th>tokens</th><th>费用</th></tr>
              </thead>
              <tbody>
                {topModels.map((mm) => (
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

        <section className="panel c6 glass">
          <div className="panel-head">
            <h3>消耗 Top 工作区</h3>
            <span className="chip muted">近 30 天</span>
          </div>
          {(usage?.workspaces || []).length === 0 ? (
            <div className="empty">暂无消耗记录。</div>
          ) : (
            <div className="ws-rank">
              {usage.workspaces.slice(0, 6).map((w) => (
                <div key={w.workspace} className="ws-rank-row" title={`${w.requests} 次请求`}>
                  <span className="ws-name">{w.workspace}</span>
                  <span className="ws-meter">
                    <i style={{ width: `${Math.max(2, (w.tokens / Math.max(1, usage.workspaces[0]?.tokens || 1)) * 100)}%` }} />
                  </span>
                  <span className="ws-val">{abbrev(w.tokens)}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="panel c6 glass">
          <div className="panel-head">
            <h3>近 7 日注册</h3>
            <span className="chip muted">signups</span>
          </div>
          {m && signupSeries.length ? <AreaSpark data={signupSeries} height={90} id="su" /> : <div className="spinner" />}
        </section>
      </div>
    </>
  );
}

function abbrev(n) {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
  return String(n);
}
