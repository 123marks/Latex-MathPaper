import { useEffect, useLayoutEffect, useRef, useState } from "react";

// Shared motion utilities. See docs/redesign/02-motion-and-background.md §6.
// Every hook is reduced-motion aware: reduced mode returns static values and
// schedules no animation frames, observers, or input listeners. The shared
// media-query listener remains active so system preference changes are reversible.

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const useClientLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function prefersReducedMotion() {
  return typeof window !== "undefined"
    && typeof window.matchMedia === "function"
    && window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useClientLayoutEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return undefined;
    }

    const mql = window.matchMedia(REDUCED_MOTION_QUERY);
    setReduced(mql.matches);

    const onChange = (event) => {
      setReduced(event.matches);
    };
    mql.addEventListener?.("change", onChange);
    return () => mql.removeEventListener?.("change", onChange);
  }, []);

  return reduced;
}

// Count a number up from `start` to `target` once the element is in view.
// Returns { ref, value } — spread ref on the element you want to observe.
export function useCountUp(target, { duration = 1100, start = 0, decimals = 0 } = {}) {
  const reduced = useReducedMotion();
  const ref = useRef(null);
  const [value, setValue] = useState(reduced ? target : start);

  useEffect(() => {
    if (reduced || prefersReducedMotion()) {
      setValue(target);
      return undefined;
    }
    const el = ref.current;
    if (!el) return undefined;

    if (
      typeof IntersectionObserver === "undefined"
      || typeof requestAnimationFrame !== "function"
      || typeof cancelAnimationFrame !== "function"
      || typeof performance === "undefined"
    ) {
      setValue(target);
      return undefined;
    }

    let raf = 0;
    let began = false;
    const run = () => {
      const t0 = performance.now();
      const tick = (now) => {
        const p = Math.min(1, (now - t0) / Math.max(1, duration));
        // easeOutExpo
        const e = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
        const v = start + (target - start) * e;
        setValue(Number(v.toFixed(decimals)));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !began) {
          began = true;
          run();
          io.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
    };
  }, [target, duration, start, decimals, reduced]);

  return { ref, value: reduced ? target : value };
}

// Fire once when the element first enters the viewport.
export function useInViewOnce({ threshold = 0.2, rootMargin = "0px" } = {}) {
  const reduced = useReducedMotion();
  const ref = useRef(null);
  const [inView, setInView] = useState(reduced);

  useEffect(() => {
    if (reduced || prefersReducedMotion()) {
      setInView(true);
      return undefined;
    }

    const el = ref.current;
    if (!el) return undefined;

    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return undefined;
    }

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold, rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [reduced, threshold, rootMargin]);

  return { ref, inView: reduced || inView };
}

// Damped pointer parallax. Returns a ref for the element being transformed.
export function usePointerParallax({ max = 6, damp = 0.12 } = {}) {
  const reduced = useReducedMotion();
  const ref = useRef(null);
  const raf = useRef(0);
  const cur = useRef({ x: 0, y: 0 });
  const tgt = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const el = ref.current;
    if (
      reduced
      || prefersReducedMotion()
      || !el
      || typeof window === "undefined"
      || typeof requestAnimationFrame !== "function"
      || typeof cancelAnimationFrame !== "function"
      || window.matchMedia?.("(pointer: coarse)").matches
    ) {
      return undefined;
    }

    const loop = () => {
      cur.current.x += (tgt.current.x - cur.current.x) * damp;
      cur.current.y += (tgt.current.y - cur.current.y) * damp;
      el.style.transform = `perspective(1200px) rotateX(${(-cur.current.y * max).toFixed(2)}deg) rotateY(${(cur.current.x * max).toFixed(2)}deg)`;

      const moving = Math.abs(tgt.current.x - cur.current.x) > 0.001
        || Math.abs(tgt.current.y - cur.current.y) > 0.001;
      raf.current = moving ? requestAnimationFrame(loop) : 0;
    };
    const schedule = () => {
      if (!raf.current) raf.current = requestAnimationFrame(loop);
    };
    const onMove = (e) => {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      tgt.current.x = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (r.width / 2)));
      tgt.current.y = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / (r.height / 2)));
      schedule();
    };
    const onLeave = () => {
      tgt.current.x = 0;
      tgt.current.y = 0;
      schedule();
    };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
      raf.current = 0;
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      el.style.transform = "";
    };
  }, [reduced, max, damp]);

  return ref;
}
