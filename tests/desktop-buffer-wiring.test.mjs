import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../apps/desktop/src/ide.jsx", import.meta.url), "utf8");

test("IDE wires text tabs to the reusable buffer lifecycle", () => {
  assert.match(source, /from ["'].\/text-buffer\.mjs["']/);
  assert.match(source, /createTextBuffer\s*\(/);
  assert.match(source, /loadTextBuffer\s*\(/);
  assert.match(source, /editTextBuffer\s*\(/);
  assert.match(source, /markTextBufferSaved\s*\(/);
  assert.match(source, /dirtyTextBuffers\s*\(/);
  assert.match(source, /renameTextBuffer\s*\(/);
});

test("loaded text tabs restore memory before the file request path", () => {
  const restore = source.indexOf('existing?.kind === "text" && existing.loaded');
  const restoreContent = source.indexOf("setEditor(existing.content)", restore);
  const request = source.indexOf("await api.get(", restore);

  assert.notEqual(restore, -1, "openFile must recognize a loaded text buffer");
  assert.notEqual(restoreContent, -1, "openFile must restore the buffer content");
  assert.notEqual(request, -1, "openFile must retain a first-load request path");
  assert.ok(restore < restoreContent && restoreContent < request);
  assert.match(source.slice(restoreContent, request), /return;/);
});

test("Save All persists each dirty buffer and handles partial failure", () => {
  assert.match(source, /dirtyTextBuffers\(openTabs\)/);
  assert.match(source, /Promise\.allSettled\s*\(/);
  assert.match(source, /buffer\.path/);
  assert.match(source, /buffer\.content/);
  assert.match(source, /failed/i);
});

test("rename and editor changes update the owning text buffer", () => {
  assert.match(source, /renameTextBuffer\(tab, to, newName\)/);
  assert.match(source, /editTextBuffer\(tab, value\)/);
});

test("desktop bootstrap precedes local authentication", () => {
  const bootstrap = source.indexOf('await api.get("/api/auth/bootstrap")');
  const localAuth = source.indexOf('await api.post("/api/auth/local", {})');

  assert.notEqual(bootstrap, -1, "desktop boot must request the bootstrap cookie");
  assert.notEqual(localAuth, -1, "desktop boot must retain local authentication");
  assert.ok(bootstrap < localAuth, "bootstrap must run before local authentication");
});
