import { useCallback, useEffect, useState } from "react";
import { api } from "../../lib/api.js";
import { useAuth } from "../../lib/auth.jsx";
import { formatDate } from "../../lib/format.js";

// 账户设置:个人资料 / 修改密码 / 登录会话,数据全部来自 /api/account/overview。
export default function Account() {
  const { refresh } = useAuth();

  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // 个人资料
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileSaved, setProfileSaved] = useState(false);

  // 修改密码
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNext, setPwNext] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pwError, setPwError] = useState("");
  const [pwSaved, setPwSaved] = useState(false);

  // 登录会话
  const [revokeBusy, setRevokeBusy] = useState(false);
  const [revokeMsg, setRevokeMsg] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const data = await api.get("/api/account/overview");
      setOverview(data);
      setDisplayName(data.user?.displayName || "");
      setEmail(data.user?.email || "");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function saveProfile(e) {
    e.preventDefault();
    setProfileError("");
    setProfileSaved(false);
    if (!displayName.trim()) {
      setProfileError("昵称不能为空。");
      return;
    }
    setProfileBusy(true);
    try {
      const data = await api.put("/api/account/profile", {
        displayName: displayName.trim(),
        email: email.trim(),
      });
      if (data.user) {
        setOverview((o) => (o ? { ...o, user: data.user } : o));
        setDisplayName(data.user.displayName || "");
        setEmail(data.user.email || "");
      }
      await refresh(); // 同步顶栏昵称
      setProfileSaved(true);
    } catch (err) {
      setProfileError(err.message);
    } finally {
      setProfileBusy(false);
    }
  }

  async function changePassword(e) {
    e.preventDefault();
    setPwError("");
    setPwSaved(false);
    if (!pwCurrent) {
      setPwError("请输入当前密码。");
      return;
    }
    if (pwNext.length < 10) {
      setPwError("新密码至少需要 10 个字符。");
      return;
    }
    if (pwNext !== pwConfirm) {
      setPwError("两次输入的新密码不一致。");
      return;
    }
    setPwBusy(true);
    try {
      await api.post("/api/account/password", { current: pwCurrent, next: pwNext });
      setPwCurrent("");
      setPwNext("");
      setPwConfirm("");
      setPwSaved(true);
    } catch (err) {
      setPwError(err.message);
    } finally {
      setPwBusy(false);
    }
  }

  async function revokeOthers() {
    setError("");
    setRevokeMsg("");
    setRevokeBusy(true);
    try {
      const r = await api.post("/api/account/sessions/revoke-others", {});
      setRevokeMsg(`已登出其它设备 · 保留 ${r.kept ?? 1} 个会话`);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setRevokeBusy(false);
    }
  }

  const user = overview?.user || {};
  const sessions = overview?.sessions || [];

  return (
    <>
      <div className="page-head">
        <h1>账户设置</h1>
        <p>管理个人资料、登录密码与设备会话,所有改动只写入本机数据目录。</p>
      </div>

      {error && (
        <div className="alert error" style={{ margin: "18px 26px 0" }}>
          {error}
        </div>
      )}

      {loading ? (
        <div className="spinner" style={{ margin: 26 }} />
      ) : !overview ? null : (
        <div className="dash-grid">
          <section className="panel glass">
            <div className="panel-head">
              <h3>个人资料</h3>
              {profileSaved && <span className="chip signal">已保存</span>}
            </div>

            <div className="row wrap" style={{ gap: 8, marginBottom: 18 }}>
              <span className="chip muted" style={{ fontFamily: "var(--font-mono)" }}>
                @{user.username || "—"}
              </span>
              <span className={`role-badge ${user.role || "member"}`}>{user.role || "member"}</span>
              {user.createdAt && (
                <span className="chip muted">注册于 {formatDate(user.createdAt)}</span>
              )}
            </div>

            {profileError && (
              <div className="alert error" style={{ marginBottom: 14 }}>
                {profileError}
              </div>
            )}

            <form onSubmit={saveProfile}>
              <label className="field">
                <span>昵称</span>
                <input
                  value={displayName}
                  onChange={(e) => {
                    setDisplayName(e.target.value);
                    setProfileSaved(false);
                  }}
                  placeholder="展示在顶栏与社区的名字"
                  maxLength={40}
                />
              </label>
              <label className="field">
                <span>邮箱(可选)</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setProfileSaved(false);
                  }}
                  placeholder="you@example.com"
                />
              </label>
              <button
                className={`btn btn-primary ${profileBusy ? "is-running" : ""}`}
                disabled={profileBusy}
              >
                {profileBusy ? "保存中" : "保存"}
              </button>
            </form>
          </section>

          <section className="panel glass">
            <div className="panel-head">
              <h3>修改密码</h3>
              {pwSaved && <span className="chip signal">密码已更新</span>}
            </div>

            {pwError && (
              <div className="alert error" style={{ marginBottom: 14 }}>
                {pwError}
              </div>
            )}

            <form onSubmit={changePassword}>
              <label className="field">
                <span>当前密码</span>
                <input
                  type="password"
                  value={pwCurrent}
                  onChange={(e) => {
                    setPwCurrent(e.target.value);
                    setPwSaved(false);
                  }}
                  autoComplete="current-password"
                />
              </label>
              <label className="field">
                <span>新密码(至少 10 个字符)</span>
                <input
                  type="password"
                  value={pwNext}
                  onChange={(e) => {
                    setPwNext(e.target.value);
                    setPwSaved(false);
                  }}
                  autoComplete="new-password"
                />
              </label>
              <label className="field">
                <span>确认新密码</span>
                <input
                  type="password"
                  value={pwConfirm}
                  onChange={(e) => {
                    setPwConfirm(e.target.value);
                    setPwSaved(false);
                  }}
                  autoComplete="new-password"
                />
              </label>
              <button
                className={`btn btn-primary ${pwBusy ? "is-running" : ""}`}
                disabled={pwBusy}
              >
                {pwBusy ? "提交中" : "更新密码"}
              </button>
            </form>
          </section>

          <section className="panel c12 glass">
            <div className="panel-head">
              <h3>登录会话</h3>
              <div className="row wrap" style={{ gap: 10 }}>
                {revokeMsg && <span className="chip signal">{revokeMsg}</span>}
                <button
                  className={`btn btn-danger btn-sm ${revokeBusy ? "is-running" : ""}`}
                  disabled={revokeBusy}
                  onClick={revokeOthers}
                >
                  {revokeBusy ? "处理中" : "登出其它所有设备"}
                </button>
              </div>
            </div>

            <table className="table">
              <thead>
                <tr>
                  <th>会话</th>
                  <th>创建时间</th>
                  <th>过期时间</th>
                  <th>状态</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s, i) => (
                  <tr key={s.id ?? i}>
                    <td>
                      <strong>{s.label || "未知设备"}</strong>
                      {s.id && (
                        <div
                          style={{
                            color: "var(--faint)",
                            fontSize: 12,
                            fontFamily: "var(--font-mono)",
                          }}
                        >
                          {String(s.id).slice(0, 10)}
                        </div>
                      )}
                    </td>
                    <td style={{ color: "var(--muted)" }}>{formatDate(s.createdAt) || "—"}</td>
                    <td style={{ color: "var(--muted)" }}>{formatDate(s.expiresAt) || "—"}</td>
                    <td>
                      {s.current ? (
                        <span className="chip">当前</span>
                      ) : (
                        <span className="chip muted">活跃</span>
                      )}
                    </td>
                  </tr>
                ))}
                {sessions.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ textAlign: "center", color: "var(--muted)" }}>
                      暂无会话记录。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
        </div>
      )}
    </>
  );
}
