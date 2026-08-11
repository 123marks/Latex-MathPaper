import Icon from "../Icon.jsx";
import QuillMark from "./QuillMark.jsx";

const STATUS_LABELS = {
  done: "已完成",
  running: "进行中",
  pending: "待执行",
};

function normalizeSteps(steps) {
  if (!Array.isArray(steps)) {
    throw new TypeError("ActionTimeline steps must be an array");
  }

  return steps.map((step, index) => {
    if (!step || typeof step !== "object") {
      throw new TypeError("ActionTimeline step " + (index + 1) + " must be an object");
    }
    if (!Object.hasOwn(STATUS_LABELS, step.status)) {
      throw new RangeError("Unsupported ActionTimeline status: " + step.status);
    }

    const title = String(step.title ?? step.text ?? "").trim();
    if (!title) {
      throw new TypeError("ActionTimeline step " + (index + 1) + " requires text");
    }

    const description = step.description ?? step.detail;
    return {
      id: step.id ?? index,
      title,
      description: description == null ? "" : String(description).trim(),
      status: step.status,
    };
  });
}

function StatusIcon({ status }) {
  if (status === "done") {
    return <Icon name="check" size={14} strokeWidth={2.2} />;
  }
  if (status === "running") {
    return <QuillMark state="thinking" size={18} decorative />;
  }
  return <Icon name="dot" size={13} strokeWidth={1.7} />;
}

export default function ActionTimeline({
  steps = [],
  label = "执行计划",
  emptyLabel = "暂无执行步骤",
  className = "",
}) {
  const normalized = normalizeSteps(steps);

  if (normalized.length === 0) {
    return (
      <div
        className={["action-timeline-empty", className].filter(Boolean).join(" ")}
        role="status"
      >
        {emptyLabel}
      </div>
    );
  }

  return (
    <ol
      className={["action-timeline", className].filter(Boolean).join(" ")}
      aria-label={label}
    >
      {normalized.map((step, index) => (
        <li
          className={[
            "action-timeline__item",
            "action-timeline__item--" + step.status,
          ].join(" ")}
          aria-current={step.status === "running" ? "step" : undefined}
          key={step.id}
        >
          <span className="action-timeline__index" aria-hidden="true">
            {index + 1}
          </span>
          <span className="action-timeline__copy">
            <span className="action-timeline__title">{step.title}</span>
            {step.description ? (
              <span className="action-timeline__description">{step.description}</span>
            ) : null}
          </span>
          <span className="action-timeline__status">
            <StatusIcon status={step.status} />
            <span>{STATUS_LABELS[step.status]}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}
