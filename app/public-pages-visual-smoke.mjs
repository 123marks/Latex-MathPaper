import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
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
const routes = ["/features", "/pricing", "/enterprise"];
const viewports = [[1440, 900], [1100, 720], [820, 800], [390, 844]];
const routeContracts = [
  {
    id: "features",
    path: routes[0],
    readySelector: ".feature-deep-dive",
    expectedCount: 5,
    criticalSelectors: [".feature-deep-dive", ".feature-fragment", ".cta-band"],
  },
  {
    id: "pricing",
    path: routes[1],
    readySelector: ".pricing-plan",
    expectedCount: 4,
    criticalSelectors: [".pricing-plan", ".pricing-comparison .tbl-wrap", ".faq", ".cta-band"],
  },
  {
    id: "enterprise",
    path: routes[2],
    readySelector: ".enterprise-capability",
    expectedCount: 6,
    criticalSelectors: [".enterprise-capability", ".enterprise-foundation", ".enterprise-architecture", ".cta-band"],
  },
];

function findBrowser() {
  return [
    process.env.PAPER_OS_BROWSER,
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
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
      const response = await fetch("http://127.0.0.1:" + port + "/json");
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
    throw new Error("Browser evaluation failed: " + detail);
  }
  return result.result?.value;
}

async function evaluateFunction(cdp, fn, ...args) {
  const serialized = args.map((value) => JSON.stringify(value)).join(",");
  return evaluate(cdp, "(" + fn.toString() + ")(" + serialized + ")");
}

async function waitForFunction(cdp, fn, label, args = [], timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await evaluateFunction(cdp, fn, ...args)) return;
    await delay(150);
  }
  throw new Error("Timed out waiting for " + label);
}

function browserHasCount(selector, expectedCount) {
  return document.querySelectorAll(selector).length === expectedCount;
}

async function browserPrepare() {
  await (document.fonts?.ready || Promise.resolve());
  const previousScrollBehavior = document.documentElement.style.scrollBehavior;
  document.documentElement.style.scrollBehavior = "auto";
  const targets = [
    ...document.querySelectorAll(
      ".feature-deep-dive,.pricing-plan,.enterprise-capability,.enterprise-foundation,.enterprise-architecture,.faq__item,.cta-band",
    ),
  ];
  for (const element of targets) {
    element.scrollIntoView({ block: "center", behavior: "auto" });
    await new Promise((resolveWait) => setTimeout(resolveWait, 90));
  }
  window.scrollTo(0, 0);
  await new Promise((resolveWait) => setTimeout(resolveWait, 220));
  document.documentElement.style.scrollBehavior = previousScrollBehavior;
  return window.scrollY;
}

function browserMetrics(contract) {
  const outOfBounds = contract.criticalSelectors.flatMap((selector) => (
    [...document.querySelectorAll(selector)].map((element) => {
      const box = element.getBoundingClientRect();
      return {
        selector,
        left: box.left,
        right: box.right,
        width: box.width,
      };
    })
  )).filter((item) => item.width > 0 && (item.left < -1 || item.right > innerWidth + 1));

  const textOverflow = [...document.querySelectorAll(
    ".public-page h1,.public-page h2,.public-page h3,.public-page p,.public-page li,.public-page .btn,.public-page summary",
  )].filter((element) => {
    const style = getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden") return false;
    return element.scrollWidth > element.clientWidth + 1;
  }).map((element) => ({
    tag: element.tagName,
    className: element.className,
    text: element.textContent.trim().slice(0, 120),
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));

  const touchTargets = [...document.querySelectorAll(
    ".public-page .btn,.public-page summary,.pricing-controls button,.feature-deep-dive__link",
  )].filter((element) => {
    const style = getComputedStyle(element);
    const box = element.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && box.width > 0;
  }).map((element) => ({
    text: element.textContent.trim().slice(0, 80),
    height: element.getBoundingClientRect().height,
  }));

  const image = document.querySelector('img[src="/assets/feature-workbench.png"]');
  const activeBilling = document.querySelector('.pricing-controls [role="radio"][aria-checked="true"]');
  return {
    route: location.pathname,
    width: innerWidth,
    height: innerHeight,
    scrollY: window.scrollY,
    scrollWidth: document.documentElement.scrollWidth,
    scrollHeight: document.documentElement.scrollHeight,
    horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
    expectedCount: contract.expectedCount,
    actualCount: document.querySelectorAll(contract.readySelector).length,
    outOfBounds,
    textOverflow,
    minTouchTarget: touchTargets.length ? Math.min(...touchTargets.map((item) => item.height)) : null,
    touchTargets,
    image: image ? {
      complete: image.complete,
      naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight,
    } : null,
    activeBilling: activeBilling?.textContent?.trim() || null,
  };
}

function browserMotionSample(selector) {
  function durationToMs(value) {
    const text = String(value || "0s").trim();
    if (text.endsWith("ms")) return Number.parseFloat(text) || 0;
    if (text.endsWith("s")) return (Number.parseFloat(text) || 0) * 1000;
    return 0;
  }
  const element = document.querySelector(selector);
  if (!element) return null;
  const style = getComputedStyle(element);
  const animation = style.animationDuration.split(",").map(durationToMs);
  const transition = style.transitionDuration.split(",").map(durationToMs);
  return {
    route: location.pathname,
    animationDurationMs: Math.max(0, ...animation),
    transitionDurationMs: Math.max(0, ...transition),
  };
}

function browserPricingState() {
  const active = document.querySelector('.pricing-controls [role="radio"][aria-checked="true"]');
  return {
    active: active?.textContent?.trim() || "",
    period: document.querySelector(".pricing-plan.is-recommended .plan-price span")?.textContent?.trim() || "",
  };
}

function browserFaqState() {
  const first = document.querySelector(".faq__item");
  return {
    open: Boolean(first?.open),
    focused: document.activeElement === first?.querySelector("summary"),
  };
}

async function pressKey(cdp, key, code, windowsVirtualKeyCode, text = "") {
  await cdp.send("Input.dispatchKeyEvent", {
    type: "rawKeyDown",
    key,
    code,
    windowsVirtualKeyCode,
  });
  if (text) {
    await cdp.send("Input.dispatchKeyEvent", {
      type: "char",
      key,
      code,
      text,
      unmodifiedText: text,
    });
  }
  await cdp.send("Input.dispatchKeyEvent", {
    type: "keyUp",
    key,
    code,
    windowsVirtualKeyCode,
  });
}

function artifact(filePath) {
  const data = readFileSync(filePath);
  return {
    path: filePath.split(String.fromCharCode(92)).join("/"),
    bytes: data.byteLength,
    sha256: createHash("sha256").update(data).digest("hex"),
  };
}

async function configureViewport(cdp, width, height, reducedMotion = false) {
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await cdp.send("Emulation.setEmulatedMedia", {
    features: [{
      name: "prefers-reduced-motion",
      value: reducedMotion ? "reduce" : "no-preference",
    }],
  });
}

async function navigate(cdp, contract, width, height, reducedMotion = false) {
  await configureViewport(cdp, width, height, reducedMotion);
  const url = target.origin + contract.path + "?public-pages-qa=" + width + "x" + height;
  await cdp.send("Page.navigate", { url });
  await waitForFunction(
    cdp,
    browserHasCount,
    contract.id + " " + width + "x" + height + " render",
    [contract.readySelector, contract.expectedCount],
  );
  await evaluateFunction(cdp, browserPrepare);
}

async function captureRoute(cdp, contract, width, height) {
  await navigate(cdp, contract, width, height);
  const metrics = await evaluateFunction(cdp, browserMetrics, contract);
  if (
    metrics.actualCount !== metrics.expectedCount
    || metrics.horizontalOverflow
    || metrics.scrollY !== 0
    || metrics.outOfBounds.length
    || metrics.textOverflow.length
    || (metrics.minTouchTarget != null && metrics.minTouchTarget < 43.5)
    || (contract.id === "features" && (!metrics.image?.complete || metrics.image.naturalWidth < 1))
  ) {
    throw new Error(
      contract.id + " " + width + "x" + height + " layout contract failed: " + JSON.stringify(metrics),
    );
  }

  const screenshot = await cdp.send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: false,
  });
  const screenshotPath = join(outputDir, "public-" + contract.id + "-" + width + "x" + height + ".png");
  writeFileSync(screenshotPath, Buffer.from(screenshot.data, "base64"));
  return { ...metrics, screenshot: artifact(screenshotPath) };
}

async function verifyPricingInteractions(cdp) {
  const contract = routeContracts.find((item) => item.id === "pricing");
  await navigate(cdp, contract, 390, 844);
  await evaluate(
    cdp,
    'document.querySelector(".pricing-controls .segmented__option.is-active").focus(); true',
  );
  await pressKey(cdp, "ArrowRight", "ArrowRight", 39);
  await waitForFunction(
    cdp,
    function billingIsYearly() {
      return document.querySelector('.pricing-controls [role="radio"][aria-checked="true"]')?.textContent?.trim() === "年付";
    },
    "yearly billing keyboard selection",
  );
  const billing = await evaluateFunction(cdp, browserPricingState);

  await evaluate(
    cdp,
    'document.querySelector(".faq__item summary").focus(); true',
  );
  await pressKey(cdp, "Enter", "Enter", 13, String.fromCharCode(13));
  await waitForFunction(
    cdp,
    function faqIsOpen() {
      return Boolean(document.querySelector(".faq__item")?.open);
    },
    "FAQ keyboard open",
  );
  const faq = await evaluateFunction(cdp, browserFaqState);

  if (billing.active !== "年付" || !billing.period.includes("年付") || !faq.open || !faq.focused) {
    throw new Error("Pricing interaction contract failed: " + JSON.stringify({ billing, faq }));
  }
  return { billing, faq };
}

async function verifyReducedMotion(cdp) {
  const selectorByRoute = {
    features: ".feature-deep-dive",
    pricing: ".pricing-plan-reveal",
    enterprise: ".enterprise-capability-reveal",
  };
  const samples = [];
  for (const contract of routeContracts) {
    await navigate(cdp, contract, 390, 844, true);
    const sample = await evaluateFunction(cdp, browserMotionSample, selectorByRoute[contract.id]);
    if (!sample || sample.animationDurationMs > 0.01 || sample.transitionDurationMs > 0.01) {
      throw new Error("Reduced-motion contract failed: " + JSON.stringify(sample));
    }
    samples.push(sample);
  }
  return samples;
}

const browserPath = findBrowser();
if (!browserPath) throw new Error("Chrome or Edge was not found");
const pageResponse = await fetch(target.origin + "/");
if (!pageResponse.ok || !(await pageResponse.text()).includes("/@vite/client")) {
  throw new Error(target.origin + " is not a Vite development route");
}

mkdirSync(outputDir, { recursive: true });
const remotePort = await freePort();
const profileDir = mkdtempSync(join(tmpdir(), "paper-os-public-pages-"));
const browser = spawn(browserPath, [
  "--headless=new",
  "--disable-extensions",
  "--disable-dev-shm-usage",
  "--no-first-run",
  "--no-default-browser-check",
  "--remote-debugging-port=" + remotePort,
  "--user-data-dir=" + profileDir,
  "--window-size=1440,900",
  target.origin,
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
  for (const contract of routeContracts) {
    for (const [width, height] of viewports) {
      captures.push(await captureRoute(cdp, contract, width, height));
    }
  }
  const interactions = await verifyPricingInteractions(cdp);
  const reducedMotion = await verifyReducedMotion(cdp);
  if (browserErrors.length) {
    throw new Error("Browser errors: " + browserErrors.join(" | "));
  }

  const report = {
    generatedAt: new Date().toISOString(),
    target: target.origin,
    browser: (await cdp.send("Browser.getVersion")).product,
    browserErrors,
    viewports: captures,
    interactions,
    reducedMotion,
  };
  report.evidenceSha256 = stableEvidenceSha256(report);
  const reportPath = join(outputDir, "public-pages-behavior.json");
  writeFileSync(reportPath, JSON.stringify(report, null, 2) + String.fromCharCode(10), "utf8");
  console.log("Public pages visual smoke OK");
  console.log(JSON.stringify({ report: artifact(reportPath), evidenceSha256: report.evidenceSha256 }, null, 2));
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
