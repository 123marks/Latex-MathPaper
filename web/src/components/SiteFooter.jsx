import { Link } from "react-router-dom";
import Logo from "./Logo.jsx";

export default function SiteFooter() {
  return (
    <footer className="foot">
      <div className="container foot-inner">
        <div>
          <div className="brand" style={{ marginBottom: 14 }}>
            <Logo size={30} />
            <span className="brand-text">
              <strong>Paper OS</strong>
              <span>Editorial LaTeX · Team First</span>
            </span>
          </div>
          <p style={{ color: "var(--muted)", fontSize: 14, lineHeight: 1.7, maxWidth: 320 }}>
            通用团队 LaTeX 文档操作系统。AI 协作 · 团队优先 · LaTeX 原生 · 技能生态。
          </p>
        </div>
        <div>
          <h4>产品</h4>
          <Link to="/features">功能</Link>
          <Link to="/pricing">定价</Link>
          <Link to="/market">技能市场</Link>
          <Link to="/app">工作台</Link>
          <Link to="/download">下载</Link>
        </div>
        <div>
          <h4>资源</h4>
          <Link to="/docs">文档</Link>
          <Link to="/changelog">更新日志</Link>
          <Link to="/community">社区广场</Link>
          <Link to="/how-to">使用手册</Link>
          <a href="https://github.com/123marksgithub/Latex-MathPaper" target="_blank" rel="noreferrer">
            GitHub
          </a>
        </div>
        <div>
          <h4>团队</h4>
          <Link to="/enterprise">企业版</Link>
          <Link to="/register">免费注册</Link>
          <Link to="/login">登录</Link>
          <a href="mailto:hi@paper-os.dev">联系我们</a>
        </div>
      </div>
      <div className="container foot-bottom">
        <span>© 2026 Paper OS · Apache-2.0</span>
        <span>LaTeX native · Team first · Evidence-traced</span>
      </div>
    </footer>
  );
}
