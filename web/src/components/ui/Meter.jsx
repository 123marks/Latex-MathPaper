import { useId } from "react";
import { classes } from "./_utils.js";

export default function Meter({
  className,
  criticalAt,
  formatValue,
  label,
  max = 100,
  min = 0,
  value,
}) {
  if (typeof label !== "string" || label.trim() === "") {
    throw new Error("Meter requires a non-empty label");
  }
  if (![min, max, value].every(Number.isFinite) || max <= min) {
    throw new Error("Meter requires finite values and max greater than min");
  }
  if (criticalAt !== undefined && !Number.isFinite(criticalAt)) {
    throw new Error("Meter criticalAt must be finite when provided");
  }
  const id = `meter-${useId().replaceAll(":", "")}`;
  const clamped = Math.min(max, Math.max(min, value));
  const percent = ((clamped - min) / (max - min)) * 100;
  const critical = criticalAt !== undefined && value >= criticalAt;
  const valueText = formatValue
    ? formatValue(value, { min, max })
    : new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 1 }).format(value);

  return (
    <div className={classes("meter", critical && "meter--critical", className)}>
      <div className="meter__meta">
        <span id={id}>{label}</span>
        <output>{valueText}</output>
      </div>
      <div
        className="meter__track"
        role="meter"
        aria-labelledby={id}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={clamped}
        aria-valuetext={valueText}
      >
        <span className="meter__fill" style={{ transform: `scaleX(${percent / 100})` }} />
      </div>
    </div>
  );
}
