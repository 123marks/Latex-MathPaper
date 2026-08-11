export function classes(...values) {
  return values.filter(Boolean).join(" ");
}

export function assertOption(component, option, supported) {
  if (!supported.includes(option)) {
    throw new Error(`Unsupported ${component} option: ${option}`);
  }
}
