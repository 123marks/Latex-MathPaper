import { classes, requireText } from "./_utils.js";

export default function CtaBand({
  actions,
  className = "",
  description,
  eyebrow,
  title,
}) {
  const safeEyebrow = requireText("CtaBand", "eyebrow", eyebrow);
  if (title == null || title === false || title === "") {
    throw new TypeError("CtaBand requires a title");
  }
  if (description == null || description === false || description === "") {
    throw new TypeError("CtaBand requires a description");
  }
  if (actions == null || actions === false) {
    throw new TypeError("CtaBand requires actions");
  }

  return (
    <aside className={classes("cta-band", className)}>
      <div className="cta-band__glow" aria-hidden="true" />
      <span className="eyebrow">{safeEyebrow}</span>
      <h2>{title}</h2>
      <p>{description}</p>
      <div className="cta-band__actions">{actions}</div>
    </aside>
  );
}
