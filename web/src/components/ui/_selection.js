const KEYS = {
  horizontal: { next: "ArrowRight", previous: "ArrowLeft" },
  vertical: { next: "ArrowDown", previous: "ArrowUp" },
};

export function moveSelection(items, currentValue, key, orientation = "horizontal") {
  const keyMap = KEYS[orientation];
  if (!keyMap) throw new Error(`Unsupported selection orientation: ${orientation}`);
  const enabled = items.filter((item) => !item.disabled);
  if (enabled.length === 0) return null;
  if (key === "Home") return enabled[0].id ?? enabled[0].value;
  if (key === "End") return enabled.at(-1).id ?? enabled.at(-1).value;
  if (key !== keyMap.next && key !== keyMap.previous) return null;

  const currentIndex = enabled.findIndex(
    (item) => (item.id ?? item.value) === currentValue,
  );
  const direction = key === keyMap.next ? 1 : -1;
  const nextIndex = (Math.max(currentIndex, 0) + direction + enabled.length) % enabled.length;
  return enabled[nextIndex].id ?? enabled[nextIndex].value;
}
