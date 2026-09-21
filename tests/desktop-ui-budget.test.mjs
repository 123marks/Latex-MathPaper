import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  appendCapped,
  CHAT_MESSAGE_CAP,
  describeOversizedFile,
  EDITOR_OPEN_MAX_BYTES,
  isNativeViewport,
  KEYBOARD_PATHS,
  LAYOUT_DPI_SCALES,
  LAYOUT_VIEWPORTS,
  LOG_LINE_CAP,
  NATIVE_WINDOW_MIN,
  prependCapped,
  TERM_LINE_CAP,
} from "../apps/desktop/src/ui-budget.mjs";

const ideSource = readFileSync(new URL("../apps/desktop/src/ide.jsx", import.meta.url), "utf8");
const serverSource = readFileSync(new URL("../app/server.mjs", import.meta.url), "utf8");
const buildScript = readFileSync(new URL("../apps/desktop/build-ide.mjs", import.meta.url), "utf8");
const launcher = readFileSync(new URL("../launcher/Program.cs", import.meta.url), "utf8");

test("log, chat, and terminal caps drop the overflow instead of growing forever", () => {
  const log = prependCapped(["old"], Array.from({ length: 250 }, (_, i) => `n${i}`), LOG_LINE_CAP);
  assert.equal(log.length, LOG_LINE_CAP);
  assert.equal(log[0], "n0");
  const chat = appendCapped([], Array.from({ length: 120 }, (_, i) => ({ id: i })), CHAT_MESSAGE_CAP);
  assert.equal(chat.length, CHAT_MESSAGE_CAP);
  assert.equal(chat[0].id, 40);
  const term = appendCapped([], Array.from({ length: 900 }, (_, i) => i), TERM_LINE_CAP);
  assert.equal(term.length, TERM_LINE_CAP);
});

test("oversized files stay out of the editor and match the server 2MB gate", () => {
  assert.equal(EDITOR_OPEN_MAX_BYTES, 2_097_152);
  assert.match(serverSource, /FILE_TOO_LARGE|stat\.size > 2_097_152/);
  const big = describeOversizedFile(EDITOR_OPEN_MAX_BYTES + 1);
  assert.equal(big.oversized, true);
  assert.match(big.message, /未载入编辑器/);
  assert.equal(describeOversizedFile(100).oversized, false);
  assert.match(ideSource, /data-testid="file-oversized"/);
  assert.match(ideSource, /kind === "oversized"/);
});

test("keyboard paths for open, save, palette, compile, mode, and preview are wired", () => {
  assert.deepEqual(KEYBOARD_PATHS.map((row) => row.id), [
    "quick-open",
    "command-palette",
    "save",
    "compile",
    "work-mode",
    "preview",
  ]);
  assert.match(ideSource, /setQuickOpen\(true\)/);
  assert.match(ideSource, /e\.shiftKey && e\.key === "P"/);
  assert.match(ideSource, /e\.key === "s" \|\| e\.key === "S"/);
  assert.match(ideSource, /Ctrl\+Alt\+M|e\.altKey && \(e\.key === "m"/);
  assert.match(ideSource, /Ctrl\+Alt\+P|toggle-pdf-preview|setShowPdf\(\(v\) => !v\)/);
  assert.match(ideSource, /data-testid="command-palette"/);
  assert.match(ideSource, /data-testid="quick-open"/);
  assert.match(buildScript, /["']ui-budget["']\s*:/);
});

test("layout evidence includes 1920 and DPI scales, and 800 is not a native window", () => {
  assert.deepEqual(LAYOUT_VIEWPORTS.map((v) => v.width), [1920, 1440, 1280, 1024, 800]);
  assert.deepEqual(LAYOUT_DPI_SCALES, [1.25, 1.5]);
  assert.equal(isNativeViewport(800, 600), false);
  assert.equal(isNativeViewport(NATIVE_WINDOW_MIN.width, NATIVE_WINDOW_MIN.height), true);
  assert.match(launcher, /MinimumSize = new Size\(1100, 720\)/);
});
