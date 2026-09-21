// Desktop IDE budgets for logs, chat, terminal, and editor opens.
// These caps keep the renderer from growing without bound. They are not
// a virtualized 60fps guarantee and do not change the 2MB server file limit.

export const LOG_LINE_CAP = 200;
export const TERM_LINE_CAP = 800;
export const CHAT_MESSAGE_CAP = 80;
export const EDITOR_OPEN_MAX_BYTES = 2_097_152;
export const NATIVE_WINDOW_MIN = { width: 1100, height: 720 };

export const KEYBOARD_PATHS = [
  { id: "quick-open", chord: "Ctrl+P", effect: "quick-open" },
  { id: "command-palette", chord: "Ctrl+Shift+P", effect: "command-palette" },
  { id: "save", chord: "Ctrl+S", effect: "save" },
  { id: "compile", chord: "Ctrl+Shift+B", effect: "compile" },
  { id: "work-mode", chord: "Ctrl+Alt+M", effect: "toggle-work-mode" },
  { id: "preview", chord: "Ctrl+Alt+P", effect: "toggle-pdf-preview" },
];

export const LAYOUT_VIEWPORTS = [
  { width: 1920, height: 1080, scale: 1 },
  { width: 1440, height: 900, scale: 1 },
  { width: 1280, height: 800, scale: 1 },
  { width: 1024, height: 768, scale: 1 },
  { width: 800, height: 600, scale: 1 },
];

export const LAYOUT_DPI_SCALES = [1.25, 1.5];

export function prependCapped(list, items, cap) {
  return [...items, ...(list || [])].slice(0, cap);
}

export function appendCapped(list, items, cap) {
  return [...(list || []), ...items].slice(-cap);
}

export function formatBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function describeOversizedFile(size, max = EDITOR_OPEN_MAX_BYTES) {
  const bytes = Number(size) || 0;
  return {
    oversized: bytes > max,
    size: bytes,
    max,
    message: `文件 ${formatBytes(bytes)} 超过 ${formatBytes(max)}，未载入编辑器`,
  };
}

export function isNativeViewport(width, height) {
  return width >= NATIVE_WINDOW_MIN.width && height >= NATIVE_WINDOW_MIN.height;
}
