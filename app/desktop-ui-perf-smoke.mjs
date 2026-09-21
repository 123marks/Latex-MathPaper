// Desktop IDE slice 6 smoke: viewports, emulated DPI, keyboard paths,
// and the 2MB editor open cap. Isolated data dir.
// Evidence: dist/visual-qa/desktop-ui-*.png and desktop-ui-behavior.json.
// This is CDP against /ide/, not PaperOS.exe. 800px is not a native window.

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { LAYOUT_DPI_SCALES, LAYOUT_VIEWPORTS } from "../apps/desktop/src/ui-budget.mjs";

const TEX = [
  "\\documentclass{article}",
  "\\begin{document}",
  "UI budget smoke.",
  "\\end{document}",
  "",
].join("\n");

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const port = probe.address().port;
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

function stopProcess(handle) {
  handle?.stdout?.destroy();
  handle?.stderr?.destroy();
  try {
    if (process.platform === "win32" && handle?.pid) {
      spawn("taskkill", ["/pid", String(handle.pid), "/t", "/f"], { stdio: "ignore", windowsHide: true }).unref();
    } else {
      handle?.kill();
    }
    handle?.unref();
  } catch { /* cleanup must not mask the assertion */ }
}

async function waitForHealth(port) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    await delay(250);
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/health`);
      if (response.ok) return;
    } catch { /* still binding */ }
  }
  throw new Error("Paper OS server did not become healthy");
}

async function waitForTab(remotePort, appPort) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    await delay(300);
    try {
      const response = await fetch(`http://127.0.0.1:${remotePort}/json`);
      const tabs = await response.json();
      const tab = tabs.find((candidate) => candidate.url?.startsWith(`http://127.0.0.1:${appPort}/ide/`));
      if (tab?.webSocketDebuggerUrl) return tab;
    } catch { /* DevTools still binding */ }
  }
  throw new Error("Browser DevTools tab did not become available");
}

function connectCdp(url) {
  const socket = new WebSocket(url);
  let commandId = 0;
  const pending = new Map();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const command = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) command.reject(new Error(message.error.message || "CDP command failed"));
      else command.resolve(message.result || {});
    }
  });
  return new Promise((resolve, reject) => {
    socket.addEventListener("open", () => resolve({
      send(method, params = {}) {
        commandId += 1;
        socket.send(JSON.stringify({ id: commandId, method, params }));
        return new Promise((commandResolve, commandReject) => {
          pending.set(commandId, { resolve: commandResolve, reject: commandReject });
        });
      },
      close() { socket.close(); },
    }));
    socket.addEventListener("error", () => reject(new Error("CDP websocket failed")));
  });
}

async function evaluate(cdp, expression) {
  const result = await cdp.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) {
    throw new Error(`page evaluation failed: ${result.exceptionDetails.text || JSON.stringify(result.exceptionDetails)}`);
  }
  return result.result?.value;
}

async function waitFor(cdp, expression, label, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await evaluate(cdp, expression)) return;
    await delay(150);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

async function screenshot(cdp, outPath, minBytes = 8_000) {
  const shot = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false, fromSurface: true });
  writeFileSync(outPath, Buffer.from(shot.data, "base64"));
  if (!existsSync(outPath) || statSync(outPath).size < minBytes) throw new Error(`screenshot is missing or blank: ${outPath}`);
}

const SNAPSHOT = `(() => {
  const box = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return null;
    return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height };
  };
  return {
    width: window.innerWidth,
    height: window.innerHeight,
    dpr: window.devicePixelRatio,
    scrollWidth: document.documentElement.scrollWidth,
    overflowX: document.documentElement.scrollWidth > window.innerWidth + 1,
    mode: document.querySelector("[data-testid=workbench-split]")?.dataset.mode || null,
    showPdf: document.querySelector("[data-testid=workbench-split]")?.dataset.showPdf || null,
    quickOpen: Boolean(document.querySelector("[data-testid=quick-open]")),
    commandPalette: Boolean(document.querySelector("[data-testid=command-palette]")),
    oversized: (document.querySelector("[data-testid=file-oversized]")?.textContent || "").trim(),
    monaco: Boolean(document.querySelector(".editor-wrap .monaco-editor")),
    rects: {
      switch: box("[data-testid=work-mode-switch]"),
      workspace: box("[data-testid=workspace-switcher]"),
      editor: box(".split > .editor-wrap"),
      assistant: box(".split > .ai-panel"),
    },
  };
})()`;

function intersects(a, b) {
  if (!a || !b) return false;
  return a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;
}

function assertLayout(snap, label) {
  if (snap.overflowX) throw new Error(`${label}: horizontal overflow (${snap.scrollWidth}>${snap.width})`);
  if (!snap.rects.switch || !snap.rects.workspace) throw new Error(`${label}: chrome missing`);
  if (snap.rects.switch.width <= 0) throw new Error(`${label}: mode switch collapsed`);
  if (snap.rects.editor && snap.rects.assistant && intersects(snap.rects.editor, snap.rects.assistant)) {
    throw new Error(`${label}: editor overlaps assistant`);
  }
  if (snap.rects.assistant && snap.rects.assistant.right > snap.width + 1) {
    throw new Error(`${label}: assistant escapes viewport`);
  }
}

async function chord(cdp, { key, code, ctrl = false, shift = false, alt = false }) {
  await evaluate(cdp, `window.dispatchEvent(new KeyboardEvent("keydown", {
    key: ${JSON.stringify(key)},
    code: ${JSON.stringify(code || `Key${key.toUpperCase()}`)},
    ctrlKey: ${ctrl},
    shiftKey: ${shift},
    altKey: ${alt},
    bubbles: true,
    cancelable: true,
  }))`);
}

const browser = findBrowser();
if (!browser) {
  console.log("Desktop UI/perf smoke SKIP: Chrome or Edge was not found.");
  process.exit(0);
}

const appPort = await freePort();
const remotePort = await freePort();
const stateRoot = mkdtempSync(join(tmpdir(), "paperos-ui-smoke-state-"));
const workspaceRoot = mkdtempSync(join(tmpdir(), "paperos-ui-smoke-ws-"));
const workspaceId = `ui-smoke-${process.pid}`;
writeFileSync(join(workspaceRoot, "main.tex"), TEX, "utf8");
writeFileSync(join(workspaceRoot, "huge.txt"), "x".repeat(2_097_153), "utf8");

const server = spawn("node", ["app/server.mjs"], {
  env: {
    ...process.env,
    PAPER_OS_PORT: String(appPort),
    PAPER_OS_DATA_DIR: join(stateRoot, "data"),
  },
  stdio: ["ignore", "pipe", "pipe"],
  windowsHide: true,
});
const profileDir = join(tmpdir(), `paperos-ui-smoke-profile-${process.pid}-${Date.now()}`);
let browserProcess;
let cdp;
let serverOutput = "";
let stage = "server health";

server.stdout.on("data", (d) => { serverOutput += d.toString(); });
server.stderr.on("data", (d) => { serverOutput += d.toString(); });

try {
  await waitForHealth(appPort);

  stage = "register Workspace";
  let cookie = "";
  async function api(path, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (cookie) headers.Cookie = cookie;
    const response = await fetch(`http://127.0.0.1:${appPort}${path}`, { ...options, headers });
    const setCookie = response.headers.get("set-cookie");
    if (setCookie) cookie = setCookie.split(";")[0];
    const body = await response.json();
    if (!response.ok && response.status !== 413) {
      throw new Error(`${path} -> ${response.status}: ${body.error || JSON.stringify(body)}`);
    }
    return { status: response.status, body };
  }
  await api("/api/auth/bootstrap");
  await api("/api/auth/local", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  await api("/api/editor/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: workspaceId, name: "UI smoke", path: workspaceRoot, pack: "latex" }),
  });
  const tooBig = await api(`/api/editor/file?workspace=${encodeURIComponent(workspaceId)}&path=huge.txt`);
  if (tooBig.status !== 413 || tooBig.body.code !== "FILE_TOO_LARGE") {
    throw new Error(`expected FILE_TOO_LARGE: ${JSON.stringify(tooBig)}`);
  }

  stage = "browser launch";
  browserProcess = spawn(browser, [
    "--headless=new", "--disable-gpu", "--disable-gpu-compositing", "--disable-accelerated-2d-canvas",
    "--disable-vulkan", "--use-gl=swiftshader", "--enable-unsafe-swiftshader",
    "--disable-features=VizDisplayCompositor,UseSkiaRenderer,DawnGraphite,Dawn",
    "--disable-dev-shm-usage", "--disable-extensions", "--no-first-run", "--no-default-browser-check",
    `--remote-debugging-port=${remotePort}`, `--user-data-dir=${profileDir}`, "--window-size=1440,900",
    `http://127.0.0.1:${appPort}/ide/`,
  ], { stdio: ["ignore", "pipe", "pipe"], windowsHide: true });

  stage = "DevTools connection";
  const tab = await waitForTab(remotePort, appPort);
  cdp = await connectCdp(tab.webSocketDebuggerUrl);
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await waitFor(cdp, "Boolean(document.querySelector('[data-testid=workspace-switcher]'))", "desktop IDE boot");
  await waitFor(cdp, `[...document.querySelectorAll('[data-testid=workspace-switcher] option')].some((o) => o.value === ${JSON.stringify(workspaceId)})`, "Workspace catalog");
  await evaluate(cdp, `(() => {
    const select = document.querySelector('[data-testid=workspace-switcher] select');
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set;
    setter.call(select, ${JSON.stringify(workspaceId)});
    select.dispatchEvent(new Event("change", { bubbles: true }));
    return select.value;
  })()`);
  await waitFor(cdp, `document.querySelector('[data-testid=workspace-switcher] select')?.value === ${JSON.stringify(workspaceId)}`, "workspace selected");
  await waitFor(cdp, "Boolean(document.querySelector('.monaco-editor'))", "Monaco");

  const outDir = join("dist", "visual-qa");
  mkdirSync(outDir, { recursive: true });
  const layouts = [];

  stage = "viewport matrix";
  for (const viewport of LAYOUT_VIEWPORTS) {
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: viewport.width,
      height: viewport.height,
      deviceScaleFactor: viewport.scale,
      mobile: false,
    });
    await delay(250);
    const snap = await evaluate(cdp, SNAPSHOT);
    assertLayout(snap, `${viewport.width}x${viewport.height}`);
    const name = `desktop-ui-${viewport.width}x${viewport.height}.png`;
    await screenshot(cdp, join(outDir, name));
    layouts.push({ ...viewport, overflowX: snap.overflowX, dpr: snap.dpr, screenshot: name });
  }

  stage = "emulated DPI";
  const dpi = [];
  for (const scale of LAYOUT_DPI_SCALES) {
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 1440,
      height: 900,
      deviceScaleFactor: scale,
      mobile: false,
    });
    await delay(250);
    const snap = await evaluate(cdp, SNAPSHOT);
    assertLayout(snap, `1440x900@${scale}`);
    if (Math.abs(snap.dpr - scale) > 0.05) throw new Error(`DPR ${snap.dpr} != ${scale}`);
    const name = `desktop-ui-1440x900-dpi-${String(scale).replace(".", "")}.png`;
    await screenshot(cdp, join(outDir, name));
    dpi.push({ scale, dpr: snap.dpr, overflowX: snap.overflowX, screenshot: name });
  }

  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

  stage = "keyboard paths";
  await chord(cdp, { key: "p", ctrl: true });
  await waitFor(cdp, "Boolean(document.querySelector('[data-testid=quick-open]'))", "Ctrl+P");
  await chord(cdp, { key: "Escape", code: "Escape" });
  await waitFor(cdp, "!document.querySelector('[data-testid=quick-open]')", "Escape closes Quick Open");
  await chord(cdp, { key: "P", ctrl: true, shift: true });
  await waitFor(cdp, "Boolean(document.querySelector('[data-testid=command-palette]'))", "Ctrl+Shift+P");
  await chord(cdp, { key: "Escape", code: "Escape" });
  await waitFor(cdp, "!document.querySelector('[data-testid=command-palette]')", "Escape closes palette");
  const beforeMode = await evaluate(cdp, "document.querySelector('[data-testid=workbench-split]')?.dataset.mode");
  await chord(cdp, { key: "m", ctrl: true, alt: true });
  await waitFor(cdp, `document.querySelector('[data-testid=workbench-split]')?.dataset.mode !== ${JSON.stringify(beforeMode)}`, "Ctrl+Alt+M");
  const afterMode = await evaluate(cdp, "document.querySelector('[data-testid=workbench-split]')?.dataset.mode");
  const beforePdf = await evaluate(cdp, "document.querySelector('[data-testid=workbench-split]')?.dataset.showPdf");
  await chord(cdp, { key: "p", ctrl: true, alt: true });
  await waitFor(cdp, `document.querySelector('[data-testid=workbench-split]')?.dataset.showPdf !== ${JSON.stringify(beforePdf)}`, "Ctrl+Alt+P");

  stage = "oversized file stays out of Monaco";
  await chord(cdp, { key: "p", ctrl: true });
  await waitFor(cdp, "Boolean(document.querySelector('[data-testid=quick-open] input'))", "Quick Open for huge.txt");
  await evaluate(cdp, `(() => {
    const input = document.querySelector("[data-testid=quick-open] input");
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    setter.call(input, "huge.txt");
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true, cancelable: true }));
    return input.value;
  })()`);
  await waitFor(cdp, "Boolean(document.querySelector('[data-testid=file-oversized]'))", "oversized panel");
  const oversized = await evaluate(cdp, SNAPSHOT);
  if (!/未载入编辑器/.test(oversized.oversized)) throw new Error(`oversized copy missing: ${oversized.oversized}`);

  writeFileSync(join(outDir, "desktop-ui-behavior.json"), JSON.stringify({
    schema: 1,
    generatedAt: new Date().toISOString(),
    browser,
    workspaceId,
    evidence: "cdp-css-pixel",
    nativeWindowMin: { width: 1100, height: 720 },
    fileTooLarge: { status: tooBig.status, code: tooBig.body.code, size: tooBig.body.size },
    layouts,
    dpi,
    keyboard: { beforeMode, afterMode, beforePdf, showPdf: oversized.showPdf },
    oversized: oversized.oversized,
  }, null, 2));
  cdp.close();
  console.log("Desktop UI/perf smoke OK");
  console.log(`  viewports=${layouts.map((v) => v.width).join("/")}`);
  console.log(`  dpi=${dpi.map((d) => d.scale).join("/")}`);
  console.log(`  mode ${beforeMode}→${afterMode}; huge.txt stayed out of the editor`);
} catch (error) {
  console.error(`Desktop UI/perf smoke failed at ${stage}: ${error.message}`);
  if (cdp) {
    try {
      console.error("page snapshot", JSON.stringify(await evaluate(cdp, SNAPSHOT)));
    } catch { /* page already gone */ }
  }
  if (serverOutput.trim()) console.error(serverOutput.slice(-4000));
  process.exitCode = 1;
} finally {
  stopProcess(browserProcess);
  stopProcess(server);
  await delay(300);
  for (const dir of [profileDir, stateRoot, workspaceRoot]) {
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
  }
  process.exit(process.exitCode ?? 0);
}
