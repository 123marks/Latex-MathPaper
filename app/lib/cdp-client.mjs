import WebSocket from "ws";

export function connectCdp(url) {
  const socket = new WebSocket(url);
  let commandId = 0;
  const listeners = new Map();
  const pending = new Map();

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data));
    if (message.method) {
      for (const listener of listeners.get(message.method) || []) {
        listener(message.params || {});
      }
      return;
    }

    if (!message.id || !pending.has(message.id)) return;
    const command = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) command.reject(new Error(message.error.message || "CDP command failed"));
    else command.resolve(message.result || {});
  });

  return new Promise((resolveConnection, reject) => {
    socket.addEventListener("open", () => {
      resolveConnection({
        send(method, params = {}) {
          commandId += 1;
          const id = commandId;
          return new Promise((resolveCommand, rejectCommand) => {
            pending.set(id, { resolve: resolveCommand, reject: rejectCommand });
            socket.send(JSON.stringify({ id, method, params }));
          });
        },
        on(method, listener) {
          const methodListeners = listeners.get(method) || new Set();
          methodListeners.add(listener);
          listeners.set(method, methodListeners);
          return () => {
            methodListeners.delete(listener);
            if (methodListeners.size === 0) listeners.delete(method);
          };
        },
        close() {
          socket.close();
        },
      });
    });
    socket.addEventListener("error", () => reject(new Error("CDP websocket failed")));
  });
}
