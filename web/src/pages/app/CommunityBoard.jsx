import { useEffect, useState, useCallback } from "react";
import { api } from "../../lib/api.js";
import { useAuth } from "../../lib/auth.jsx";
import { formatRelative } from "../../lib/format.js";

const CATEGORIES = ["讨论", "求助", "分享", "公告"];

export default function CommunityBoard() {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
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
          {loading ? (
            <div className="spinner" />
          ) : posts.length === 0 ? (
            <div className="empty">还没有话题，发布右侧第一个帖子。</div>
          ) : (
            posts.map((post) => (
              <article key={post.id} className="card post">
                <div className="post-head">
                  <span className="chip">{post.category}</span>
                  <span>{post.author}</span>
                  <span>·</span>
                  <span>{formatRelative(post.createdAt)}</span>
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

        <form className="panel glass" onSubmit={submitPost} style={{ position: "sticky", top: 84 }}>
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
      </div>
    </>
  );
}
