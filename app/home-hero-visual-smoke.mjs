import { spawn } from "node:child_process";
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
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import { connectCdp } from "./lib/cdp-client.mjs";
import { stableEvidenceSha256 } from "./lib/visual-evidence.mjs";

const targetUrl = process.argv[2] || "http://127.0.0.1:5174/";
const target = new URL(targetUrl);
const outputDir = resolve("dist/visual-qa");
const viewports = [[1440, 900], [1100, 720], [820, 800], [390, 844]];

function findBrowser() {
  return [
    process.env.PAPER_OS_BROWSER,
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  ].filter(Boolean).find((candidate) => existsSync(candidate));
}

async function freePort() {
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

async function waitForTab(port) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    await delay(250);
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json`);
      const tabs = await response.json();
      const tab = tabs.find((candidate) => candidate.type === "page" && candidate.webSocketDebuggerUrl);
      if (tab) return tab;
    } catch {
      // DevTools is still binding.
    }
  }
  throw new Error("Browser DevTools tab did not become available");
}

async function evaluate(cdp, expression) {
  const result = await cdp.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    const detail = result.exceptionDetails.exception?.description || result.exceptionDetails.text;
    throw new Error(`Browser evaluation failed: ${detail}`);
  }
  return result.result?.value;
}

async function waitForExpression(cdp, expression, label, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await evaluate(cdp, expression)) return;
    await delay(150);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

function artifact(filePath) {
  const data = readFileSync(filePath);
  return {
    path: filePath.replaceAll("\\", "/"),
    bytes: data.byteLength,
    sha256: createHash("sha256").update(data).digest("hex"),
  };
}

async function captureViewport(cdp, width, height) {
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await cdp.send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: "no-preference" }],
  });
  await cdp.send("Page.navigate", { url: targetUrl });
  await waitForExpression(
    cdp,
    "Boolean(document.querySelector('.hero-mock-assistant'))",
    `${width}x${height} Hero render`,
  );
  await evaluate(cdp, "document.fonts?.ready || Promise.resolve()");
  await delay(1400);
  await evaluate(cdp, "window.scrollTo(0, 0); true");

  const metrics = await evaluate(cdp, `(() => {
    const rect = (selector) => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const box = element.getBoundingClientRect();
      return { left: box.left, top: box.top, right: box.right, bottom: box.bottom, width: box.width, height: box.height };
    };
    const overlap = (a, b) => Boolean(
      a && b && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
    );
    const important = [
      ".hero-title",
      ".hero-foil",
      ".hero-sub",
      ".hero-platform",
      ".hero-meta",
      ".hero-actions .btn",
      ".feature h3",
      ".feature p",
      ".workflow-ribbon__card h3",
      ".workflow-ribbon__card p",
      ".workflow-ribbon__card code",
      ".workflow-ribbon__evidence",
      ".home-comparison .tbl-wrap",
      ".logo-wall li",
      ".faq__item > summary span",
      ".faq__answer p",
      ".cta-band h2",
      ".cta-band p",
      ".cta-band__actions .btn",
    ];
    const clipped = important.flatMap((selector) => [...document.querySelectorAll(selector)])
      .map((element) => {
        const box = element.getBoundingClientRect();
        const range = document.createRange();
        range.selectNodeContents(element);
        const text = range.getBoundingClientRect();
        const style = getComputedStyle(element);
        const clipsVertically = style.overflowY === "hidden" || style.overflowY === "clip";
        const exceeds = text.left < box.left - 1
          || text.right > box.right + 1
          || (clipsVertically && (text.top < box.top - 1 || text.bottom > box.bottom + 1));
        return exceeds ? {
          selector: element.matches(".btn") ? ".hero-actions .btn" : "." + element.classList[0],
          text: element.textContent.trim(),
          box: { left: box.left, top: box.top, right: box.right, bottom: box.bottom },
          textBox: { left: text.left, top: text.top, right: text.right, bottom: text.bottom },
        } : null;
      })
      .filter(Boolean);
    const outOfBounds = [
      ".hero-title",
      ".hero-actions",
      ".hero-platform",
      ".hero-meta",
      ".hero-mock",
      ".feature",
      ".workflow-ribbon__card",
      ".workflow-ribbon__evidence",
      ".home-comparison .tbl-wrap",
      ".logo-wall",
      ".faq",
      ".cta-band",
    ].flatMap((selector) => [...document.querySelectorAll(selector)].map((element) => {
      const box = element.getBoundingClientRect();
      return { selector, box: { left: box.left, top: box.top, right: box.right, bottom: box.bottom, width: box.width, height: box.height } };
    })).filter(({ box }) => box.left < -1 || box.right > innerWidth + 1);
    const copy = rect(".hero-inner > div:first-child");
    const mock = rect(".hero-stage");
    const paneRects = [
      ".hero-mock-tree",
      ".hero-mock-editor",
      ".hero-mock-pdf",
      ".hero-mock-assistant",
    ].map((selector) => ({ selector, box: rect(selector) }));
    const workflowTrack = document.querySelector(".workflow-ribbon__track");
    const workflowColumns = workflowTrack
      ? getComputedStyle(workflowTrack).gridTemplateColumns.trim().split(/\\s+/).filter(Boolean).length
      : 0;
    const faqHeights = [...document.querySelectorAll(".faq__item > summary")]
      .map((summary) => summary.getBoundingClientRect().height);
    const workflowVisibleConnectors = [...document.querySelectorAll(".workflow-ribbon__connector")]
      .filter((connector) => getComputedStyle(connector).display !== "none");
    const workflowConnectorThicknesses = workflowVisibleConnectors.map((connector) => {
        const box = connector.getBoundingClientRect();
        return Math.min(box.width, box.height);
      });
    const comparisonCaption = rect(".home-comparison .tbl caption");
    const comparisonWrap = rect(".home-comparison .tbl-wrap");
    return {
      width: innerWidth,
      height: innerHeight,
      scrollWidth: document.documentElement.scrollWidth,
      scrollHeight: document.documentElement.scrollHeight,
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
      clipped,
      outOfBounds,
      copy,
      mock,
      copyMockOverlap: overlap(copy, mock),
      paneRects,
      publicSections: {
        featureCount: document.querySelectorAll(".feature").length,
        workflowNodeCount: document.querySelectorAll(".workflow-ribbon__node").length,
        workflowConnectorCount: document.querySelectorAll(".workflow-ribbon__connector").length,
        workflowEvidenceCount: document.querySelectorAll(".workflow-ribbon__evidence-item").length,
        workflowColumns,
        workflowVisibleConnectorCount: workflowVisibleConnectors.length,
        workflowConnectorThickness: workflowConnectorThicknesses.length
          ? Math.min(...workflowConnectorThicknesses)
          : 0,
        faqCount: document.querySelectorAll(".faq__item").length,
        faqMinimumHeight: faqHeights.length ? Math.min(...faqHeights) : 0,
        comparisonExists: Boolean(document.querySelector(".home-comparison .tbl-wrap")),
        comparisonCaptionWidthRatio: comparisonCaption && comparisonWrap
          ? comparisonCaption.width / comparisonWrap.width
          : 0,
        logoWallExists: Boolean(document.querySelector(".logo-wall")),
        ctaExists: Boolean(document.querySelector(".cta-band")),
      },
      layout: innerWidth >= 1200 ? "columns" : "stack",
      truth: document.querySelector(".hero")?.textContent || "",
      workflowExists: Boolean(document.querySelector("#workflow")),
      workflowHref: document.querySelector('.hero-actions [href="#workflow"]')?.getAttribute("href"),
      navLinksDisplay: getComputedStyle(document.querySelector(".nav-links")).display,
      menuToggleDisplay: getComputedStyle(document.querySelector(".menu-toggle")).display,
    };
  })()`);

  if (metrics.horizontalOverflow || metrics.clipped.length || metrics.outOfBounds.length) {
    throw new Error(`${width}x${height} overflow or clipping: ${JSON.stringify(metrics)}`);
  }
  const expectedWorkflowColumns = width <= 640 ? 1 : width <= 1080 ? 2 : 5;
  const expectedVisibleWorkflowConnectors = width <= 640 || width > 1080 ? 4 : 0;
  if (
    metrics.publicSections.featureCount !== 6
    || metrics.publicSections.workflowNodeCount !== 5
    || metrics.publicSections.workflowConnectorCount !== 4
    || metrics.publicSections.workflowEvidenceCount !== 4
    || metrics.publicSections.workflowColumns !== expectedWorkflowColumns
    || metrics.publicSections.workflowVisibleConnectorCount !== expectedVisibleWorkflowConnectors
    || (expectedVisibleWorkflowConnectors > 0
      && metrics.publicSections.workflowConnectorThickness < 1.9)
    || metrics.publicSections.faqCount !== 4
    || metrics.publicSections.faqMinimumHeight < 44
    || !metrics.publicSections.comparisonExists
    || metrics.publicSections.comparisonCaptionWidthRatio < 0.9
    || !metrics.publicSections.logoWallExists
    || !metrics.publicSections.ctaExists
  ) {
    throw new Error(`${width}x${height} public-section contract failed: ${JSON.stringify(metrics.publicSections)}`);
  }
  if (
    !metrics.workflowExists
    || metrics.workflowHref !== "#workflow"
    || !metrics.truth.includes("Windows 开发预览")
    || !metrics.truth.includes("macOS/Linux 规划中")
    || !metrics.truth.includes("Preview → Apply")
  ) {
    throw new Error(`${width}x${height} product truth contract failed`);
  }
  if (metrics.copyMockOverlap) {
    throw new Error(`${width}x${height} Hero copy and product preview overlap`);
  }
  if (
    width <= 880
      ? metrics.navLinksDisplay !== "none" || metrics.menuToggleDisplay === "none"
      : metrics.navLinksDisplay === "none" || metrics.menuToggleDisplay !== "none"
  ) {
    throw new Error(width + "x" + height + " public navigation breakpoint contract failed");
  }
  const mockVisibleHeight = Math.max(
    0,
    Math.min(height, metrics.mock.bottom) - Math.max(0, metrics.mock.top),
  );
  metrics.mockVisibleHeight = mockVisibleHeight;
  if (mockVisibleHeight < 72) {
    throw new Error(
      `${width}x${height} product preview is not visible enough in the first viewport: ${mockVisibleHeight}px`,
    );
  }
  if (width >= 1200 && Math.abs(metrics.copy.top - metrics.mock.top) > 150) {
    throw new Error(`${width}x${height} desktop columns are misaligned`);
  }
  if (width < 1200 && metrics.mock.top < metrics.copy.bottom + 20) {
    throw new Error(`${width}x${height} stacked Hero spacing collapsed`);
  }
  if (metrics.paneRects.some(({ box }) => !box || box.width < 40 || box.height < 40)) {
    throw new Error(`${width}x${height} product preview pane collapsed`);
  }

  const screenshotPath = join(outputDir, `home-hero-${width}x${height}.png`);
  const screenshot = await cdp.send("Page.captureScreenshot", {
    captureBeyondViewport: false,
    format: "png",
    fromSurface: true,
  });
  writeFileSync(screenshotPath, Buffer.from(screenshot.data, "base64"));
  if (statSync(screenshotPath).size < 10_000) {
    throw new Error(`${width}x${height} screenshot is blank`);
  }

  const revealTargetCount = await evaluate(cdp, `(() => {
    document.documentElement.dataset.previousScrollBehavior = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = "auto";
    return document.querySelectorAll([
      ".section-head",
      ".feature-slot",
      ".workflow-ribbon__card",
      ".home-comparison",
      ".home-audience",
      ".home-faq-layout > div",
      ".cta-band",
    ].join(",")).length;
  })()`);
  for (let index = 0; index < revealTargetCount; index += 1) {
    await evaluate(cdp, `(() => {
      const targets = document.querySelectorAll([
        ".section-head",
        ".feature-slot",
        ".workflow-ribbon__card",
        ".home-comparison",
        ".home-audience",
        ".home-faq-layout > div",
        ".cta-band",
      ].join(","));
      targets[${index}]?.scrollIntoView({ block: "center" });
      return true;
    })()`);
    await delay(70);
  }
  await waitForExpression(
    cdp,
    `(() => {
      const cta = document.querySelector(".cta-band");
      const reveal = cta?.parentElement;
      return Boolean(cta && reveal && Number.parseFloat(getComputedStyle(reveal).opacity) >= 0.99);
    })()`,
    `${width}x${height} CTA Reveal visibility`,
  );
  const captureVisibility = await evaluate(cdp, `(() => {
    const cta = document.querySelector(".cta-band");
    const reveal = cta?.parentElement;
    const result = {
      revealTargetCount: ${revealTargetCount},
      ctaOpacity: reveal ? Number.parseFloat(getComputedStyle(reveal).opacity) : 0,
      ctaHeight: cta?.getBoundingClientRect().height || 0,
    };
    return result;
  })()`);
  await evaluate(cdp, "window.scrollTo(0, 0); true");
  await waitForExpression(cdp, "scrollY === 0", `${width}x${height} full-page capture top baseline`);
  captureVisibility.fullPageScrollY = await evaluate(cdp, "scrollY");
  await evaluate(cdp, `(() => {
    document.documentElement.style.scrollBehavior = document.documentElement.dataset.previousScrollBehavior || "";
    delete document.documentElement.dataset.previousScrollBehavior;
    return true;
  })()`);
  await delay(100);
  const layoutMetrics = await cdp.send("Page.getLayoutMetrics");
  const contentSize = layoutMetrics.cssContentSize || layoutMetrics.contentSize;
  const fullPagePath = join(outputDir, `home-full-${width}x${height}.png`);
  const fullPage = await cdp.send("Page.captureScreenshot", {
    captureBeyondViewport: true,
    clip: {
      x: 0,
      y: 0,
      width: Math.ceil(contentSize.width),
      height: Math.ceil(contentSize.height),
      scale: 1,
    },
    format: "png",
    fromSurface: true,
  });
  writeFileSync(fullPagePath, Buffer.from(fullPage.data, "base64"));
  if (statSync(fullPagePath).size < 30_000) {
    throw new Error(`${width}x${height} full-page screenshot is blank`);
  }

  return {
    ...metrics,
    captureVisibility,
    screenshot: artifact(screenshotPath),
    fullPage: { screenshot: artifact(fullPagePath) },
  };
}

async function verifyAnchor(cdp) {
  const previousScrollBehavior = await evaluate(cdp, `(() => {
    const previous = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = "auto";
    history.replaceState(null, "", location.pathname + location.search);
    window.scrollTo(0, 0);
    return previous;
  })()`);
  await waitForExpression(cdp, "window.scrollY === 0", "anchor top baseline");
  await evaluate(cdp, "document.querySelector('.hero-actions [href=\"#workflow\"]')?.click(); true");
  await waitForExpression(cdp, "location.hash === '#workflow'", "workflow hash");
  await delay(100);
  const result = await evaluate(cdp, `(() => {
    const target = document.querySelector("#workflow");
    return {
      hash: location.hash,
      top: target?.getBoundingClientRect().top,
      targetOffsetTop: target?.offsetTop,
      scrollY,
      viewport: innerHeight,
    };
  })()`);
  await evaluate(
    cdp,
    `document.documentElement.style.scrollBehavior = ${JSON.stringify(previousScrollBehavior)}; true`,
  );
  if (result.top < 60 || result.top > 160) {
    throw new Error(`Workflow anchor is obscured or misaligned: ${JSON.stringify(result)}`);
  }
  return result;
}

async function verifyReducedMotion(cdp) {
  await cdp.send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: "reduce" }],
  });
  await cdp.send("Page.navigate", { url: `${target.origin}/?hero-qa=reduced` });
  await waitForExpression(cdp, "Boolean(document.querySelector('.hero-mock'))", "reduced-motion Hero");
  await delay(100);
  const before = await evaluate(cdp, `(() => {
    const stageElement = document.querySelector(".hero-stage-wrap");
    const stage = stageElement ? getComputedStyle(stageElement) : null;
    return {
      query: matchMedia("(prefers-reduced-motion: reduce)").matches,
      heroMotion: document.querySelector(".hero")?.dataset.motion,
      scrollBehavior: getComputedStyle(document.documentElement).scrollBehavior,
      traceAnimation: getComputedStyle(document.querySelector(".trace-badge-spin")).animationName,
      connectorAnimations: [...document.querySelectorAll(".workflow-ribbon__connector")]
        .map((connector) => getComputedStyle(connector).animationName),
      ctaGlowAnimation: getComputedStyle(document.querySelector(".cta-band__glow")).animationName,
      transitionMs: getComputedStyle(document.querySelector(".hero-actions .btn")).transitionDuration,
      stageTransform: stage?.transform,
      stageOpacity: stage?.opacity,
    };
  })()`);
  await evaluate(cdp, "window.scrollTo(0, 180); true");
  await delay(250);
  const after = await evaluate(cdp, `(() => {
    const stageElement = document.querySelector(".hero-stage-wrap");
    const stage = stageElement ? getComputedStyle(stageElement) : null;
    return { stageTransform: stage?.transform, stageOpacity: stage?.opacity };
  })()`);
  await evaluate(cdp, `(() => {
    document.querySelector("#workflow")?.scrollIntoView({ block: "start" });
    return true;
  })()`);
  await delay(180);
  const screenshotPath = join(outputDir, "home-workflow-reduced-390x844.png");
  const screenshot = await cdp.send("Page.captureScreenshot", {
    captureBeyondViewport: false,
    format: "png",
    fromSurface: true,
  });
  writeFileSync(screenshotPath, Buffer.from(screenshot.data, "base64"));
  const result = { ...before, after, screenshot: artifact(screenshotPath) };
  if (
    !result.query
    || result.heroMotion !== "static"
    || result.scrollBehavior !== "auto"
    || result.traceAnimation !== "none"
    || result.connectorAnimations.length !== 4
    || result.connectorAnimations.some((animation) => animation !== "none")
    || result.ctaGlowAnimation !== "none"
    || result.stageTransform !== after.stageTransform
    || result.stageOpacity !== after.stageOpacity
  ) {
    throw new Error("Reduced-motion contract failed: " + JSON.stringify(result));
  }
  return result;
}

async function verifyPublicSections(cdp) {
  await cdp.send("Page.bringToFront");
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await cdp.send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: "no-preference" }],
  });
  await cdp.send("Page.navigate", { url: `${target.origin}/?hero-qa=public-sections` });
  await waitForExpression(
    cdp,
    "document.querySelectorAll('.workflow-ribbon__node').length === 5",
    "five-node workflow",
  );
  await waitForExpression(
    cdp,
    "document.querySelectorAll('.faq__item > summary').length === 4",
    "four FAQ disclosures",
  );
  await evaluate(cdp, "document.fonts?.ready || Promise.resolve()");

  const initial = await evaluate(cdp, `(() => {
    const details = document.querySelector(".faq__item");
    const summary = details?.querySelector("summary");
    summary?.scrollIntoView({ block: "center" });
    summary?.focus();
    return {
      workflowNodes: document.querySelectorAll(".workflow-ribbon__node").length,
      workflowConnectors: document.querySelectorAll(".workflow-ribbon__connector").length,
      workflowEvidence: document.querySelectorAll(".workflow-ribbon__evidence-item").length,
      faqItems: document.querySelectorAll(".faq__item").length,
      open: Boolean(details?.open),
      focused: document.activeElement === summary,
      summaryHeight: summary?.getBoundingClientRect().height || 0,
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
    };
  })()`);
  if (
    initial.workflowNodes !== 5
    || initial.workflowConnectors !== 4
    || initial.workflowEvidence !== 4
    || initial.faqItems !== 4
    || initial.open
    || !initial.focused
    || initial.summaryHeight < 44
    || initial.horizontalOverflow
  ) {
    throw new Error("Public-section initial contract failed: " + JSON.stringify(initial));
  }

  const enter = {
    key: "Enter",
    code: "Enter",
    windowsVirtualKeyCode: 13,
    nativeVirtualKeyCode: 13,
  };
  const pressEnter = async () => {
    await cdp.send("Input.dispatchKeyEvent", { type: "rawKeyDown", ...enter });
    await cdp.send("Input.dispatchKeyEvent", {
      type: "char",
      key: "Enter",
      code: "Enter",
      text: "\r",
      unmodifiedText: "\r",
      windowsVirtualKeyCode: 13,
    });
    await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", ...enter });
  };
  await pressEnter();
  await waitForExpression(cdp, "Boolean(document.querySelector('.faq__item')?.open)", "FAQ keyboard open");
  const opened = await evaluate(cdp, `(() => {
    const details = document.querySelector(".faq__item");
    const summary = details?.querySelector("summary");
    const answer = details?.querySelector(".faq__answer p");
    return {
      open: Boolean(details?.open),
      focused: document.activeElement === summary,
      answerHeight: answer?.getBoundingClientRect().height || 0,
      answerText: answer?.textContent?.trim() || "",
    };
  })()`);
  if (!opened.open || !opened.focused || opened.answerHeight <= 0 || !opened.answerText) {
    throw new Error("FAQ keyboard-open contract failed: " + JSON.stringify(opened));
  }

  const screenshotPath = join(outputDir, "home-faq-390x844-open.png");
  const screenshot = await cdp.send("Page.captureScreenshot", {
    captureBeyondViewport: false,
    format: "png",
    fromSurface: true,
  });
  writeFileSync(screenshotPath, Buffer.from(screenshot.data, "base64"));
  if (statSync(screenshotPath).size < 10_000) {
    throw new Error("FAQ keyboard screenshot is blank");
  }

  await pressEnter();
  await waitForExpression(cdp, "!document.querySelector('.faq__item')?.open", "FAQ keyboard close");
  const closed = await evaluate(cdp, `(() => {
    const details = document.querySelector(".faq__item");
    const summary = details?.querySelector("summary");
    return { open: Boolean(details?.open), focused: document.activeElement === summary };
  })()`);
  if (closed.open || !closed.focused) {
    throw new Error("FAQ keyboard-close contract failed: " + JSON.stringify(closed));
  }

  return { initial, opened, closed, screenshot: artifact(screenshotPath) };
}

async function verifyPublicNavigation(cdp) {
  await cdp.send("Page.bringToFront");
  await cdp.send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: "no-preference" }],
  });
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 881,
    height: 800,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await cdp.send("Page.navigate", { url: target.origin + "/pricing?hero-qa=navigation-edge" });
  await waitForExpression(
    cdp,
    `Boolean(document.querySelector('a[aria-current="page"][href="/pricing"]'))`,
    "881px pricing navigation",
  );
  await evaluate(cdp, "document.fonts?.ready || Promise.resolve()");
  const desktopEdge = await evaluate(cdp, `(() => {
    const rect = (selector) => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const box = element.getBoundingClientRect();
      return { left: box.left, right: box.right, width: box.width };
    };
    const inner = document.querySelector(".nav-inner");
    const innerBox = rect(".nav-inner");
    const brandBox = rect(".brand");
    const linksBox = rect(".nav-links");
    const actionsBox = rect(".nav-actions");
    return {
      width: innerWidth,
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
      innerOverflow: inner.scrollWidth > inner.clientWidth + 1,
      innerFitsViewport: innerBox.left >= -1 && innerBox.right <= innerWidth + 1,
      brandLinksOverlap: brandBox.right > linksBox.left + 1,
      linksActionsOverlap: linksBox.right > actionsBox.left + 1,
      brandLinksGap: linksBox.left - brandBox.right,
      linksActionsGap: actionsBox.left - linksBox.right,
      navLinksDisplay: getComputedStyle(document.querySelector(".nav-links")).display,
      menuToggleDisplay: getComputedStyle(document.querySelector(".menu-toggle")).display,
    };
  })()`);
  if (
    desktopEdge.horizontalOverflow
    || desktopEdge.innerOverflow
    || !desktopEdge.innerFitsViewport
    || desktopEdge.brandLinksOverlap
    || desktopEdge.linksActionsOverlap
    || desktopEdge.navLinksDisplay === "none"
    || desktopEdge.menuToggleDisplay !== "none"
  ) {
    throw new Error("881px desktop navigation contract failed: " + JSON.stringify(desktopEdge));
  }

  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 1100,
    height: 720,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await cdp.send("Page.navigate", { url: target.origin + "/pricing?hero-qa=navigation" });
  await waitForExpression(
    cdp,
    "Boolean(document.querySelector('a[aria-current=\"page\"][href=\"/pricing\"]'))",
    "pricing current navigation",
  );
  await evaluate(cdp, "document.fonts?.ready || Promise.resolve()");
  await evaluate(cdp, "document.documentElement.style.scrollBehavior = 'auto'; window.scrollTo(0, 0); true");
  await waitForExpression(cdp, "window.scrollY === 0", "navigation top baseline");

  const readNavigationState = () => evaluate(cdp, [
    "(() => {",
    "  const header = document.querySelector('.nav');",
    "  const inner = document.querySelector('.nav-inner');",
    "  const currentLinks = [...document.querySelectorAll('a[aria-current=\\\"page\\\"]')];",
    "  const current = currentLinks[0];",
    "  const primary = document.querySelector('.nav-download');",
    "  const innerStyle = getComputedStyle(inner);",
    "  const indicator = current ? getComputedStyle(current, '::after') : null;",
    "  return {",
    "    scrollY,",
    "    scrolled: header?.classList.contains('nav--scrolled') || false,",
    "    glass: inner?.classList.contains('glass-frost') || false,",
    "    innerHeight: inner?.getBoundingClientRect().height || 0,",
    "    backgroundColor: innerStyle.backgroundColor,",
    "    boxShadow: innerStyle.boxShadow,",
    "    transform: innerStyle.transform,",
    "    transitionDuration: innerStyle.transitionDuration,",
    "    currentCount: currentLinks.length,",
    "    currentHref: current?.getAttribute('href') || '',",
    "    indicatorHeight: indicator ? Number.parseFloat(indicator.height) : 0,",
    "    indicatorBackground: indicator?.backgroundColor || '',",
    "    ctaHref: primary?.getAttribute('href') || '',",
    "    ctaText: primary?.textContent?.trim() || '',",
    "    navLinksDisplay: getComputedStyle(document.querySelector('.nav-links')).display,",
    "    menuToggleDisplay: getComputedStyle(document.querySelector('.menu-toggle')).display,",
    "    horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,",
    "  };",
    "})()",
  ].join("\n"));

  await evaluate(cdp, "window.scrollTo(0, 40); true");
  await waitForExpression(
    cdp,
    "window.scrollY === 40 && !document.querySelector('.nav')?.classList.contains('nav--scrolled')",
    "40px navigation rest state",
  );
  const restAtThreshold = await readNavigationState();

  await evaluate(cdp, "window.scrollTo(0, 41); true");
  await waitForExpression(
    cdp,
    "window.scrollY === 41 && document.querySelector('.nav')?.classList.contains('nav--scrolled')",
    "41px navigation compact state",
  );
  await delay(450);
  const compact = await readNavigationState();
  const compactHeight = compact.innerHeight;
  const compactBoxShadow = compact.boxShadow;
  const contraction = restAtThreshold.innerHeight - compactHeight;

  if (
    restAtThreshold.scrolled
    || restAtThreshold.glass
    || restAtThreshold.currentCount !== 1
    || restAtThreshold.currentHref !== "/pricing"
    || restAtThreshold.indicatorHeight !== 2
    || restAtThreshold.ctaHref !== "/download"
    || restAtThreshold.ctaText !== "下载桌面端"
    || restAtThreshold.navLinksDisplay === "none"
    || restAtThreshold.menuToggleDisplay !== "none"
    || restAtThreshold.horizontalOverflow
    || !compact.scrolled
    || !compact.glass
    || contraction < 0.5
    || contraction > 3
    || compact.backgroundColor === restAtThreshold.backgroundColor
    || compactBoxShadow === "none"
    || compact.transform === "none"
  ) {
    throw new Error(
      "Public navigation contract failed: "
        + JSON.stringify({ restAtThreshold, compact, compactHeight, compactBoxShadow, contraction }),
    );
  }

  await cdp.send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: "reduce" }],
  });
  await cdp.send("Page.navigate", { url: target.origin + "/pricing?hero-qa=navigation-reduced" });
  await waitForExpression(
    cdp,
    "Boolean(document.querySelector('a[aria-current=\"page\"][href=\"/pricing\"]'))",
    "reduced-motion pricing navigation",
  );
  await evaluate(cdp, "document.documentElement.style.scrollBehavior = 'auto'; window.scrollTo(0, 41); true");
  await waitForExpression(
    cdp,
    "document.querySelector('.nav')?.classList.contains('nav--scrolled')",
    "reduced-motion compact navigation",
  );
  const reduced = await readNavigationState();
  const navigationTransitionDuration = reduced.transitionDuration;
  const transitionDurationsMs = navigationTransitionDuration.split(",").map((duration) => {
    const value = Number.parseFloat(duration);
    return duration.trim().endsWith("ms") ? value : value * 1000;
  });
  if (
    !reduced.scrolled
    || !reduced.glass
    || transitionDurationsMs.length === 0
    || transitionDurationsMs.some((duration) => duration > 0.01)
  ) {
    throw new Error("Reduced-motion navigation contract failed: " + JSON.stringify(reduced));
  }

  const authBootstrap = await cdp.send("Page.addScriptToEvaluateOnNewDocument", {
    source: `(() => {
      const nativeFetch = window.fetch.bind(window);
      window.fetch = (input, init) => {
        const requestUrl = typeof input === "string" ? input : input.url;
        if (new URL(requestUrl, location.origin).pathname === "/api/auth/me") {
          return Promise.resolve(new Response(
            JSON.stringify({ user: { id: "navigation-qa", name: "QA User" } }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ));
        }
        return nativeFetch(input, init);
      };
    })();`,
  });
  let authenticated;
  try {
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 1100,
      height: 720,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await cdp.send("Page.navigate", { url: target.origin + "/pricing?hero-qa=navigation-auth" });
    await waitForExpression(
      cdp,
      `Boolean(document.querySelector('.nav-account-action[href="/app"]'))`,
      "authenticated navigation",
    );
    authenticated = await evaluate(cdp, `(() => {
      const primary = [...document.querySelectorAll(".nav-inner .btn-primary")];
      return {
        authenticatedPrimaryCount: primary.length,
        authenticatedPrimaryHref: primary[0]?.getAttribute("href") || "",
        authenticatedPrimaryText: primary[0]?.textContent?.trim() || "",
        workbenchIsSecondary: !document.querySelector('.nav-account-action[href="/app"]')
          ?.classList.contains("btn-primary"),
      };
    })()`);
  } finally {
    await cdp.send("Page.removeScriptToEvaluateOnNewDocument", {
      identifier: authBootstrap.identifier,
    });
  }
  if (
    authenticated.authenticatedPrimaryCount !== 1
    || authenticated.authenticatedPrimaryHref !== "/download"
    || authenticated.authenticatedPrimaryText !== "下载桌面端"
    || !authenticated.workbenchIsSecondary
  ) {
    throw new Error("Authenticated navigation contract failed: " + JSON.stringify(authenticated));
  }

  await cdp.send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: "no-preference" }],
  });
  await evaluate(cdp, "window.scrollTo(0, 0); true");
  return {
    desktopEdge,
    restAtThreshold,
    compact: { ...compact, compactHeight, compactBoxShadow, contraction },
    reduced: { ...reduced, navigationTransitionDuration },
    authenticated,
  };
}

async function verifyMobileMenu(cdp) {
  await cdp.send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: "no-preference" }],
  });
  const mobileWidths = [820, 390];
  const interactions = [];
  for (const width of mobileWidths) {
    const height = width === 390 ? 844 : 800;
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await cdp.send("Page.navigate", { url: target.origin + `/?hero-qa=menu-${width}` });
    await waitForExpression(
      cdp,
      "Boolean(document.querySelector('.menu-toggle'))",
      `${width}px mobile menu button`,
    );

    const initial = await evaluate(cdp, `(() => {
      const button = document.querySelector(".menu-toggle");
      return {
        navLinksDisplay: getComputedStyle(document.querySelector(".nav-links")).display,
        menuToggleDisplay: getComputedStyle(button).display,
        expanded: button.getAttribute("aria-expanded"),
        controls: button.getAttribute("aria-controls"),
        horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
      };
    })()`);
    if (
      initial.navLinksDisplay !== "none"
      || initial.menuToggleDisplay === "none"
      || initial.expanded !== "false"
      || initial.controls !== "mobile-site-nav"
      || initial.horizontalOverflow
    ) {
      throw new Error(`${width}px mobile menu initial contract failed: ${JSON.stringify(initial)}`);
    }

    await evaluate(cdp, "document.querySelector('.menu-toggle').click(); true");
    await waitForExpression(
      cdp,
      "Boolean(document.querySelector('#mobile-site-nav'))",
      `${width}px mobile menu open`,
    );
    await waitForExpression(
      cdp,
      "document.activeElement === document.querySelector('#mobile-site-nav .mobile-nav__link')",
      `${width}px mobile menu first-link focus`,
    );
    const opened = await evaluate(cdp, `(() => {
      const menu = document.querySelector("#mobile-site-nav");
      const box = menu.getBoundingClientRect();
      return {
        expanded: document.querySelector(".menu-toggle").getAttribute("aria-expanded"),
        focusedText: document.activeElement?.textContent?.trim() || "",
        firstLinkFocused: document.activeElement === menu.querySelector(".mobile-nav__link"),
        horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
        menuFitsViewport: box.left >= -1 && box.right <= innerWidth + 1,
      };
    })()`);

    await evaluate(
      cdp,
      "document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); true",
    );
    await waitForExpression(
      cdp,
      "!document.querySelector('#mobile-site-nav')",
      `${width}px mobile menu close`,
    );
    const closed = await evaluate(cdp, `(() => ({
      expanded: document.querySelector(".menu-toggle").getAttribute("aria-expanded"),
      focusRestored: document.activeElement === document.querySelector(".menu-toggle"),
    }))()`);
    if (
      opened.expanded !== "true"
      || !opened.firstLinkFocused
      || opened.horizontalOverflow
      || !opened.menuFitsViewport
      || closed.expanded !== "false"
      || !closed.focusRestored
    ) {
      throw new Error(
        `${width}px mobile menu behavior contract failed: ${JSON.stringify({ opened, closed })}`,
      );
    }
    interactions.push({ width, initial, opened, closed });
  }

  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 820,
    height: 800,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await cdp.send("Page.navigate", { url: target.origin + "/?hero-qa=menu-lifecycle" });
  await waitForExpression(cdp, "Boolean(document.querySelector('.menu-toggle'))", "lifecycle menu button");
  await evaluate(cdp, "document.querySelector('.menu-toggle').click(); true");
  await waitForExpression(cdp, "Boolean(document.querySelector('#mobile-site-nav'))", "lifecycle menu open");
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 1000,
    height: 800,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await waitForExpression(
    cdp,
    "!document.querySelector('#mobile-site-nav')",
    "mobile menu unmount after desktop resize",
  );
  const widened = await evaluate(cdp, `(() => ({
    navLinksDisplay: getComputedStyle(document.querySelector(".nav-links")).display,
    menuToggleDisplay: getComputedStyle(document.querySelector(".menu-toggle")).display,
    mobileNavMounted: Boolean(document.querySelector("#mobile-site-nav")),
    expanded: document.querySelector(".menu-toggle").getAttribute("aria-expanded"),
  }))()`);
  if (
    widened.navLinksDisplay === "none"
    || widened.menuToggleDisplay !== "none"
    || widened.mobileNavMounted
    || widened.expanded !== "false"
  ) {
    throw new Error("Desktop resize navigation contract failed: " + JSON.stringify(widened));
  }

  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 820,
    height: 800,
    deviceScaleFactor: 1,
    mobile: false,
  });
  const compactAgain = await evaluate(cdp, `(() => ({
    navLinksDisplay: getComputedStyle(document.querySelector(".nav-links")).display,
    menuToggleDisplay: getComputedStyle(document.querySelector(".menu-toggle")).display,
    mobileNavMounted: Boolean(document.querySelector("#mobile-site-nav")),
    expanded: document.querySelector(".menu-toggle").getAttribute("aria-expanded"),
  }))()`);
  if (
    compactAgain.navLinksDisplay !== "none"
    || compactAgain.menuToggleDisplay === "none"
    || compactAgain.mobileNavMounted
    || compactAgain.expanded !== "false"
  ) {
    throw new Error("Compact resize navigation contract failed: " + JSON.stringify(compactAgain));
  }

  return { interactions, widened, compactAgain };
}

const browserPath = findBrowser();
if (!browserPath) throw new Error("Chrome or Edge was not found");
const pageResponse = await fetch(targetUrl);
if (!pageResponse.ok || !(await pageResponse.text()).includes("/@vite/client")) {
  throw new Error(`${targetUrl} is not a Vite development route`);
}

mkdirSync(outputDir, { recursive: true });
const remotePort = await freePort();
const profileDir = mkdtempSync(join(tmpdir(), "paper-os-home-hero-"));
const browser = spawn(browserPath, [
  "--headless=new",
  "--disable-extensions",
  "--disable-dev-shm-usage",
  "--no-first-run",
  "--no-default-browser-check",
  `--remote-debugging-port=${remotePort}`,
  `--user-data-dir=${profileDir}`,
  "--window-size=1440,900",
  targetUrl,
], { stdio: "ignore", windowsHide: true });

let cdp;
const browserErrors = [];
try {
  const tab = await waitForTab(remotePort);
  cdp = await connectCdp(tab.webSocketDebuggerUrl);
  await Promise.all([
    cdp.send("Page.enable"),
    cdp.send("Runtime.enable"),
    cdp.send("Log.enable"),
  ]);
  cdp.on("Runtime.exceptionThrown", ({ exceptionDetails }) => {
    browserErrors.push(exceptionDetails?.exception?.description || exceptionDetails?.text || "Runtime exception");
  });
  cdp.on("Log.entryAdded", ({ entry }) => {
    if (entry?.level === "error") {
      browserErrors.push(entry.url ? entry.text + " (" + entry.url + ")" : entry.text);
    }
  });

  const captures = [];
  for (const [width, height] of viewports) {
    captures.push(await captureViewport(cdp, width, height));
  }
  const anchor = await verifyAnchor(cdp);
  const reducedMotion = await verifyReducedMotion(cdp);
  const publicSections = await verifyPublicSections(cdp);
  const mobileMenu = await verifyMobileMenu(cdp);
  const publicNavigation = await verifyPublicNavigation(cdp);
  if (browserErrors.length) {
    throw new Error(`Browser errors: ${browserErrors.join(" | ")}`);
  }

  const report = {
    generatedAt: new Date().toISOString(),
    target: { origin: target.origin, pathname: target.pathname },
    browser: (await cdp.send("Browser.getVersion")).product,
    browserErrors,
    anchor,
    reducedMotion,
    publicSections,
    mobileMenu,
    publicNavigation,
    viewports: captures,
  };
  report.evidenceSha256 = stableEvidenceSha256(report);
  const reportPath = join(outputDir, "home-hero-behavior.json");
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log("Home Hero visual smoke OK");
  console.log(JSON.stringify({ report: artifact(reportPath), viewports: captures }, null, 2));
} finally {
  cdp?.close();
  if (browser.pid) {
    const killer = spawn("taskkill", ["/pid", String(browser.pid), "/t", "/f"], {
      stdio: "ignore",
      windowsHide: true,
    });
    await new Promise((resolveStop) => killer.once("close", resolveStop));
    await delay(250);
  }
  rmSync(profileDir, { force: true, maxRetries: 4, recursive: true, retryDelay: 250 });
}
