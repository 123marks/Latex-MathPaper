import { useEffect, useMemo, useState, useCallback } from "react";
import { api } from "../../lib/api.js";
import { formatRelative } from "../../lib/format.js";

export default function AdminCommunity() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [selected, setSelected] = useState(() => new Set());
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.get("/api/community/posts");
      setPosts(data.posts || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const categories = useMemo(() => {
    const counts = new Map();
    for (const p of posts) {
      const c = p.category || "未分类";
      counts.set(c, (counts.get(c) || 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [posts]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return posts.filter((p) => {
      if (category !== "all" && (p.category || "未分类") !== category) return false;
      if (!q) return true;
      return [p.title, p.content, p.author]
        .filter(Boolean)
        .some((s) => String(s).toLowerCase().includes(q));
    });
  }, [posts, query, category]);

  const totalReplies = useMemo(
    () => posts.reduce((sum, p) => sum + (p.replies?.length || 0), 0),
    [posts]
  );

  const allVisibleSelected =
    filtered.length > 0 && filtered.every((p) => selected.has(p.id));

  function toggleOne(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllVisible() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        for (const p of filtered) next.delete(p.id);
      } else {
        for (const p of filtered) next.add(p.id);
      }
      return next;
    });
  }

  async function removeMany(ids) {
    if (ids.length === 0) return;
    setError("");
    setNotice("");
    setBusy(true);
    try {
      const results = await Promise.allSettled(
        ids.map((id) => api.del(`/api/admin/community/posts/${id}`))
      );
      const failed = results.filter((r) => r.status === "rejected").length;
      const ok = ids.length - failed;
      setNotice(`已删除 ${ok} 篇帖子${failed ? `，${failed} 篇失败` : ""}。`);
      setSelected(new Set());
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="page-head">
        <h1>社区审核</h1>
        <p>管理员可删除违规或低质内容。删除会记录到审计日志。</p>
      </div>
      {error && <div className="alert error">{error}</div>}
      {notice && <div className="alert success">{notice}</div>}

      <div className="admin-metrics" style={{ marginBottom: 18 }}>
        <div className="card metric-card">
          <div className="k">帖子总数</div>
          <div className="v">{posts.length}</div>
        </div>
        <div className="card metric-card">
          <div className="k">回复总数</div>
          <div className="v">{totalReplies}</div>
        </div>
        <div className="card metric-card">
          <div className="k">分类数</div>
          <div className="v">{categories.length}</div>
        </div>
        <div className="card metric-card">
          <div className="k">已选</div>
          <div className="v">{selected.size}</div>
        </div>
      </div>

      <section className="panel c12 glass" style={{ marginBottom: 18 }}>
        <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
          <input
            className="input"
            style={{ minWidth: 240, flex: 1 }}
            placeholder="搜索标题 / 内容 / 作者…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select
            className="input"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="all">全部分类</option>
            {categories.map(([c, n]) => (
              <option key={c} value={c}>
                {c}（{n}）
              </option>
            ))}
          </select>
          <button
            className="btn btn-glass"
            onClick={toggleAllVisible}
            disabled={filtered.length === 0}
          >
            {allVisibleSelected ? "取消全选" : `全选（${filtered.length}）`}
          </button>
          <button
            className="btn btn-danger"
            disabled={selected.size === 0 || busy}
            onClick={() => removeMany([...selected])}
          >
            {busy ? "删除中…" : `批量删除（${selected.size}）`}
          </button>
        </div>
      </section>

      {loading ? (
        <div className="spinner" />
      ) : filtered.length === 0 ? (
        <div className="empty">
          {posts.length === 0 ? "社区暂无内容。" : "没有匹配的帖子。"}
        </div>
      ) : (
        <div className="post-list">
          {filtered.map((post) => (
            <article key={post.id} className="card post">
              <div className="post-head">
                <input
                  type="checkbox"
                  checked={selected.has(post.id)}
                  onChange={() => toggleOne(post.id)}
                  aria-label={`选择 ${post.title}`}
                  style={{ marginRight: 4 }}
                />
                <span className="chip">{post.category || "未分类"}</span>
                <span>{post.author}</span>
                <span>·</span>
                <span>{formatRelative(post.createdAt)}</span>
                <span>·</span>
                <span>{post.replies?.length || 0} 回复</span>
                <button
                  className="btn btn-danger btn-sm"
                  style={{ marginLeft: "auto" }}
                  disabled={busy}
                  onClick={() => removeMany([post.id])}
                >
                  删除
                </button>
              </div>
              <h3>{post.title}</h3>
              <p className="body">{post.content}</p>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
