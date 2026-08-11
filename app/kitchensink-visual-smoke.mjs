import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import { connectCdp } from "./lib/cdp-client.mjs";

const targetUrl = process.argv[2]
  || process.env.PAPER_OS_KITCHENSINK_URL
  || "http://127.0.0.1:5174/_kitchensink";
const target = new URL(targetUrl);
const outputDir = resolve("dist/visual-qa");

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
      const tab = tabs.find((candidate) => candidate.url === targetUrl && candidate.webSocketDebuggerUrl);
      if (tab) return tab;
    } catch {
      // DevTools is still binding.
    }
  }
  throw new Error("Browser DevTools tab did not become available");
}

async function waitForExpression(cdp, expression, label, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = await cdp.send("Runtime.evaluate", { expression, returnByValue: true });
    if (result.result?.value) return;
    await delay(150);
  }
  throw new Error(`Timed out waiting for ${label}`);
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

async function press(cdp, key, modifiers = 0) {
  await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key, modifiers });
  await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key, modifiers });
}

async function clickButton(cdp, label) {
  const clicked = await evaluate(cdp, `(() => {
    const button = [...document.querySelectorAll('button')]
      .find((candidate) => candidate.textContent.trim() === ${JSON.stringify(label)});
    if (!button) return false;
    button.focus();
    button.click();
    return true;
  })()`);
  if (!clicked) throw new Error(`Button not found: ${label}`);
}

function artifact(filePath) {
  const contents = readFileSync(filePath);
  return {
    path: filePath.replaceAll("\\", "/"),
    bytes: contents.byteLength,
    sha256: createHash("sha256").update(contents).digest("hex"),
  };
}

async function capture(cdp, width, height) {
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await evaluate(cdp, "document.fonts?.ready || Promise.resolve()");
  await evaluate(cdp, `(() => {
    document.documentElement.style.scrollBehavior = "auto";
    window.scrollTo(0, 0);
    return true;
  })()`);

  await waitForExpression(cdp, "window.scrollY === 0", "page scroll reset");
  const metrics = await evaluate(cdp, `(() => {
    window.scrollTo(0, 0);
    const visibleControls = [...document.querySelectorAll('.btn,.icon-btn,.tab,.segmented__option')]
      .filter((element) => !element.disabled && element.offsetParent !== null);
    const undersized = visibleControls.filter((element) => {
      const rect = element.getBoundingClientRect();
      return rect.width < 31 || rect.height < 31;
    }).map((element) => element.outerHTML.slice(0, 160));
    const clippedText = visibleControls.filter((element) => element.scrollWidth > element.clientWidth + 1)
      .map((element) => element.textContent.trim());
    return {
      width: innerWidth,
      height: innerHeight,
      scrollY,
      kitchenTop: document.querySelector('.kitchen')?.getBoundingClientRect().top,
      headerTop: document.querySelector('.kitchen__header')?.getBoundingClientRect().top,
      scrollWidth: document.documentElement.scrollWidth,
      scrollHeight: document.documentElement.scrollHeight,
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
      sectionCount: document.querySelectorAll('.kitchen__section').length,
      cardCount: document.querySelectorAll('.kitchen__cards .card').length,
      tabCount: document.querySelectorAll('[role=tab]').length,
      radioCount: document.querySelectorAll('[role=radio]').length,
      tableCount: document.querySelectorAll('table.tbl').length,
      toastCount: document.querySelectorAll('.kitchen__toast-grid .toast').length,
      badgeCount: document.querySelectorAll('.badge').length,
      skeletonCount: document.querySelectorAll('.skeleton').length,
      meterCount: document.querySelectorAll('[role=meter]').length,
      undersized,
      clippedText,
    };
  })()`);

  if (metrics.horizontalOverflow) throw new Error(`${width}x${height}: page overflows horizontally`);
  if (metrics.sectionCount !== 3 || metrics.cardCount !== 3 || metrics.tableCount !== 2) {
    throw new Error(`${width}x${height}: component catalog is incomplete: ${JSON.stringify(metrics)}`);
  }
  if (metrics.tabCount !== 4 || metrics.radioCount !== 3 || metrics.toastCount !== 3) {
    throw new Error(`${width}x${height}: interactive state inventory is incomplete`);
  }
  if (metrics.skeletonCount < 4 || metrics.meterCount !== 2 || metrics.badgeCount < 8) {
    throw new Error(`${width}x${height}: feedback state inventory is incomplete`);
  }
  if (metrics.undersized.length > 0 || metrics.clippedText.length > 0) {
    throw new Error(`${width}x${height}: unstable controls: ${JSON.stringify({ undersized: metrics.undersized, clippedText: metrics.clippedText })}`);
  }

  const viewportPath = join(outputDir, `kitchensink-${width}x${height}-viewport.png`);
  const viewportScreenshot = await cdp.send("Page.captureScreenshot", {
    captureBeyondViewport: false,
    format: "png",
    fromSurface: true,
  });
  writeFileSync(viewportPath, Buffer.from(viewportScreenshot.data, "base64"));
  if (statSync(viewportPath).size < 10_000) throw new Error(`${width}x${height}: viewport screenshot is blank`);

  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width,
    height: metrics.scrollHeight,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await delay(200);
  const expandedViewport = await evaluate(cdp, `(() => ({
    height: innerHeight,
    scrollHeight: document.documentElement.scrollHeight,
  }))()`);
  if (expandedViewport.height < metrics.scrollHeight) {
    throw new Error(`${width}x${height}: browser did not rasterize the full document`);
  }

  const filePath = join(outputDir, `kitchensink-${width}x${height}.png`);
  const screenshot = await cdp.send("Page.captureScreenshot", {
    captureBeyondViewport: true,
    clip: { x: 0, y: 0, width, height: expandedViewport.scrollHeight, scale: 1 },
    format: "png",
    fromSurface: true,
  });
  writeFileSync(filePath, Buffer.from(screenshot.data, "base64"));
  if (statSync(filePath).size < 30_000) throw new Error(`${width}x${height}: screenshot is blank`);
  return {
    ...metrics,
    captureHeight: expandedViewport.scrollHeight,
    screenshot: artifact(filePath),
    viewportScreenshot: artifact(viewportPath),
  };
}

async function runInteractions(cdp) {
  const result = {};

  await evaluate(cdp, "document.querySelector('[role=tab]')?.focus()");
  await press(cdp, "ArrowRight");
  result.tabs = await evaluate(cdp, `(() => ({
    selected: document.querySelector('[role=tab][aria-selected=true]')?.textContent.trim(),
    focused: document.activeElement?.textContent.trim(),
  }))()`);
  if (result.tabs.selected !== "PDF 预览" || result.tabs.focused !== "PDF 预览") {
    throw new Error(`Tabs keyboard navigation failed: ${JSON.stringify(result.tabs)}`);
  }

  await evaluate(cdp, "document.querySelector('[role=radio]')?.focus()");
  await press(cdp, "ArrowRight");
  result.segmented = await evaluate(cdp, `(() => ({
    selected: document.querySelector('[role=radio][aria-checked=true]')?.textContent.trim(),
    focused: document.activeElement?.textContent.trim(),
  }))()`);
  if (result.segmented.selected !== "Pack" || result.segmented.focused !== "Pack") {
    throw new Error(`Segmented keyboard navigation failed: ${JSON.stringify(result.segmented)}`);
  }

  await evaluate(cdp, "document.querySelector('[aria-label=\"搜索 Resource\"]')?.focus()");
  await waitForExpression(cdp, "Boolean(document.querySelector('.tooltip[aria-hidden=false]'))", "keyboard tooltip");
  result.tooltipVisible = true;
  await press(cdp, "Escape");
  await waitForExpression(cdp, "document.querySelector('.tooltip[aria-hidden=true]') !== null", "tooltip dismissal");

  await clickButton(cdp, "打开 Modal");
  await waitForExpression(cdp, "Boolean(document.querySelector('.modal__panel'))", "modal");
  result.modalInitialFocus = await evaluate(cdp, "document.activeElement?.textContent.trim()");
  await evaluate(cdp, "[...document.querySelectorAll('.modal__panel button')].at(-1)?.focus()");
  await press(cdp, "Tab");
  result.modalWrappedFocus = await evaluate(cdp, "document.activeElement?.getAttribute('aria-label')");
  await press(cdp, "Escape");
  await waitForExpression(cdp, "!document.querySelector('.modal__panel')", "modal dismissal");
  result.modalRestoredFocus = await evaluate(cdp, "document.activeElement?.textContent.trim()");
  if (result.modalInitialFocus !== "继续编辑" || result.modalWrappedFocus !== "关闭对话框" || result.modalRestoredFocus !== "打开 Modal") {
    throw new Error(`Modal focus contract failed: ${JSON.stringify(result)}`);
  }

  await clickButton(cdp, "打开 Drawer");
  await waitForExpression(cdp, "Boolean(document.querySelector('.drawer__panel'))", "drawer");
  await delay(500);
  result.drawer = await evaluate(cdp, `(() => {
    const rect = document.querySelector('.drawer__panel').getBoundingClientRect();
    return {
      right: rect.right,
      width: rect.width,
      viewport: innerWidth,
      initialFocus: document.activeElement?.getAttribute('aria-label'),
    };
  })()`);
  if (Math.abs(result.drawer.right - result.drawer.viewport) > 1 || result.drawer.width < 319) {
    throw new Error(`Drawer geometry failed: ${JSON.stringify(result.drawer)}`);
  }
  await press(cdp, "Tab");
  result.drawer.wrappedFocus = await evaluate(
    cdp,
    "document.activeElement?.getAttribute('aria-label')",
  );
  await press(cdp, "Escape");
  await waitForExpression(cdp, "!document.querySelector('.drawer__panel')", "drawer dismissal");
  result.drawer.restoredFocus = await evaluate(cdp, "document.activeElement?.textContent.trim()");
  if (
    result.drawer.initialFocus !== "\u5173\u95ed\u62bd\u5c49"
    || result.drawer.wrappedFocus !== "\u5173\u95ed\u62bd\u5c49"
    || result.drawer.restoredFocus !== "\u6253\u5f00 Drawer"
  ) {
    throw new Error(`Drawer focus contract failed: ${JSON.stringify(result.drawer)}`);
  }

  await clickButton(cdp, "显示 Toast");
  await waitForExpression(cdp, "Boolean(document.querySelector('.toast-stack .toast'))", "toast");
  result.toastRole = await evaluate(cdp, "document.querySelector('.toast-stack .toast')?.getAttribute('role')");
  await evaluate(cdp, "document.querySelector('.toast-stack [aria-label=\"关闭通知\"]')?.click()");
  await waitForExpression(cdp, "!document.querySelector('.toast-stack .toast')", "toast dismissal");
  return result;
}

const browserPath = findBrowser();
if (!browserPath) throw new Error("Chrome or Edge was not found");
const pageResponse = await fetch(targetUrl);
if (!pageResponse.ok || !(await pageResponse.text()).includes("/@vite/client")) {
  throw new Error(`${targetUrl} is not a Vite development route`);
}

mkdirSync(outputDir, { recursive: true });
const remotePort = await freePort();
const profileDir = mkdtempSync(join(tmpdir(), "paper-os-kitchensink-"));
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
    if (entry?.level === "error") browserErrors.push(entry.text);
  });
  await waitForExpression(cdp, "Boolean(document.querySelector('.kitchen'))", "kitchensink render");

  const interactions = await runInteractions(cdp);
  const viewports = [];
  for (const [width, height] of [[1440, 900], [1100, 720], [390, 844]]) {
    viewports.push(await capture(cdp, width, height));
  }
  if (browserErrors.length > 0) throw new Error(`Browser errors: ${browserErrors.join(" | ")}`);

  const report = {
    generatedAt: new Date().toISOString(),
    target: { origin: target.origin, pathname: target.pathname },
    browser: (await cdp.send("Browser.getVersion")).product,
    interactions,
    browserErrors,
    viewports,
  };
  const reportPath = join(outputDir, "kitchensink-behavior.json");
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ report: artifact(reportPath), viewports }, null, 2));
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
  try {
    rmSync(profileDir, { force: true, maxRetries: 4, recursive: true, retryDelay: 250 });
  } catch (error) {
    console.warn(`Kitchensink profile cleanup warning: ${error.message}`);
  }
}
