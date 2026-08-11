import Icon from "../Icon.jsx";
import { classes, requireText } from "./_utils.js";

export default function FeatureCard({
  className = "",
  description,
  icon,
  number,
  title,
  wide = false,
}) {
  const safeNumber = requireText("FeatureCard", "number", number);
  const safeIcon = requireText("FeatureCard", "icon", icon);
  const safeTitle = requireText("FeatureCard", "title", title);
  const safeDescription = requireText("FeatureCard", "description", description);

  return (
    <article className={classes("card", "lift", "feature", wide && "wide", className)}>
      <div className="feature-topline">
        <span className="feature-num">{safeNumber}</span>
        <span className="feat-ico" aria-hidden="true">
          <Icon name={safeIcon} size={18} strokeWidth={1.6} />
        </span>
      </div>
      <h3>{safeTitle}</h3>
      <p>{safeDescription}</p>
    </article>
  );
}
