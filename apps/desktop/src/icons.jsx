// Shared stroke icons (Lucide-style). Keep path data tiny and consistent.
import React from "react";

// Paper OS brand mark — amber rounded-square badge with a serif "P" cut out.
// Mirrors web/src/components/Logo.jsx and the generated app icon / favicon.
export function BrandLogo({ size = 22 }) {
  const uid = `ide-logo-${size}`;
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-label="Paper OS" role="img" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={`${uid}-g`} x1="24" y1="2" x2="24" y2="46" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#f0d38a" />
          <stop offset="0.45" stopColor="#e2b564" />
          <stop offset="1" stopColor="#b8801f" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="44" height="44" rx="13" fill={`url(#${uid}-g)`} />
      <path d="M17 12.5h9.4c4.7 0 7.8 2.9 7.8 7.4 0 4.6-3.2 7.5-8.1 7.5h-4.5v8.1h3.3v1.5H17v-1.5h2.8V14h-2.8v-1.5Zm4.6 1.5v12.4h4c3.4 0 5.4-2.2 5.4-6.2 0-3.9-2-6.2-5.3-6.2h-4.1Z" fill="#12100b" />
    </svg>
  );
}

export function Icon({ name, size = 16, className = "" }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    className: `ico-svg ${className}`.trim(),
    "aria-hidden": true,
  };
  switch (name) {
    case "menu":
      return (
        <svg {...common}>
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      );
    case "template":
      return (
        <svg {...common}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
          <path d="M14 2v6h6M12 12v6M9 15h6" />
        </svg>
      );
    case "files":
      return (
        <svg {...common}>
          <path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
        </svg>
      );
    case "search":
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
      );
    case "outline":
      return (
        <svg {...common}>
          <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
        </svg>
      );
    case "git":
      return (
        <svg {...common}>
          <circle cx="6" cy="6" r="2.5" />
          <circle cx="18" cy="6" r="2.5" />
          <circle cx="12" cy="18" r="2.5" />
          <path d="M6 8.5v3.5a3 3 0 0 0 3 3h3M18 8.5V12" />
        </svg>
      );
    case "extensions":
      return (
        <svg {...common}>
          <path d="M12 3v7M8.5 7.5 12 11l3.5-3.5M5 14h14v5a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-5Z" />
        </svg>
      );
    case "magnifier":
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.2-3.2M9 11h4M11 9v4" />
        </svg>
      );
    case "settings":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      );
    case "engine":
      return (
        <svg {...common}>
          <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9c.3.6.9 1 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
        </svg>
      );
    case "chevron":
      return (
        <svg {...common}>
          <path d="m9 18 6-6-6-6" />
        </svg>
      );
    case "chevron-down":
      return (
        <svg {...common}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      );
    case "file":
      return (
        <svg {...common}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
          <path d="M14 2v6h6" />
        </svg>
      );
    case "tex":
      return (
        <svg {...common}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
          <path d="M14 2v6h6M8 13h8M10 17h4M9 9h2" />
        </svg>
      );
    case "bib":
      return (
        <svg {...common}>
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
        </svg>
      );
    case "pdf":
      return (
        <svg {...common}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
          <path d="M14 2v6h6M10 13h1.5a1.5 1.5 0 0 1 0 3H10v2M14 13v5M17 18v-3.5a1.5 1.5 0 0 1 3 0V18" />
        </svg>
      );
    case "py":
      return (
        <svg {...common}>
          <path d="M12 2c-3 0-4 2-4 4v2h8V6c0-2-1-4-4-4Z" />
          <path d="M8 10H6c-2 0-4 1-4 4s2 4 4 4h2v-4c0-2 1-4 4-4h2v-2H8Z" />
          <path d="M16 14h2c2 0 4-1 4-4s-2-4-4-4h-2v4c0 2-1 4-4 4H8v2h8Z" />
        </svg>
      );
    case "csv":
      return (
        <svg {...common}>
          <path d="M4 4h16v16H4z" />
          <path d="M4 9h16M4 14h16M9 4v16M14 4v16" />
        </svg>
      );
    case "md":
      return (
        <svg {...common}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
          <path d="M14 2v6h6M8 13l2 2 2-2M10 15v3" />
        </svg>
      );
    case "folder":
      return (
        <svg {...common}>
          <path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" fill="currentColor" fillOpacity="0.18" />
          <path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
        </svg>
      );
    case "folder-open":
      return (
        <svg {...common}>
          <path d="m5 19 2.5-8H20l-2 8H5Z" fill="currentColor" fillOpacity="0.22" />
          <path d="m5 19 2.5-8H20l-2 8H5Z" />
          <path d="M3 7a2 2 0 0 1 2-2h5l2 2h4a2 2 0 0 1 2 2v1H7L4.5 19" />
        </svg>
      );
    case "plus":
      return (
        <svg {...common}>
          <path d="M12 5v14M5 12h14" />
        </svg>
      );
    case "close":
      return (
        <svg {...common}>
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      );
    case "save":
      return (
        <svg {...common}>
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" />
          <path d="M17 21v-8H7v8M7 3v5h8" />
        </svg>
      );
    case "play":
      return (
        <svg {...common}>
          <path d="m7 4 12 8L7 20V4Z" />
        </svg>
      );
    case "terminal":
      return (
        <svg {...common}>
          <path d="M4 5h16v14H4z" />
          <path d="m7 9 3 3-3 3M12 15h5" />
        </svg>
      );
    case "download":
      return (
        <svg {...common}>
          <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
        </svg>
      );
    case "git-branch":
    case "branch":
      return (
        <svg {...common}>
          <circle cx="6" cy="6" r="2.5" />
          <circle cx="18" cy="18" r="2.5" />
          <path d="M6 8.5v7a3 3 0 0 0 3 3h6.5M18 15.5V12" />
        </svg>
      );
    case "error":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v5M12 16h.01" />
        </svg>
      );
    case "warn":
      return (
        <svg {...common}>
          <path d="m10.3 3.9-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3.1l-8-14a2 2 0 0 0-3.4 0Z" />
          <path d="M12 9v4M12 17h.01" />
        </svg>
      );
    case "send":
      return (
        <svg {...common}>
          <path d="m22 2-7 20-4-9-9-4Z" />
          <path d="M22 2 11 13" />
        </svg>
      );
    case "sparkle":
      return (
        <svg {...common}>
          <path d="M12 3v4M12 17v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M3 12h4M17 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8" />
          <circle cx="12" cy="12" r="2.5" />
        </svg>
      );
    case "pencil":
      return (
        <svg {...common}>
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
      );
    case "check":
      return (
        <svg {...common}>
          <path d="M20 6 9 17l-5-5" />
        </svg>
      );
    case "circle":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="7" />
        </svg>
      );
    case "hash":
      return (
        <svg {...common}>
          <path d="M5 9h14M5 15h14M10 3 8 21M16 3l-2 18" />
        </svg>
      );
    case "sync":
    case "refresh":
      return (
        <svg {...common}>
          <path d="M21 12a9 9 0 1 1-2.6-6.4" />
          <path d="M21 3v6h-6" />
        </svg>
      );
    case "command":
      return (
        <svg {...common}>
          <path d="M7 7h.01M17 7h.01M7 17h.01M17 17h.01" />
          <path d="M9 7H7a2 2 0 1 0 2 2v6a2 2 0 1 1-2 2h2M15 7h2a2 2 0 1 1-2 2v6a2 2 0 1 0 2 2h-2" />
        </svg>
      );
    case "panel":
      return (
        <svg {...common}>
          <path d="M4 5h16v14H4z" />
          <path d="M10 5v14M4 10h6" />
        </svg>
      );
    case "evidence":
      return (
        <svg {...common}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
          <path d="M14 2v6h6M8 15l2 2 5-5" />
        </svg>
      );
    case "mcp":
      return (
        <svg {...common}>
          <path d="M9 7V4a3 3 0 0 1 6 0v3" />
          <path d="M7 7h10v5a5 5 0 0 1-10 0Z" />
          <path d="M12 17v4M9 21h6" />
        </svg>
      );
    case "filter":
      return (
        <svg {...common}>
          <path d="M4 5h16l-6 7v5l-4 2v-7Z" />
        </svg>
      );
    case "export":
      return (
        <svg {...common}>
          <path d="M14 3h7v7M21 3 11 13" />
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
        </svg>
      );
  }
}

export const ICON_NAMES = Object.freeze([
  "files", "search", "outline", "git", "extensions", "magnifier", "settings", "engine",
  "chevron", "chevron-down", "file", "tex", "bib", "pdf", "py", "csv", "md", "folder",
  "folder-open", "plus", "close", "save", "play", "terminal", "download", "branch",
  "git-branch", "error", "warn", "send", "sparkle", "pencil", "check", "circle", "hash",
  "refresh", "sync", "command", "panel", "menu", "template", "evidence", "mcp", "filter",
  "export",
]);

export function fileIconName(name, isDir, open) {
  if (isDir) return open ? "folder-open" : "folder";
  const lower = String(name || "").toLowerCase();
  if (lower.endsWith(".tex") || lower.endsWith(".sty") || lower.endsWith(".cls")) return "tex";
  if (lower.endsWith(".bib")) return "bib";
  if (lower.endsWith(".pdf")) return "pdf";
  if (lower.endsWith(".py")) return "py";
  if (lower.endsWith(".csv") || lower.endsWith(".tsv")) return "csv";
  if (lower.endsWith(".md")) return "md";
  return "file";
}

export const HIDDEN_TREE = new Set([
  ".aux", ".log", ".out", ".toc", ".lof", ".lot", ".fls", ".fdb_latexmk",
  ".synctex.gz", ".bbl", ".blg", ".nav", ".snm", ".vrb", ".bcf", ".run.xml",
]);

export function shouldHideNode(node) {
  if (!node) return false;
  const name = String(node.name || "").toLowerCase();
  if (node.type === "dir") {
    return name === "build" || name === ".tectonic" || name === "node_modules" || name === ".git" || name === "__pycache__";
  }
  for (const ext of HIDDEN_TREE) {
    if (name.endsWith(ext)) return true;
  }
  return false;
}
