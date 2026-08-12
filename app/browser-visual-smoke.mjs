import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { release as osRelease, tmpdir, type as osType } from "node:os";
import { join, resolve } from "node:path";
import { connectCdp } from "./lib/cdp-client.mjs";
import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";

async function getFreePort() {
  return new Promise((resolvePort, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      const port = typeof address === "object" ? address.port : 0;
      probe.close(() => resolvePort(port));
    });
  });
}

function findBrowser() {
  return [
    process.env.PAPER_OS_BROWSER,
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  ].filter(Boolean).find((candidate) => existsSync(candidate));
}

function gitOutput(args) {
  const result = spawnSync("git", args, {
    cwd: process.cwd(),
    encoding: "utf8",
    windowsHide: true,
  });
  return result.status === 0 ? result.stdout.trim() : null;
}

function collectGitState() {
  const status = gitOutput(["status", "--porcelain"]);
  return {
    commit: gitOutput(["rev-parse", "HEAD"]),
    branch: gitOutput(["branch", "--show-current"]),
    dirty: status === null ? null : status.length > 0,
  };
}

function describeArtifact(filePath) {
  const absolutePath = resolve(filePath);
  const contents = readFileSync(absolutePath);
  return {
    path: filePath.replaceAll("\\", "/"),
    bytes: contents.byteLength,
    sha256: createHash("sha256").update(contents).digest("hex"),
  };
}

async function stopProcess(processHandle) {
  if (!processHandle?.pid || processHandle.exitCode !== null) return;
  processHandle.stdout?.destroy();
  processHandle.stderr?.destroy();
  processHandle.stdin?.destroy();
  if (process.platform !== "win32") {
    processHandle.kill();
    return;
  }
  await new Promise((resolveStop) => {
    const killer = spawn("taskkill", ["/pid", String(processHandle.pid), "/t", "/f"], {
      stdio: "ignore",
      windowsHide: true,
    });
    const timeout = setTimeout(resolveStop, 4000);
    killer.once("close", () => {
      clearTimeout(timeout);
      resolveStop();
    });
    killer.once("error", () => {
      clearTimeout(timeout);
      resolveStop();
    });
  });
}

async function fetchJson(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`${url}: ${response.status} ${JSON.stringify(payload)}`);
    return { response, payload };
  } finally {
    clearTimeout(timeout);
  }
}

async function waitForHealth(port) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    await delay(250);
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/health`);
      if (response.ok) return;
    } catch {
      // The isolated server is still binding.
    }
  }
  throw new Error("Paper OS server did not become healthy");
}

async function waitForTab(remotePort) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    await delay(250);
    try {
      const { payload: tabs } = await fetchJson(`http://127.0.0.1:${remotePort}/json`, {}, 3000);
      const tab = tabs.find((candidate) => candidate.type === "page" && candidate.webSocketDebuggerUrl);
      if (tab) return tab;
    } catch {
      // DevTools is still binding.
    }
  }
  throw new Error("Browser DevTools tab did not become available");
}

async function waitForExpression(cdp, expression, label, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = await cdp.send("Runtime.evaluate", {
      expression: `Boolean(${expression})`,
      returnByValue: true,
    });
    if (result.result?.value) return;
    await delay(250);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

async function evaluateValue(cdp, expression) {
  const result = await cdp.send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails) {
    const detail = result.exceptionDetails.exception?.description || result.exceptionDetails.text;
    throw new Error(`Browser evaluation failed: ${detail}`);
  }
  return result.result?.value;
}

function horizonProbeSource({ forceWebglFailure = false } = {}) {
  const failWebgl = forceWebglFailure ? "true" : "false";
  return `(() => {
    const probe = {
      contextCount: 0,
      drawCalls: 0,
      webglFailures: 0,
      loseContextCalls: 0,
      qualityValues: [],
      lastQuality: null,
      slowFramesRemaining: 0,
      slowOffset: 0,
      hiddenOverride: null,
      horizonIntersecting: null,
      pageTransitions: [],
      bfcacheToken: null,
      intersectionEvents: 0,
      setHidden(value) {
        this.hiddenOverride = Boolean(value);
        document.dispatchEvent(new Event("visibilitychange"));
      }
    };
    Object.defineProperty(window, "__paperOsHorizonProbe", { value: probe, configurable: true });

    const NativeIntersectionObserver = window.IntersectionObserver;
    window.IntersectionObserver = class extends NativeIntersectionObserver {
      constructor(callback, options) {
        super((entries, observer) => {
          const horizonEntry = entries.find((entry) => entry.target.querySelector?.("canvas"));
          if (horizonEntry) {
            probe.horizonIntersecting = horizonEntry.isIntersecting;
            probe.intersectionEvents += 1;
          }
          callback(entries, observer);
        }, options);
      }
    };

    const qualityLocations = new WeakSet();
    const contexts = new WeakSet();
    const wrappedExtensions = new WeakSet();
    const patchContext = (Context) => {
      const prototype = Context?.prototype;
      if (!prototype || prototype.__paperOsHorizonPatched) return;
      Object.defineProperty(prototype, "__paperOsHorizonPatched", { value: true });

      const drawArrays = prototype.drawArrays;
      prototype.drawArrays = function (...args) {
        probe.drawCalls += 1;
        return drawArrays.apply(this, args);
      };

      const getUniformLocation = prototype.getUniformLocation;
      prototype.getUniformLocation = function (program, name) {
        const location = getUniformLocation.call(this, program, name);
        if (location && name === "uQuality") qualityLocations.add(location);
        return location;
      };

      const uniform1f = prototype.uniform1f;
      prototype.uniform1f = function (location, value) {
        if (location && qualityLocations.has(location)) {
          const quality = Number(value);
          probe.lastQuality = quality;
          if (probe.qualityValues.at(-1) !== quality) probe.qualityValues.push(quality);
        }
        return uniform1f.call(this, location, value);
      };

      const getExtension = prototype.getExtension;
      prototype.getExtension = function (name) {
        const extension = getExtension.call(this, name);
        if (name === "WEBGL_lose_context" && extension && !wrappedExtensions.has(extension)) {
          wrappedExtensions.add(extension);
          const loseContext = extension.loseContext.bind(extension);
          extension.loseContext = () => {
            probe.loseContextCalls += 1;
            return loseContext();
          };
        }
        return extension;
      };
    };
    patchContext(window.WebGLRenderingContext);
    patchContext(window.WebGL2RenderingContext);

    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      const normalized = String(type).toLowerCase();
      const isWebgl = normalized === "webgl" || normalized === "webgl2" || normalized === "experimental-webgl";
      if (${failWebgl} && isWebgl) {
        probe.webglFailures += 1;
        return null;
      }
      const context = getContext.call(this, type, ...args);
      if (isWebgl && context && !contexts.has(context)) {
        contexts.add(context);
        probe.contextCount += 1;
      }
      return context;
    };

    const requestFrame = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (callback) => requestFrame((now) => {
      if (probe.slowFramesRemaining > 0) {
        probe.slowFramesRemaining -= 1;
        probe.slowOffset += 50;
      }
      callback(now + probe.slowOffset);
    });

    const recordPageTransition = (event) => {
      probe.pageTransitions.push({
        type: event.type,
        persisted: event.persisted,
        at: performance.now(),
        path: location.pathname,
        drawCalls: probe.drawCalls,
        contextCount: probe.contextCount,
        loseContextCalls: probe.loseContextCalls,
        canvasCount: document.querySelectorAll("canvas").length
      });
    };
    window.addEventListener("pagehide", recordPageTransition, true);
    window.addEventListener("pageshow", recordPageTransition, true);

    const hiddenGetter = Object.getOwnPropertyDescriptor(Document.prototype, "hidden")?.get;
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get() {
        return probe.hiddenOverride === null ? Boolean(hiddenGetter?.call(document)) : probe.hiddenOverride;
      }
    });
  })();`;
}

async function installHorizonProbe(cdp, options, previousIdentifier) {
  if (previousIdentifier) {
    await cdp.send("Page.removeScriptToEvaluateOnNewDocument", { identifier: previousIdentifier });
  }
  const { identifier } = await cdp.send("Page.addScriptToEvaluateOnNewDocument", {
    source: horizonProbeSource(options),
  });
  return identifier;
}

async function horizonSnapshot(cdp) {
  return evaluateValue(cdp, `(() => {
    const probe = window.__paperOsHorizonProbe;
    const canvas = document.querySelector("canvas");
    const webgl = canvas?.getContext("webgl2") || canvas?.getContext("webgl") || null;
    const rendererInfo = webgl?.getExtension("WEBGL_debug_renderer_info") || null;
    const webglInfo = webgl ? {
      vendor: String(webgl.getParameter(webgl.VENDOR)),
      renderer: String(webgl.getParameter(webgl.RENDERER)),
      version: String(webgl.getParameter(webgl.VERSION)),
      shadingLanguageVersion: String(webgl.getParameter(webgl.SHADING_LANGUAGE_VERSION)),
      unmaskedVendor: rendererInfo ? String(webgl.getParameter(rendererInfo.UNMASKED_VENDOR_WEBGL)) : null,
      unmaskedRenderer: rendererInfo ? String(webgl.getParameter(rendererInfo.UNMASKED_RENDERER_WEBGL)) : null
    } : null;
    return {
      contextCount: probe?.contextCount ?? -1,
      drawCalls: probe?.drawCalls ?? -1,
      webglFailures: probe?.webglFailures ?? -1,
      loseContextCalls: probe?.loseContextCalls ?? -1,
      qualityValues: probe?.qualityValues ? [...probe.qualityValues] : [],
      lastQuality: probe?.lastQuality ?? null,
      horizonIntersecting: probe?.horizonIntersecting ?? null,
      intersectionEvents: probe?.intersectionEvents ?? 0,
      hidden: document.hidden,
      canvasCount: document.querySelectorAll("canvas").length,
      fallbackVisible: Boolean(document.querySelector(".bg-fallback")),
      webgl: webglInfo,
      scrollY: window.scrollY,
      maxScroll: Math.max(0, document.documentElement.scrollHeight - innerHeight)
    };
  })()`);
}

function requireBehavior(condition, message, evidence) {
  if (!condition) throw new Error(`${message}: ${JSON.stringify(evidence)}`);
}

async function measureDraws(cdp, durationMs) {
  const before = await horizonSnapshot(cdp);
  const startedAt = Date.now();
  await delay(durationMs);
  const after = await horizonSnapshot(cdp);
  const elapsedMs = Date.now() - startedAt;
  const drawDelta = after.drawCalls - before.drawCalls;
  return {
    elapsedMs,
    drawDelta,
    drawCallsPerSecond: Number(((drawDelta * 1000) / Math.max(elapsedMs, 1)).toFixed(1)),
    before,
    after,
  };
}

async function capturePage(cdp, url, screenshotPath, readyExpression, label) {
  await cdp.send("Page.navigate", { url });
  await waitForExpression(cdp, readyExpression, label);
  await cdp.send("Runtime.evaluate", {
    expression: "document.fonts?.ready || Promise.resolve()",
    awaitPromise: true,
  });
  await delay(500);

  const metricsResult = await cdp.send("Runtime.evaluate", {
    expression: `(() => ({
      path: location.pathname,
      width: innerWidth,
      height: innerHeight,
      overflowX: document.documentElement.scrollWidth > innerWidth + 1,
      title: document.title,
      canvasCount: document.querySelectorAll('canvas').length,
      h1: document.querySelector('h1')?.textContent?.trim() || ''
    }))()`,
    returnByValue: true,
  });
  const metrics = metricsResult.result?.value;
  if (!metrics || metrics.overflowX) {
    throw new Error(`${label} has invalid layout metrics: ${JSON.stringify(metrics)}`);
  }

  const screenshot = await cdp.send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false,
    fromSurface: true,
  });
  const absoluteScreenshotPath = resolve(screenshotPath);
  writeFileSync(absoluteScreenshotPath, Buffer.from(screenshot.data, "base64"));
  if (!existsSync(absoluteScreenshotPath) || statSync(absoluteScreenshotPath).size < 20_000) {
    throw new Error(`${label} screenshot is missing or blank: ${absoluteScreenshotPath}`);
  }
  return { ...metrics, artifact: describeArtifact(screenshotPath) };
}

async function verifyHorizonBehavior(cdp, baseUrl, outDir, probeIdentifier) {
  await waitForExpression(
    cdp,
    "window.__paperOsHorizonProbe?.drawCalls >= 3 && window.__paperOsHorizonProbe.horizonIntersecting === true",
    "Horizon normal animation frames",
  );
  const initial = await horizonSnapshot(cdp);
  requireBehavior(initial.contextCount === 1, "Horizon must create exactly one WebGL context", initial);
  requireBehavior(initial.canvasCount === 1, "Horizon must mount exactly one canvas", initial);
  requireBehavior(initial.lastQuality === 1, "Desktop Horizon must start at full quality", initial);
  requireBehavior(initial.horizonIntersecting === true, "Horizon host must start onscreen", initial);

  const normal = await measureDraws(cdp, 750);
  requireBehavior(normal.drawDelta > 0, "Horizon must keep drawing while visible", normal);

  await evaluateValue(cdp, "window.__paperOsHorizonProbe.setHidden(true); true");
  await delay(150);
  const hidden = await measureDraws(cdp, 350);
  requireBehavior(hidden.after.hidden === true, "Hidden-state override must be active", hidden);
  requireBehavior(hidden.drawDelta === 0, "Horizon must stop drawing while the document is hidden", hidden);
  await evaluateValue(cdp, "window.__paperOsHorizonProbe.setHidden(false); true");
  await waitForExpression(
    cdp,
    `window.__paperOsHorizonProbe.drawCalls > ${hidden.after.drawCalls + 2}`,
    "Horizon resume after visibilitychange",
  );
  const hiddenResume = await horizonSnapshot(cdp);

  requireBehavior(initial.maxScroll > 0, "Homepage must be scrollable for offscreen Horizon QA", initial);
  await evaluateValue(
    cdp,
    "document.documentElement.style.scrollBehavior = 'auto'; window.scrollTo(0, document.documentElement.scrollHeight); true",
  );
  await waitForExpression(
    cdp,
    "window.scrollY >= Math.max(0, document.documentElement.scrollHeight - innerHeight - 2)",
    "homepage bottom for offscreen Horizon QA",
  );
  await waitForExpression(
    cdp,
    "window.__paperOsHorizonProbe.horizonIntersecting === false",
    "Horizon observer offscreen state",
  );
  await delay(150);
  const offscreen = await measureDraws(cdp, 350);
  requireBehavior(offscreen.drawDelta === 0, "Horizon must stop drawing while its host is offscreen", offscreen);
  await evaluateValue(cdp, "window.scrollTo(0, 0); true");
  await waitForExpression(
    cdp,
    `window.__paperOsHorizonProbe.drawCalls > ${offscreen.after.drawCalls + 2}`,
    "Horizon resume after returning onscreen",
  );
  const offscreenResume = await horizonSnapshot(cdp);

  await evaluateValue(cdp, "window.__paperOsHorizonProbe.slowFramesRemaining = 60; true");
  await waitForExpression(
    cdp,
    "window.__paperOsHorizonProbe.lastQuality === 0",
    "Horizon slow-frame quality downgrade",
    15000,
  );
  const slowFrame = await horizonSnapshot(cdp);
  requireBehavior(
    slowFrame.qualityValues.includes(1) && slowFrame.qualityValues.includes(0),
    "Horizon must record a full-to-low quality transition",
    slowFrame,
  );

  const bfcacheBefore = await horizonSnapshot(cdp);
  const bfcacheToken = `horizon-bfcache-${Date.now()}`;
  const bfcacheNotUsed = [];
  const stopBfcacheDiagnostics = cdp.on("Page.backForwardCacheNotUsed", (event) => {
    bfcacheNotUsed.push(event);
  });
  await evaluateValue(
    cdp,
    `window.__paperOsHorizonProbe.bfcacheToken = ${JSON.stringify(bfcacheToken)}; true`,
  );
  const bfcacheAwayUrl = `${baseUrl}/features?bfcache-away=${encodeURIComponent(bfcacheToken)}`;
  await cdp.send("Page.navigate", { url: bfcacheAwayUrl });
  await waitForExpression(
    cdp,
    `location.pathname === "/features" && location.search.includes(${JSON.stringify(bfcacheToken)})`,
    "BFCache same-origin away navigation",
  );
  await evaluateValue(cdp, "history.back(); true");
  await waitForExpression(
    cdp,
    'location.pathname === "/"',
    "BFCache return navigation",
  );
  await delay(250);
  stopBfcacheDiagnostics();
  const bfcacheNavigation = await evaluateValue(cdp, `(() => {
    const probe = window.__paperOsHorizonProbe;
    const events = probe?.pageTransitions || [];
    const pagehide = [...events].reverse().find((event) => event.type === "pagehide" && event.persisted);
    const pageshow = [...events].reverse().find((event) => event.type === "pageshow" && event.persisted);
    return {
      token: probe?.bfcacheToken ?? null,
      awayUrl: ${JSON.stringify(bfcacheAwayUrl)},
      navigationType: performance.getEntriesByType("navigation")[0]?.type ?? null,
      pagehide,
      pageshow,
      notRestored: ${JSON.stringify(bfcacheNotUsed)}
    };
  })()`);
  requireBehavior(
    bfcacheNavigation.token === bfcacheToken
      && bfcacheNavigation.pagehide?.persisted === true
      && bfcacheNavigation.pageshow?.persisted === true,
    "Horizon BFCache gate must use a browser-generated back/forward restoration",
    bfcacheNavigation,
  );
  const bfcachePaused = {
    elapsedMs: Math.max(0, bfcacheNavigation.pageshow.at - bfcacheNavigation.pagehide.at),
    drawDelta: bfcacheNavigation.pageshow.drawCalls - bfcacheNavigation.pagehide.drawCalls,
    drawCallsPerSecond: 0,
    before: bfcacheNavigation.pagehide,
    after: bfcacheNavigation.pageshow,
  };
  requireBehavior(
    bfcachePaused.drawDelta === 0,
    "Horizon must pause while its page is held in BFCache",
    bfcachePaused,
  );
  requireBehavior(
    bfcachePaused.before.canvasCount === 1
      && bfcachePaused.after.canvasCount === 1
      && bfcachePaused.after.loseContextCalls === bfcacheBefore.loseContextCalls,
    "BFCache pagehide must preserve the Horizon canvas and WebGL context",
    { bfcacheBefore, bfcacheNavigation, bfcachePaused },
  );
  await waitForExpression(
    cdp,
    `window.__paperOsHorizonProbe.drawCalls > ${bfcachePaused.after.drawCalls + 2}`,
    "Horizon resume after BFCache pageshow",
  );
  const bfcacheResumed = await horizonSnapshot(cdp);
  requireBehavior(
    bfcacheResumed.canvasCount === 1 && bfcacheResumed.contextCount === 1,
    "BFCache restore must resume the existing Horizon surface",
    bfcacheResumed,
  );

  const teardownBefore = await horizonSnapshot(cdp);
  await evaluateValue(
    cdp,
    "window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: false })); true",
  );
  await delay(100);
  const teardownFirst = await horizonSnapshot(cdp);
  await delay(250);
  await evaluateValue(
    cdp,
    "window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: false })); true",
  );
  const teardownSecond = await horizonSnapshot(cdp);
  requireBehavior(teardownFirst.loseContextCalls === 1, "Horizon teardown must lose its WebGL context once", teardownFirst);
  requireBehavior(teardownFirst.canvasCount === 0, "Horizon teardown must remove its canvas", teardownFirst);
  requireBehavior(
    teardownSecond.loseContextCalls === 1 && teardownSecond.drawCalls === teardownFirst.drawCalls,
    "Horizon teardown must be idempotent and stop future draws",
    { teardownFirst, teardownSecond },
  );

  await cdp.send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: "reduce" }],
  });
  const reducedPath = join(outDir, "horizon-reduced-motion.png");
  const reducedMetrics = await capturePage(
    cdp,
    `${baseUrl}/?horizon-qa=reduced`,
    reducedPath,
    "location.search.includes('horizon-qa=reduced') && Boolean(document.querySelector('.hero')) && Boolean(document.querySelector('canvas'))",
    "reduced-motion homepage",
  );
  const reduced = await measureDraws(cdp, 350);
  requireBehavior(reduced.after.contextCount === 1, "Reduced-motion Horizon must keep one WebGL context", reduced);
  requireBehavior(reduced.after.drawCalls === 1 && reduced.drawDelta === 0, "Reduced-motion Horizon must render exactly one frame", reduced);
  requireBehavior(reduced.after.lastQuality === 0, "Reduced-motion Horizon must use low quality", reduced);

  probeIdentifier = await installHorizonProbe(cdp, { forceWebglFailure: true }, probeIdentifier);
  await cdp.send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: "no-preference" }],
  });
  const fallbackPath = join(outDir, "horizon-webgl-fallback.png");
  const fallbackMetrics = await capturePage(
    cdp,
    `${baseUrl}/?horizon-qa=fallback`,
    fallbackPath,
    "location.search.includes('horizon-qa=fallback') && Boolean(document.querySelector('.bg-fallback'))",
    "WebGL fallback homepage",
  );
  const fallback = await horizonSnapshot(cdp);
  requireBehavior(fallback.fallbackVisible, "WebGL failure must show .bg-fallback", fallback);
  requireBehavior(fallback.canvasCount === 0, "WebGL fallback must not leave a canvas", fallback);
  requireBehavior(fallback.webglFailures > 0, "WebGL failure injection must be exercised", fallback);

  const evidence = {
    initial,
    normal,
    hidden: { paused: hidden, resumed: hiddenResume },
    offscreen: { paused: offscreen, resumed: offscreenResume },
    slowFrame,
    bfcache: { before: bfcacheBefore, navigation: bfcacheNavigation, paused: bfcachePaused, resumed: bfcacheResumed },
    teardown: { before: teardownBefore, first: teardownFirst, second: teardownSecond },
    reducedMotion: { metrics: reducedMetrics, sample: reduced, screenshot: reducedPath },
    fallback: { metrics: fallbackMetrics, state: fallback, screenshot: fallbackPath },
  };
  const evidencePath = resolve(join(outDir, "horizon-behavior.json"));

  probeIdentifier = await installHorizonProbe(cdp, {}, probeIdentifier);
  return { evidence, evidencePath, probeIdentifier };
}

function cookiePair(headers, name) {
  const cookie = headers.getSetCookie().find((value) => value.startsWith(`${name}=`));
  if (!cookie) throw new Error(`Response did not return ${name}`);
  return cookie.split(";", 1)[0];
}

async function bootstrapSession(baseUrl) {
  const bootstrap = await fetchJson(`${baseUrl}/api/auth/bootstrap`);
  const bootstrapCookie = cookiePair(bootstrap.response.headers, "paper_os_local_bootstrap");
  const local = await fetchJson(`${baseUrl}/api/auth/local`, {
    method: "POST",
    headers: { Cookie: bootstrapCookie },
  });
  const sessionCookie = cookiePair(local.response.headers, "paper_os_session");
  return decodeURIComponent(sessionCookie.slice(sessionCookie.indexOf("=") + 1));
}

async function verifyWorkbenchAI(cdp, baseUrl, outDir, workspaceId) {
  const before = await evaluateValue(
    cdp,
    `fetch("/api/editor/file?workspace=${workspaceId}&path=paper/main.tex", { cache: "no-store" }).then((r) => r.json()).then((j) => j.content || "")`,
  );

  const setInput = (value) => evaluateValue(
    cdp,
    `(() => {
      const input = document.querySelector("#workbench-ai-input");
      if (!input) return false;
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
      setter.call(input, ${JSON.stringify(value)});
      input.dispatchEvent(new Event("input", { bubbles: true }));
      return true;
    })()`,
  );
  const clickSend = () => evaluateValue(
    cdp,
    `(() => {
      const input = document.querySelector("#workbench-ai-input");
      const button = input?.closest("form")?.querySelector("button[type=submit]");
      if (!button || button.disabled) return false;
      button.click();
      return true;
    })()`,
  );
  const clickButton = (label) => evaluateValue(
    cdp,
    `(() => {
      const button = [...document.querySelectorAll("button")]
        .find((candidate) => candidate.textContent.trim() === ${JSON.stringify(label)});
      if (!button || button.disabled) return false;
      button.click();
      return true;
    })()`,
  );
  const aiSnapshot = () => evaluateValue(cdp, `(() => ({
    runtime: document.querySelector("[data-runtime]")?.getAttribute("data-runtime") || "",
    runtimeText: document.querySelector("[data-runtime]")?.textContent?.trim() || "",
    planCount: document.querySelectorAll(".ai-plan .action-timeline__item").length,
    runningCount: document.querySelectorAll(".ai-plan .action-timeline__item--running").length,
    proposalState: document.querySelector(".ai-proposal__state")?.textContent?.trim() || "",
    proposalPath: document.querySelector(".ai-proposal-file code")?.textContent?.trim() || "",
    applyDisabled: Boolean([...document.querySelectorAll(".ai-proposal button")].find((button) => button.textContent.trim() === "Apply")?.disabled),
    rejectVisible: Boolean([...document.querySelectorAll(".ai-proposal button")].find((button) => button.textContent.trim() === "Reject")),
    inputDisabled: Boolean(document.querySelector("#workbench-ai-input")?.disabled),
    overflowX: document.documentElement.scrollWidth > innerWidth + 1,
    overflowElements: [...document.querySelectorAll("body *")]
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName.toLowerCase(),
          className: typeof element.className === "string" ? element.className : "",
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
        };
      })
      .filter((item) => item.left < -1 || item.right > innerWidth + 1 || item.width > innerWidth + 1)
      // Right-extending / over-wide elements are the actual scrollWidth
      // culprits; off-canvas-left (hidden menus) sort last so a truncated
      // list still shows the real offenders first.
      .sort((a, b) => Math.max(b.right - innerWidth, b.width - innerWidth)
        - Math.max(a.right - innerWidth, a.width - innerWidth))
      .slice(0, 12),
  }))()`);

  await waitForExpression(
    cdp,
    `location.pathname === "/app/workbench" && Boolean(document.querySelector("#workbench-ai-input"))`,
    "Workbench AI panel",
  );
  const providerText = await evaluateValue(
    cdp,
    `document.querySelector("[data-provider-source]")?.textContent?.trim() || ""`,
  );
  if (/online/i.test(providerText)) throw new Error("Provider chip must not claim online readiness");

  if (!await setInput("update [file:paper/main.tex]")) {
    throw new Error("Workbench AI input was not available");
  }
  if (!await clickSend()) throw new Error("Workbench AI send button was not enabled");
  await waitForExpression(
    cdp,
    `document.querySelector('[data-runtime="mock-local"]') && document.querySelector(".ai-proposal__state--ready")`,
    "mock-local proposal preview",
  );
  const ready = await aiSnapshot();
  if (
    ready.runtime !== "mock-local"
    || ready.planCount !== 4
    || ready.runningCount !== 1
    || ready.proposalState !== "ready"
    || ready.proposalPath !== "paper/main.tex"
    || ready.applyDisabled
    || !ready.rejectVisible
    || !ready.inputDisabled
    || ready.overflowX
  ) {
    throw new Error("Workbench AI ready contract failed: " + JSON.stringify(ready));
  }

  await cdp.send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: "reduce" }],
  });
  const reducedMotion = await evaluateValue(cdp, `(() => {
    const quill = document.querySelector(".ai-plan .quill-mark--thinking");
    if (!quill) return { matches: false, reason: "running quill missing" };
    const style = getComputedStyle(quill, "::before");
    const duration = style.animationDuration;
    const durationMs = duration.endsWith("ms")
      ? Number.parseFloat(duration)
      : Number.parseFloat(duration) * 1000;
    return {
      matches: matchMedia("(prefers-reduced-motion: reduce)").matches,
      animationName: style.animationName,
      animationDuration: duration,
      animationIterationCount: style.animationIterationCount,
      durationMs,
    };
  })()`);
  if (
    !reducedMotion.matches
    || reducedMotion.animationName !== "none"
    || !Number.isFinite(reducedMotion.durationMs)
    || reducedMotion.durationMs > 0.01
    || reducedMotion.animationIterationCount !== "1"
  ) {
    throw new Error("AI timeline reduced-motion contract failed: " + JSON.stringify(reducedMotion));
  }
  await cdp.send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: "no-preference" }],
  });

  const readyPath = join(outDir, "workbench-ai-ready-1440x1200.png");
  const readyShot = await cdp.send("Page.captureScreenshot", { format: "png", fromSurface: true });
  writeFileSync(readyPath, Buffer.from(readyShot.data, "base64"));

  if (!await clickButton("Reject")) throw new Error("Reject action was not available");
  await waitForExpression(cdp, `document.querySelector(".ai-proposal__state--rejected")`, "proposal rejection");
  const afterReject = await evaluateValue(
    cdp,
    `fetch("/api/editor/file?workspace=${workspaceId}&path=paper/main.tex", { cache: "no-store" }).then((r) => r.json()).then((j) => j.content || "")`,
  );
  if (afterReject !== before) throw new Error("Reject changed the Workspace file");

  if (!await setInput("update [file:paper/main.tex]")) throw new Error("AI input did not unlock after Reject");
  if (!await clickSend()) throw new Error("Second AI send button was not enabled");
  await waitForExpression(cdp, `document.querySelector(".ai-proposal__state--ready")`, "second proposal preview");
  await evaluateValue(cdp, `(() => {
    const nativeFetch = window.fetch.bind(window);
    window.__paperOsApplyTrace = [];
    window.fetch = async (...args) => {
      const [input, init] = args;
      const url = typeof input === "string" ? input : input?.url || "";
      const response = await nativeFetch(...args);
      if (url.includes("/api/editor/apply-blocks")) {
        const payload = await response.clone().json().catch(() => null);
        window.__paperOsApplyTrace.push({
          url,
          status: response.status,
          body: init?.body || null,
          payload,
        });
      }
      return response;
    };
    return true;
  })()`);
  if (!await clickButton("Apply")) throw new Error("Apply action was not available");
  await waitForExpression(cdp, `document.querySelector(".ai-proposal__state--applied")`, "proposal apply");
  const afterApply = await evaluateValue(
    cdp,
    `fetch("/api/editor/file?workspace=${workspaceId}&path=paper/main.tex", { cache: "no-store" }).then((r) => r.json()).then((j) => j.content || "")`,
  );
  await delay(100);
  const applyTrace = await evaluateValue(cdp, "window.__paperOsApplyTrace || []");
  if (afterApply === before || !afterApply.includes("Auto-drafted by Paper OS Assistant")) {
    throw new Error("Apply did not update the isolated Workspace: " + JSON.stringify({
      beforeBytes: new TextEncoder().encode(before).byteLength,
      afterApplyBytes: new TextEncoder().encode(afterApply).byteLength,
      afterApplyPreview: afterApply.slice(0, 120),
      applyTrace,
    }));
  }

  const appliedPath = join(outDir, "workbench-ai-applied-1440x1200.png");
  const appliedShot = await cdp.send("Page.captureScreenshot", { format: "png", fromSurface: true });
  writeFileSync(appliedPath, Buffer.from(appliedShot.data, "base64"));

  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await evaluateValue(cdp, `(() => {
    const panel = document.querySelector(".ai-assistant");
    panel?.scrollIntoView({ block: "start" });
    const stream = panel?.querySelector(".chat-stream");
    if (stream) stream.scrollTop = stream.scrollHeight;
    return true;
  })()`);
  await delay(350);
  const mobile = await aiSnapshot();
  if (mobile.overflowX || mobile.proposalState !== "applied") {
    throw new Error("Workbench AI mobile contract failed: " + JSON.stringify(mobile));
  }
  const mobilePath = join(outDir, "workbench-ai-applied-390x844.png");
  const mobileShot = await cdp.send("Page.captureScreenshot", { format: "png", fromSurface: true });
  writeFileSync(mobilePath, Buffer.from(mobileShot.data, "base64"));

  return {
    workspaceId,
    providerText,
    beforeBytes: new TextEncoder().encode(before).byteLength,
    afterApplyBytes: new TextEncoder().encode(afterApply).byteLength,
    ready,
    mobile,
    reducedMotion,
    applyTrace,
    artifacts: {
      ready: describeArtifact(readyPath),
      applied: describeArtifact(appliedPath),
      mobile: describeArtifact(mobilePath),
    },
  };
}

const browser = findBrowser();
const strict = process.env.PAPER_OS_BROWSER_STRICT === "1" || process.argv.includes("--strict");
const strictCommand = "node app/browser-visual-smoke.mjs --strict";
const outDir = join("dist", "visual-qa");
const evidencePath = resolve(join(outDir, "horizon-behavior.json"));
mkdirSync(outDir, { recursive: true });
rmSync(evidencePath, { force: true });
if (!browser) {
  const message = "Browser visual smoke SKIP: no Chrome/Edge browser found. Set PAPER_OS_BROWSER to enable it.";
  if (strict) throw new Error(message);
  console.log(message);
  process.exit(0);
}

const appPort = await getFreePort();
const remotePort = await getFreePort();
const stateRoot = mkdtempSync(join(tmpdir(), "paper-os-browser-visual-"));
const profileDir = join(stateRoot, "browser-profile");
const aiWorkspaceId = "ai-qa";
const aiWorkspaceRoot = join(stateRoot, "workspace-ai-qa");
mkdirSync(join(aiWorkspaceRoot, "paper"), { recursive: true });
writeFileSync(
  join(aiWorkspaceRoot, "paper", "main.tex"),
  "\\documentclass{article}\n\\begin{document}\nInitial AI QA draft.\n\\end{document}\n",
);
const server = spawn("node", ["app/server.mjs"], {
  env: {
    ...process.env,
    PAPER_OS_DATA_DIR: join(stateRoot, "data"),
    PAPER_OS_PORT: String(appPort),
  },
  stdio: ["ignore", "pipe", "pipe"],
  windowsHide: true,
});
let browserProcess;
let browserOutput = "";
let serverOutput = "";
let cdp;
let probeIdentifier;
let stage = "server health";
server.stdout.on("data", (data) => { serverOutput += data.toString(); });
server.stderr.on("data", (data) => { serverOutput += data.toString(); });

try {
  await waitForHealth(appPort);
  const baseUrl = `http://127.0.0.1:${appPort}`;
  stage = "local bootstrap";
  const token = await bootstrapSession(baseUrl);

  stage = "AI QA Workspace registration";
  await fetchJson(`${baseUrl}/api/editor/projects`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `paper_os_session=${encodeURIComponent(token)}`,
    },
    body: JSON.stringify({
      id: aiWorkspaceId,
      name: "AI panel browser QA",
      path: aiWorkspaceRoot,
      pack: "latex",
    }),
  });

  browserProcess = spawn(browser, [
    "--headless=new",
    "--disable-gpu",
    "--disable-gpu-compositing",
    "--disable-accelerated-2d-canvas",
    "--disable-accelerated-video-decode",
    "--disable-vulkan",
    "--use-gl=swiftshader",
    "--enable-unsafe-swiftshader",
    "--disable-features=VizDisplayCompositor,UseSkiaRenderer,DawnGraphite,Dawn",
    "--disable-dev-shm-usage",
    "--disable-extensions",
    "--no-first-run",
    "--no-default-browser-check",
    `--remote-debugging-port=${remotePort}`,
    `--user-data-dir=${profileDir}`,
    "--window-size=1440,1200",
    "about:blank",
  ], {
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  browserProcess.stdout.on("data", (data) => { browserOutput += data.toString(); });
  browserProcess.stderr.on("data", (data) => { browserOutput += data.toString(); });

  stage = "DevTools connection";
  const tab = await waitForTab(remotePort);
  cdp = await connectCdp(tab.webSocketDebuggerUrl);
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Network.enable");
  const browserVersion = await cdp.send("Browser.getVersion");
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 1200,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await cdp.send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: "no-preference" }],
  });
  probeIdentifier = await installHorizonProbe(cdp, {}, probeIdentifier);
  const cookie = await cdp.send("Network.setCookie", {
    name: "paper_os_session",
    value: token,
    url: baseUrl,
    httpOnly: true,
    sameSite: "Lax",
  });
  if (!cookie.success) throw new Error("CDP rejected the isolated bootstrap session cookie");

  stage = "homepage capture";
  const homePath = join(outDir, "browser-homepage.png");
  const home = await capturePage(
    cdp,
    `${baseUrl}/`,
    homePath,
    "location.pathname === '/' && Boolean(document.querySelector('.hero')) && Boolean(document.querySelector('.hero-mock'))",
    "homepage",
  );

  stage = "Horizon behavior QA";
  const horizon = await verifyHorizonBehavior(cdp, baseUrl, outDir, probeIdentifier);
  probeIdentifier = horizon.probeIdentifier;

  stage = "Workbench capture";
  const appPath = join(outDir, "browser-app.png");
  const app = await capturePage(
    cdp,
    `${baseUrl}/app/workbench?workspace=${encodeURIComponent(aiWorkspaceId)}`,
    appPath,
    "location.pathname === '/app/workbench' && Boolean(document.querySelector('.ide')) && Boolean(document.querySelector('.chat'))",
    "Workbench",
  );

  stage = "Workbench AI behavior QA";
  const workbenchAI = await verifyWorkbenchAI(cdp, baseUrl, outDir, aiWorkspaceId);

  stage = "evidence write";
  const evidence = {
    schemaVersion: 2,
    verdict: "pass",
    recordedAt: new Date().toISOString(),
    verification: {
      strict,
      strictCommand,
      argv: process.argv.slice(1),
    },
    environment: {
      node: process.version,
      os: {
        platform: process.platform,
        type: osType(),
        release: osRelease(),
        arch: process.arch,
      },
      browser: { executable: browser, ...browserVersion },
      webgl: horizon.evidence.initial.webgl,
    },
    git: collectGitState(),
    viewport: { width: 1440, height: 1200, deviceScaleFactor: 1 },
    performanceExpectation: {
      targetPresentationFps: 60,
      sampledMetric: "drawArrays calls per second",
      caveat: "SwiftShader draw-call cadence is not browser presentation FPS or physical-GPU proof.",
    },
    artifacts: {
      homepage: home.artifact,
      workbench: app.artifact,
      reducedMotion: horizon.evidence.reducedMotion.metrics.artifact,
      webglFallback: horizon.evidence.fallback.metrics.artifact,
      workbenchAIReady: workbenchAI.artifacts.ready,
      workbenchAIApplied: workbenchAI.artifacts.applied,
      workbenchAIMobile: workbenchAI.artifacts.mobile,
    },
    behavior: {
      ...horizon.evidence,
      workbenchAI,
    },
  };
  writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);

  console.log("Browser visual smoke OK");
  console.log(`Browser: ${browser}`);
  console.log(JSON.stringify({ home, app, workbenchAI }, null, 2));
  console.log(`Homepage screenshot: ${homePath}`);
  console.log(`Application screenshot: ${appPath}`);
  console.log(`Workbench AI desktop screenshot: ${workbenchAI.artifacts.applied.path}`);
  console.log(`Workbench AI mobile screenshot: ${workbenchAI.artifacts.mobile.path}`);
  console.log(`Horizon behavior evidence: ${evidencePath}`);
} catch (error) {
  const message = `Browser visual smoke ${strict ? "FAILED" : "SKIP"} at ${stage}: ${error.message}`;
  if (browserOutput.trim()) console.error(browserOutput.slice(-6000));
  if (serverOutput.trim()) console.error(serverOutput.slice(-3000));
  if (strict) throw new Error(message);
  console.log(message);
} finally {
  cdp?.close();
  await stopProcess(browserProcess);
  await stopProcess(server);
  try {
    rmSync(stateRoot, { recursive: true, force: true });
  } catch {
    // Best-effort cleanup of isolated browser/server state.
  }
}
