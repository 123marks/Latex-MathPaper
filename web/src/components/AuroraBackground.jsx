import { useEffect, useRef, useState } from "react";
import { Renderer, Program, Mesh, Triangle } from "ogl";

// Brand light-field: a slow-breathing "horizon glow" rendered on the GPU.
// Deep charcoal base, a warm amber / vermilion band rising from the bottom
// third, faint drifting grain — nothing else. This replaces the old rainbow
// aurora (jade/teal/violet/rose) which fought the Horizon Atelier palette and
// read as generic "AI gradient". Falls back to a static CSS glow when WebGL is
// unavailable or the user prefers reduced motion.
const VERT = `
attribute vec2 uv;
attribute vec2 position;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}`;

const FRAG = `
precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform vec2 uRes;

float hash(vec2 p){ p = fract(p * vec2(123.34, 345.45)); p += dot(p, p + 34.345); return fract(p.x * p.y); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  float a = hash(i), b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0)), d = hash(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++){ v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }

void main(){
  vec2 uv = vUv;
  float t = uTime * 0.05;

  // --- the horizon band: warm light rising from the lower third ---
  // Its top edge undulates slowly via fbm so it reads as a living glow, not a
  // static gradient.
  float edge = 0.34
    + 0.05 * sin(uv.x * 2.0 + t * 1.4)
    + 0.08 * fbm(vec2(uv.x * 2.4 + t * 0.4, t * 0.5));
  float d = uv.y - edge;                       // d<0 below the edge
  float band = 1.0 - smoothstep(0.0, 0.42, d); // bright below edge, fades up
  band = pow(band, 1.5);

  // slow breathing of the whole field
  float breathe = 0.82 + 0.18 * sin(t * 1.7);

  // two warm light sources low-left and low-right for depth
  float left  = exp(-8.0  * length((uv - vec2(0.16, 0.10)) * vec2(uRes.x/uRes.y, 1.0)));
  float right = exp(-10.0 * length((uv - vec2(0.86, 0.06)) * vec2(uRes.x/uRes.y, 1.0)));

  vec3 charcoal = vec3(0.031, 0.031, 0.039);   // #08080a
  vec3 amber    = vec3(0.83, 0.64, 0.25);      // #d4a341
  vec3 amberB   = vec3(0.89, 0.71, 0.39);      // #e2b564
  vec3 vermilion= vec3(0.77, 0.28, 0.28);      // #c44747

  // band color: amber core, vermilion fringe near the bottom edge
  vec3 bandCol = mix(amber, amberB, smoothstep(0.1, 0.5, uv.x));
  bandCol = mix(bandCol, vermilion, (1.0 - smoothstep(0.0, 0.06, uv.y)) * 0.55);

  vec3 col = charcoal;
  col += bandCol * band * 0.55 * breathe;
  col += amber * left * 0.16 * breathe;
  col += vermilion * right * 0.10 * breathe;

  // very subtle warm vignette so edges never go pure black
  float vig = 1.0 - smoothstep(0.35, 1.25, length(uv - 0.5));
  col *= mix(0.86, 1.0, vig);

  // fine animated grain to kill banding / plastic flatness
  float g = hash(uv * uRes + fract(t) * 60.0);
  col += (g - 0.5) * 0.015;

  gl_FragColor = vec4(col, 1.0);
}`;

export default function AuroraBackground() {
  const hostRef = useRef(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    let renderer;
    let raf = 0;
    try {
      renderer = new Renderer({
        alpha: false,
        antialias: false,
        dpr: Math.min(window.devicePixelRatio || 1, 1.75),
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
      },
    });
    const mesh = new Mesh(gl, { geometry: new Triangle(gl), program });

    const resize = () => {
      renderer.setSize(window.innerWidth, window.innerHeight);
      program.uniforms.uRes.value = [window.innerWidth, window.innerHeight];
    };
    resize();
    window.addEventListener("resize", resize);

    const start = performance.now();
    const loop = (now) => {
      program.uniforms.uTime.value = (now - start) / 1000;
      renderer.render({ scene: mesh });
      raf = requestAnimationFrame(loop);
    };
    if (reduce) {
      program.uniforms.uTime.value = 8;
      renderer.render({ scene: mesh });
    } else {
      raf = requestAnimationFrame(loop);
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      try {
        canvas.remove();
        gl.getExtension("WEBGL_lose_context")?.loseContext();
      } catch {
        // best-effort teardown
      }
    };
  }, []);

  if (failed) return <div className="bg-fallback" aria-hidden="true" />;
  return <div ref={hostRef} aria-hidden="true" />;
}
