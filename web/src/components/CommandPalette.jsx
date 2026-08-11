import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth.jsx";
import Icon from "./Icon.jsx";

export default function CommandPalette() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);

  const isAdmin = user && (user.role === "owner" || user.role === "admin");

  const commands = useMemo(() => {
    const go = (to) => () => {
      navigate(to);
      setOpen(false);
    };
    const list = [
      { id: "home", label: "前往 · 总览", hint: "Dashboard", icon: "dashboard", run: go("/app") },
      { id: "workbench", label: "前往 · 工作台", hint: "Workbench", icon: "workbench", run: go("/app/workbench") },
      { id: "community", label: "前往 · 社区", hint: "Community", icon: "community", run: go("/app/community") },
      { id: "site", label: "前往 · 官网首页", hint: "Home", icon: "home", run: go("/") },
    ];
    if (isAdmin) {
      list.push(
        { id: "admin", label: "管理 · 总览", hint: "Admin", icon: "admin", run: go("/admin") },
        { id: "admin-users", label: "管理 · 用户", hint: "Users", icon: "users", run: go("/admin/users") },
        { id: "admin-community", label: "管理 · 社区审核", hint: "Moderation", icon: "check", run: go("/admin/community") },
        { id: "admin-content", label: "管理 · 首页内容", hint: "CMS", icon: "content", run: go("/admin/content") },
        { id: "admin-audit", label: "管理 · 审计日志", hint: "Audit", icon: "audit", run: go("/admin/audit") },
      );
    }
    list.push({
      id: "logout",
      label: "退出登录",
      hint: "Logout",
      icon: "logout",
      run: async () => {
        setOpen(false);
        await logout();
        navigate("/");
      },
    });
    return list;
  }, [navigate, logout, isAdmin]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return commands;
    return commands.filter((c) => `${c.label} ${c.hint}`.toLowerCase().includes(s));
  }, [q, commands]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
        setQ("");
        setActive(0);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    const onOpen = () => {
      setOpen(true);
      setQ("");
      setActive(0);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("paperos:open-cmdk", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("paperos:open-cmdk", onOpen);
    };
  }, []);

  useEffect(() => {
    setActive(0);
  }, [q]);

  if (!open) return null;

  const onInputKey = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      filtered[active]?.run();
    }
  };

  return (
    <div className="cmdk-overlay" onClick={() => setOpen(false)}>
      <div className="cmdk glass" onClick={(e) => e.stopPropagation()}>
        <input
          autoFocus
          className="cmdk-input"
          placeholder="输入命令或页面…  (Esc 关闭)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onInputKey}
        />
        <div className="cmdk-list">
          {filtered.length === 0 ? (
            <div className="empty">无匹配命令</div>
          ) : (
            filtered.map((c, i) => (
              <div
                key={c.id}
                className={`cmdk-item ${i === active ? "active" : ""}`}
                onMouseEnter={() => setActive(i)}
                onClick={() => c.run()}
              >
                <span className="cmdk-ico" aria-hidden="true">
                  <Icon name={c.icon} size={15} />
                </span>
                <span>{c.label}</span>
                <span className="hint">{c.hint}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
