import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const smokePath = fileURLToPath(new URL("../app/browser-visual-smoke.mjs", import.meta.url));
const authSmokePath = fileURLToPath(new URL("../app/auth-visual-smoke.mjs", import.meta.url));
const source = readFileSync(smokePath, "utf8");
const packageJson = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);
const horizonSource = readFileSync(
  new URL("../web/src/components/HorizonBackground.jsx", import.meta.url),
  "utf8",
);
test("browser visual smoke script parses before the browser gate starts", () => {
  const result = spawnSync(process.execPath, ["--check", smokePath], {
    encoding: "utf8",
    windowsHide: true,
  });
  assert.equal(result.status, 0, result.stderr);
});


test("the default browser visual smoke command is strict", () => {
  assert.match(packageJson.scripts["browser-visual-smoke"], /--strict(?:\s|$)/);
  assert.doesNotMatch(packageJson.scripts["browser-visual-smoke"], /PAPER_OS_BROWSER_STRICT=0/);
});

test("the auth visual smoke has a package entry and parses before launch", () => {
  assert.equal(existsSync(authSmokePath), true);
  assert.match(packageJson.scripts["auth-visual-smoke"] || "", /app\/auth-visual-smoke\.mjs/);
  const result = spawnSync(process.execPath, ["--check", authSmokePath], {
    encoding: "utf8",
    windowsHide: true,
  });
  assert.equal(result.status, 0, result.stderr);
});

test("browser visual smoke resolves screenshot outputs before launching Chrome", () => {
  assert.match(source, /resolve\(screenshotPath\)/);
  assert.match(source, /existsSync\(absoluteScreenshotPath\)/);
  assert.match(source, /statSync\(absoluteScreenshotPath\)/);
});

test("browser visual smoke captures the authenticated Workbench, not a legacy hash", () => {
  assert.doesNotMatch(source, /\/#app/);
  assert.match(source, /\/app\/workbench/);
  assert.match(source, /api\/auth\/bootstrap/);
  assert.match(source, /paper_os_local_bootstrap/);
  assert.match(source, /api\/auth\/local/);
  assert.match(source, /paper_os_session/);
  assert.match(source, /Network\.setCookie/);
  assert.match(source, /waitForExpression/);
  assert.match(source, /document\.querySelector\(['"]\.ide['"]\)/);
  assert.match(source, /Page\.captureScreenshot/);
});

test("browser visual smoke exercises the T3.3 AI proposal lifecycle in an isolated Workspace", () => {
  assert.match(source, /workspace-ai-qa/);
  assert.match(source, /api\/editor\/projects/);
  assert.match(source, /\/app\/workbench\?workspace=/);
  assert.match(source, /verifyWorkbenchAI/);
  assert.match(source, /data-runtime=["']mock-local["']/);
  assert.match(source, /clickButton\("Reject"\)/);
  assert.match(source, /clickButton\("Apply"\)/);
  assert.match(source, /Reject changed the Workspace file/);
  assert.match(source, /Apply did not update the isolated Workspace/);
  assert.match(source, /button\.click\(\);\s*return true/);
  assert.doesNotMatch(source, /\?\.click\(\) \|\| false/);
  assert.match(source, /prefers-reduced-motion/);
  assert.match(source, /getComputedStyle\(quill, "::before"\)/);
  assert.match(source, /animationIterationCount/);
  assert.match(source, /animationName !== "none"/);
  assert.match(source, /durationMs > 0\.01/);
  assert.match(source, /width:\s*390/);
  assert.match(source, /workbenchAIReady/);
  assert.match(source, /workbenchAIMobile/);
  assert.match(source, /expression:\s*`Boolean\(\$\{expression\}\)`/);
});

test("browser visual smoke verifies every T0.3 Horizon runtime state", () => {
  assert.match(source, /Page\.addScriptToEvaluateOnNewDocument/);
  assert.match(source, /Emulation\.setEmulatedMedia/);
  assert.match(source, /visibilitychange/);
  assert.match(source, /scrollBehavior = ["']auto["']/);
  assert.match(source, /horizonIntersecting/);
  assert.match(source, /\.bg-fallback/);
  assert.match(source, /WEBGL_lose_context/);
  assert.match(source, /performance\.getEntriesByType\(["']navigation["']\)/);
  assert.match(source, /bfcacheToken/);
  assert.match(source, /Page\.backForwardCacheNotUsed/);
  assert.doesNotMatch(source, /navigationType\s*===\s*["']back_forward["']/);
  assert.match(source, /history\.back\(\)/);
  assert.match(source, /pagehide/);
  assert.match(source, /pageshow/);
  assert.doesNotMatch(
    source,
    /dispatchEvent\(new PageTransitionEvent\(["']page(?:hide|show)["'],\s*\{\s*persisted:\s*true/,
  );
  assert.match(source, /horizon-behavior\.json/);
});

test("browser visual smoke records reproducible environment and artifact evidence", () => {
  assert.match(source, /Browser\.getVersion/);
  assert.match(source, /process\.platform/);
  assert.match(source, /process\.version/);
  assert.match(source, /spawnSync/);
  assert.match(source, /UNMASKED_VENDOR_WEBGL/);
  assert.match(source, /UNMASKED_RENDERER_WEBGL/);
  assert.match(source, /drawCallsPerSecond/);
  assert.doesNotMatch(source, /framesPerSecond/);
  assert.match(source, /sha256/);
  assert.match(source, /verdict:\s*["']pass["']/);
  assert.match(source, /strictCommand/);
});

test("Horizon cancels its scheduled frame when the observer reports it offscreen", () => {
  const observerStart = horizonSource.indexOf("const io = new IntersectionObserver");
  const observerEnd = horizonSource.indexOf("io.observe(host)", observerStart);
  const observerBlock = horizonSource.slice(observerStart, observerEnd);
  assert.ok(observerStart >= 0 && observerEnd > observerStart);
  assert.match(observerBlock, /if \(!visible\)/);
  assert.match(observerBlock, /cancelAnimationFrame\(raf\)/);
  assert.match(observerBlock, /raf = 0/);
});

test("Horizon stale frame callbacks cannot restart hidden or offscreen rendering", () => {
  const loopStart = horizonSource.indexOf("const loop = (now) =>");
  const loopEnd = horizonSource.indexOf("if (reduce)", loopStart);
  const loopBlock = horizonSource.slice(loopStart, loopEnd);
  assert.ok(loopStart >= 0 && loopEnd > loopStart);
  assert.match(loopBlock, /if \(!visible \|\| suspended \|\| document\.hidden\)/);
  assert.match(loopBlock, /raf = 0/);
  assert.match(loopBlock, /return/);
});

test("Horizon waits for its first intersection result before scheduling animation", () => {
  assert.match(horizonSource, /let visible = false/);
  assert.match(horizonSource, /const startAnimation = \(\) =>/);
  assert.doesNotMatch(horizonSource, /else \{\s*raf = requestAnimationFrame\(loop\);\s*\}/);
});

test("Horizon observer target has a stable first-viewport geometry", () => {
  const styleStart = horizonSource.indexOf("Object.assign(host.style");
  const styleEnd = horizonSource.indexOf("});", styleStart);
  const styleBlock = horizonSource.slice(styleStart, styleEnd);
  assert.ok(styleStart >= 0 && styleEnd > styleStart);
  assert.match(styleBlock, /position: "absolute"/);
  assert.match(styleBlock, /height: "100vh"/);
});

test("Horizon pauses for BFCache and only disposes on a terminal pagehide", () => {
  assert.match(horizonSource, /const onPageHide = \(event\) =>/);
  assert.match(horizonSource, /if \(event\.persisted\)/);
  assert.match(horizonSource, /suspended = true/);
  assert.match(horizonSource, /const onPageShow = \(event\) =>/);
  assert.match(horizonSource, /if \(!event\.persisted \|\| disposed\) return/);
  assert.match(horizonSource, /suspended = false/);
  assert.match(horizonSource, /addEventListener\("pagehide", onPageHide/);
  assert.match(horizonSource, /addEventListener\("pageshow", onPageShow/);
  assert.match(horizonSource, /removeEventListener\("pagehide", onPageHide/);
  assert.match(horizonSource, /removeEventListener\("pageshow", onPageShow/);
  assert.match(horizonSource, /if \(disposed\) return/);
  assert.match(horizonSource, /WEBGL_lose_context/);
});
