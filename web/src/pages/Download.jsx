import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Reveal from "../components/Reveal.jsx";
import { api } from "../lib/api.js";
import Icon from "../components/Icon.jsx";

const RELEASES = "https://github.com/123marksgithub/Latex-MathPaper/releases";

const OS_META = {
  windows: { label: "Windows", icon: "windows", key: "win" },
  macos: { label: "macOS", icon: "macos", key: "mac" },
  linux: { label: "Linux", icon: "linux", key: "linux" },
};

function detectOS() {
  if (typeof navigator === "undefined") return "windows";
  const ua = navigator.userAgent || "";
  if (/Mac/i.test(ua)) return "macos";
  if (/Linux|X11/i.test(ua)) return "linux";
  return "windows";
}

function formatSize(bytes) {
  if (!bytes) return "";
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export default function Download() {
  const current = detectOS();
  const [manifest, setManifest] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/api/releases")
      .then(setManifest)
      .catch((e) => setError(e.message));
  }, []);

  const version = manifest?.version ? `v${manifest.version}` : "";
  const assets = manifest?.assets || [];

  return (
    <div className="container section">
      <Reveal className="section-head">
        <span className="eyebrow">下载客户端</span>
        <h2>
          把算力放回<span className="serif-it" style={{ color: "var(--amber)" }}>你自己的机器</span>。
        </h2>
        <p>
          网页负责展示、账号与社区广场;真正的 LaTeX 编译与 AI 写作,
          在本地桌面客户端里跑——用你电脑的 CPU,又快、又私密,也不给服务器添压力。
        </p>
      </Reveal>

      {error && (
        <div className="alert error" style={{ maxWidth: 620, margin: "0 auto 18px" }}>
          无法读取发布信息:{error}
        </div>
      )}

      <div className="market-grid">
        {(assets.length
          ? assets
          : Object.keys(OS_META).map((os) => ({ os, available: false }))
        ).map((asset, i) => {
          const meta = OS_META[asset.os] || { label: asset.os, icon: "linux", key: asset.os };
          const ready = asset.available;
          return (
            <Reveal key={asset.os} delay={i * 0.06} className="card lift market-card" style={{ textAlign: "center" }}>
              {meta.key === OS_META[current]?.key && (
                <span className="chip" style={{ position: "absolute", top: 14, right: 14 }}>
                  推荐给你
                </span>
              )}
              <div className="ico" style={{ margin: "8px auto 12px", display: "flex", justifyContent: "center" }}>
                <Icon name={meta.icon} size={30} strokeWidth={1.5} />
              </div>
              <div className="name">{meta.label}</div>
              <div className="desc">{asset.label || "桌面客户端"}</div>
              <div className="meta" style={{ justifyContent: "center" }}>
                {asset.ext || ""}{asset.size ? ` · ${formatSize(asset.size)}` : ""}
              </div>
              {ready ? (
                <a className="btn btn-primary btn-block" href={asset.url}>
                  下载 {meta.label} 版
                </a>
              ) : (
                <a className="btn btn-glass btn-block" href={RELEASES} target="_blank" rel="noreferrer">
                  前往发布页
                </a>
              )}
              {asset.sha256 && (
                <div
                  className="meta"
                  style={{ justifyContent: "center", marginTop: 8, fontSize: 10.5, opacity: 0.7 }}
                  title={asset.sha256}
                >
                  SHA-256 · {asset.sha256.slice(0, 16)}…
                </div>
              )}
            </Reveal>
          );
        })}
      </div>

      <Reveal className="glass" style={{ marginTop: 24, padding: 26, borderRadius: "var(--radius)" }}>
        <div className="row wrap" style={{ justifyContent: "space-between", gap: 16 }}>
          <div>
            <strong style={{ fontFamily: "var(--font-display)", fontSize: 18 }}>
              最新版本 {version || "—"}
            </strong>
            {manifest?.publishedAt && (
              <span className="chip muted" style={{ marginLeft: 10 }}>{manifest.publishedAt}</span>
            )}
            {manifest?.notes?.length ? (
              <ul style={{ color: "var(--muted)", fontSize: 13, marginTop: 10, maxWidth: 560, paddingLeft: 18, lineHeight: 1.7 }}>
                {manifest.notes.slice(0, 4).map((note, i) => (
                  <li key={i}>{note}</li>
                ))}
              </ul>
            ) : (
              <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 6, maxWidth: 540 }}>
                当前采用本地 Node 运行时(需 Node.js 20+);后续将发布内嵌 Tectonic
                的独立安装包,实现真正零依赖的本地 LaTeX 编译。
              </p>
            )}
          </div>
          <div className="row wrap" style={{ gap: 10 }}>
            <Link to="/changelog" className="btn btn-glass">全部更新日志</Link>
            <Link to="/docs" className="btn btn-quiet">先看使用文档</Link>
          </div>
        </div>
      </Reveal>
    </div>
  );
}
