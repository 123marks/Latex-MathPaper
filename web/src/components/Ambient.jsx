import { useReducedMotion } from "../lib/motion.js";

export default function Ambient() {
  const reduced = useReducedMotion();

  return (
    <div className="ambient" data-motion={reduced ? "static" : "active"} aria-hidden="true">
      <div className="ambient-grid" />
      {reduced ? null : <div className="scanline" />}
    </div>
  );
}
