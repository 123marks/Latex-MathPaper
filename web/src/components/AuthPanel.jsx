import { Link, useLocation, useNavigate } from "react-router-dom";
import Logo from "./Logo.jsx";
import Segmented from "./ui/Segmented.jsx";

const modeOptions = [
  { value: "login", label: "登录" },
  { value: "register", label: "注册" },
];

const providers = [
  { id: "google", label: "Google", glyph: "G" },
  { id: "github", label: "GitHub", glyph: "GH" },
  { id: "wechat-work", label: "企业微信", glyph: "W" },
];

export default function AuthPanel({
  mode,
  title,
  subtitle,
  error,
  busy,
  formInvalid = false,
  ssoBusy,
  onSubmit,
  onSso,
  children,
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const from = location.state?.from;

  function selectMode(nextMode) {
    navigate(nextMode === "login" ? "/login" : "/register", {
      state: from ? { from } : undefined,
    });
  }

  return (
    <div className="auth-panel">
      <form className="auth-card glass" onSubmit={onSubmit}>
          <div className="auth-card__top">
            <Link to="/" className="auth-card__home">← 返回首页</Link>
            <span className="auth-card__signal"><span className="signal-dot" /> local workspace</span>
          </div>
          <div className="auth-card__logo">
            <Logo size={44} badge />
          </div>
          <div className="auth-mode">
            <Segmented
              ariaLabel="登录或注册"
              options={modeOptions}
              value={mode}
              onValueChange={selectMode}
            />
          </div>
          <h1>{title}</h1>
          <p className="sub">{subtitle}</p>
          {error && <div className="alert error" role="alert">{error}</div>}
          {children}
          <button
            type="submit"
            className={"btn btn-primary btn-block" + (busy ? " is-running" : "")}
            disabled={busy || formInvalid || !!ssoBusy}
          >
            {busy ? (mode === "login" ? "登录中…" : "创建中…") : (mode === "login" ? "登录并继续" : "免费开始")}
          </button>
          <div className="sso-divider"><span>或使用第三方登录</span></div>
          <div className="sso-row">
            {providers.map((provider) => (
              <button
                key={provider.id}
                type="button"
                className={"sso-btn" + (ssoBusy === provider.id ? " is-running" : "")}
                data-auth-provider={provider.id}
                onClick={() => onSso?.(provider.id)}
                disabled={busy || !!ssoBusy}
              >
                <span className="sso-glyph" aria-hidden="true">{provider.glyph}</span>
                {provider.label}
              </button>
            ))}
          </div>
          <a href="/download" className="auth-offline">
            <span className="auth-offline__icon" aria-hidden="true">↳</span>
            <span>
              <strong>离线打开本地项目</strong>
              <small>使用桌面入口继续 Workspace 工作</small>
            </span>
          </a>
          <p className="auth-boundary">
            项目文件保留在本机；模型请求按你配置的服务商边界发送。
            <span>开发流程：OAuth 按钮仅连接当前开发端点。</span>
          </p>
      </form>
      <span className="auth-page-signal" aria-hidden="true">PAPER OS / AUTH</span>
    </div>
  );
}
