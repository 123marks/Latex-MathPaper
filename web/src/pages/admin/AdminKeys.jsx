import { useEffect, useState, useCallback } from "react";
import { api } from "../../lib/api.js";
import { formatDate } from "../../lib/format.js";

const SOURCE_LABEL = {
  user: "自有 Key",
  fallback: "共享默认",
  none: "无",
};

export default function AdminKeys() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await api.get("/api/admin/keys");
      setUsers(data.users || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const configured = users.filter((u) => u.hasProviderKey).length;

  return (
    <>
      <div className="page-head">
        <h1>模型 Key 概览</h1>
        <p>
          所有 Key 均经 AES-256-GCM 加密存储在本机，此处永远不展示明文——只统计每位用户是否已配置及所用模型。
        </p>
      </div>
      {error && <div className="alert error">{error}</div>}

      <section className="panel c12 glass">
        {loading ? (
          <div className="spinner" />
        ) : users.length === 0 ? (
          <div className="empty">暂无用户数据。</div>
        ) : (
          <>
            <div className="spread" style={{ marginBottom: 14 }}>
              <span style={{ color: "var(--muted)", fontSize: 13 }}>
                {configured} / {users.length} 用户已配置自有 Key
              </span>
              <span className="chip muted">只读概览</span>
            </div>
            <table className="table">
              <thead>
                <tr>
                  <th>用户</th>
                  <th>角色</th>
                  <th>状态</th>
                  <th>模型</th>
                  <th>来源</th>
                  <th>更新时间</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <strong>{u.displayName}</strong>
                      <div style={{ color: "var(--faint)", fontSize: 12 }}>@{u.username}</div>
                    </td>
                    <td><span className={`role-badge ${u.role}`}>{u.role}</span></td>
                    <td>
                      {u.hasProviderKey ? (
                        <span className="chip signal">已配置</span>
                      ) : (
                        <span className="chip muted">未配置</span>
                      )}
                    </td>
                    <td style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>
                      {u.providerModel || "—"}
                    </td>
                    <td style={{ color: "var(--muted)" }}>
                      {SOURCE_LABEL[u.providerSource] || u.providerSource || "—"}
                    </td>
                    <td style={{ color: "var(--muted)" }}>
                      {formatDate(u.updatedAt) || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </section>
    </>
  );
}
