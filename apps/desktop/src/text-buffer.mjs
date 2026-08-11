export function createTextBuffer({ path, name }) {
  return {
    path,
    name,
    kind: "text",
    content: "",
    savedContent: "",
    loaded: false,
    dirty: false,
  };
}

export function loadTextBuffer(buffer, content) {
  const value = content ?? "";
  return {
    ...buffer,
    kind: "text",
    content: value,
    savedContent: value,
    loaded: true,
    dirty: false,
  };
}

export function editTextBuffer(buffer, content) {
  const value = content ?? "";
  return {
    ...buffer,
    content: value,
    dirty: value !== buffer.savedContent,
  };
}

export function markTextBufferSaved(buffer, savedContent = buffer.content) {
  return {
    ...buffer,
    savedContent,
    dirty: buffer.content !== savedContent,
  };
}

export function dirtyTextBuffers(buffers) {
  return buffers.filter((buffer) => (
    buffer.kind === "text" && buffer.loaded && buffer.dirty
  ));
}

export function renameTextBuffer(buffer, path, name) {
  return { ...buffer, path, name };
}
