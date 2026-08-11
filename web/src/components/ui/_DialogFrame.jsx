import { useId, useRef } from "react";
import IconButton from "./IconButton.jsx";
import { handleDialogKeyDown, useDialogLifecycle } from "./_dialog.js";
import { classes } from "./_utils.js";

export default function DialogFrame({
  children,
  className,
  description,
  initialFocusRef,
  kind,
  onClose,
  open,
  title,
}) {
  const generatedId = useId().replaceAll(":", "");
  const titleId = `${kind}-${generatedId}-title`;
  const descriptionId = description ? `${kind}-${generatedId}-description` : undefined;
  const panelRef = useRef(null);
  useDialogLifecycle({ containerRef: panelRef, initialFocusRef, open });

  if (typeof title !== "string" || title.trim() === "") {
    throw new Error("DialogFrame requires a non-empty title");
  }
  if (!open) return null;

  return (
    <div
      className={classes("modal", `${kind}__overlay`)}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <section
        ref={panelRef}
        className={classes(`${kind}__panel`, className)}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        onKeyDown={(event) => handleDialogKeyDown(event, panelRef.current, onClose)}
      >
        <header className={`${kind}__header`}>
          <div className={`${kind}__heading`}>
            <h2 id={titleId}>{title}</h2>
            {description ? <p id={descriptionId}>{description}</p> : null}
          </div>
          <IconButton icon="close" label={`关闭${kind === "modal" ? "对话框" : "抽屉"}`} onClick={onClose} />
        </header>
        <div className={`${kind}__body`}>{children}</div>
      </section>
    </div>
  );
}
