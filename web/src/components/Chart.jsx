export function BarSeries({ data = [] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div>
      <div className="bars">
        {data.map((d, i) => (
          <div
            key={i}
            className="bar"
            style={{ height: `${Math.max(4, (d.count / max) * 100)}%` }}
            title={`${d.day}: ${d.count}`}
          />
        ))}
      </div>
      <div className="bar-label">
        {data.map((d, i) => (
          <span key={i}>{String(d.day).slice(5)}</span>
        ))}
      </div>
    </div>
  );
}

export function AreaSpark({ data = [], height = 120, id = "spark" }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const n = data.length;
  const w = 100;
  const h = height;
  const pts = data.map((d, i) => {
    const x = n <= 1 ? 0 : (i / (n - 1)) * w;
    const y = h - (d.count / max) * (h - 14) - 6;
    return [x, y];
  });
  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(" ");
  const area = `${line} L ${w} ${h} L 0 ${h} Z`;
  return (
    <svg className="chart" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ height, width: "100%" }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(212,163,65,0.45)" />
          <stop offset="100%" stopColor="rgba(212,163,65,0)" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke="#e2b564" strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
