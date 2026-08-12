import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api.js";
import { useAuth } from "../../lib/auth.jsx";
import { formatRelative } from "../../lib/format.js";
import StageGrid from "../../components/StageGrid.jsx";

// 登录后首页 = 本地控制中枢。全部数据来自真实端点：
// /api/summary（运行时）、/api/editor/projects（工作区）、/api/chat/history
// （最近会话）、/api/usage/me（7 天用量）、/api/engine/status（编译引擎）。
function RuntimeRow({ k, v, ok, hint }) {
  return (
    <div className="spread" style={{ fontSize: 13, alignItems: "baseline" }}>
      <span style={{ color: "var(--muted)" }}>{k}</span>
      <span style={{ textAlign: "right" }}>
        <span className={`chip ${ok === false ? "rose" : "muted"}`}>{v}</span>
        {ok === false && hint ? (
          <div style={{ fontSize: 11, color: "var(--faint)", marginTop: 2 }}>{hint}</div>
        ) : null}
      </span>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [projects, setProjects] = useState(null);
  const [packs, setPacks] = useState([]);
  const [sessions, setSessions] = useState(null);
  const [usage, setUsage] = useState(null);
  const [engine, setEngine] = useState(null);
  const [error, setError] = useState("");
  // 新建 / 注册工作区表单：{ mode: "managed" | "external" } 或 null
  const [wsForm, setWsForm] = useState(null);
  const [wsBusy, setWsBusy] = useState(false);
  const [wsError, setWsError] = useState("");

  useEffect(() => {
    api.get("/api/summary").then(setSummary).catch((e) => setError(e.message));
    api.get("/api/editor/projects").then((d) => {
      setProjects(d.projects || []);
      setPacks((d.packs || []).filter((p) => p.adapter !== "legacy-contest"));
    }).catch(() => setProjects([]));
    api.get("/api/chat/history").then((d) => setSessions((d.threads || []).slice(0, 5))).catch(() => setSessions([]));
    api.get("/api/usage/me?days=7").then(setUsage).catch(() => {});
    api.get("/api/engine/status").then(setEngine).catch(() => {});
  }, []);

  async function submitWorkspaceForm(e) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const name = String(form.get("name") || "").trim();
    const id = String(form.get("id") || "").trim();
    const pack = String(form.get("pack") || "latex");
    const path = String(form.get("path") || "").trim();
    if (!id) { setWsError("请填写标识（字母/数字/-_.）。"); return; }
    if (wsForm?.mode === "external" && !path) { setWsError("请填写要注册的本机文件夹绝对路径。"); return; }
    try {
      setWsBusy(true);
      setWsError("");
      const body = wsForm?.mode === "external"
        ? { id, name: name || id, path, pack: pack || undefined }
        : { id, name: name || id, pack };
      await api.post("/api/editor/projects", body);
      const d = await api.get("/api/editor/projects");
      setProjects(d.projects || []);
      setWsForm(null);
    } catch (err) {
      setWsError(err.message);
    } finally {
      setWsBusy(false);
    }
  }

  async function removeWorkspaceRow(p) {
    const label = p.name || p.id;
    try {
      if (p.source === "managed") {
        if (!window.confirm(`移除托管工作区「${label}」会删除它的磁盘文件夹（建议先导出备份）。确定删除？`)) return;
        await api.del(`/api/editor/projects/${encodeURIComponent(p.id)}?deleteFiles=1`);
      } else {
        if (!window.confirm(`把「${label}」移出工作区列表？磁盘文件会原样保留。`)) return;
        await api.del(`/api/editor/projects/${encodeURIComponent(p.id)}`);
      }
      const d = await api.get("/api/editor/projects");
      setProjects(d.projects || []);
    } catch (e) {
      setError(e.message);
    }
  }

  const rt = summary?.runtime;
  const ok = (p) => (p?.ok ? p.detail || "可用" : "缺失");
  const workspaceCount = projects?.length ?? summary?.workspaces?.length ?? 0;
  const activeWs = summary?.activeWorkspace || summary?.activeContest || "";
  const tectonicOk = Boolean(engine?.tectonic?.present);
  const readyCount = [rt?.python?.ok, rt?.latexmk?.ok, tectonicOk].filter(Boolean).length;
  const comp = usage ? usage.promptTokens + usage.completionTokens : 0;
  const promptPct = comp > 0 ? Math.round((usage.promptTokens / comp) * 100) : 0;

  return (
    <>
      <div className="page-head spread" style={{ alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1>欢迎回来，{user?.displayName || user?.username}</h1>
          <p>本地文档运行时总览：Workspace 文件与编译在你的机器上；模型请求按你配置的 provider 处理。</p>
        </div>
        <div className="row" style={{ gap: 10 }}>
          <Link className="btn btn-quiet btn-sm" to="/app/sessions">AI 会话</Link>
          <Link className="btn btn-primary btn-sm" to="/app/workbench">进入工作台 →</Link>
        </div>
      </div>
      {error && <div className="alert error">{error}</div>}

      <div className="stat-grid" style={{ marginBottom: 18 }}>
        <div className="stat"><b>{workspaceCount}</b><span>工作区{activeWs ? ` · 当前 ${activeWs}` : ""}</span></div>
        <div className="stat"><b>{readyCount}/3</b><span>运行时就绪 · Python / LaTeX / Tectonic</span></div>
        <div className="stat"><b style={{ fontSize: 15 }}>{rt?.node || "—"}</b><span>Node 运行时</span></div>
        <div className="stat"><b style={{ fontSize: 13, fontFamily: "var(--font-mono)" }}>{rt?.url || "—"}</b><span>本地运行地址</span></div>
      </div>

      <div className="grid">
        <section className="panel c8 glass">
          <div className="panel-head">
            <h3>工作区</h3>
            <span className="chip muted">{workspaceCount} 个</span>
            <div className="row" style={{ gap: 8, marginLeft: "auto" }}>
              <button
                type="button"
                className="btn btn-quiet btn-sm"
                onClick={() => { setWsForm(wsForm?.mode === "managed" ? null : { mode: "managed" }); setWsError(""); }}
              >
                ＋ 新建
              </button>
              <button
                type="button"
                className="btn btn-quiet btn-sm"
                onClick={() => { setWsForm(wsForm?.mode === "external" ? null : { mode: "external" }); setWsError(""); }}
              >
                注册文件夹
              </button>
            </div>
          </div>
          {wsForm && (
            <form className="ws-create" onSubmit={submitWorkspaceForm}>
              {wsError && <div className="alert error" style={{ marginBottom: 10 }}>{wsError}</div>}
              <div className="ws-create-grid">
                <label className="field">
                  <span>名称</span>
                  <input name="name" placeholder="如 我的美赛论文" autoComplete="off" />
                </label>
                <label className="field">
                  <span>标识 *</span>
                  <input name="id" placeholder="如 mcm-2026（字母数字-_.）" required autoComplete="off" spellCheck={false} />
                </label>
                {wsForm.mode === "managed" ? (
                  <label className="field">
                    <span>类型（Pack）</span>
                    <select name="pack" defaultValue="latex">
                      {packs.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <label className="field">
                    <span>本机文件夹绝对路径 *</span>
                    <input name="path" placeholder="如 C:\papers\my-thesis" required autoComplete="off" spellCheck={false} />
                  </label>
                )}
              </div>
              <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                <button className={`btn btn-primary btn-sm ${wsBusy ? "is-running" : ""}`} disabled={wsBusy}>
                  {wsBusy ? "处理中" : wsForm.mode === "managed" ? "创建工作区" : "注册"}
                </button>
                <button type="button" className="btn btn-quiet btn-sm" onClick={() => setWsForm(null)}>取消</button>
                <span className="muted" style={{ fontSize: 12 }}>
                  {wsForm.mode === "managed"
                    ? "LaTeX 类型会生成结构化论文骨架（章节 / 文献 / 证据示例）。"
                    : "注册不复制文件；之后移除也只是移出列表，不动磁盘。"}
                </span>
              </div>
            </form>
          )}
          {projects === null ? (
            <div className="spinner" />
          ) : projects.length === 0 ? (
            <div className="empty">
              还没有工作区。打开工作台会得到示例工作区，也可以在顶栏的工作区切换器里新建。
            </div>
          ) : (
            <div className="ws-list">
              {projects.map((p) => (
                <div key={p.id} className={`ws-row ${p.id === activeWs ? "active" : ""}`}>
                  <div className="ws-row-main">
                    <b>{p.name || p.id}</b>
                    <span className="chip muted">{p.pack || "latex"}</span>
                    {p.id === activeWs && <span className="chip signal">当前</span>}
                  </div>
                  <div className="ws-row-side">
                    <code className="ws-id">{p.id}</code>
                    <a
                      className="btn btn-quiet btn-sm"
                      href={`/api/editor/export-archive?workspace=${encodeURIComponent(p.id)}`}
                      download
                      title="导出整个工作区为 tar.gz 备份（排除缓存目录）"
                    >
                      导出
                    </a>
                    <Link className="btn btn-quiet btn-sm" to={`/app/workbench?workspace=${encodeURIComponent(p.id)}`}>
                      打开 →
                    </Link>
                    {p.source !== "legacy-contest" && (
                      <button
                        type="button"
                        className="btn btn-quiet btn-sm ws-remove"
                        title={p.source === "managed" ? "删除托管工作区（含磁盘文件夹）" : "移出列表（保留磁盘文件）"}
                        onClick={() => removeWorkspaceRow(p)}
                      >
                        移除
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="panel c4 glass">
          <div className="panel-head"><h3>运行时体检</h3></div>
          <div className="stack" style={{ gap: 12 }}>
            <RuntimeRow k="本地地址" v={rt?.url || "—"} />
            <RuntimeRow k="Node" v={rt?.node || "—"} />
            <RuntimeRow k="Python" v={ok(rt?.python)} ok={rt ? Boolean(rt.python?.ok) : undefined} hint="装 Python 3 后可跑数据脚本" />
            <RuntimeRow k="latexmk" v={ok(rt?.latexmk)} ok={rt ? Boolean(rt.latexmk?.ok) : undefined} hint="可选：本机 TeX 发行版" />
            <RuntimeRow
              k="Tectonic"
              v={tectonicOk ? engine?.tectonic?.detail || "已安装" : "未安装"}
              ok={engine ? tectonicOk : undefined}
              hint="工作台内一键下载后可编译 PDF"
            />
          </div>
        </section>

        <section className="panel c8 glass">
          <div className="panel-head">
            <h3>最近 AI 会话</h3>
            <Link className="ulink" to="/app/sessions">全部会话 →</Link>
          </div>
          {sessions === null ? (
            <div className="spinner" />
          ) : sessions.length === 0 ? (
            <div className="empty">还没有会话。去工作台选中一段源码，让 AI 给出修改提案。</div>
          ) : (
            <div className="dash-sessions">
              {sessions.map((s) => (
                <div key={s.id} className="dash-session-row">
                  <span className={`chip ${s.mode === "inline" ? "" : "muted"}`}>{s.mode}</span>
                  <span className="dash-session-prompt">{s.prompt}</span>
                  <span className="dash-session-time">{formatRelative(s.createdAt)}</span>
                  <Link
                    className="btn btn-quiet btn-sm"
                    to={`/app/workbench?${s.workspace ? `workspace=${encodeURIComponent(s.workspace)}&` : ""}prompt=${encodeURIComponent(s.prompt)}`}
                  >
                    复用
                  </Link>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="panel c4 glass">
          <div className="panel-head">
            <h3>近 7 天用量</h3>
            <Link className="ulink" to="/app/usage">明细 →</Link>
          </div>
          {!usage ? (
            <div className="spinner" />
          ) : usage.totalRequests === 0 ? (
            <div className="empty">近 7 天没有模型调用。</div>
          ) : (
            <div className="stack" style={{ gap: 12 }}>
              <div className="stat" style={{ padding: 0, background: "none", border: 0 }}>
                <b>{usage.totalTokens.toLocaleString()}</b>
                <span>tokens · {usage.totalRequests} 次请求 · ${usage.costUsd.toFixed(4)}</span>
              </div>
              <div className="token-comp">
                <div className="token-comp-bar">
                  <span className="token-comp-prompt" style={{ width: `${promptPct}%` }} />
                  <span className="token-comp-completion" style={{ width: `${comp > 0 ? 100 - promptPct : 0}%` }} />
                </div>
                <div className="token-comp-legend" style={{ fontSize: 11.5 }}>
                  <span><i className="dot dot-prompt" /> 输入 {promptPct}%</span>
                  <span><i className="dot dot-completion" /> 输出 {comp > 0 ? 100 - promptPct : 0}%</span>
                </div>
              </div>
            </div>
          )}
        </section>

        {summary?.status ? (
          <section className="panel c12 glass">
            <div className="panel-head">
              <h3>工作流阶段</h3>
              <Link className="ulink" to="/app/workbench">进入工作台 →</Link>
            </div>
            <StageGrid status={summary.status} />
          </section>
        ) : null}
      </div>
    </>
  );
}
