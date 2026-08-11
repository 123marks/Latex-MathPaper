import { classes, requireItems, requireText } from "./_utils.js";

function normalizeItem(item, index) {
  if (!item || typeof item !== "object") {
    throw new TypeError(`StatRow item ${index + 1} must be an object`);
  }
  const label = requireText("StatRow", `item ${index + 1} label`, item.label);
  const value = item.value == null ? "" : String(item.value).trim();
  if (!value) throw new TypeError(`StatRow item ${index + 1} requires a value`);
  return { id: item.id ?? index, label, value };
}

export default function StatRow({ className = "", items = [], label = "关键指标" }) {
  const normalized = requireItems("StatRow", items).map(normalizeItem);
  const accessibleLabel = requireText("StatRow", "label", label);

  return (
    <dl className={classes("stat-row", className)} aria-label={accessibleLabel}>
      {normalized.map((item) => (
        <div key={item.id}>
          <dt>{item.label}</dt>
          <dd><b>{item.value}</b></dd>
        </div>
      ))}
    </dl>
  );
}
