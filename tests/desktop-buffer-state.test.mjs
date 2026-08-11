import test from "node:test";
import assert from "node:assert/strict";

import {
  createTextBuffer,
  dirtyTextBuffers,
  editTextBuffer,
  loadTextBuffer,
  markTextBufferSaved,
  renameTextBuffer,
} from "../apps/desktop/src/text-buffer.mjs";

test("text buffers retain independent in-memory content across switches", () => {
  const first = editTextBuffer(
    loadTextBuffer(createTextBuffer({ path: "a.tex", name: "a.tex" }), "A on disk"),
    "A in memory",
  );
  const second = loadTextBuffer(
    createTextBuffer({ path: "b.tex", name: "b.tex" }),
    "B on disk",
  );
  const tabs = [first, second];

  assert.equal(tabs.find((tab) => tab.path === "a.tex").content, "A in memory");
  assert.equal(tabs.find((tab) => tab.path === "b.tex").content, "B on disk");
  assert.equal(first.savedContent, "A on disk");
  assert.equal(first.loaded, true);
  assert.equal(first.dirty, true);
});

test("new text buffers are unloaded and editing compares with saved content", () => {
  const unloaded = createTextBuffer({ path: "README.md", name: "README.md" });
  assert.deepEqual(unloaded, {
    path: "README.md",
    name: "README.md",
    kind: "text",
    content: "",
    savedContent: "",
    loaded: false,
    dirty: false,
  });

  const loaded = loadTextBuffer(unloaded, "saved");
  assert.equal(editTextBuffer(loaded, "changed").dirty, true);
  assert.equal(editTextBuffer(loaded, "saved").dirty, false);
});

test("marking one buffer saved leaves every other buffer untouched", () => {
  const first = editTextBuffer(
    loadTextBuffer(createTextBuffer({ path: "a.md", name: "a.md" }), "a0"),
    "a1",
  );
  const second = editTextBuffer(
    loadTextBuffer(createTextBuffer({ path: "b.md", name: "b.md" }), "b0"),
    "b1",
  );

  const savedFirst = markTextBufferSaved(first);
  assert.equal(savedFirst.savedContent, "a1");
  assert.equal(savedFirst.dirty, false);
  assert.equal(second.savedContent, "b0");
  assert.equal(second.content, "b1");
  assert.equal(second.dirty, true);
});

test("marking an older persisted snapshot keeps newer edits dirty", () => {
  const buffer = editTextBuffer(
    loadTextBuffer(createTextBuffer({ path: "a.md", name: "a.md" }), "v0"),
    "v2",
  );

  assert.deepEqual(markTextBufferSaved(buffer, "v1"), {
    ...buffer,
    savedContent: "v1",
    dirty: true,
  });
});

test("dirty enumeration excludes clean, unloaded, and media tabs", () => {
  const dirty = editTextBuffer(
    loadTextBuffer(createTextBuffer({ path: "dirty.tex", name: "dirty.tex" }), "old"),
    "new",
  );
  const clean = loadTextBuffer(
    createTextBuffer({ path: "clean.tex", name: "clean.tex" }),
    "same",
  );
  const unloaded = createTextBuffer({ path: "new.tex", name: "new.tex" });
  const media = { path: "figure.png", name: "figure.png", kind: "media", dirty: true };

  assert.deepEqual(dirtyTextBuffers([clean, media, unloaded, dirty]), [dirty]);
});

test("rename preserves buffer ownership and in-memory revisions", () => {
  const edited = editTextBuffer(
    loadTextBuffer(createTextBuffer({ path: "draft.md", name: "draft.md" }), "v1"),
    "v2",
  );

  assert.deepEqual(renameTextBuffer(edited, "final.md", "final.md"), {
    ...edited,
    path: "final.md",
    name: "final.md",
  });
});
