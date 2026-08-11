import { useEffect } from "react";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export function getFocusableElements(container) {
  if (!container?.querySelectorAll) return [];
  return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
    (element) => element.getAttribute?.("aria-hidden") !== "true",
  );
}

export function handleDialogKeyDown(event, container, onClose) {
  if (event.key === "Escape") {
    event.preventDefault();
    onClose?.();
    return true;
  }
  if (event.key !== "Tab") return false;

  const focusable = getFocusableElements(container);
  if (focusable.length === 0) {
    event.preventDefault();
    container?.focus?.();
    return true;
  }

  const first = focusable[0];
  const last = focusable.at(-1);
  if (event.shiftKey && event.target === first) {
    event.preventDefault();
    last.focus();
    return true;
  }
  if (!event.shiftKey && event.target === last) {
    event.preventDefault();
    first.focus();
    return true;
  }
  return false;
}

export function useDialogLifecycle({ containerRef, initialFocusRef, open }) {
  useEffect(() => {
    if (!open || typeof document === "undefined") return undefined;
    const previousActive = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusTarget = initialFocusRef?.current
      ?? getFocusableElements(containerRef.current)[0]
      ?? containerRef.current;
    focusTarget?.focus?.();

    return () => {
      document.body.style.overflow = previousOverflow;
      if (previousActive?.isConnected !== false) previousActive?.focus?.();
    };
  }, [containerRef, initialFocusRef, open]);
}
