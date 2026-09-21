import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Reveal from "../components/Reveal.jsx";
import { api } from "../lib/api.js";
import Icon from "../components/Icon.jsx";
import { describeReleaseAsset, fallbackReleaseNotes, platformLabel } from "../lib/release-assets.js";

const OS_META = {
  windows: { icon: "windows", key: "win" },
  macos: { icon: "macos", key: "mac" },
  linux: { icon: "linux", key: "linux" },
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
          网页负责展示、账号与社区广场;真正的 LaTeX 编译在本地桌面客户端里跑——
          用你电脑的 CPU,又快又私密。AI 写作则由你配置的 provider 处理,请求按该
          provider 的边界发送。
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
          const meta = OS_META[asset.os] || { icon: "linux", key: asset.os };
          const offer = describeReleaseAsset(asset);
          const name = platformLabel(asset.os);
          return (
            <Reveal key={asset.os} delay={i * 0.06} className="card lift market-card" style={{ textAlign: "center" }}>
              <div data-testid={`download-card-${asset.os}`}>
              {meta.key === OS_META[current]?.key && (
                <span className="chip" style={{ position: "absolute", top: 14, right: 14 }}>
                  推荐给你
                </span>
              )}
              <div className="ico" style={{ margin: "8px auto 12px", display: "flex", justifyContent: "center" }}>
                <Icon name={meta.icon} size={30} strokeWidth={1.5} />
              </div>
              <div className="name">{name}</div>
              <div className="desc">{asset.label || "桌面客户端"}</div>
              <div className="meta" style={{ justifyContent: "center" }}>
                <span className={`chip ${offer.ready ? "signal" : "muted"}`}>{offer.statusLabel}</span>
                {asset.ext || ""}{asset.size ? ` · ${formatSize(asset.size)}` : ""}
              </div>
              {offer.ready ? (
                <a className="btn btn-primary btn-block" href={offer.href} data-testid="download-ready">
                  {offer.buttonLabel}
                </a>
              ) : (
                <span className="btn btn-glass btn-block" aria-disabled="true" data-testid="download-unavailable">
                  {offer.buttonLabel}
                </span>
              )}
              {offer.hint && (
                <p className="meta" data-testid="download-hint" style={{ justifyContent: "center", marginTop: 8, textAlign: "center" }}>
                  {offer.hint}
                </p>
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
              </div>
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
            <p style={{ color: "var(--muted)", fontSize: 12.5, marginTop: 8, maxWidth: 560 }}>
              下列说明描述已声明的打包形态；实际能否下载以各平台「已打包 / 尚未打包」为准。
            </p>
            {manifest?.notes?.length ? (
              <ul style={{ color: "var(--muted)", fontSize: 13, marginTop: 10, maxWidth: 560, paddingLeft: 18, lineHeight: 1.7 }}>
                {manifest.notes.slice(0, 4).map((note, i) => (
                  <li key={i}>{note}</li>
                ))}
              </ul>
            ) : (
              <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 6, maxWidth: 540 }}>
                {fallbackReleaseNotes()}
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
