import { classes } from "./_utils.js";

const STATUS = {
  verified: { label: "已验证", tone: "signal" },
  compiling: { label: "编译中", tone: "info", busy: true },
  failed: { label: "失败", tone: "error" },
  offline: { label: "离线可用", tone: "muted" },
};

export default function Badge({ className, label, status = "offline" }) {
  const config = STATUS[status];
  if (!config) throw new Error(`Unsupported Badge status: ${status}`);
  return (
    <span
      className={classes("badge", `badge--${config.tone}`, className)}
      role="status"
      aria-live={config.busy ? "polite" : undefined}
      aria-busy={config.busy || undefined}
    >
      <span className="badge__mark" aria-hidden="true" />
      <span>{label ?? config.label}</span>
    </span>
  );
}
