import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="container" style={{ minHeight: "72vh", display: "grid", placeItems: "center", textAlign: "center" }}>
      <div>
        <div className="display italic" style={{ fontSize: 96, background: "var(--grad-aurora)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
          404
        </div>
        <p style={{ color: "var(--muted)", margin: "12px 0 24px" }}>这个页面不在工作流里。</p>
        <Link to="/" className="btn btn-primary">回到首页</Link>
      </div>
    </div>
  );
}
