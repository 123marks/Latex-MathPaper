import { useEffect, useMemo, useState, useCallback } from "react";
import { api } from "../../lib/api.js";
import { useAuth } from "../../lib/auth.jsx";
import { formatRelative } from "../../lib/format.js";

const CATEGORIES = ["讨论", "求助", "分享", "公告"];
const FEEDS = [
  { id: "latest", label: "最新" },
  { id: "hot", label: "热门" },
];

export default function CommunityBoard() {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [feed, setFeed] = useState("latest");
  const [form, setForm] = useState({ title: "", category: "讨论", content: "" });
  const [busy, setBusy] = useState(false);
  const [replyDraft, setReplyDraft] = useState({});

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

  // Feed ordering uses only real fields: creation time and reply count.
  const sortedPosts = useMemo(() => {
    const list = [...posts];
    if (feed === "hot") {
      list.sort((a, b) =>
        (b.replies?.length || 0) - (a.replies?.length || 0) ||
        String(b.createdAt).localeCompare(String(a.createdAt)),
      );
    } else {
      list.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    }
    return list;
  }, [posts, feed]);

  // Contribution leaderboard tallied from real posts + replies (no fabricated scores).
  const leaderboard = useMemo(() => {
    const scores = new Map();
    const bump = (name, n) => {
      if (!name) return;
      scores.set(name, (scores.get(name) || 0) + n);
    };
    for (const post of posts) {
      bump(post.author, 1);
      for (const reply of post.replies || []) bump(reply.author, 1);
    }
    return [...scores.entries()]
      .map(([name, score]) => ({ name, score }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);
  }, [posts]);

  async function submitPost(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.post("/api/community/posts", form);
      setForm({ title: "", category: "讨论", content: "" });
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function submitReply(postId) {
    const content = (replyDraft[postId] || "").trim();
    if (!content) return;
    try {
      await api.post(`/api/community/posts/${postId}/replies`, { content });
      setReplyDraft((prev) => ({ ...prev, [postId]: "" }));
      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <>
      <div className="page-head">
        <h1>社区</h1>
        <p>和其他作者交流写作、图表与踩坑经验。帖子保存在本机。</p>
      </div>
      {error && <div className="alert error">{error}</div>}

      <div className="community">
        <div className="post-list">
          <div className="feed-tabs" role="tablist" aria-label="信息流排序">
            {FEEDS.map((f) => (
              <button
                key={f.id}
                role="tab"
                aria-selected={feed === f.id}
                className={`chip ${feed === f.id ? "" : "muted"}`}
                style={{ cursor: "pointer" }}
                onClick={() => setFeed(f.id)}
              >
                {f.label}
              </button>
            ))}
            <span className="feed-count">{posts.length} 个话题</span>
          </div>
          {loading ? (
            <div className="spinner" />
          ) : sortedPosts.length === 0 ? (
            <div className="empty">还没有话题，发布右侧第一个帖子。</div>
          ) : (
            sortedPosts.map((post) => (
              <article key={post.id} className="card post">
                <div className="post-head">
                  <span className="chip">{post.category}</span>
                  <span>{post.author}</span>
                  <span>·</span>
                  <span>{formatRelative(post.createdAt)}</span>
                  {post.replies?.length > 0 && (
                    <span className="post-replies">{post.replies.length} 回复</span>
                  )}
                </div>
                <h3>{post.title}</h3>
                <p className="body">{post.content}</p>

                {post.replies?.length > 0 && (
                  <div className="replies">
                    {post.replies.map((reply) => (
                      <div key={reply.id} className="reply">
                        <span className="who">{reply.author}</span>
                        <span style={{ color: "var(--faint)", margin: "0 8px" }}>{formatRelative(reply.createdAt)}</span>
                        {reply.content}
                      </div>
                    ))}
                  </div>
                )}

                <div className="reply-row">
                  <input
                    className="input"
                    placeholder="写下回复…"
                    value={replyDraft[post.id] || ""}
                    onChange={(e) => setReplyDraft((prev) => ({ ...prev, [post.id]: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === "Enter") submitReply(post.id); }}
                  />
                  <button className="btn btn-glass btn-sm" onClick={() => submitReply(post.id)}>回复</button>
                </div>
              </article>
            ))
          )}
        </div>

        <div className="community-rail" style={{ display: "grid", gap: 16, alignContent: "start" }}>
          <form className="panel glass" onSubmit={submitPost}>
            <div className="panel-head"><h3>发起话题</h3></div>
            <label className="field"><span>标题</span><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="例如：长文档的编译速度怎么优化" required /></label>
            <label className="field"><span>分类</span>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </label>
            <label className="field"><span>内容</span><textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder="分享你的方法、问题或经验…" required /></label>
            <button className={`btn btn-primary btn-block ${busy ? "is-running" : ""}`} disabled={busy}>
              {busy ? "发布中" : `以 ${user?.displayName || user?.username} 发布`}
            </button>
          </form>

          <section className="panel glass">
            <div className="panel-head"><h3>贡献榜</h3></div>
            {leaderboard.length === 0 ? (
              <div className="empty" style={{ fontSize: 13 }}>发帖或回复即可上榜。</div>
            ) : (
              <ol className="leaderboard">
                {leaderboard.map((entry, i) => (
                  <li key={entry.name} className="leaderboard-row">
                    <span className={`rank ${i < 3 ? "top" : ""}`}>{i + 1}</span>
                    <span className="avatar-sm">{entry.name.slice(0, 1).toUpperCase()}</span>
                    <span className="who">{entry.name}</span>
                    <span className="score">{entry.score}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
