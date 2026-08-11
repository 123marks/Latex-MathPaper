import { useEffect, useRef, useState } from "react";

// Thin WebSocket hook. The server upgrades /ws/api with session-cookie
// auth, so we just pass through. Reconnects with exponential backoff.
export function usePaperOSWS() {
  const wsRef = useRef(null);
  const subsRef = useRef(new Map()); // channel -> Set<handler>
  const [status, setStatus] = useState("connecting");

  useEffect(() => {
    let alive = true;
    let backoff = 500;
    function connect() {
      if (!alive) return;
      const proto = location.protocol === "https:" ? "wss" : "ws";
      const url = `${proto}://${location.host}/ws/api`;
      let ws;
      try { ws = new WebSocket(url); } catch { setStatus("error"); return; }
      wsRef.current = ws;
      setStatus("connecting");
      ws.onopen = () => {
        setStatus("open");
        backoff = 500;
        // re-subscribe
        for (const ch of subsRef.current.keys()) {
          ws.send(JSON.stringify({ op: "subscribe", channel: ch }));
        }
      };
      ws.onmessage = (e) => {
        let msg;
        try { msg = JSON.parse(e.data); } catch { return; }
        if (!msg.channel) return;
        const set = subsRef.current.get(msg.channel);
        if (set) for (const h of set) try { h(msg); } catch { /* */ }
      };
      ws.onclose = () => {
        if (!alive) return;
        setStatus("closed");
        setTimeout(() => { if (alive) { backoff = Math.min(backoff * 2, 8000); connect(); } }, backoff);
      };
      ws.onerror = () => setStatus("error");
    }
    connect();
    return () => { alive = false; try { wsRef.current?.close(); } catch { /* */ } };
  }, []);

  function subscribe(channel, handler) {
    if (!subsRef.current.has(channel)) subsRef.current.set(channel, new Set());
    subsRef.current.get(channel).add(handler);
    if (wsRef.current?.readyState === 1) {
      wsRef.current.send(JSON.stringify({ op: "subscribe", channel }));
    }
    return () => {
      subsRef.current.get(channel)?.delete(handler);
      if (wsRef.current?.readyState === 1 && subsRef.current.get(channel)?.size === 0) {
        wsRef.current.send(JSON.stringify({ op: "unsubscribe", channel }));
      }
    };
  }

  return { status, subscribe };
}
