import { useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api.js";
import { formatDate } from "../../lib/format.js";

const CATEGORY_LABEL = {
  auth: "认证",
  account: "账户",
  admin: "管理",
  role: "角色",
  user: "用户",
  post: "社区",
  content: "内容",
  file: "文件",
  workspace: "工作区",
  project: "工作区",
  editor: "编辑器",
  skill: "技能",
};

function categoryOf(action = "") {
  const head = action.split(".")[0];
  return CATEGORY_LABEL[head] || head || "其他";
}

export default function AdminAudit() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");

  useEffect(() => {
    api
      .get("/api/admin/audit")
      .then((data) => setEntries(data.entries || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const categories = useMemo(() => {
    const counts = new Map();
    for (const e of entries) {
      const c = categoryOf(e.action);
      counts.set(c, (counts.get(c) || 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [entries]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((e) => {
      if (category !== "all" && categoryOf(e.action) !== category) return false;
      if (!q) return true;
      return [e.actor, e.action, e.detail]
        .filter(Boolean)
        .some((s) => String(s).toLowerCase().includes(q));
    });
  }, [entries, query, category]);

  const today = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return entries.filter((e) => new Date(e.at) >= start).length;
  }, [entries]);

  const uniqueActors = useMemo(
    () => new Set(entries.map((e) => e.actor).filter(Boolean)).size,
    [entries]
  );

  return (
    <>
      <div className="page-head">
        <h1>审计日志</h1>
        <p>敏感操作留痕：注册、登录、角色变更、禁用、删帖、内容更新。</p>
      </div>
      {error && <div className="alert error">{error}</div>}

      <div className="admin-metrics" style={{ marginBottom: 18 }}>
        <div className="card metric-card">
          <div className="k">总记录</div>
          <div className="v">{entries.length}</div>
        </div>
        <div className="card metric-card">
          <div className="k">今日新增</div>
          <div className="v">{today}</div>
        </div>
        <div className="card metric-card">
          <div className="k">操作主体</div>
          <div className="v">{uniqueActors}</div>
        </div>
        <div className="card metric-card">
          <div className="k">当前筛选</div>
          <div className="v">{filtered.length}</div>
        </div>
      </div>

      <section className="panel c12 glass">
        <div className="panel-head" style={{ flexWrap: "wrap", gap: 12 }}>
          <h3>操作记录</h3>
          <div className="row" style={{ gap: 10, marginLeft: "auto", flexWrap: "wrap" }}>
            <input
              className="input"
              style={{ minWidth: 220 }}
              placeholder="搜索操作者 / 动作 / 详情…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <select
              className="input"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="all">全部类型</option>
              {categories.map(([c, n]) => (
                <option key={c} value={c}>
                  {c}（{n}）
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="spinner" />
        ) : filtered.length === 0 ? (
          <div className="empty">
            {entries.length === 0 ? "暂无审计记录。" : "没有匹配的审计记录。"}
          </div>
        ) : (
          <div>
            {filtered.map((e) => (
              <div key={e.id} className="audit-row">
                <div>
                  <div className="when">{formatDate(e.at)}</div>
                  <div style={{ fontSize: 12, color: "var(--text-soft)" }}>
                    {e.actor}
                    {e.role ? (
                      <span className={`role-badge ${e.role}`} style={{ marginLeft: 6 }}>
                        {e.role}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div>
                  <span className="chip muted" style={{ marginRight: 8 }}>
                    {categoryOf(e.action)}
                  </span>
                  <span className="act">{e.action}</span>
                  {e.detail ? (
                    <span style={{ color: "var(--muted)", marginLeft: 10 }}>{e.detail}</span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
