import { useEffect, useState, useCallback } from "react";
import { api } from "../../lib/api.js";
import { formatDate } from "../../lib/format.js";

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "—";
  const mb = bytes / (1024 * 1024);
  if (mb >= 100) return `${Math.round(mb)} MB`;
  return `${mb.toFixed(1)} MB`;
}

export default function AdminReleases() {
  const [release, setRelease] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await api.get("/api/admin/releases");
      setRelease(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading || !release) {
    return (
      <>
        <div className="page-head">
          <h1>发布管理</h1>
          <p>查看下载页对外分发的签名发布清单：版本、更新说明与各平台安装包状态。</p>
        </div>
        {error ? <div className="alert error">{error}</div> : <div className="spinner" style={{ margin: 26 }} />}
      </>
    );
  }

  const assets = release.assets || [];
  const notes = release.notes || [];

  return (
    <>
      <div className="page-head spread">
        <div>
          <h1>发布管理</h1>
          <p>查看下载页对外分发的签名发布清单：版本、更新说明与各平台安装包状态。</p>
        </div>
        {release.signed ? (
          <span className="chip signal">已签名 (Ed25519)</span>
        ) : (
          <span className="chip muted">未签名</span>
        )}
      </div>
      {error && <div className="alert error">{error}</div>}

      <div className="grid">
        <section className="panel c4 glass">
          <div className="panel-head"><h3>当前发布</h3></div>
          <div className="row wrap" style={{ gap: 8, marginBottom: 16 }}>
            <span className="chip">{release.version || "—"}</span>
            <span className="chip muted">{release.channel || "—"}</span>
            <span className="chip muted">{formatDate(release.publishedAt) || "—"}</span>
          </div>
          <div>
            <span style={{ color: "var(--muted)", fontSize: 13 }}>公钥</span>
            <div
              style={{
                marginTop: 6,
                padding: "10px 12px",
                background: "rgba(232, 227, 218, 0.03)",
                border: "1px solid var(--glass-border-2)",
                borderRadius: "var(--radius-sm)",
                fontFamily: "var(--font-mono)",
                fontSize: 11.5,
                lineHeight: 1.7,
                color: "var(--text-soft)",
                wordBreak: "break-all",
                whiteSpace: "pre-wrap",
                userSelect: "all",
              }}
            >
              {release.publicKey || "—"}
            </div>
          </div>
        </section>

        <section className="panel c8 glass">
          <div className="panel-head">
            <h3>更新说明</h3>
            <span className="chip muted">{notes.length} 条</span>
          </div>
          {notes.length === 0 ? (
            <div className="empty">本次发布没有更新说明。</div>
          ) : (
            <ul style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 8 }}>
              {notes.map((note, i) => (
                <li key={i} style={{ fontSize: 13.5, lineHeight: 1.6, color: "var(--text-soft)" }}>
                  {note}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel c12 glass">
          <div className="panel-head">
            <h3>平台安装包</h3>
            <span className="chip muted">
              {assets.filter((a) => a.available).length} / {assets.length} 就绪
            </span>
          </div>
          {assets.length === 0 ? (
            <div className="empty">清单中没有任何安装包。</div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>平台</th>
                  <th>说明</th>
                  <th>文件</th>
                  <th>状态</th>
                  <th>大小</th>
                  <th>SHA-256</th>
                </tr>
              </thead>
              <tbody>
                {assets.map((a) => (
                  <tr key={`${a.os}-${a.ext}`}>
                    <td><strong>{a.os}</strong></td>
                    <td style={{ color: "var(--muted)" }}>
                      {a.label}
                      {a.minimum ? (
                        <div style={{ color: "var(--faint)", fontSize: 12 }}>{a.minimum}</div>
                      ) : null}
                    </td>
                    <td style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>
                      {a.filename || "—"}
                    </td>
                    <td>
                      {a.available ? (
                        <span className="chip signal">就绪</span>
                      ) : (
                        <span className="chip muted">未发布</span>
                      )}
                    </td>
                    <td style={{ color: "var(--muted)" }}>{formatBytes(a.size)}</td>
                    <td>
                      {a.sha256 ? (
                        <span
                          title={a.sha256}
                          style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-soft)" }}
                        >
                          {a.sha256.slice(0, 16)}…
                        </span>
                      ) : (
                        <span style={{ color: "var(--faint)" }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </>
  );
}
