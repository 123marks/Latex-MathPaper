import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api.js";
import { useAuth } from "../../lib/auth.jsx";
import StageGrid from "../../components/StageGrid.jsx";

function Row({ k, v, bad }) {
  return (
    <div className="spread" style={{ fontSize: 13 }}>
      <span style={{ color: "var(--muted)" }}>{k}</span>
      <span className={`chip ${bad ? "rose" : "muted"}`}>{v}</span>
    </div>
  );
}

function QuickLink({ to, t, d }) {
  return (
    <Link to={to} className="stat" style={{ textDecoration: "none", display: "block" }}>
      <b style={{ fontSize: 18 }}>{t}</b>
      <span>{d}</span>
    </Link>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/api/summary").then(setSummary).catch((e) => setError(e.message));
  }, []);

  const rt = summary?.runtime;
  const ok = (p) => (p?.ok ? p.detail || "可用" : "缺失");

  return (
    <>
      <div className="page-head">
        <h1>欢迎回来，{user?.displayName || user?.username}</h1>
        <p>本地文档运行时总览：Workspace 文件与编译在你的机器上；模型请求按你配置的 provider 处理。</p>
      </div>
      {error && <div className="alert error">{error}</div>}
      <div className="grid">
        <section className="panel c8 glass">
          <div className="panel-head">
            <h3>工作流阶段</h3>
            <Link className="ulink" to="/app/workbench">进入工作台 →</Link>
          </div>
          <StageGrid status={summary?.status} />
        </section>
        <section className="panel c4 glass">
          <div className="panel-head"><h3>运行时</h3></div>
          <div className="stack" style={{ gap: 12 }}>
            <Row k="本地地址" v={rt?.url || "—"} />
            <Row k="Node" v={rt?.node || "—"} />
            <Row k="Python" v={ok(rt?.python)} bad={rt && !rt.python?.ok} />
            <Row k="latexmk" v={ok(rt?.latexmk)} bad={rt && !rt.latexmk?.ok} />
          </div>
        </section>
        <section className="panel c4 glass">
          <div className="panel-head"><h3>工作区</h3></div>
          <div className="stat">
            <b>{summary?.workspaces?.length ?? summary?.contests?.length ?? "—"}</b>
            <span>个工作区 · 当前 {summary?.activeWorkspace || summary?.activeContest || "无"}</span>
          </div>
        </section>
        <section className="panel c8 glass">
          <div className="panel-head"><h3>快速上手</h3></div>
          <div className="stat-grid">
            <QuickLink to="/app/workbench" t="打开工作台" d="编辑、编译、AI 协作" />
            <QuickLink to="/app/api-keys" t="配置模型 Key" d="加密存储 · 本机使用" />
            <QuickLink to="/app/community" t="逛社区" d="交流方法与经验" />
            <QuickLink to="/docs" t="使用文档" d="快速上手流程" />
          </div>
        </section>
      </div>
    </>
  );
}
