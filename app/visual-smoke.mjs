import { readFile, readdir } from "node:fs/promises";

// Audit the Paper OS v2 "Horizon Atelier" design-system source plus the
// produced build. Enforces the warm-amber identity (NOT purple-blue AI
// clichés), the liquid-glass material, the persistent-motion contract, the
// Quill Circle brand mark, and the editorial Playfair typography.
const styleFiles = ["tokens.css", "base.css", "components.css", "pages.css"];
const parts = await Promise.all(
  styleFiles.map((file) => readFile(`web/src/styles/${file}`, "utf-8")),
);
const css = parts.join("\n");
const indexHtml = await readFile("app/public/index.html", "utf-8");
const horizonBackground = await readFile("web/src/components/HorizonBackground.jsx", "utf-8");
const appSource = await readFile("web/src/App.jsx", "utf-8");
const siteHeader = await readFile("web/src/components/SiteHeader.jsx", "utf-8");
const brandLogo = await readFile("web/src/components/Logo.jsx", "utf-8");

function assertIncludes(label, content, markers) {
  const missing = markers.filter((m) => !content.includes(m));
  if (missing.length) {
    throw new Error(`${label} missing markers: ${missing.join(", ")}`);
  }
}

// ----- Horizon Atelier palette: deep charcoal + warm amber -----
assertIncludes("palette", css, [
  "color-scheme: dark",
  "--bg-1:",
  "--amber:",
  "--amber-bright:",
  "--vermilion:",
  "--signal:",
  "--grad-amber:",
  "--grad-horizon:",
]);

// ----- Editorial typography: Playfair display + Inter body + JetBrains mono -----
assertIncludes("typography", css, [
  "--font-display:",
  "--font-sans:",
  "--font-mono:",
  "Playfair Display",
  "Inter",
  "JetBrains Mono",
]);

// ----- Brand mark: Quill Circle (the v2 visual signature) -----
assertIncludes("quill-circle", css, [
  ".quill-circle",
  "conic-gradient",
  "@keyframes quillSpin",
  ".quill-mark",
  ".quill-glyph",
  ".quill-mark-glyph",
]);
assertIncludes("brand-logo-in-use", siteHeader, ["Logo", "Paper OS"]);
assertIncludes("brand-logo-svg", brandLogo, ["svg", "Paper OS", "linearGradient"]);

// ----- Signature Horizon Glow -----
assertIncludes("horizon-glow", css, [
  ".horizon",
  "@keyframes horizonPulse",
]);

// ----- Liquid-glass material -----
assertIncludes("liquid-glass", css, [
  "backdrop-filter",
  ".glass",
  ".glass-frost",
]);

// ----- Persistent motion system -----
assertIncludes("motion", css, [
  "@keyframes horizonPulse",
  "@keyframes quillSpin",
  "@keyframes shimmer",
  "@keyframes floatY",
  "@keyframes pulseDot",
  "@keyframes spinSlow",
  "@keyframes marquee",
  "@keyframes foilShimmer",
  "@keyframes marchAnts",
]);

// ----- Accessibility + responsiveness -----
assertIncludes("responsive/a11y", css, [
  "@media (prefers-reduced-motion: reduce)",
  "@media (max-width: 1080px)",
  "@media (max-width: 880px)",
  "@media (max-width: 640px)",
  ":focus-visible",
]);

// ----- The active WebGL horizon keeps a static accessibility/failure fallback -----
assertIncludes("webgl-horizon", horizonBackground, [
  "ogl",
  "Renderer",
  "Program",
  "prefers-reduced-motion",
  "bg-fallback",
]);
assertIncludes("horizon-in-use", appSource, ["HorizonBackground", "<HorizonBackground />"]);

// ----- SPA shell + assets -----
assertIncludes("spa shell", indexHtml, ['id="root"', "assets/"]);

const assets = await readdir("app/public/assets");
if (!assets.some((f) => f.endsWith(".css"))) throw new Error("built CSS asset missing");
if (!assets.some((f) => f.endsWith(".js"))) throw new Error("built JS asset missing");
if (!assets.some((f) => f.endsWith(".woff2"))) throw new Error("self-hosted fonts missing from build");

const keyframes = [...css.matchAll(/@keyframes\s+[a-zA-Z0-9_-]+/g)].map((m) => m[0]);
if (keyframes.length < 8) {
  throw new Error(`expected persistent motion system, found ${keyframes.length} keyframes`);
}

// ----- Anti-slop: avoid the AI-purple-blue cliché, and definitely NO jade/aurora palette -----
const badPatterns = [
  "#667eea",
  "#7c3aed",
  "font-family: Inter", // Inter is no longer the body font; variable-Inter is fine
  "font-family: Roboto",
  "--jade:", // old palette must be fully replaced
  "--grad-aurora:",
];
const present = badPatterns.filter((p) => css.includes(p));
if (present.length) {
  throw new Error(`AI-slop or legacy palette detected: ${present.join(", ")}`);
}

console.log("Visual implementation smoke OK (Horizon Atelier)");
console.log(`Keyframes: ${keyframes.length}`);
console.log(`Built assets: ${assets.length} files`);
