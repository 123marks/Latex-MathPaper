import { useEffect, useState } from "react";
import { NavLink, Outlet, Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../lib/auth.jsx";
import { api } from "../../lib/api.js";
import CommandPalette from "../../components/CommandPalette.jsx";
import Logo from "../../components/Logo.jsx";
import Icon from "../../components/Icon.jsx";

const APP_NAV = [
  { to: "/app", label: "总览", icon: "dashboard", end: true },
  { to: "/app/workbench", label: "工作台", icon: "workbench" },
  { to: "/app/sessions", label: "会话", icon: "compose" },
  { to: "/app/api-keys", label: "模型 Key", icon: "key" },
  { to: "/app/usage", label: "API 用量", icon: "usage" },
  { to: "/app/community", label: "社区", icon: "community" },
  { to: "/app/account", label: "账户设置", icon: "account" },
];

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [workspaces, setWorkspaces] = useState([]);
  const isAdmin = user && (user.role === "owner" || user.role === "admin");

  useEffect(() => {
    let alive = true;
    api.get("/api/editor/projects")
      .then((d) => { if (alive) setWorkspaces(d.projects || []); })
      .catch(() => { /* switcher stays hidden if projects are unavailable */ });
    return () => { alive = false; };
  }, []);

  async function onLogout() {
    await logout();
    navigate("/");
  }

  const initial = (user?.displayName || user?.username || "U").slice(0, 1).toUpperCase();
  const renderLink = (item) => (
    <NavLink
      key={item.to}
      to={item.to}
      end={item.end}
      className={({ isActive }) => `side-link ${isActive ? "active" : ""}`}
      onClick={() => setMenuOpen(false)}
    >
      <span className="side-ico" aria-hidden="true"><Icon name={item.icon} size={16} /></span>
      {item.label}
    </NavLink>
  );

  return (
    <div className={`shell ${menuOpen ? "menu-open" : ""}`}>
      <aside className="side">
        <Link to="/" className="brand">
          <Logo size={30} />
          <span className="brand-text">
            <strong>Paper OS</strong>
            <span>Workbench</span>
          </span>
        </Link>

        <div className="side-group">工作区</div>
        <nav className="side-nav">{APP_NAV.map(renderLink)}</nav>

        {isAdmin && (
          <>
            <div className="side-group">管理</div>
            <nav className="side-nav">
              <NavLink to="/admin" className="side-link" onClick={() => setMenuOpen(false)}>
                <span className="side-ico" aria-hidden="true"><Icon name="admin" size={16} /></span>
                进入控制台
              </NavLink>
            </nav>
          </>
        )}

        <div className="side-foot">{`v${__APP_VERSION__} · Horizon · 本地优先`}</div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="row">
            <button
              className="btn btn-quiet btn-sm menu-toggle"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="菜单"
            >
              <Icon name="menu" size={16} />
            </button>
            <button
              className="cmdk-trigger"
              onClick={() => window.dispatchEvent(new CustomEvent("paperos:open-cmdk"))}
            >
              <span>搜索 / 命令</span>
              <span className="kbd">⌘K</span>
            </button>
          </div>
          <div className="row" style={{ gap: 12 }}>
            {workspaces.length > 0 && (
              <select
                className="workspace-switch"
                defaultValue=""
                aria-label="切换工作区"
                onChange={(e) => {
                  if (e.target.value) navigate(`/app/workbench?workspace=${encodeURIComponent(e.target.value)}`);
                }}
              >
                <option value="" disabled>切换工作区…</option>
                {workspaces.map((w) => (
                  <option key={w.id} value={w.id}>{w.name || w.id}</option>
                ))}
              </select>
            )}
            <span className={`role-badge ${user?.role}`}>{user?.role}</span>
            <span className="avatar">{initial}</span>
            <span style={{ fontSize: 14 }}>{user?.displayName || user?.username}</span>
            <button className="btn btn-quiet btn-sm" onClick={onLogout}>退出</button>
          </div>
        </header>
        <div className="content">
          <Outlet />
        </div>
      </div>

      <CommandPalette />
    </div>
  );
}
