import Icon from "../Icon.jsx";
import { classes, requireItems, requireText } from "./_utils.js";

function normalizeItem(item, index) {
  if (!item || typeof item !== "object") {
    throw new TypeError(`LogoWall item ${index + 1} must be an object`);
  }
  return {
    id: item.id ?? index,
    icon: requireText("LogoWall", `item ${index + 1} icon`, item.icon),
    label: requireText("LogoWall", `item ${index + 1} label`, item.label),
  };
}

export default function LogoWall({ className = "", description, items = [], label }) {
  const normalized = requireItems("LogoWall", items).map(normalizeItem);
  const accessibleLabel = requireText("LogoWall", "label", label);

  return (
    <section className={classes("logo-wall", className)} aria-label={accessibleLabel}>
      <div className="logo-wall__copy">
        <span className="eyebrow">适用场景</span>
        <h3>{accessibleLabel}</h3>
        {description ? <p>{description}</p> : null}
      </div>
      <ul>
        {normalized.map((item) => (
          <li key={item.id}>
            <Icon name={item.icon} size={18} strokeWidth={1.6} />
            <span>{item.label}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
