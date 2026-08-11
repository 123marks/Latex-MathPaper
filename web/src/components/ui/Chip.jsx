import { assertOption, classes } from "./_utils.js";

const TONES = ["default", "muted", "rose", "signal"];

export default function Chip({ as: Component = "span", className, tone = "default", ...props }) {
  if (!TONES.includes(tone)) throw new Error(`Unsupported Chip tone: ${tone}`);
  assertOption("Chip tone", tone, TONES);
  return (
    <Component
      {...props}
      className={classes("chip", tone !== "default" && tone, className)}
    />
  );
}
