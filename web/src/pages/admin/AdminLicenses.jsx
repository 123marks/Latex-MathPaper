import { useCallback, useEffect, useState } from "react";
import { api } from "../../lib/api.js";
import { formatDate } from "../../lib/format.js";

// 许可证管理：签发激活码（pro/team × 时长 × 数量）+ 全量台账。
// 收款在渠道外完成后发码——不伪造支付网关对接。
export default function AdminLicenses() {
  const [codes, setCodes] = useState(null);
  const [error, setError] = useState("");
  const [plan, setPlan] = useState("pro");
  const [days, setDays] = useState(365);
  const [count, setCount] = useState(5);
  const [busy, setBusy] = useState(false);
  const [fresh, setFresh] = useState([]);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      setError("");
      const d = await api.get("/api/admin/licenses");
      setCodes(d.codes || []);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function issue(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setFresh([]);
    setCopied(false);
    try {
      const d = await api.post("/api/admin/licenses", { plan, days: Number(days), count: Number(count) });
      setFresh(d.codes || []);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function copyFresh() {
    try {
      await navigator.clipboard.writeText(fresh.map((c) => c.code).join("\n"));
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  const total = codes?.length ?? 0;
  const redeemed = (codes || []).filter((c) => c.redeemedBy).length;

  return (
    <>
      <div className="page-head">
        <h1>许可证</h1>
        <p>签发与追踪激活码。用户在「账户设置 → 计划与许可」兑换后计划即时生效。</p>
      </div>
      {error && <div className="alert error">{error}</div>}

      <div className="admin-metrics" style={{ marginBottom: 18 }}>
        <div className="card metric-card">
          <div className="k">已签发</div>
          <div className="v">{total}</div>
        </div>
        <div className="card metric-card">
          <div className="k">已兑换</div>
          <div className="v">{redeemed}</div>
          <div className="metric-sub">{total - redeemed} 待兑换</div>
        </div>
      </div>

      <section className="panel c12 glass" style={{ marginBottom: 18 }}>
        <div className="panel-head"><h3>签发激活码</h3></div>
        <form className="row wrap" style={{ gap: 12, alignItems: "flex-end" }} onSubmit={issue}>
          <label className="field" style={{ minWidth: 120 }}>
            <span>计划</span>
            <select className="input" value={plan} onChange={(e) => setPlan(e.target.value)}>
              <option value="pro">pro</option>
              <option value="team">team</option>
            </select>
          </label>
          <label className="field" style={{ maxWidth: 130 }}>
            <span>有效天数</span>
            <input className="input" type="number" min="1" max="3650" value={days} onChange={(e) => setDays(e.target.value)} />
          </label>
          <label className="field" style={{ maxWidth: 110 }}>
            <span>数量</span>
            <input className="input" type="number" min="1" max="50" value={count} onChange={(e) => setCount(e.target.value)} />
          </label>
          <button className={`btn btn-primary btn-sm ${busy ? "is-running" : ""}`} disabled={busy}>
            {busy ? "签发中" : "签发"}
          </button>
        </form>

        {fresh.length > 0 && (
          <div className="license-fresh">
            <div className="spread" style={{ marginBottom: 8 }}>
              <b style={{ fontSize: 13 }}>本次签发 {fresh.length} 个（请立即分发保存）</b>
              <button type="button" className="btn btn-quiet btn-sm" onClick={copyFresh}>
                {copied ? "已复制" : "复制全部"}
              </button>
            </div>
            <pre className="license-codes">{fresh.map((c) => c.code).join("\n")}</pre>
          </div>
        )}
      </section>

      <section className="panel c12 glass">
        <div className="panel-head"><h3>台账</h3></div>
        {codes === null ? (
          <div className="spinner" />
        ) : codes.length === 0 ? (
          <div className="empty">还没有签发过激活码。</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>激活码</th>
                  <th>计划</th>
                  <th>天数</th>
                  <th>签发时间</th>
                  <th>状态</th>
                </tr>
              </thead>
              <tbody>
                {codes.map((c) => (
                  <tr key={c.code}>
                    <td><code className="code-chip">{c.code}</code></td>
                    <td><span className={`chip ${c.plan === "team" ? "" : "muted"}`}>{c.plan}</span></td>
                    <td style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>{c.days}</td>
                    <td style={{ color: "var(--muted)", fontSize: 12 }}>{formatDate(c.createdAt)}</td>
                    <td>
                      {c.redeemedBy ? (
                        <span className="chip signal">
                          已兑换 · {c.redeemedByName}（{formatDate(c.redeemedAt)}）
                        </span>
                      ) : (
                        <span className="chip muted">待兑换</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
