import { useEffect, useMemo, useState, useCallback } from "react";
import { api } from "../../lib/api.js";
import { useAuth } from "../../lib/auth.jsx";
import { formatDate, formatRelative } from "../../lib/format.js";

function abbrev(n) {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
  return String(n);
}

export default function AdminUsers() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const isOwner = user?.role === "owner";

  const load = useCallback(async () => {
    try {
      const data = await api.get("/api/admin/users");
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

  async function changeRole(id, role) {
    setError("");
    try {
      await api.post(`/api/admin/users/${id}/role`, { role });
      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  async function toggleStatus(u) {
    setError("");
    try {
      await api.post(`/api/admin/users/${u.id}/status`, {
        status: u.status === "disabled" ? "active" : "disabled",
      });
      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((u) => {
      if (roleFilter !== "all" && u.role !== roleFilter) return false;
      if (statusFilter !== "all" && (u.status || "active") !== statusFilter) return false;
      if (!q) return true;
      return [u.displayName, u.username, u.email]
        .filter(Boolean)
        .some((s) => String(s).toLowerCase().includes(q));
    });
  }, [users, query, roleFilter, statusFilter]);

  const stats = useMemo(() => {
    const active = users.filter((u) => (u.status || "active") === "active").length;
    const admins = users.filter((u) => u.role === "admin" || u.role === "owner").length;
    const totalTokens = users.reduce((a, u) => a + (u.usage?.tokens || 0), 0);
    return { total: users.length, active, admins, totalTokens };
  }, [users]);

  return (
    <>
      <div className="page-head">
        <h1>用户管理</h1>
        <p>RBAC 角色、账号状态与每用户的 API 消耗。owner 可调整角色，管理员可禁用普通成员。</p>
      </div>
      {error && <div className="alert error">{error}</div>}

      <div className="admin-metrics">
        <div className="card metric-card">
          <div className="k">总用户</div>
          <div className="v">{stats.total}</div>
          <div className="metric-sub">{stats.active} 正常 · {stats.total - stats.active} 禁用</div>
        </div>
        <div className="card metric-card">
          <div className="k">管理员</div>
          <div className="v">{stats.admins}</div>
          <div className="metric-sub">owner + admin</div>
        </div>
        <div className="card metric-card">
          <div className="k">累计消耗</div>
          <div className="v">{abbrev(stats.totalTokens)}</div>
          <div className="metric-sub">全用户 tokens</div>
        </div>
        <div className="card metric-card">
          <div className="k">当前筛选</div>
          <div className="v">{filtered.length}</div>
          <div className="metric-sub">符合条件</div>
        </div>
      </div>

      <section className="panel c12 glass">
        <div className="panel-head" style={{ flexWrap: "wrap", gap: 12 }}>
          <h3>成员列表</h3>
          <div className="row" style={{ gap: 10, marginLeft: "auto", flexWrap: "wrap" }}>
            <input
              className="input"
              style={{ minWidth: 200 }}
              placeholder="搜索昵称 / 用户名 / 邮箱…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <select className="input" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
              <option value="all">全部角色</option>
              <option value="owner">owner</option>
              <option value="admin">admin</option>
              <option value="member">member</option>
            </select>
            <select className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">全部状态</option>
              <option value="active">正常</option>
              <option value="disabled">已禁用</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="spinner" />
        ) : filtered.length === 0 ? (
          <div className="empty">{users.length === 0 ? "暂无用户。" : "没有匹配的用户。"}</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>用户</th>
                  <th>角色</th>
                  <th>状态</th>
                  <th>消耗 (tokens)</th>
                  <th>费用</th>
                  <th>最近活跃</th>
                  <th>注册时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <strong>{u.displayName}</strong>
                      <div style={{ color: "var(--faint)", fontSize: 12 }}>
                        @{u.username}{u.email ? ` · ${u.email}` : ""}
                      </div>
                    </td>
                    <td><span className={`role-badge ${u.role}`}>{u.role}</span></td>
                    <td>
                      <span className={`status-tag ${u.status || "active"}`}>
                        {(u.status || "active") === "disabled" ? "已禁用" : "正常"}
                      </span>
                    </td>
                    <td style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>
                      {u.usage?.tokens ? abbrev(u.usage.tokens) : "0"}
                    </td>
                    <td style={{ color: "var(--amber)", fontSize: 12 }}>
                      {u.usage?.costUsd ? `$${u.usage.costUsd.toFixed(4)}` : "—"}
                    </td>
                    <td style={{ color: "var(--muted)", fontSize: 12 }}>
                      {u.usage?.lastActiveAt ? formatRelative(u.usage.lastActiveAt) : "—"}
                    </td>
                    <td style={{ color: "var(--muted)", fontSize: 12 }}>{formatDate(u.createdAt)}</td>
                    <td>
                      <div className="row" style={{ gap: 8 }}>
                        {isOwner && u.role !== "owner" && (
                          <select
                            className="select"
                            value={u.role}
                            onChange={(e) => changeRole(u.id, e.target.value)}
                          >
                            <option value="member">member</option>
                            <option value="admin">admin</option>
                          </select>
                        )}
                        {u.role !== "owner" && u.id !== user?.id && (
                          <button
                            className={`btn btn-sm ${(u.status || "active") === "disabled" ? "btn-glass" : "btn-danger"}`}
                            onClick={() => toggleStatus(u)}
                          >
                            {(u.status || "active") === "disabled" ? "启用" : "禁用"}
                          </button>
                        )}
                        {(u.role === "owner" || u.id === user?.id) && (
                          <span style={{ color: "var(--faint)", fontSize: 12 }}>—</span>
                        )}
                      </div>
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
