import { Link } from "react-router-dom";
import Logo from "./Logo.jsx";

const trace = ["Workspace", "Packs", "LaTeX 原生", "证据可追溯", "技能生态"];

export default function AuthAside() {
  return (
    <aside className="auth-aside">
      <div className="auth-aside__copy">
        <Link to="/" className="brand">
          <Logo size={32} />
          <span className="brand-text">
            <strong>Paper OS</strong>
            <span>Local First · Pack Powered</span>
          </span>
        </Link>
        <h2 className="display">
          从想法，到可以交付的
          <br />
          <span className="grad">文档工作区</span>。
        </h2>
        <p>
          一个把 Workspace、Packs、LaTeX 原生编辑和证据链放在一起的本地优先工作台。
          先看清变更，再决定哪些内容可以进入文档。
        </p>
      </div>
      <div className="aside-list">
        <div><span className="amber-dot" />Workspace + Packs</div>
        <div><span className="amber-dot" />LaTeX 原生</div>
        <div><span className="amber-dot" />证据可追溯</div>
        <div><span className="amber-dot" />技能生态</div>
      </div>
      <div className="auth-aside__visual" aria-hidden="true">
        <pre className="auth-fragment auth-fragment--code">
          {["const draft = workspace.open(\"paper.tex\");", "const evidence = packs.trace(draft);", "return review(evidence);"].join("\n")}
        </pre>
        <div className="auth-fragment auth-fragment--pdf">
          <span className="auth-fragment__label">PDF / evidence</span>
          <strong>reviewable output</strong>
          <i />
          <i />
          <i />
          <small>v0.4 · local build</small>
        </div>
        <ol className="auth-trace">
          {trace.map((label, index) => (
            <li className="auth-trace__step" key={label}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              {label}
            </li>
          ))}
        </ol>
      </div>
      <div className="horizon" aria-hidden="true" />
    </aside>
  );
}
