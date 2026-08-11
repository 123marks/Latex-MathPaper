import { useEffect, useRef, useState } from "react";
import { NavLink, Link } from "react-router-dom";
import { useAuth } from "../lib/auth.jsx";
import Logo from "./Logo.jsx";
import Icon from "./Icon.jsx";

const LINKS = [
  { to: "/", label: "产品", end: true },
  { to: "/features", label: "功能" },
  { to: "/pricing", label: "定价" },
  { to: "/enterprise", label: "企业版" },
  { to: "/market", label: "技能市场" },
  { to: "/community", label: "社区" },
  { to: "/download", label: "下载" },
];
const COMPACT_NAV_QUERY = "(max-width: 880px)";
const SCROLL_THRESHOLD = 40;

export default function SiteHeader() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const menuButtonRef = useRef(null);
  const mobileNavRef = useRef(null);

  useEffect(() => {
    const syncScrolled = () => setScrolled(window.scrollY > SCROLL_THRESHOLD);
    syncScrolled();
    window.addEventListener("scroll", syncScrolled, { passive: true });
    return () => window.removeEventListener("scroll", syncScrolled);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    mobileNavRef.current?.querySelector("a")?.focus();
    const closeOnEscape = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
      menuButtonRef.current?.focus();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  useEffect(() => {
    const media = window.matchMedia(COMPACT_NAV_QUERY);
    const closeWhenWide = (event) => {
      if (!event.matches) setOpen(false);
    };
    media.addEventListener?.("change", closeWhenWide);
    return () => media.removeEventListener?.("change", closeWhenWide);
  }, []);

  return (
    <header className={`nav${scrolled ? " nav--scrolled" : ""}`}>
      <div className={`nav-inner${scrolled ? " glass-frost" : ""}`}>
        <Link to="/" className="brand" onClick={() => setOpen(false)}>
          <Logo size={30} />
          <span className="brand-text">
            <strong>Paper OS</strong>
            <span>Local First · Pack Powered</span>
          </span>
        </Link>

        <nav className="nav-links" aria-label="主导航">
          {LINKS.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.end}>
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="nav-actions">
          {user ? (
            <>
              <Link to="/app" className="btn btn-glass btn-sm nav-account-action">
                进入工作台
              </Link>
              <button className="btn btn-quiet btn-sm nav-account-action" onClick={logout}>
                退出
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn-quiet btn-sm nav-account-action">
                登录
              </Link>
              <Link to="/register" className="btn btn-glass btn-sm nav-account-action">
                免费开始
              </Link>
            </>
          )}
          <Link to="/download" className="btn btn-primary btn-sm nav-download">
            <Icon name="releases" size={15} />
            <span>下载桌面端</span>
          </Link>
          <button
            ref={menuButtonRef}
            type="button"
            className="btn btn-quiet btn-sm menu-toggle"
            onClick={() => setOpen((v) => !v)}
            aria-label="菜单"
            aria-expanded={open}
            aria-controls="mobile-site-nav"
          >
            <Icon name="menu" size={18} />
          </button>
        </div>
      </div>

      {open && (
        <nav
          id="mobile-site-nav"
          ref={mobileNavRef}
          className="glass mobile-nav"
          aria-label="移动导航"
        >
          {LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              onClick={() => setOpen(false)}
              className="mobile-nav__link"
            >
              {link.label}
            </NavLink>
          ))}
          <div className="mobile-nav__account">
            {user ? (
              <>
                <Link to="/app" className="btn btn-glass btn-sm" onClick={() => setOpen(false)}>
                  进入工作台
                </Link>
                <button
                  type="button"
                  className="btn btn-quiet btn-sm"
                  onClick={() => {
                    setOpen(false);
                    logout();
                  }}
                >
                  退出
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="btn btn-quiet btn-sm" onClick={() => setOpen(false)}>
                  登录
                </Link>
                <Link to="/register" className="btn btn-glass btn-sm" onClick={() => setOpen(false)}>
                  免费开始
                </Link>
              </>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}
