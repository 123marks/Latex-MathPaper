import { useCallback, useEffect, useState } from "react";
import { api } from "../../lib/api.js";
import { formatUptime, formatDate } from "../../lib/format.js";

// 服务监控：进程内存 / 系统内存 / 数据存储体积，全部为运行时真实读数。
function mb(bytes) {
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

export default function AdminMonitor() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [refreshedAt, setRefreshedAt] = useState(null);

  const load = useCallback(async () => {
    try {
      setError("");
      setData(await api.get("/api/admin/monitor"));
      setRefreshedAt(new Date());
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 10000);
    return () => clearInterval(timer);
  }, [load]);

  const p = data?.process;
  const s = data?.system;
  const memPct = s ? Math.round(((s.totalMemBytes - s.freeMemBytes) / s.totalMemBytes) * 100) : 0;
  const heapPct = p ? Math.round((p.heapUsedBytes / Math.max(1, p.heapTotalBytes)) * 100) : 0;
  const showLoad = s && s.platform !== "win32" && s.loadavg.some((v) => v > 0);

  return (
    <>
      <div className="page-head spread">
        <div>
          <h1>服务监控</h1>
          <p>本机 Node 服务进程与宿主系统的实时读数，每 10 秒自动刷新。</p>
        </div>
        <span className="chip muted" style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>
          {refreshedAt ? `刷新于 ${refreshedAt.toLocaleTimeString()}` : "加载中"}
        </span>
      </div>
      {error && <div className="alert error">{error}</div>}
      {!data ? (
        <div className="spinner" />
      ) : (
        <>
          <div className="admin-metrics">
            <div className="card metric-card">
              <div className="k">进程内存 (RSS)</div>
              <div className="v" style={{ fontSize: 24 }}>{mb(p.rssBytes)}</div>
              <div className="metric-sub">heap {mb(p.heapUsedBytes)} / {mb(p.heapTotalBytes)}（{heapPct}%）</div>
            </div>
            <div className="card metric-card">
              <div className="k">系统内存</div>
              <div className="v" style={{ fontSize: 24 }}>{memPct}%</div>
              <div className="metric-sub">
                已用 {mb(s.totalMemBytes - s.freeMemBytes)} / {mb(s.totalMemBytes)}
              </div>
            </div>
            <div className="card metric-card">
              <div className="k">服务运行时长</div>
              <div className="v" style={{ fontSize: 24 }}>{formatUptime(p.uptimeSeconds)}</div>
              <div className="metric-sub">pid {p.pid} · {p.node}</div>
            </div>
            <div className="card metric-card">
              <div className="k">宿主</div>
              <div className="v" style={{ fontSize: 24 }}>{s.cpus} 核</div>
              <div className="metric-sub">
                {s.platform}/{s.arch} · 开机 {formatUptime(s.hostUptimeSeconds)}
                {showLoad ? ` · load ${s.loadavg.join(" / ")}` : ""}
              </div>
            </div>
          </div>

          <div className="grid" style={{ marginTop: 18 }}>
            <section className="panel c8 glass">
              <div className="panel-head">
                <h3>数据存储</h3>
                <span className="chip muted" style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>{data.dataDir}</span>
              </div>
              <table className="table">
                <thead>
                  <tr><th>文件</th><th>体积</th><th>最后写入</th></tr>
                </thead>
                <tbody>
                  {data.stores.map((f) => (
                    <tr key={f.name}>
                      <td><code className="code-chip">{f.name}</code></td>
                      <td style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>
                        {f.bytes > 0 ? `${(f.bytes / 1024).toFixed(1)} KB` : "—"}
                      </td>
                      <td style={{ color: "var(--muted)", fontSize: 12 }}>
                        {f.mtime ? formatDate(new Date(f.mtime).toISOString()) : "未创建"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
            <section className="panel c4 glass">
              <div className="panel-head"><h3>工作区</h3></div>
              <div className="stat" style={{ background: "none", border: 0, padding: 0 }}>
                <b>{data.workspaceCount}</b>
                <span>已注册 Workspace</span>
              </div>
              <p style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.7, marginTop: 12 }}>
                所有读数都来自本机进程与文件系统的即时查询；
                {s.platform === "win32" ? "Windows 不提供 load average，故不显示该项；" : ""}
                没有任何模拟数据。
              </p>
            </section>
          </div>
        </>
      )}
    </>
  );
}
