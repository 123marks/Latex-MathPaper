import { classes, requireText } from "./_utils.js";

const ALIGNMENTS = new Set(["left", "center"]);

export default function SectionHead({
  align = "left",
  className = "",
  description,
  eyebrow,
  headingLevel = 2,
  id,
  title,
}) {
  if (!ALIGNMENTS.has(align)) {
    throw new RangeError(`Unsupported SectionHead alignment: ${align}`);
  }
  if (title == null || title === false || title === "") {
    throw new TypeError("SectionHead requires a title");
  }
  if (!Number.isInteger(headingLevel) || headingLevel < 1 || headingLevel > 6) {
    throw new RangeError(`Unsupported SectionHead heading level: ${headingLevel}`);
  }
  const safeEyebrow = eyebrow == null ? "" : requireText("SectionHead", "eyebrow", eyebrow);
  const Heading = "h" + headingLevel;

  return (
    <header className={classes("section-head", `section-head--${align}`, className)}>
      {safeEyebrow ? <span className="eyebrow">{safeEyebrow}</span> : null}
      <Heading id={id}>{title}</Heading>
      {description ? <p>{description}</p> : null}
    </header>
  );
}
