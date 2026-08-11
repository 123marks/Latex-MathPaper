import { useEffect, useRef, useState } from "react";
import IconButton from "./IconButton.jsx";
import { assertOption, classes } from "./_utils.js";

const TONES = ["success", "error", "warning", "info"];

export default function Toast({
  action,
  children,
  className,
  duration = 4000,
  onDismiss,
  open = true,
  title,
  tone = "success",
}) {
  assertOption("Toast tone", tone, TONES);
  if (!Number.isFinite(duration) || duration < 0) {
    throw new Error("Toast duration must be a non-negative finite number");
  }
  const [paused, setPaused] = useState(false);
  const remainingRef = useRef(duration);
  const surfaceRef = useRef(null);

  useEffect(() => {
    remainingRef.current = duration;
  }, [duration, open]);

  useEffect(() => {
    if (!open || paused || duration === 0 || !onDismiss || typeof window === "undefined") {
      return undefined;
    }
    const startedAt = Date.now();
    const timer = window.setTimeout(onDismiss, remainingRef.current);
    return () => {
      window.clearTimeout(timer);
      remainingRef.current = Math.max(0, remainingRef.current - (Date.now() - startedAt));
    };
  }, [duration, onDismiss, open, paused]);

  if (!open) return null;
  const role = tone === "error" ? "alert" : "status";

  return (
    <aside
      ref={surfaceRef}
      className={classes("toast", `toast--${tone}`, className)}
      role={role}
      aria-live={role === "alert" ? "assertive" : "polite"}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => {
        if (!surfaceRef.current?.contains(event.relatedTarget)) setPaused(false);
      }}
    >
      <span className="toast__signal" aria-hidden="true" />
      <div className="toast__content">
        {title ? <strong>{title}</strong> : null}
        <div>{children}</div>
        {action ? <div className="toast__action">{action}</div> : null}
      </div>
      {onDismiss ? <IconButton icon="close" label="关闭通知" onClick={onDismiss} /> : null}
    </aside>
  );
}
