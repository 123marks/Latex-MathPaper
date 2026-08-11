import { useRef, useState } from "react";
import { moveSelection } from "./_selection.js";
import { classes } from "./_utils.js";

export default function Segmented({
  ariaLabel = "选项",
  className,
  defaultValue,
  onValueChange,
  options = [],
  value,
}) {
  const [internalValue, setInternalValue] = useState(defaultValue ?? options[0]?.value);
  const refs = useRef(new Map());
  const controlled = value !== undefined;
  const selectedOption = options.find((option) => option.value === (controlled ? value : internalValue) && !option.disabled)
    ?? options.find((option) => !option.disabled);
  const activeValue = selectedOption?.value;
  const activeIndex = Math.max(0, options.findIndex((option) => option.value === activeValue));

  function select(nextValue, { focus = false } = {}) {
    if (nextValue == null || nextValue === activeValue) return;
    if (!controlled) setInternalValue(nextValue);
    onValueChange?.(nextValue);
    if (focus) refs.current.get(nextValue)?.focus();
  }

  function onKeyDown(event) {
    const nextValue = moveSelection(options, activeValue, event.key);
    if (nextValue == null) return;
    event.preventDefault();
    select(nextValue, { focus: true });
  }

  if (options.length === 0) return null;

  return (
    <div
      className={classes("segmented", className)}
      role="radiogroup"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      style={{ "--segment-count": options.length, "--segment-index": activeIndex }}
    >
      <span className="segmented__indicator" aria-hidden="true" />
      {options.map((option) => {
        const selected = option.value === activeValue;
        return (
          <button
            key={option.value}
            ref={(node) => {
              if (node) refs.current.set(option.value, node);
              else refs.current.delete(option.value);
            }}
            type="button"
            className={classes("segmented__option", selected && "is-active")}
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            disabled={option.disabled}
            onClick={() => select(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
