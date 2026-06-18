import { readFile } from "node:fs/promises";

const html = await readFile("app/public/index.html", "utf-8");
const css = await readFile("app/public/styles.css", "utf-8");
const js = await readFile("app/public/app.js", "utf-8");

const htmlMarkers = [
  "Model Gateway for Competition Papers",
  "Official Site",
  "Signal relay",
  "Provider relay",
  "Research OS",
  "Application Workbench",
  "Local Runtime",
  "MathModelingPaperOS.exe",
  "runtimeUrl",
  "motion-backplane",
  "gateway-console",
  "gateway-map",
  "gateway-node",
  "route-beam",
  "live-pulse",
  "model-orbit",
  "map-grid",
  "traffic-lane",
  "request-stream",
  "relay-matrix",
  "signal-ledger",
  "stage-runway",
  "Package Submission",
  "Workflow Intelligence",
  "Contest Onboard",
  "Enter App",
  'data-view="home"',
  "viewToggle",
  "Back to Official Site",
  "ops-ribbon",
  "paper-health",
  "throughput-board",
  "tool-drawer",
  "drawer-status",
  "drawer-tabs",
  "data-drawer-tab",
  "data-drawer-panel",
  'aria-pressed="false"',
  'aria-selected="true"',
  "viewport-fit=cover",
];

const cssMarkers = [
  "@keyframes ambientSweep",
  "@keyframes particleDrift",
  "@keyframes rotateHalo",
  "@keyframes trafficFlow",
  "@keyframes streamPulse",
  "@keyframes orbitDash",
  "@keyframes tickerMove",
  "@keyframes trackRun",
  "@keyframes matrixRoute",
  "@keyframes runtimeOrbit",
  "@keyframes ribbonSweep",
  "@keyframes throughputSweep",
  "@keyframes drawerSignal",
  "@keyframes drawerPanelIn",
  "@keyframes mapSweep",
  "@keyframes beamTravel",
  "@keyframes ledgerBeat",
  "@keyframes statusSpark",
  "@media (prefers-reduced-motion: reduce)",
  "@media (max-width: 1320px)",
  "@media (max-width: 760px)",
  'body[data-view="home"] .app-shell',
  'body[data-view="app"] .official-site',
  "min-height: 44px",
  "touch-action: manipulation",
  "transform",
  "opacity",
];

const jsMarkers = [
  "setView",
  "setDrawerTab",
  "renderStages",
  "renderBlueprint",
  "package-submission",
  "loadSummary",
  "loadIntelligence",
];

function assertIncludes(label, content, markers) {
  const missing = markers.filter((marker) => !content.includes(marker));
  if (missing.length) {
    throw new Error(`${label} missing markers: ${missing.join(", ")}`);
  }
}

assertIncludes("HTML", html, htmlMarkers);
assertIncludes("CSS", css, cssMarkers);
assertIncludes("JS", js, jsMarkers);

const keyframes = [...css.matchAll(/@keyframes\s+[a-zA-Z0-9_-]+/g)].map((match) => match[0]);
if (keyframes.length < 8) {
  throw new Error(`expected persistent motion system, found ${keyframes.length} keyframes`);
}

const sectionCount = [...html.matchAll(/<section\b/g)].length;
if (sectionCount < 6) {
  throw new Error(`expected landing + app section hierarchy, found ${sectionCount} sections`);
}

const badPatterns = [
  "linear-gradient(135deg, #667eea",
  "linear-gradient(135deg, #7c3aed",
  "font-family: Inter",
  "font-family: Roboto",
  "bounce",
  "elastic",
];
const presentBadPatterns = badPatterns.filter((pattern) => css.includes(pattern) || html.includes(pattern));
if (presentBadPatterns.length) {
  throw new Error(`AI-slop pattern(s) detected: ${presentBadPatterns.join(", ")}`);
}

if (html.includes("LaTeX-first Contest Studio") || html.includes("Turn problem files, data, AI")) {
  throw new Error("old static hero copy is still present");
}

if (html.includes("flow-node")) {
  throw new Error("old flow-node preview is still present");
}

console.log("Visual implementation smoke OK");
console.log(`Sections: ${sectionCount}`);
console.log(`Keyframes: ${keyframes.length}`);
