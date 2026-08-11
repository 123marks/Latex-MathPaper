export function classes(...values) {
  return values.filter(Boolean).join(" ");
}

export function requireText(component, field, value) {
  if (typeof value !== "string" || !value.trim()) {
    throw new TypeError(`${component} requires a non-empty ${field}`);
  }
  return value.trim();
}

export function requireItems(component, items) {
  if (!Array.isArray(items)) {
    throw new TypeError(`${component} items must be an array`);
  }
  return items;
}
