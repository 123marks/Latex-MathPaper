import { useId, useRef, useState } from "react";
import { moveSelection } from "./_selection.js";
import { classes } from "./_utils.js";

export default function Tabs({
  ariaLabel = "标签页",
  className,
  defaultValue,
  items = [],
  onValueChange,
  value,
}) {
  const generatedId = useId();
  const [internalValue, setInternalValue] = useState(defaultValue ?? items[0]?.id);
  const refs = useRef(new Map());
  const controlled = value !== undefined;
  const selectedValue = controlled ? value : internalValue;
  const selectedItem = items.find((item) => item.id === selectedValue && !item.disabled)
    ?? items.find((item) => !item.disabled);
  const activeValue = selectedItem?.id;
  const activeIndex = Math.max(0, items.findIndex((item) => item.id === activeValue));

  function select(nextValue, { focus = false } = {}) {
    if (nextValue == null || nextValue === activeValue) return;
    if (!controlled) setInternalValue(nextValue);
    onValueChange?.(nextValue);
    if (focus) refs.current.get(nextValue)?.focus();
  }

  function onKeyDown(event) {
    const nextValue = moveSelection(items, activeValue, event.key);
    if (nextValue == null) return;
    event.preventDefault();
    select(nextValue, { focus: true });
  }

  if (items.length === 0) return null;
  const idBase = `tabs-${generatedId.replaceAll(":", "")}`;
  const panelId = `${idBase}-panel`;

  return (
    <div className={classes("tabs-root", className)}>
      <div
        className="tabs"
        role="tablist"
        aria-label={ariaLabel}
        onKeyDown={onKeyDown}
        style={{ "--tabs-count": items.length, "--tabs-index": activeIndex }}
      >
        {items.map((item) => {
          const selected = item.id === activeValue;
          const tabId = `${idBase}-tab-${item.id}`;
          return (
            <button
              key={item.id}
              ref={(node) => {
                if (node) refs.current.set(item.id, node);
                else refs.current.delete(item.id);
              }}
              id={tabId}
              type="button"
              className={classes("tab", selected && "is-active", item.dirty && "is-dirty")}
              role="tab"
              aria-selected={selected}
              aria-controls={panelId}
              tabIndex={selected ? 0 : -1}
              disabled={item.disabled}
              onClick={() => select(item.id)}
            >
              <span className="tab__label">{item.label}</span>
              {item.dirty ? <span className="tab__dirty" aria-label="未保存" /> : null}
            </button>
          );
        })}
        <span className="tabs__indicator" aria-hidden="true" />
      </div>
      <div
        id={panelId}
        className="tabs__panel"
        role="tabpanel"
        aria-labelledby={`${idBase}-tab-${activeValue}`}
        tabIndex={0}
      >
        {selectedItem?.content}
      </div>
    </div>
  );
}
