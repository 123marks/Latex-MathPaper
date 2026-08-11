import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api.js";
import { useAuth } from "../lib/auth.jsx";
import { formatRelative } from "../lib/format.js";
import Reveal from "../components/Reveal.jsx";

const FILTERS = ["最新", "热门", "本周精选", "官方推荐"];

export default function Community() {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("最新");

  useEffect(() => {
    api
      .get("/api/community/posts")
      .then((data) => setPosts(data.posts || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="container section">
      <Reveal className="section-head">
        <span className="eyebrow">社区广场</span>
        <h2>
          分享模板 · 安装技能 · 共同<span className="serif-it" style={{ color: "var(--amber)" }}>进步</span>。
        </h2>
        <p>
          {user
            ? "进入工作台,创建账号后即可发帖与下载模板。"
            : "登录后即可发帖、回复、下载模板、收藏技能。"}
        </p>
      </Reveal>

      <div className="row wrap" style={{ marginBottom: 22, gap: 12 }}>
        {user ? (
          <Link to="/app/community" className="btn btn-primary">
            进入社区发帖
          </Link>
        ) : (
          <Link to="/login" className="btn btn-primary">
            登录后参与
          </Link>
        )}
        <span className="chip muted">{posts.length} 个话题</span>
      </div>

      <div className="market-filters">
        {FILTERS.map((f) => (
          <button
            key={f}
            className={`chip ${filter === f ? "" : "muted"}`}
            style={{ cursor: "pointer" }}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="spinner" />
      ) : error ? (
        <div className="alert error">{error}</div>
      ) : posts.length === 0 ? (
        <div className="empty">还没有话题,成为第一个发帖的人。</div>
      ) : (
        <div className="feed">
          {posts.map((post, i) => (
            <Reveal key={post.id} delay={i * 0.04} className="card feed-card">
              <div className="feed-head">
                <span className="avatar-sm">
                  {(post.author || "U").slice(0, 1).toUpperCase()}
                </span>
                <span className="chip" style={{ padding: "2px 8px" }}>
                  {post.category}
                </span>
                <span style={{ fontWeight: 600, color: "var(--text-soft)" }}>
                  {post.author}
                </span>
                <span>·</span>
                <span>{formatRelative(post.createdAt)}</span>
                <span style={{ marginLeft: "auto" }}>
                  {post.replies?.length || 0} 回复
                </span>
              </div>
              <h3>{post.title}</h3>
              <p className="body">{post.content}</p>
              <div className="feed-actions">
                <span className="act">↑ 点赞</span>
                <span className="act">✎ 评论</span>
                <span className="act">⊕ 收藏</span>
                <span className="act" style={{ marginLeft: "auto", color: "var(--amber)" }}>
                  下载模板 →
                </span>
              </div>
            </Reveal>
          ))}
        </div>
      )}
    </div>
  );
}
