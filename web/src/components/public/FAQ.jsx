import Icon from "../Icon.jsx";
import { classes, requireItems, requireText } from "./_utils.js";

function normalizeItem(item, index) {
  if (!item || typeof item !== "object") {
    throw new TypeError(`FAQ item ${index + 1} must be an object`);
  }
  return {
    id: item.id ?? index,
    question: requireText("FAQ", `item ${index + 1} question`, item.question),
    answer: requireText("FAQ", `item ${index + 1} answer`, item.answer),
  };
}

export default function FAQ({ className = "", items = [], label = "常见问题" }) {
  const normalized = requireItems("FAQ", items).map(normalizeItem);
  const accessibleLabel = requireText("FAQ", "label", label);

  return (
    <div className={classes("faq", className)} role="region" aria-label={accessibleLabel}>
      {normalized.map((item) => (
        <details className="faq__item" key={item.id}>
          <summary>
            <span>{item.question}</span>
            <Icon name="arrowRight" size={17} strokeWidth={1.8} />
          </summary>
          <div className="faq__answer">
            <p>{item.answer}</p>
          </div>
        </details>
      ))}
    </div>
  );
}
