import { useState } from "react";
import { NavLink, Outlet, Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../lib/auth.jsx";
import CommandPalette from "../../components/CommandPalette.jsx";
import Logo from "../../components/Logo.jsx";
import Icon from "../../components/Icon.jsx";

const NAV = [
  {
    group: "总览",
    items: [
      { to: "/admin", label: "仪表盘", icon: "dashboard", end: true },
      { to: "/admin/usage", label: "用量统计", icon: "analytics" },
    ],
  },
  {
    group: "用户与权限",
    items: [
      { to: "/admin/users", label: "用户管理", icon: "community" },
      { to: "/admin/keys", label: "模型 Key", icon: "key" },
      { to: "/admin/licenses", label: "许可证", icon: "key" },
    ],
  },
  {
    group: "内容与社区",
    items: [
      { to: "/admin/community", label: "社区审核", icon: "check" },
      { to: "/admin/content", label: "首页内容", icon: "content" },
      { to: "/admin/releases", label: "发布管理", icon: "releases" },
    ],
  },
  {
    group: "监控",
    items: [
      { to: "/admin/monitor", label: "服务监控", icon: "system" },
      { to: "/admin/sessions", label: "在线会话", icon: "community" },
    ],
  },
  {
    group: "系统",
    items: [
      { to: "/admin/system", label: "系统设置", icon: "system" },
      { to: "/admin/audit", label: "审计日志", icon: "audit" },
    ],
  },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  async function onLogout() {
    await logout();
    navigate("/");
  }

  const initial = (user?.displayName || user?.username || "A").slice(0, 1).toUpperCase();

  const renderLink = (item) => (
    <NavLink
      key={item.to}
      to={item.to}
      end={item.end}
      className={({ isActive }) => `admin-link${isActive ? " active" : ""}`}
      onClick={() => setMenuOpen(false)}
    >
      <span className="admin-link-ico" aria-hidden="true"><Icon name={item.icon} size={16} /></span>
      <span className="admin-link-label">{item.label}</span>
    </NavLink>
  );

  return (
    <div className={`admin-shell${menuOpen ? " menu-open" : ""}`}>
      <aside className="admin-side">
        <Link to="/admin" className="admin-brand">
          <Logo size={28} />
          <span className="admin-brand-text">
            <strong>Paper OS</strong>
            <span>Console</span>
          </span>
        </Link>

        <nav className="admin-nav">
          {NAV.map((section) => (
            <div key={section.group} className="admin-nav-group">
              <div className="admin-nav-title">{section.group}</div>
              {section.items.map(renderLink)}
            </div>
          ))}
        </nav>

        <div className="admin-side-foot">
          <Link to="/app" className="admin-backapp">
            ← 返回工作台
          </Link>
          <div className="admin-version">{`v${__APP_VERSION__} · Horizon`}</div>
        </div>
      </aside>

      <div className="admin-main">
        <header className="admin-topbar">
          <div className="row">
            <button
              className="btn btn-quiet btn-sm admin-menu-toggle"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="菜单"
            >
              ☰
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
            <span className={`role-badge ${user?.role}`}>{user?.role}</span>
            <span className="avatar">{initial}</span>
            <span className="admin-user-name">{user?.displayName || user?.username}</span>
            <button className="btn btn-quiet btn-sm" onClick={onLogout}>退出</button>
          </div>
        </header>

        <main className="admin-content">
          <Outlet />
        </main>
      </div>

      <CommandPalette />
    </div>
  );
}
