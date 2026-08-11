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

  // Real derived metrics only; the board must never show fabricated counts.
  const evidenceTotal = useMemo(
    () => (data.tasks || []).reduce((sum, t) => sum + (Number(t.ev) || 0), 0),
    [data.tasks],
  );

  const contributions = useMemo(() => {
    const counts = {};
    for (const t of data.tasks || []) {
      const who = t.assignee || "未分配";
      counts[who] = (counts[who] || 0) + 1;
    }
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [data.tasks]);

  // 7-day contribution heatmap from real task.createdAt only (empty when no
  // recent activity; never backfilled or invented).
  const activity = useMemo(() => {
    const days = [];
    const now = new Date();
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      days.push(d.toISOString().slice(0, 10));
    }
    const dayset = new Set(days);
    const byPerson = new Map();
    for (const t of data.tasks || []) {
      const day = String(t.createdAt || "").slice(0, 10);
      if (!dayset.has(day)) continue;
      const who = t.assignee || "未分配";
      if (!byPerson.has(who)) byPerson.set(who, {});
      const row = byPerson.get(who);
      row[day] = (row[day] || 0) + 1;
    }
    const grid = [...byPerson.entries()].map(([name, counts]) => ({
      name,
      cells: days.map((day) => ({ day, count: counts[day] || 0 })),
    }));
    return { days, grid };
  }, [data.tasks]);

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
          <h4 style={{ margin: 0, marginBottom: 10 }}>团队概览</h4>
          <div className="lib-item">
            <span style={{ color: "var(--amber)" }}>◆</span>
            <span>成员</span>
            <span className="v">{data.members?.length || 0}</span>
          </div>
          <div className="lib-item">
            <span style={{ color: "var(--amber)" }}>◆</span>
            <span>任务</span>
            <span className="v">{data.tasks?.length || 0}</span>
          </div>
          <div className="lib-item">
            <span style={{ color: "var(--amber)" }}>◆</span>
            <span>已审</span>
            <span className="v">{grouped.done?.length || 0}</span>
          </div>
          <div className="lib-item">
            <span style={{ color: "var(--amber)" }}>◆</span>
            <span>证据合计</span>
            <span className="v">{evidenceTotal}</span>
          </div>
          <h4 style={{ margin: "14px 0 10px" }}>任务贡献</h4>
          {contributions.length === 0 ? (
            <div className="lib-item">
              <span style={{ color: "var(--muted)" }}>暂无任务</span>
            </div>
          ) : (
            contributions.map((c) => (
              <div className="lib-item" key={c.name}>
                <span style={{ color: "var(--amber)" }}>★</span>
                <span>{c.name}</span>
                <span className="v">{c.count}</span>
              </div>
            ))
          )}
        </aside>
      </div>

      <section className="panel team-activity">
        <div className="panel-head">
          <h3>近 7 天活动</h3>
          <span className="chip muted">按任务创建时间</span>
        </div>
        {activity.grid.length === 0 ? (
          <div className="empty" style={{ fontSize: 13 }}>近 7 天暂无任务活动。创建任务后会在此累积真实贡献热力。</div>
        ) : (
          <div className="activity-heatmap">
            <div className="heat-head">
              <span className="heat-name" />
              {activity.days.map((day) => (
                <span key={day} className="heat-daylabel">{day.slice(5)}</span>
              ))}
            </div>
            {activity.grid.map((row) => (
              <div className="heat-row" key={row.name}>
                <span className="heat-name" title={row.name}>{row.name}</span>
                {row.cells.map((cell) => (
                  <span
                    key={cell.day}
                    className="heat-cell"
                    data-level={Math.min(4, cell.count)}
                    title={`${cell.day} · ${row.name} · ${cell.count} 个任务`}
                  />
                ))}
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
