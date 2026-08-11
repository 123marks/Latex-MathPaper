import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth.jsx";
import { api } from "../lib/api.js";
import AuthPanel from "../components/AuthPanel.jsx";
import AuthAside from "../components/AuthAside.jsx";
import {
  passwordConfirmationError,
  passwordPolicyError,
} from "../lib/password-policy.js";

export default function Register() {
  const { register, refresh } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({
    username: "",
    email: "",
    displayName: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [ssoBusy, setSsoBusy] = useState("");
  const from = location.state?.from || "/app";

  const update = (key) => (event) => setForm((current) => ({
    ...current,
    [key]: event.target.value,
  }));
  const pwHint = passwordPolicyError(form.password);
  const confirmationHint = passwordConfirmationError(form.password, form.confirmPassword);

  async function onSubmit(event) {
    event.preventDefault();
    setError("");
    if (pwHint || confirmationHint) {
      setError(pwHint || confirmationHint);
      return;
    }
    setBusy(true);
    try {
      const { confirmPassword, ...payload } = form;
      await register(payload);
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
        mode="register"
        title="注册"
        subtitle="建立一个本地优先的 Workspace 账号。"
        error={error}
        busy={busy}
        formInvalid={Boolean(pwHint || confirmationHint)}
        ssoBusy={ssoBusy}
        onSubmit={onSubmit}
        onSso={startSso}
      >
        <label className="field">
          <span>用户名</span>
          <input
            value={form.username}
            onChange={update("username")}
            placeholder="3-32 位字母、数字、点、下划线或短横线"
            autoComplete="username"
            required
          />
        </label>
        <div className="grid-2 auth-register-grid">
          <label className="field">
            <span>显示名（可选）</span>
            <input
              value={form.displayName}
              onChange={update("displayName")}
              placeholder="展示名称"
            />
          </label>
          <label className="field">
            <span>邮箱（可选）</span>
            <input
              type="email"
              value={form.email}
              onChange={update("email")}
              placeholder="you@example.com"
              autoComplete="email"
            />
          </label>
        </div>
        <label className="field">
          <span>密码</span>
          <input
            type="password"
            name="password"
            value={form.password}
            onChange={update("password")}
            placeholder="至少 10 位，包含两类字符"
            autoComplete="new-password"
            required
            aria-describedby="password-policy"
          />
          <span id="password-policy" className={"auth-policy" + (pwHint ? " is-error" : "")}>
            {pwHint || "至少 10 位，且包含大小写字母、数字或符号中的两类。"}
          </span>
        </label>
        <label className="field">
          <span>确认密码</span>
          <input
            type="password"
            name="confirmPassword"
            value={form.confirmPassword}
            onChange={update("confirmPassword")}
            placeholder="再次输入密码"
            autoComplete="new-password"
            required
            aria-describedby="password-confirmation"
          />
          <span id="password-confirmation" className={"auth-confirmation" + (confirmationHint ? " is-error" : "")}>
            {confirmationHint || "两次输入必须保持一致。"}
          </span>
        </label>
      </AuthPanel>
    </div>
  );
}
