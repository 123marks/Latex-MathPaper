import { useCallback, useEffect, useState } from "react";
import { api } from "../../lib/api.js";
import { formatDate, formatRelative } from "../../lib/format.js";

// 在线会话管理：列出所有未过期登录会话（仅 token 前缀），可强制下线。
export default function AdminSessions() {
  const [sessions, setSessions] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    try {
      setError("");
      const d = await api.get("/api/admin/sessions");
      setSessions(d.sessions || []);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function revoke(s) {
    if (!window.confirm(`强制下线 ${s.displayName}（${s.label}）？该会话将立即失效。`)) return;
    try {
      setBusy(s.id);
      await api.del(`/api/admin/sessions/${s.id}`);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }

  const online = sessions?.length ?? 0;
  const uniqueUsers = sessions ? new Set(sessions.map((s) => s.username)).size : 0;

  return (
    <>
      <div className="page-head spread">
        <div>
          <h1>在线会话</h1>
          <p>当前有效的登录会话。强制下线会立刻吊销对应 token，不影响该用户的其他会话。</p>
        </div>
        <button className="btn btn-quiet btn-sm" onClick={load}>刷新</button>
      </div>
      {error && <div className="alert error">{error}</div>}

      <div className="admin-metrics" style={{ marginBottom: 18 }}>
        <div className="card metric-card">
          <div className="k">在线会话</div>
          <div className="v">{online}</div>
        </div>
        <div className="card metric-card">
          <div className="k">覆盖用户</div>
          <div className="v">{uniqueUsers}</div>
        </div>
      </div>

      <section className="panel c12 glass">
        {sessions === null ? (
          <div className="spinner" />
        ) : sessions.length === 0 ? (
          <div className="empty">当前没有有效会话。</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>用户</th>
                  <th>角色</th>
                  <th>设备</th>
                  <th>登录时间</th>
                  <th>过期时间</th>
                  <th>会话</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <strong>{s.displayName}</strong>
                      <div style={{ color: "var(--faint)", fontSize: 12 }}>@{s.username}</div>
                    </td>
                    <td><span className={`role-badge ${s.role}`}>{s.role}</span></td>
                    <td style={{ color: "var(--muted)", fontSize: 12 }}>{s.label}</td>
                    <td style={{ color: "var(--muted)", fontSize: 12 }} title={formatDate(s.createdAt)}>
                      {formatRelative(s.createdAt)}
                    </td>
                    <td style={{ color: "var(--muted)", fontSize: 12 }}>{formatDate(s.expiresAt)}</td>
                    <td>
                      <code className="code-chip">{s.id}</code>
                      {s.current && <span className="chip signal" style={{ marginLeft: 6 }}>本会话</span>}
                    </td>
                    <td>
                      {s.current ? (
                        <span style={{ color: "var(--faint)", fontSize: 12 }}>—</span>
                      ) : (
                        <button
                          className="btn btn-danger btn-sm"
                          disabled={busy === s.id}
                          onClick={() => revoke(s)}
                        >
                          {busy === s.id ? "处理中" : "强制下线"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
