import { useEffect, useMemo, useState } from "react";
import Reveal from "../../components/Reveal.jsx";
import { api } from "../../lib/api.js";
import { useAuth } from "../../lib/auth.jsx";
import { usePaperOSWS } from "../../lib/ws.js";

const COL_TITLES = ["todo", "in_progress", "done"];
const COL_LABELS = { todo: "待办", in_progress: "进行中", done: "已审" };
const COL_CHIP = { todo: "muted", in_progress: "", done: "signal" };

export default function TeamSpace() {
  const { user } = useAuth();
  const { subscribe: wsSubscribe } = usePaperOSWS();
  const [data, setData] = useState({ team: null, members: [], tasks: [] });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    title: "",
    assignee: "",
    due: "今日",
    file: "paper.tex",
    ev: 1,
  });

  async function load() {
    try {
      const d = await api.get("/api/team");
      setData(d);
    } catch (e) {
      setError(e.message);
    }
  }
  useEffect(() => { load(); }, []);

  // Live team updates: when another teammate creates/updates a task,
  // patch it into local state so the board stays in sync.
  useEffect(() => {
    const teamId = data.team?.id;
    if (!teamId) return;
    const off = wsSubscribe(`team:${teamId}`, (msg) => {
      if (msg.event === "task.created" && msg.task) {
        setData((d) =>
          d.tasks.some((t) => t.id === msg.task.id)
            ? d
            : { ...d, tasks: [...d.tasks, msg.task] },
        );
      } else if (msg.event === "task.updated" && msg.task) {
        setData((d) => ({
          ...d,
          tasks: d.tasks.map((t) => (t.id === msg.task.id ? msg.task : t)),
        }));
      }
    });
    return off;
  }, [data.team?.id, wsSubscribe]);

  async function createTask() {
    if (!form.title.trim()) return;
    try {
      setBusy(true);
      const r = await api.post("/api/team/tasks", {
        ...form,
        assignee: form.assignee || user?.username || "我",
        ev: Number(form.ev) || 1,
      });
      setData((d) => ({ ...d, tasks: [...d.tasks, r.task] }));
      setShowCreate(false);
      setForm({ title: "", assignee: "", due: "今日", file: "paper.tex", ev: 1 });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function move(task, dir) {
    const idx = COL_TITLES.indexOf(task.state);
    const next = COL_TITLES[Math.max(0, Math.min(COL_TITLES.length - 1, idx + dir))];
    if (next === task.state) return;
    try {
      await api.patch(`/api/team/tasks/${task.id}`, { state: next });
      setData((d) => ({
        ...d,
        tasks: d.tasks.map((t) => (t.id === task.id ? { ...t, state: next } : t)),
      }));
    } catch (e) {
      setError(e.message);
    }
  }

  const grouped = useMemo(() => {
    const g = { todo: [], in_progress: [], done: [] };
    for (const t of data.tasks) (g[t.state] || (g[t.state] = [])).push(t);
    return g;
  }, [data.tasks]);

  const memberByName = useMemo(() => {
    const m = {};
    for (const x of data.members || []) m[x.username] = x;
    return m;
  }, [data.members]);

  return (
    <>
      <div className="page-head">
        <h1>团队 · {data.team?.name || "加载中"}</h1>
        <p>任务看板 + 团队库,用卡片上的 ← → 按钮推进状态。</p>
      </div>

      {error && <div className="alert error">{error}</div>}

      <div className="team-layout">
        <aside className="team-side">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h4 style={{ margin: 0 }}>团队</h4>
          </div>
          <div className="avatar-row">
            {(data.members || []).slice(0, 4).map((m) => (
              <span className="avatar-sm" key={m.id} title={m.displayName}>
                {(m.displayName || m.username || "?").slice(0, 1).toUpperCase()}
              </span>
            ))}
            {(data.members || []).length > 4 && (
              <span className="avatar-sm more">+{data.members.length - 4}</span>
            )}
          </div>
          <h4>角色</h4>
          <div className="row wrap" style={{ gap: 6 }}>
            {Array.from(new Set((data.members || []).map((m) => m.role))).map((r) => (
              <span className={`role-badge ${r}`} key={r}>{r}</span>
            ))}
          </div>
          <h4>在线</h4>
          <div className="stack" style={{ gap: 6, fontSize: 12.5 }}>
            {(data.members || []).slice(0, 5).map((m) => (
              <div className="row" key={m.id} style={{ justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-soft)" }}>{m.displayName}</span>
                <span className="chip signal" style={{ padding: "1px 7px" }}>●</span>
              </div>
            ))}
          </div>
        </aside>

        <div className="kanban">
          {COL_TITLES.map((col, i) => (
            <div className="kanban-col" key={col}>
              <h5>
                {COL_LABELS[col]} <b>{grouped[col]?.length || 0}</b>
              </h5>
              {grouped[col]?.map((card, j) => (
                <Reveal
                  key={card.id}
                  delay={i * 0.04 + j * 0.04}
                  className="kanban-card"
                >
                  <div className="title">{card.title}</div>
                  <div className="meta">
                    <span>{card.assignee}</span>
                    <span>·</span>
                    <span>{card.due}</span>
                    <span className="evbadge">证据:{card.ev}</span>
                  </div>
                  <div className="file">{card.file}</div>
                  <div className="row" style={{ marginTop: 8, gap: 4 }}>
                    <button
                      className="btn btn-quiet btn-sm"
                      onClick={() => move(card, -1)}
                      disabled={card.state === "todo"}
                      style={{ flex: 1, fontSize: 11, padding: "4px 6px" }}
                    >← 上一步</button>
                    <button
                      className="btn btn-quiet btn-sm"
                      onClick={() => move(card, 1)}
                      disabled={card.state === "done"}
                      style={{ flex: 1, fontSize: 11, padding: "4px 6px" }}
                    >下一步 →</button>
                  </div>
                </Reveal>
              ))}
              <button
                className="btn btn-quiet btn-sm"
                style={{ width: "100%", marginTop: 6 }}
                onClick={() => setShowCreate((v) => !v)}
              >
                {showCreate ? "× 取消" : "+ 新建任务"}
              </button>
              {showCreate && (
                <form
                  className="card"
                  style={{ marginTop: 8, padding: 10, display: "grid", gap: 6 }}
                  onSubmit={(e) => { e.preventDefault(); createTask(); }}
                >
                  <input
                    className="input"
                    placeholder="任务标题"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    autoFocus
                  />
                  <div className="grid-2">
                    <input
                      className="input"
                      placeholder="负责人"
                      value={form.assignee}
                      onChange={(e) => setForm({ ...form, assignee: e.target.value })}
                    />
                    <input
                      className="input"
                      placeholder="截止"
                      value={form.due}
                      onChange={(e) => setForm({ ...form, due: e.target.value })}
                    />
                  </div>
                  <input
                    className="input"
                    placeholder="关联 .tex 文件"
                    value={form.file}
                    onChange={(e) => setForm({ ...form, file: e.target.value })}
                  />
                  <input
                    className="input"
                    type="number"
                    min="0"
                    placeholder="证据数"
                    value={form.ev}
                    onChange={(e) => setForm({ ...form, ev: e.target.value })}
                  />
                  <button
                    className={`btn btn-primary btn-sm ${busy ? "is-running" : ""}`}
                    disabled={busy}
                  >
                    {busy ? "创建中" : "创建"}
                  </button>
                </form>
              )}
            </div>
          ))}
        </div>

        <aside className="team-library">
          <h4 style={{ margin: 0, marginBottom: 10 }}>团队库</h4>
          <div className="lib-item">
            <span style={{ color: "var(--amber)" }}>◆</span>
            <span>常用模板</span>
            <span className="v">12</span>
          </div>
          <div className="lib-item">
            <span style={{ color: "var(--amber)" }}>◆</span>
            <span>已发布技能</span>
            <span className="v">5</span>
          </div>
          <div className="lib-item">
            <span style={{ color: "var(--amber)" }}>◆</span>
            <span>最近论断</span>
            <span className="v">28</span>
          </div>
          <div className="lib-item">
            <span style={{ color: "var(--amber)" }}>◆</span>
            <span>共享引用</span>
            <span className="v">142</span>
          </div>
          <h4 style={{ margin: "14px 0 10px" }}>本周贡献</h4>
          {["Bob", "Alice", "Miro"].map((n, i) => (
            <div className="lib-item" key={n}>
              <span style={{ color: "var(--amber)" }}>★</span>
              <span>{n}</span>
              <span className="v">{42 - i * 11}</span>
            </div>
          ))}
        </aside>
      </div>
    </>
  );
}
