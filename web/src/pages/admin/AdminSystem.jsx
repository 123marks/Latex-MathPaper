import { useEffect, useState, useCallback } from "react";
import { api } from "../../lib/api.js";
import { formatUptime } from "../../lib/format.js";

function Metric({ k, v }) {
  return (
    <div className="card metric-card">
      <div className="k">{k}</div>
      <div className="v">{v}</div>
    </div>
  );
}

function InfoRow({ k, v, mono }) {
  return (
    <div className="spread" style={{ fontSize: 13, gap: 12 }}>
      <span style={{ color: "var(--muted)", flexShrink: 0 }}>{k}</span>
      <span
        style={
          mono
            ? { fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-soft)", textAlign: "right", wordBreak: "break-all" }
            : { textAlign: "right" }
        }
      >
        {v}
      </span>
    </div>
  );
}

export default function AdminSystem() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [registrationOpen, setRegistrationOpen] = useState(false);
  const [loginRateMax, setLoginRateMax] = useState("");
  const [loginRateWindowMinutes, setLoginRateWindowMinutes] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const applySettings = useCallback((s) => {
    setRegistrationOpen(!!s?.registrationOpen);
    setLoginRateMax(s?.loginRateMax === null || s?.loginRateMax === undefined ? "" : String(s.loginRateMax));
    setLoginRateWindowMinutes(
      s?.loginRateWindowMinutes === null || s?.loginRateWindowMinutes === undefined ? "" : String(s.loginRateWindowMinutes),
    );
  }, []);

  const load = useCallback(async () => {
    try {
      const d = await api.get("/api/admin/system");
      setData(d);
      applySettings(d.settings);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [applySettings]);

  useEffect(() => {
    load();
  }, [load]);

  async function save(event) {
    event.preventDefault();
    setError("");
    setSaved(false);
    const max = Number(loginRateMax);
    const win = Number(loginRateWindowMinutes);
    if (!Number.isInteger(max) || max < 1) {
      setError("登录限流最大尝试次数需为不小于 1 的整数。");
      return;
    }
    if (!Number.isInteger(win) || win < 1) {
      setError("登录限流时间窗需为不小于 1 的整数（分钟）。");
      return;
    }
    setBusy(true);
    try {
      const resp = await api.put("/api/admin/system", {
        registrationOpen,
        loginRateMax: max,
        loginRateWindowMinutes: win,
      });
      if (resp.settings) {
        applySettings(resp.settings);
        setData((d) => (d ? { ...d, settings: resp.settings } : d));
      }
      setSaved(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (loading || !data) {
    return (
      <>
        <div className="page-head">
          <h1>系统设置</h1>
          <p>控制注册开关与登录限流策略，并查看本机运行时的构建信息。</p>
        </div>
        {error ? <div className="alert error">{error}</div> : <div className="spinner" style={{ margin: 26 }} />}
      </>
    );
  }

  const counts = data.counts;
  const build = data.build;
  const maxBodyMB = data.settings?.maxBodyMB;

  return (
    <>
      <div className="page-head">
        <h1>系统设置</h1>
        <p>控制注册开关与登录限流策略，并查看本机运行时的构建信息。</p>
      </div>
      {error && <div className="alert error">{error}</div>}

      <div className="admin-metrics">
        <Metric k="用户" v={counts?.users ?? "—"} />
        <Metric k="工作区" v={counts?.workspaces ?? "—"} />
        <Metric k="活跃会话" v={counts?.sessions ?? "—"} />
        <Metric k="已配置 Key" v={counts?.providerKeys ?? "—"} />
      </div>

      <div className="grid">
        <form className="panel c8 glass" onSubmit={save}>
          <div className="panel-head">
            <h3>访问控制</h3>
            <span className={`chip ${registrationOpen ? "signal" : "muted"}`}>
              {registrationOpen ? "开放注册" : "关闭注册"}
            </span>
          </div>

          <label className="row" style={{ gap: 10, marginBottom: 16, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={registrationOpen}
              style={{ accentColor: "var(--amber)" }}
              onChange={(e) => {
                setRegistrationOpen(e.target.checked);
                setSaved(false);
              }}
            />
            <span>开放注册（关闭后新用户无法自助注册，已有账号不受影响）</span>
          </label>

          <div className="grid-2">
            <label className="field">
              <span>登录限流：最大尝试次数</span>
              <input
                type="number"
                min="1"
                step="1"
                value={loginRateMax}
                onChange={(e) => {
                  setLoginRateMax(e.target.value);
                  setSaved(false);
                }}
              />
            </label>
            <label className="field">
              <span>登录限流：时间窗（分钟）</span>
              <input
                type="number"
                min="1"
                step="1"
                value={loginRateWindowMinutes}
                onChange={(e) => {
                  setLoginRateWindowMinutes(e.target.value);
                  setSaved(false);
                }}
              />
            </label>
          </div>

          <p style={{ color: "var(--faint)", fontSize: 12, margin: "0 0 16px", fontFamily: "var(--font-mono)" }}>
            同一来源在 {loginRateWindowMinutes || "—"} 分钟内最多尝试登录 {loginRateMax || "—"} 次
            {maxBodyMB !== undefined && maxBodyMB !== null ? ` · 单次请求体上限 ${maxBodyMB} MB（只读）` : ""}
          </p>

          <div className="row" style={{ gap: 10 }}>
            <button className={`btn btn-primary ${busy ? "is-running" : ""}`} disabled={busy}>
              {busy ? "保存中" : "保存"}
            </button>
            {saved && <span className="chip signal">已保存</span>}
          </div>
        </form>

        <section className="panel c4 glass">
          <div className="panel-head">
            <h3>构建信息</h3>
            <span className="chip muted">只读</span>
          </div>
          <div className="stack" style={{ gap: 12 }}>
            <InfoRow k="版本" v={build?.version || "—"} mono />
            <InfoRow k="Node" v={build?.node || "—"} mono />
            <InfoRow k="运行时长" v={formatUptime(build?.uptimeSeconds)} />
            <div>
              <span style={{ color: "var(--muted)", fontSize: 13 }}>数据目录</span>
              <div
                style={{
                  marginTop: 6,
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  lineHeight: 1.6,
                  color: "var(--text-soft)",
                  wordBreak: "break-all",
                  userSelect: "all",
                }}
              >
                {build?.dataDir || "—"}
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
