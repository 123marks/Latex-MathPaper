import { Children, cloneElement, isValidElement, useEffect, useId, useRef, useState } from "react";
import { assertOption, classes } from "./_utils.js";

const PLACEMENTS = ["top", "right", "bottom", "left"];

function compose(first, second) {
  return (event) => {
    first?.(event);
    if (!event.defaultPrevented) second?.(event);
  };
}

export default function Tooltip({
  children,
  className,
  content,
  delay = 300,
  placement = "top",
}) {
  assertOption("Tooltip placement", placement, PLACEMENTS);
  if (!Number.isFinite(delay) || delay < 0) {
    throw new Error("Tooltip delay must be a non-negative finite number");
  }
  const child = Children.only(children);
  if (!isValidElement(child)) throw new Error("Tooltip requires one React element trigger");
  const id = `tooltip-${useId().replaceAll(":", "")}`;
  const timerRef = useRef(null);
  const [open, setOpen] = useState(false);

  function cancel() {
    if (timerRef.current != null && typeof window !== "undefined") {
      window.clearTimeout(timerRef.current);
    }
    timerRef.current = null;
  }

  function show() {
    cancel();
    if (delay === 0 || typeof window === "undefined") setOpen(true);
    else timerRef.current = window.setTimeout(() => setOpen(true), delay);
  }

  function hide() {
    cancel();
    setOpen(false);
  }

  useEffect(() => cancel, []);

  const trigger = cloneElement(child, {
    "aria-describedby": id,
    onPointerEnter: compose(child.props.onPointerEnter, show),
    onPointerLeave: compose(child.props.onPointerLeave, hide),
    onFocus: compose(child.props.onFocus, show),
    onBlur: compose(child.props.onBlur, hide),
    onKeyDown: compose(child.props.onKeyDown, (event) => {
      if (event.key === "Escape") hide();
    }),
  });

  return (
    <span className="tooltip-root">
      {trigger}
      <span
        id={id}
        className={classes("tooltip", `tooltip--${placement}`, open && "is-open", className)}
        role="tooltip"
        aria-hidden={!open}
      >
        {content}
      </span>
    </span>
  );
}
