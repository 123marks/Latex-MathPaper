import { useId } from "react";

export default function TraceBadge({
  size = 220,
  className = "",
  style,
  label = "Traceable · Verifiable · Reproducible",
}) {
  const instanceId = useId().replace(/[^a-zA-Z0-9_-]/g, "") || "trace";
  const ringId = "trace-" + instanceId + "-ring";
  const radius = 44;
  const ringPath = [
    "M 50 50 m -" + radius + " 0",
    "a " + radius + " " + radius + " 0 1 1 " + radius * 2 + " 0",
    "a " + radius + " " + radius + " 0 1 1 -" + radius * 2 + " 0",
  ].join(" ");

  return (
    <svg
      className={["trace-badge", className].filter(Boolean).join(" ")}
      style={style}
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label={label}
      focusable="false"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <path id={ringId} d={ringPath} fill="none" />
      </defs>

      <g className="trace-badge-spin">
        <text
          fill="var(--muted)"
          fontFamily="var(--font-mono)"
          fontSize="5.4"
          letterSpacing="1.8"
          style={{ textTransform: "uppercase" }}
        >
          <textPath href={"#" + ringId} startOffset="0%">
            TRACEABLE · VERIFIABLE · REPRODUCIBLE ·
          </textPath>
        </text>
      </g>

      <circle cx="50" cy="50" r="36" fill="none" stroke="rgba(212,163,65,0.28)" strokeWidth="0.5" />
      <circle
        cx="50"
        cy="50"
        r="30"
        fill="none"
        stroke="rgba(212,163,65,0.5)"
        strokeWidth="0.5"
        strokeDasharray="2 3"
      />

      <g stroke="rgba(232,181,100,0.6)" strokeWidth="0.5">
        <line x1="50" y1="14" x2="50" y2="24" />
        <line x1="50" y1="76" x2="50" y2="86" />
        <line x1="14" y1="50" x2="24" y2="50" />
        <line x1="76" y1="50" x2="86" y2="50" />
      </g>
      <circle cx="50" cy="50" r="4" fill="var(--amber)" />
      <circle cx="50" cy="50" r="8" fill="none" stroke="var(--amber)" strokeWidth="0.6" opacity="0.6" />
    </svg>
  );
}
