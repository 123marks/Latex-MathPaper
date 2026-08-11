import { classes } from "./_utils.js";

export default function Skeleton({
  className,
  count = 1,
  height,
  label = "正在加载",
  radius,
  width,
}) {
  const safeCount = Math.max(1, Math.floor(Number.isFinite(count) ? count : 1));
  return (
    <span className={classes("skeleton-group", className)} role="status" aria-busy="true">
      <span className="sr-only">{label}</span>
      {Array.from({ length: safeCount }, (_, index) => (
        <span
          key={index}
          className="skeleton"
          aria-hidden="true"
          style={{ width, height, borderRadius: radius }}
        />
      ))}
    </span>
  );
}
