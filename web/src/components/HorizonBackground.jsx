import { useEffect, useRef, useState } from "react";
import { Renderer, Program, Mesh, Triangle } from "ogl";

// Paper OS · Horizon Glow (v2 dynamic background)
// See docs/redesign/02-motion-and-background.md. Deep-charcoal field with a
// slow-breathing amber "horizon" rising from the lower third, two warm light
// sources, faint drifting aurora filaments, sparse floating dust and a soft
// pointer glow. One GPU context, one RAF. Pauses when the tab is hidden or the
// canvas scrolls fully out of view; degrades on low power / reduced-motion.
//
// Target location after P6 refactor: components/motifs/HorizonBackground.jsx.

const VERT = /* glsl */ `
attribute vec2 uv;
attribute vec2 position;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}`;

const FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform vec2  uRes;
uniform vec2  uMouse;   // damped, normalized (0..1), y up
uniform float uScroll;  // 0..1
uniform float uQuality; // 1.0 full, 0.0 low-power (no dust / filaments / pointer)

float hash(vec2 p){ p = fract(p * vec2(123.34, 345.45)); p += dot(p, p + 34.345); return fract(p.x * p.y); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  float a = hash(i), b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0)), d = hash(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++){ v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }

// sparse, slowly rising, twinkling dust
float dust(vec2 uv, float t){
  float acc = 0.0;
  vec2 g = uv * vec2(9.0, 6.0);
  vec2 cell = floor(g);
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 c = cell + vec2(float(i), float(j));
      float h = hash(c);
      if (h < 0.86) continue;               // keep it sparse
      vec2 pos = c + vec2(hash(c + 1.0), fract(hash(c + 3.0) - t * 0.03));
      float d = length(g - pos);
      float tw = 0.5 + 0.5 * sin(t * 1.4 + h * 40.0);
      acc += (1.0 - smoothstep(0.0, 0.16, d)) * tw;
    }
  }
  return acc;
}

void main(){
  vec2 uv = vUv;
  float t = uTime * 0.05;

  // horizon band: warm light rising from the lower third, top edge undulates
  float edge = 0.34
    + 0.05 * sin(uv.x * 2.0 + t * 1.4)
    + 0.08 * fbm(vec2(uv.x * 2.4 + t * 0.4, t * 0.5))
    - uScroll * 0.05;                        // sinks a touch as you scroll
  float d = uv.y - edge;
  float band = 1.0 - smoothstep(0.0, 0.42, d);
  band = pow(band, 1.5);

  float breathe = 0.82 + 0.18 * sin(t * 1.7);

  // two warm sources low-left / low-right
  float aspect = uRes.x / max(uRes.y, 1.0);
  float left  = exp(-8.0  * length((uv - vec2(0.16, 0.10)) * vec2(aspect, 1.0)));
  float right = exp(-10.0 * length((uv - vec2(0.86, 0.06)) * vec2(aspect, 1.0)));

  vec3 charcoal = vec3(0.031, 0.031, 0.039);
  vec3 amber    = vec3(0.83, 0.64, 0.25);
  vec3 amberB   = vec3(0.89, 0.71, 0.39);
  vec3 vermilion= vec3(0.77, 0.28, 0.28);

  vec3 bandCol = mix(amber, amberB, smoothstep(0.1, 0.5, uv.x));
  bandCol = mix(bandCol, vermilion, (1.0 - smoothstep(0.0, 0.06, uv.y)) * 0.55);

  vec3 col = charcoal;
  col += bandCol * band * 0.55 * breathe;
  col += amber * left * 0.16 * breathe;
  col += vermilion * right * 0.10 * breathe;

  // aurora filaments above the band (full quality only) — very low contrast
  if (uQuality > 0.5) {
    float warp = fbm(vec2(uv.x * 3.0 + t * 0.5, uv.y * 2.0 - t * 0.2));
    float fil = fbm(vec2(uv.x * 1.6 + warp * 0.6 - t * 0.15, uv.y * 3.2));
    float aboveBand = smoothstep(edge - 0.02, edge + 0.28, uv.y)
      * (1.0 - smoothstep(0.35, 0.85, uv.y));
    col += amberB * pow(fil, 2.2) * aboveBand * 0.10 * breathe;

    // pointer glow — a soft warm lift where the cursor rests
    float md = length((uv - uMouse) * vec2(aspect, 1.0));
    col += amber * exp(-4.0 * md) * 0.05;

    // dust
    col += amberB * dust(uv, uTime * 0.4) * 0.05;
  }

  // warm vignette so edges never go pure black
  float vig = 1.0 - smoothstep(0.35, 1.25, length(uv - 0.5));
  col *= mix(0.86, 1.0, vig);

  // fine animated grain to kill banding
  float g = hash(uv * uRes + fract(t) * 60.0);
  col += (g - 0.5) * 0.015;

  gl_FragColor = vec4(col, 1.0);
}`;

export default function HorizonBackground() {
  const hostRef = useRef(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    Object.assign(host.style, {
      position: "absolute",
      top: "0",
      left: "0",
      width: "1px",
      height: "100vh",
      pointerEvents: "none",
    });

    const mql = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const reduce = !!mql?.matches;
    const coarse = window.matchMedia?.("(pointer: coarse)").matches;
    const lowPower = coarse || window.innerWidth < 768;

    let renderer;
    try {
      renderer = new Renderer({
        alpha: false,
        antialias: false,
        dpr: Math.min(window.devicePixelRatio || 1, lowPower ? 1.25 : 1.75),
        depth: false,
        stencil: false,
      });
    } catch {
      setFailed(true);
      return undefined;
    }
    const gl = renderer.gl;
    if (!gl) {
      setFailed(true);
      return undefined;
    }
    gl.clearColor(0.031, 0.031, 0.039, 1);

    const canvas = gl.canvas;
    Object.assign(canvas.style, {
      position: "fixed",
      inset: "0",
      width: "100%",
      height: "100%",
      zIndex: "-3",
      pointerEvents: "none",
      display: "block",
    });
    host.appendChild(canvas);

    const program = new Program(gl, {
      vertex: VERT,
      fragment: FRAG,
      uniforms: {
        uTime: { value: 0 },
        uRes: { value: [window.innerWidth, window.innerHeight] },
        uMouse: { value: [0.5, 0.35] },
        uScroll: { value: 0 },
        uQuality: { value: lowPower ? 0 : 1 },
      },
    });
    const mesh = new Mesh(gl, { geometry: new Triangle(gl), program });

    const resize = () => {
      renderer.setSize(window.innerWidth, window.innerHeight);
      program.uniforms.uRes.value = [window.innerWidth, window.innerHeight];
    };
    resize();
    window.addEventListener("resize", resize);

    // damped pointer + scroll (full quality only)
    const target = [0.5, 0.35];
    const onPointer = (e) => {
      target[0] = e.clientX / window.innerWidth;
      target[1] = 1 - e.clientY / window.innerHeight;
    };
    const onScroll = () => {
      const max = document.body.scrollHeight - window.innerHeight;
      program.uniforms.uScroll.value = max > 0 ? Math.min(1, window.scrollY / max) : 0;
    };
    if (!lowPower && !reduce) {
      window.addEventListener("pointermove", onPointer, { passive: true });
      window.addEventListener("scroll", onScroll, { passive: true });
    }

    let raf = 0;
    let disposed = false;
    let suspended = false;
    let visible = false;
    const start = performance.now();
    let last = start;
    let slowFrames = 0;

    const stopAnimation = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };

    const loop = (now) => {
      if (disposed) return;
      if (!visible || suspended || document.hidden) {
        raf = 0;
        return;
      }
      const dt = now - last;
      last = now;
      // auto-downgrade if sustained < ~30fps
      if (!lowPower) {
        if (dt > 33) slowFrames++;
        else slowFrames = Math.max(0, slowFrames - 1);
        if (slowFrames > 45) program.uniforms.uQuality.value = 0;
      }
      const mx = program.uniforms.uMouse.value;
      mx[0] += (target[0] - mx[0]) * 0.06;
      mx[1] += (target[1] - mx[1]) * 0.06;
      program.uniforms.uTime.value = (now - start) / 1000;
      renderer.render({ scene: mesh });
      raf = requestAnimationFrame(loop);
    };

    const startAnimation = () => {
      if (disposed || suspended || reduce || document.hidden || !visible || raf !== 0) return;
      last = performance.now();
      raf = requestAnimationFrame(loop);
    };

    // Wait for the first observer result so an initially offscreen host never
    // spends frames before its visibility is known.
    const io = new IntersectionObserver(
      ([entry]) => {
        if (disposed) return;
        visible = entry.isIntersecting;
        if (!visible) {
          cancelAnimationFrame(raf);
          raf = 0;
          return;
        }
        startAnimation();
      },
      { threshold: 0 },
    );
    io.observe(host);

    const onVisibility = () => {
      if (disposed) return;
      if (document.hidden) stopAnimation();
      else startAnimation();
    };
    document.addEventListener("visibilitychange", onVisibility);

    if (reduce) {
      program.uniforms.uTime.value = 8;
      program.uniforms.uQuality.value = 0;
      renderer.render({ scene: mesh });
    }

    const dispose = () => {
      if (disposed) return;
      disposed = true;
      stopAnimation();
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("pageshow", onPageShow);
      document.removeEventListener("visibilitychange", onVisibility);
      io.disconnect();
      try {
        canvas.remove();
        gl.getExtension("WEBGL_lose_context")?.loseContext();
      } catch {
        // best-effort teardown
      }
    };

    const onPageHide = (event) => {
      if (event.persisted) {
        suspended = true;
        stopAnimation();
        return;
      }
      dispose();
    };

    const onPageShow = (event) => {
      if (!event.persisted || disposed) return;
      suspended = false;
      startAnimation();
    };

    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("pageshow", onPageShow);
    return dispose;
  }, []);

  if (failed) return <div className="bg-fallback" aria-hidden="true" />;
  return <div ref={hostRef} aria-hidden="true" />;
}
