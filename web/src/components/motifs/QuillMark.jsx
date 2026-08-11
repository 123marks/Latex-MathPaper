const STATE_LABELS = {
  idle: "Quill",
  loading: "加载中",
  thinking: "思考中",
};

export default function QuillMark({
  state = "idle",
  size = 28,
  label,
  className = "",
  style,
  decorative = false,
}) {
  if (!Object.hasOwn(STATE_LABELS, state)) {
    throw new RangeError("Unsupported QuillMark state: " + state);
  }

  const active = state !== "idle";
  const semantics = decorative
    ? { "aria-hidden": "true" }
    : active
      ? {
          role: "status",
          "aria-live": "polite",
          "aria-label": label || STATE_LABELS[state],
        }
      : {
          role: "img",
          "aria-label": label || STATE_LABELS[state],
        };

  return (
    <span
      className={["quill-mark", "quill-mark--" + state, className].filter(Boolean).join(" ")}
      style={{ "--size": typeof size === "number" ? size + "px" : size, ...style }}
      {...semantics}
    >
      <span className="quill-mark-core" aria-hidden="true" />
    </span>
  );
}
