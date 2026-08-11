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
const routes = ["/login", "/register"];
const viewports = [[1440, 900], [1100, 720], [820, 800], [390, 844]];

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

function authReady(path) {
  return location.pathname === path && Boolean(document.querySelector(".auth-card"));
}

async function preparePage() {
  await (document.fonts?.ready || Promise.resolve());
  document.documentElement.style.scrollBehavior = "auto";
  window.scrollTo(0, 0);
  await new Promise((resolveWait) => setTimeout(resolveWait, 180));
  return window.scrollY;
}

function authMetrics(path) {
  const criticalSelectors = [".auth-panel", ".auth-card", ".auth-aside", ".auth-fragment", ".auth-offline"];
  const outOfBounds = criticalSelectors.flatMap((selector) => (
    [...document.querySelectorAll(selector)].map((element) => {
      const box = element.getBoundingClientRect();
      return { selector, left: box.left, right: box.right, width: box.width };
    })
  )).filter((item) => item.width > 0 && (item.left < -1 || item.right > innerWidth + 1));
  const textOverflow = [...document.querySelectorAll(
    ".auth h1,.auth h2,.auth p,.auth label,.auth button,.auth a,.auth-fragment",
  )].filter((element) => {
    const style = getComputedStyle(element);
    const box = element.getBoundingClientRect();
    return box.width > 0 && style.display !== "none" && style.visibility !== "hidden"
      && element.scrollWidth > element.clientWidth + 1;
  }).map((element) => ({
    tag: element.tagName,
    className: element.className,
    text: element.textContent.trim().slice(0, 100),
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  const touchTargets = [...document.querySelectorAll(
    ".auth-card button,.auth-card__home,.auth-offline",
  )].filter((element) => {
    const style = getComputedStyle(element);
    const box = element.getBoundingClientRect();
    return box.width > 0 && style.display !== "none" && style.visibility !== "hidden";
  }).map((element) => ({
    text: element.textContent.trim().slice(0, 80),
    height: element.getBoundingClientRect().height,
  }));
  const activeMode = document.querySelector('.auth-mode [role="radio"][aria-checked="true"]');
  const aside = document.querySelector(".auth-aside");
  const asideVisible = aside ? getComputedStyle(aside).display !== "none" : false;
  return {
    route: location.pathname,
    expectedRoute: path,
    width: innerWidth,
    height: innerHeight,
    scrollY: window.scrollY,
    scrollWidth: document.documentElement.scrollWidth,
    horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
    outOfBounds,
    textOverflow,
    minTouchTarget: touchTargets.length ? Math.min(...touchTargets.map((item) => item.height)) : null,
    touchTargets,
    modeCount: document.querySelectorAll('.auth-mode [role="radio"]').length,
    activeMode: activeMode?.textContent?.trim() || "",
    offlineHref: document.querySelector(".auth-offline")?.getAttribute("href") || "",
    offlineLabel: document.querySelector(".auth-offline")?.textContent?.trim() || "",
    providerCount: document.querySelectorAll(".sso-btn[data-auth-provider]").length,
    h1Count: document.querySelectorAll(".auth h1").length,
    asideVisible,
    fragmentCount: document.querySelectorAll(".auth-fragment").length,
    traceCount: document.querySelectorAll(".auth-trace__step").length,
    passwordCount: document.querySelectorAll('input[type="password"]').length,
  };
}

function durationToMs(value) {
  const text = String(value || "0s").trim();
  if (text.endsWith("ms")) return Number.parseFloat(text) || 0;
  if (text.endsWith("s")) return (Number.parseFloat(text) || 0) * 1000;
  return 0;
}

function reducedMotionMetrics() {
  function durationToMs(value) {
    const text = String(value || "0s").trim();
    if (text.endsWith("ms")) return Number.parseFloat(text) || 0;
    if (text.endsWith("s")) return (Number.parseFloat(text) || 0) * 1000;
    return 0;
  }

  return [".auth-mode .segmented__indicator", ".auth-fragment", ".auth-offline"].map((selector) => {
    const element = document.querySelector(selector);
    if (!element) return { selector, missing: true };
    const style = getComputedStyle(element);
    return {
      selector,
      animationDurationMs: Math.max(0, ...style.animationDuration.split(",").map(durationToMs)),
      transitionDurationMs: Math.max(0, ...style.transitionDuration.split(",").map(durationToMs)),
    };
  });
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

async function navigate(cdp, path, width, height, reducedMotion = false) {
  await configureViewport(cdp, width, height, reducedMotion);
  await cdp.send("Page.navigate", {
    url: target.origin + path + "?auth-qa=" + width + "x" + height,
  });
  await waitForFunction(cdp, authReady, path + " " + width + "x" + height + " render", [path]);
  await evaluateFunction(cdp, preparePage);
}

function artifact(filePath) {
  const data = readFileSync(filePath);
  return {
    path: filePath.split(String.fromCharCode(92)).join("/"),
    bytes: data.byteLength,
    sha256: createHash("sha256").update(data).digest("hex"),
  };
}

async function captureRoute(cdp, path, width, height) {
  await navigate(cdp, path, width, height);
  const metrics = await evaluateFunction(cdp, authMetrics, path);
  const expectedMode = path === "/login" ? "登录" : "注册";
  const expectedPasswordCount = path === "/register" ? 2 : 1;
  if (
    metrics.route !== path
    || metrics.horizontalOverflow
    || metrics.scrollY !== 0
    || metrics.outOfBounds.length
    || metrics.textOverflow.length
    || metrics.modeCount !== 2
    || metrics.activeMode !== expectedMode
    || metrics.offlineHref !== "/download"
    || !metrics.offlineLabel.includes("离线打开本地项目")
    || metrics.providerCount !== 3
    || metrics.h1Count !== 1
    || metrics.passwordCount !== expectedPasswordCount
    || (metrics.minTouchTarget != null && metrics.minTouchTarget < 43.5)
    || (width > 880 && (!metrics.asideVisible || metrics.fragmentCount !== 2 || metrics.traceCount !== 5))
    || (width <= 880 && metrics.asideVisible)
  ) {
    throw new Error(path + " " + width + "x" + height + " layout contract failed: " + JSON.stringify(metrics));
  }
  const screenshot = await cdp.send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: false,
  });
  const id = path.slice(1);
  const screenshotPath = join(outputDir, "auth-" + id + "-" + width + "x" + height + ".png");
  writeFileSync(screenshotPath, Buffer.from(screenshot.data, "base64"));
  return { ...metrics, screenshot: artifact(screenshotPath) };
}

async function pressKey(cdp, key, code, windowsVirtualKeyCode) {
  await cdp.send("Input.dispatchKeyEvent", { type: "rawKeyDown", key, code, windowsVirtualKeyCode });
  await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key, code, windowsVirtualKeyCode });
}

function setInputValue(name, value) {
  const input = document.querySelector('input[name="' + name + '"]');
  if (!input) return false;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
  setter.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  return true;
}

function registerPolicyState() {
  return {
    route: location.pathname,
    policy: document.querySelector(".auth-policy.is-error")?.textContent?.trim() || "",
    confirmation: document.querySelector(".auth-confirmation.is-error")?.textContent?.trim() || "",
    disabled: Boolean(document.querySelector('.auth-card button[type="submit"]')?.disabled),
  };
}

async function verifyInteractions(cdp) {
  await navigate(cdp, "/login", 390, 844);
  await evaluate(cdp, 'document.querySelector(".auth-mode .segmented__option.is-active").focus(); true');
  await pressKey(cdp, "ArrowRight", "ArrowRight", 39);
  await waitForFunction(cdp, function registerSelected() {
    return location.pathname === "/register"
      && document.querySelector('.auth-mode [role="radio"][aria-checked="true"]')?.textContent?.trim() === "注册";
  }, "register mode keyboard selection");

  await evaluateFunction(cdp, setInputValue, "password", "abcdefghij");
  await evaluateFunction(cdp, setInputValue, "confirmPassword", "abcdefghij");
  await waitForFunction(cdp, function oneClassRejected() {
    return document.querySelector(".auth-policy.is-error")?.textContent?.includes("至少两类");
  }, "one-class password rejection");
  const oneClass = await evaluateFunction(cdp, registerPolicyState);
  if (!oneClass.disabled) throw new Error("One-class password must disable registration");

  await evaluateFunction(cdp, setInputValue, "password", "Abcdefghij");
  await evaluateFunction(cdp, setInputValue, "confirmPassword", "Abcdefghik");
  await waitForFunction(cdp, function mismatchRejected() {
    return document.querySelector(".auth-confirmation.is-error")?.textContent?.includes("不一致");
  }, "password confirmation mismatch");
  const mismatch = await evaluateFunction(cdp, registerPolicyState);
  if (!mismatch.disabled) throw new Error("Mismatched confirmation must disable registration");

  await evaluateFunction(cdp, setInputValue, "confirmPassword", "Abcdefghij");
  await waitForFunction(cdp, function matchingAccepted() {
    return !document.querySelector(".auth-policy.is-error")
      && !document.querySelector(".auth-confirmation.is-error")
      && !document.querySelector('.auth-card button[type="submit"]')?.disabled;
  }, "matching password acceptance");
  const matching = await evaluateFunction(cdp, registerPolicyState);
  if (matching.disabled) throw new Error("Matching password must enable registration");

  await evaluate(cdp, 'document.querySelector(".auth-mode .segmented__option.is-active").focus(); true');
  await pressKey(cdp, "ArrowLeft", "ArrowLeft", 37);
  await waitForFunction(cdp, function loginSelected() {
    return location.pathname === "/login"
      && document.querySelector('.auth-mode [role="radio"][aria-checked="true"]')?.textContent?.trim() === "登录";
  }, "login mode keyboard selection");
  return { oneClass, mismatch, matching, finalRoute: await evaluate(cdp, "location.pathname") };
}

async function verifyReducedMotion(cdp) {
  await navigate(cdp, "/login", 1440, 900, true);
  const samples = await evaluateFunction(cdp, reducedMotionMetrics);
  if (samples.some((sample) => sample.missing || sample.animationDurationMs > 0.01 || sample.transitionDurationMs > 0.01)) {
    throw new Error("Reduced-motion contract failed: " + JSON.stringify(samples));
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
const profileDir = mkdtempSync(join(tmpdir(), "paper-os-auth-pages-"));
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
    if (entry?.level === "error") browserErrors.push(entry.url ? entry.text + " (" + entry.url + ")" : entry.text);
  });

  const captures = [];
  for (const path of routes) {
    for (const [width, height] of viewports) {
      captures.push(await captureRoute(cdp, path, width, height));
    }
  }
  const interactions = await verifyInteractions(cdp);
  const reducedMotion = await verifyReducedMotion(cdp);
  if (browserErrors.length) throw new Error("Browser errors: " + browserErrors.join(" | "));

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
  const reportPath = join(outputDir, "auth-pages-behavior.json");
  writeFileSync(reportPath, JSON.stringify(report, null, 2) + String.fromCharCode(10), "utf8");
  console.log("Auth pages visual smoke OK");
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
