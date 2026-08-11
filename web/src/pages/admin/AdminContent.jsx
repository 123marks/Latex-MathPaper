import { useEffect, useState } from "react";
import { api } from "../../lib/api.js";

export default function AdminContent() {
  const [content, setContent] = useState(null);
  const [error, setError] = useState("");
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get("/api/content").then(setContent).catch((e) => setError(e.message));
  }, []);

  if (!content) {
    return (
      <>
        <div className="page-head"><h1>首页内容</h1></div>
        {error ? <div className="alert error">{error}</div> : <div className="spinner" />}
      </>
    );
  }

  const setHero = (key, value) => setContent({ ...content, hero: { ...content.hero, [key]: value } });
  const setLine = (i, value) => {
    const titleLines = [...(content.hero.titleLines || [])];
    titleLines[i] = value;
    setHero("titleLines", titleLines);
  };
  const setAnnounce = (key, value) =>
    setContent({ ...content, announcement: { ...content.announcement, [key]: value } });

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setOk(false);
    try {
      const saved = await api.put("/api/admin/content", content);
      setContent(saved);
      setOk(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const lines = content.hero.titleLines || ["", "", ""];

  return (
    <>
      <div className="page-head">
        <h1>首页内容</h1>
        <p>编辑官网首页的标题、副标题与公告条，保存后立即对所有访客生效。</p>
      </div>
      {error && <div className="alert error">{error}</div>}
      {ok && <div className="alert success">已保存，首页内容已更新。</div>}

      <form className="grid" onSubmit={save}>
        <section className="panel c6 glass">
          <div className="panel-head"><h3>英雄区</h3></div>
          <label className="field"><span>Kicker（小标）</span><input value={content.hero.kicker} onChange={(e) => setHero("kicker", e.target.value)} /></label>
          {[0, 1, 2].map((i) => (
            <label className="field" key={i}><span>标题第 {i + 1} 行{i === 2 ? "（极光渐变行）" : ""}</span><input value={lines[i] || ""} onChange={(e) => setLine(i, e.target.value)} /></label>
          ))}
          <label className="field"><span>副标题</span><textarea value={content.hero.subtitle} onChange={(e) => setHero("subtitle", e.target.value)} /></label>
        </section>

        <section className="panel c6 glass">
          <div className="panel-head"><h3>公告条</h3></div>
          <label className="row" style={{ gap: 10, marginBottom: 16 }}>
            <input type="checkbox" checked={!!content.announcement.enabled} onChange={(e) => setAnnounce("enabled", e.target.checked)} />
            <span>启用顶部公告条</span>
          </label>
          <label className="field"><span>公告文字</span><input value={content.announcement.text} onChange={(e) => setAnnounce("text", e.target.value)} placeholder="例如：2026 国赛报名开放" /></label>

          <div className="card" style={{ marginTop: 8 }}>
            <div className="k" style={{ color: "var(--muted)", fontSize: 12, marginBottom: 8 }}>预览</div>
            {content.announcement.enabled && content.announcement.text ? (
              <div className="announce" style={{ borderRadius: 10 }}>{content.announcement.text}</div>
            ) : (
              <div className="empty">公告条未启用</div>
            )}
          </div>
        </section>

        <div className="panel c12" style={{ background: "transparent", border: 0, padding: 0 }}>
          <button className={`btn btn-primary ${busy ? "is-running" : ""}`} disabled={busy}>
            {busy ? "保存中" : "保存内容"}
          </button>
        </div>
      </form>
    </>
  );
}
