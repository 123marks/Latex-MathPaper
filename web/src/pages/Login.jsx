import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth.jsx";
import { api } from "../lib/api.js";
import AuthPanel from "../components/AuthPanel.jsx";
import AuthAside from "../components/AuthAside.jsx";

export default function Login() {
  const { login, refresh } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [ssoBusy, setSsoBusy] = useState("");
  const from = location.state?.from || "/app";

  async function onSubmit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login(identifier, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function startSso(provider) {
    setError("");
    setSsoBusy(provider);
    try {
      const data = await api.get("/api/auth/oauth/" + provider + "/start");
      if (data.dev && data.url) {
        await fetch(data.url, { credentials: "same-origin" });
        const me = await refresh();
        if (me) {
          navigate(from, { replace: true });
          return;
        }
        setError("第三方登录未返回会话，请重试或使用账号登录。");
      } else if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSsoBusy("");
    }
  }

  return (
    <div className="auth">
      <AuthAside />
      <AuthPanel
        mode="login"
        title="登录"
        subtitle="登录后进入工作台，继续你的文档。"
        error={error}
        busy={busy}
        ssoBusy={ssoBusy}
        onSubmit={onSubmit}
        onSso={startSso}
      >
        <label className="field">
          <span>账号或邮箱</span>
          <input
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            placeholder="username 或 you@example.com"
            autoComplete="username"
            required
          />
        </label>
        <label className="field">
          <span>密码</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="输入你的密码"
            autoComplete="current-password"
            required
          />
        </label>
      </AuthPanel>
    </div>
  );
}
