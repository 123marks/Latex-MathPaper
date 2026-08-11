const ORDER = ["intake", "modeling", "figure", "writing", "verification"];
const LABELS = { done: "完成", todo: "待办", in_progress: "进行中", blocked: "阻塞" };

export default function StageGrid({ status }) {
  const statuses = status?.statuses || {};
  return (
    <div className="stage-grid">
      {ORDER.map((stage, index) => {
        const item = statuses[stage] || { state: "todo", note: "等待状态" };
        return (
          <article key={stage} className={`stage ${item.state}`}>
            <span className="state">{LABELS[item.state] || item.state}</span>
            <span className="si">{String(index + 1).padStart(2, "0")}</span>
            <h4>{stage}</h4>
            <p>{item.note}</p>
          </article>
        );
      })}
    </div>
  );
}
