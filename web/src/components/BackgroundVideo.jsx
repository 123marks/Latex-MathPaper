import { useEffect, useState } from "react";
import { prefersReducedMotion, useReducedMotion } from "../lib/motion.js";

export function isUsableVideoResponse(response) {
  const contentType = response.headers.get("content-type");
  return response.ok
    && typeof contentType === "string"
    && contentType.toLowerCase().startsWith("video/");
}

// Optional deep-space video backdrop. Drop a file at `web/public/bg-space.mp4`
// (rebuild to copy it into `app/public/`) and it becomes an optional motion layer,
// blended above Horizon and below a contrast scrim. If the file is absent we render
// nothing, so the CSS starfield + WebGL aurora remain the backdrop — no black box.
export default function BackgroundVideo() {
  const reduced = useReducedMotion();
  const [src, setSrc] = useState(null);

  useEffect(() => {
    if (reduced || prefersReducedMotion()) return undefined;

    let alive = true;
    fetch("/bg-space.mp4", { method: "HEAD" })
      .then((r) => {
        if (alive && isUsableVideoResponse(r)) setSrc("/bg-space.mp4");
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [reduced]);

  if (reduced || !src) return null;
  return (
    <>
      <video
        className="bg-video"
        autoPlay
        muted
        loop
        playsInline
        poster="/bg-space.jpg"
        aria-hidden="true"
      >
        <source src={src} type="video/mp4" />
      </video>
      <div className="bg-scrim" aria-hidden="true" />
    </>
  );
}
