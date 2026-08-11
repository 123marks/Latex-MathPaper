import { useCountUp } from "../../lib/motion.js";

function validateNumber(value, name) {
  if (!Number.isFinite(value)) {
    throw new TypeError("CountUp " + name + " must be a finite number");
  }
}

function formattedValue(value, { decimals, format, locale, prefix, suffix }) {
  const core = typeof format === "function"
    ? format(value)
    : new Intl.NumberFormat(locale, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(value);
  return prefix + String(core) + suffix;
}

function CountUpValue({
  value,
  elementRef,
  className,
  decimals,
  format,
  label,
  locale,
  prefix,
  suffix,
}) {
  return (
    <span
      className={["count-up", className].filter(Boolean).join(" ")}
      ref={elementRef}
      aria-label={label}
    >
      {formattedValue(value, { decimals, format, locale, prefix, suffix })}
    </span>
  );
}

function AnimatedCountUp({
  to,
  from,
  duration,
  decimals,
  format,
  label,
  locale,
  prefix,
  suffix,
  className,
}) {
  const { ref, value } = useCountUp(to, {
    duration,
    start: from,
    decimals,
  });
  return (
    <CountUpValue
      value={value}
      elementRef={ref}
      className={className}
      decimals={decimals}
      format={format}
      label={label}
      locale={locale}
      prefix={prefix}
      suffix={suffix}
    />
  );
}

export default function CountUp({
  to = 0,
  from = 0,
  duration = 1100,
  decimals = 0,
  format,
  locale = "zh-CN",
  prefix = "",
  suffix = "",
  label,
  className = "",
  animate = true,
}) {
  validateNumber(to, "target");
  validateNumber(from, "start");
  validateNumber(duration, "duration");
  if (duration <= 0) {
    throw new RangeError("CountUp duration must be a positive duration");
  }
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 20) {
    throw new RangeError("CountUp decimals must be an integer from 0 to 20");
  }

  const props = { to, from, duration, decimals, format, label, locale, prefix, suffix, className };
  return animate
    ? <AnimatedCountUp {...props} />
    : <CountUpValue {...props} value={to} />;
}
