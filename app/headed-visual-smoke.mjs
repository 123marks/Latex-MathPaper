import { spawn } from "node:child_process";
import { existsSync, mkdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";

async function getFreePort() {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      const port = typeof address === "object" ? address.port : 0;
      probe.close(() => resolve(port));
    });
    probe.on("error", reject);
  });
}

function browserCandidates() {
  return [
    process.env.PAPER_OS_BROWSER,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  ].filter(Boolean);
}

function findBrowser() {
  return browserCandidates().find((candidate) => existsSync(candidate));
}

function stopProcess(processHandle) {
  processHandle.stdout?.destroy();
  processHandle.stderr?.destroy();
  processHandle.stdin?.destroy();
  try {
    if (process.platform === "win32" && processHandle.pid) {
      const killer = spawn("taskkill", ["/pid", String(processHandle.pid), "/t", "/f"], {
        stdio: "ignore",
        windowsHide: true,
      });
      killer.unref();
    } else {
      processHandle.kill();
    }
    processHandle.unref();
  } catch {
    // Cleanup must not hide the real smoke failure.
  }
}

async function fetchJson(url, timeoutMs = 8000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`${url} failed: ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function waitForTabs(remotePort, appPort) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await delay(500);
    try {
      const tabs = await fetchJson(`http://127.0.0.1:${remotePort}/json`, 4000);
      const tab = tabs.find((item) => item.url?.startsWith(`http://127.0.0.1:${appPort}/`));
      if (tab?.webSocketDebuggerUrl) return tab;
    } catch {
      // Wait for DevTools to bind.
    }
  }
  throw new Error("Chrome DevTools tab did not become available");
}

function connectCdp(webSocketDebuggerUrl) {
  const socket = new WebSocket(webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  socket.addEventListener("message", (event) => {
    const data = JSON.parse(event.data);
    if (data.id && pending.has(data.id)) {
      const { resolve, reject } = pending.get(data.id);
      pending.delete(data.id);
      if (data.error) reject(new Error(data.error.message || "CDP command failed"));
      else resolve(data.result || {});
    }
  });
  return new Promise((resolve, reject) => {
    socket.addEventListener("open", () => {
      resolve({
        send(method, params = {}) {
          id += 1;
          socket.send(JSON.stringify({ id, method, params }));
          return new Promise((commandResolve, commandReject) => {
            pending.set(id, { resolve: commandResolve, reject: commandReject });
          });
        },
        close() {
          socket.close();
        },
      });
    });
    socket.addEventListener("error", () => reject(new Error("CDP websocket failed")));
  });
}

async function waitForExpression(cdp, expression, label, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = await cdp.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
    });
    if (result.result?.value) return;
    await delay(300);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

async function capture(cdp, url, screenshotPath, view) {
  await cdp.send("Page.navigate", { url });
  await delay(1600);
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 1200,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await cdp.send("Runtime.evaluate", {
    expression: "document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()",
    awaitPromise: true,
  });
  if (view) {
    await cdp.send("Runtime.evaluate", {
      expression: `window.setView ? window.setView(${JSON.stringify(view)}) : null`,
      awaitPromise: true,
    });
    await delay(800);
    const viewState = await cdp.send("Runtime.evaluate", {
      expression: "document.body.dataset.view",
      returnByValue: true,
    });
    if (viewState.result?.value !== view) {
      throw new Error(`Expected ${view} view before screenshot, got ${viewState.result?.value || "unknown"}`);
    }
  }
  if (view === "app") {
    await cdp.send("Runtime.evaluate", {
      expression: "window.loadSummary ? window.loadSummary() : Promise.resolve()",
      awaitPromise: true,
    });
    await waitForExpression(
      cdp,
      "document.body.dataset.view === 'app' && document.querySelectorAll('#stages .stage').length >= 5",
      "application workbench data",
      30000,
    );
  }
  await delay(700);
  const screenshot = await cdp.send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false,
    fromSurface: true,
  });
  writeFileSync(screenshotPath, Buffer.from(screenshot.data, "base64"));
  if (!existsSync(screenshotPath) || statSync(screenshotPath).size < 20_000) {
    throw new Error(`Screenshot was not created or is too small: ${screenshotPath}`);
  }
}

const browser = findBrowser();
const strict = process.env.PAPER_OS_HEADED_STRICT === "1";
if (!browser) {
  const message = "Headed visual smoke SKIP: no Chrome/Edge browser found. Set PAPER_OS_BROWSER to enable it.";
  if (strict) throw new Error(message);
  console.log(message);
  process.exit(0);
}

const appPort = await getFreePort();
const remotePort = await getFreePort();
const server = spawn("node", ["app/server.mjs"], {
  env: { ...process.env, PAPER_OS_PORT: String(appPort) },
  stdio: ["ignore", "pipe", "pipe"],
  windowsHide: true,
});
const profileDir = join(tmpdir(), `paper-os-headed-${process.pid}-${Date.now()}`);
const browserProcess = spawn(browser, [
  `--remote-debugging-port=${remotePort}`,
  `--user-data-dir=${profileDir}`,
  "--no-first-run",
  "--no-default-browser-check",
  "--window-size=1440,1200",
  `http://127.0.0.1:${appPort}/`,
], {
  stdio: ["ignore", "pipe", "pipe"],
  windowsHide: false,
});

try {
  const tab = await waitForTabs(remotePort, appPort);
  const cdp = await connectCdp(tab.webSocketDebuggerUrl);
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");

  const outDir = join("dist", "visual-qa");
  mkdirSync(outDir, { recursive: true });
  const homepage = join(outDir, "headed-homepage.png");
  const app = join(outDir, "headed-app.png");
  await capture(cdp, `http://127.0.0.1:${appPort}/`, homepage, "home");
  await capture(cdp, `http://127.0.0.1:${appPort}/#app`, app, "app");
  cdp.close();

  console.log("Headed visual smoke OK");
  console.log(`Browser: ${browser}`);
  console.log(`Homepage screenshot: ${homepage}`);
  console.log(`Application screenshot: ${app}`);
} catch (error) {
  const message = `Headed visual smoke ${strict ? "FAILED" : "SKIP"}: ${error.message}`;
  if (strict) throw new Error(message);
  console.log(message);
} finally {
  stopProcess(browserProcess);
  stopProcess(server);
  try {
    rmSync(profileDir, { recursive: true, force: true });
  } catch {
    // Best-effort cleanup.
  }
}
