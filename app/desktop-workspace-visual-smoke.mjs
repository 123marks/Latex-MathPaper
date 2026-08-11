import { spawn } from "node:child_process";
import { existsSync, mkdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      const port = typeof address === "object" ? address.port : 0;
      probe.close(() => resolve(port));
    });
  });
}

function findBrowser() {
  return [
    process.env.PAPER_OS_BROWSER,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  ].filter(Boolean).find((candidate) => existsSync(candidate));
}

function stopProcess(processHandle) {
  processHandle?.stdout?.destroy();
  processHandle?.stderr?.destroy();
  try {
    if (process.platform === "win32" && processHandle?.pid) {
      const killer = spawn("taskkill", ["/pid", String(processHandle.pid), "/t", "/f"], {
        stdio: "ignore",
        windowsHide: true,
      });
      killer.unref();
    } else {
      processHandle?.kill();
    }
    processHandle?.unref();
  } catch {
    // Cleanup must not hide the visual assertion result.
  }
}

async function waitForHealth(port) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    await delay(250);
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/health`);
      if (response.ok) return;
    } catch {
      // Server is still binding.
    }
  }
  throw new Error("Paper OS server did not become healthy");
}

async function fetchJson(url, timeoutMs = 5000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`${url}: ${response.status}`);
    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function waitForTab(remotePort, appPort) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    await delay(300);
    try {
      const tabs = await fetchJson(`http://127.0.0.1:${remotePort}/json`);
      const tab = tabs.find((candidate) => candidate.url?.startsWith(`http://127.0.0.1:${appPort}/ide/`));
      if (tab?.webSocketDebuggerUrl) return tab;
    } catch {
      // DevTools is still binding.
    }
  }
  throw new Error("Browser DevTools tab did not become available");
}

function connectCdp(url) {
  const socket = new WebSocket(url);
  let commandId = 0;
  const pending = new Map();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const command = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) command.reject(new Error(message.error.message || "CDP command failed"));
    else command.resolve(message.result || {});
  });
  return new Promise((resolve, reject) => {
    socket.addEventListener("open", () => {
      resolve({
        send(method, params = {}) {
          commandId += 1;
          socket.send(JSON.stringify({ id: commandId, method, params }));
          return new Promise((commandResolve, commandReject) => {
            pending.set(commandId, { resolve: commandResolve, reject: commandReject });
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

async function waitForExpression(cdp, expression, label, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = await cdp.send("Runtime.evaluate", { expression, returnByValue: true });
    if (result.result?.value) return;
    await delay(250);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

async function captureWorkspace(cdp, outPath, width, height, mode) {
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await cdp.send("Runtime.evaluate", {
    expression: "document.fonts?.ready || Promise.resolve()",
    awaitPromise: true,
  });
  await cdp.send("Runtime.evaluate", {
    expression: `(() => {
      const chooser = document.querySelector('[data-testid="workspace-chooser"]');
      if (!chooser) document.querySelector('[aria-label="Create or register Workspace"]')?.click();
      return true;
    })()`,
    returnByValue: true,
  });
  await waitForExpression(cdp, "Boolean(document.querySelector('[data-testid=workspace-chooser]'))", "Workspace chooser");
  if (mode === "register") {
    await cdp.send("Runtime.evaluate", {
      expression: "document.querySelector('[data-testid=workspace-register]')?.click()",
    });
  }
  await delay(400);

  const metricsResult = await cdp.send("Runtime.evaluate", {
    expression: `(() => {
      const chooser = document.querySelector('.workspace-chooser');
      const rect = chooser?.getBoundingClientRect();
      return {
        width: window.innerWidth,
        height: window.innerHeight,
        pageOverflowX: document.documentElement.scrollWidth > window.innerWidth + 1,
        chooser: rect ? { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom } : null,
        packCount: document.querySelectorAll('.pack-option').length,
        workspaceCount: document.querySelectorAll('.workspace-row').length,
        modeCount: document.querySelectorAll('.workspace-mode [role=tab]').length,
        activeMode: document.querySelector('.workspace-mode [aria-selected=true]')?.dataset.testid || '',
      };
    })()`,
    returnByValue: true,
  });
  const metrics = metricsResult.result?.value;
  if (!metrics?.chooser) throw new Error(`${width}x${height}: chooser is missing`);
  if (metrics.pageOverflowX) throw new Error(`${width}x${height}: page overflows horizontally`);
  if (metrics.chooser.left < -1 || metrics.chooser.top < -1 || metrics.chooser.right > width + 1 || metrics.chooser.bottom > height + 1) {
    throw new Error(`${width}x${height}: chooser escapes viewport: ${JSON.stringify(metrics.chooser)}`);
  }
  if (metrics.packCount < 4) throw new Error(`${width}x${height}: expected at least four Packs`);
  if (metrics.modeCount !== 2) throw new Error(`${width}x${height}: expected two Workspace modes`);

  const screenshot = await cdp.send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false,
    fromSurface: true,
  });
  writeFileSync(outPath, Buffer.from(screenshot.data, "base64"));
  if (!existsSync(outPath) || statSync(outPath).size < 30_000) {
    throw new Error(`${width}x${height}: screenshot is missing or blank`);
  }
  return metrics;
}

const browser = findBrowser();
if (!browser) {
  console.log("Desktop Workspace visual smoke SKIP: Chrome or Edge was not found.");
  process.exit(0);
}

const appPort = await freePort();
const remotePort = await freePort();
const server = spawn("node", ["app/server.mjs"], {
  env: { ...process.env, PAPER_OS_PORT: String(appPort) },
  stdio: ["ignore", "pipe", "pipe"],
  windowsHide: true,
});
const profileDir = join(tmpdir(), `paper-os-workspace-visual-${process.pid}-${Date.now()}`);
let browserProcess;
let browserOutput = "";
let serverOutput = "";
let stage = "server health";
server.stdout.on("data", (data) => { serverOutput += data.toString(); });
server.stderr.on("data", (data) => { serverOutput += data.toString(); });
server.on("error", (error) => { serverOutput += `[spawn error] ${error.message}\n`; });
server.on("exit", (code, signal) => { serverOutput += `[exit] code=${code} signal=${signal}\n`; });

try {
  await waitForHealth(appPort);
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
    "--window-size=1440,900",
    `http://127.0.0.1:${appPort}/ide/`,
  ], {
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });

  browserProcess.stdout.on("data", (data) => { browserOutput += data.toString(); });
  browserProcess.stderr.on("data", (data) => { browserOutput += data.toString(); });
  stage = "DevTools connection";
  const tab = await waitForTab(remotePort, appPort);
  const cdp = await connectCdp(tab.webSocketDebuggerUrl);
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await waitForExpression(cdp, "Boolean(document.querySelector('[data-testid=workspace-switcher]'))", "desktop IDE");

  const outDir = join("dist", "visual-qa");
  mkdirSync(outDir, { recursive: true });
  const widePath = join(outDir, "desktop-workspace-1440x900.png");
  const compactPath = join(outDir, "desktop-workspace-1100x720.png");
  stage = "1440x900 create capture";
  const wide = await captureWorkspace(cdp, widePath, 1440, 900, "create");
  stage = "1100x720 register capture";
  const compact = await captureWorkspace(cdp, compactPath, 1100, 720, "register");
  cdp.close();

  console.log("Desktop Workspace visual smoke OK");
  console.log(JSON.stringify({ wide, compact }, null, 2));
  console.log(`Wide screenshot: ${widePath}`);
  console.log(`Compact screenshot: ${compactPath}`);
} catch (error) {
  console.error(`Desktop Workspace visual smoke failed at ${stage}`);
  console.error(`Browser exit code: ${browserProcess?.exitCode ?? "not started"}`);
  console.error(`Server exit code: ${server.exitCode ?? "running"}`);
  if (browserOutput.trim()) console.error(browserOutput.slice(-12000));
  if (serverOutput.trim()) console.error(serverOutput.slice(-4000));
  throw error;
} finally {
  stopProcess(browserProcess);
  stopProcess(server);
  try {
    rmSync(profileDir, { recursive: true, force: true });
  } catch {
    // Best-effort browser profile cleanup.
  }
}
