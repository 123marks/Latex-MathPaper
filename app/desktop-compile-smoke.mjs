// Desktop IDE compile lifecycle smoke (slice 2a).
//
// Starts app/server.mjs with an isolated PATH that only sees the fake
// latexmk fixture, registers a LaTeX Workspace, and proves:
//   - a successful .tex updates the PDF pane and marks it fresh;
//   - a subsequent failing .tex keeps that PDF and marks it stale;
//   - the status chip walks idle → running → succeeded → failed.
// Evidence: dist/visual-qa/desktop-compile-*.png + desktop-compile-behavior.json.

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

const root = dirname(fileURLToPath(new URL(".", import.meta.url)));
const fakeEngine = join(root, "tests", "fixtures", "fake-latexmk.mjs");

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

function isolatedPath() {
  const nodeDir = dirname(process.execPath);
  const extras = process.platform === "win32"
    ? [process.env.SystemRoot ? join(process.env.SystemRoot, "System32") : "C:\\Windows\\System32"]
    : ["/bin", "/usr/bin"];
  const sep = process.platform === "win32" ? ";" : ":";
  return [nodeDir, ...extras].join(sep);
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

async function screenshot(cdp, outPath, minBytes = 10_000) {
  const shot = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false, fromSurface: true });
  writeFileSync(outPath, Buffer.from(shot.data, "base64"));
  if (!existsSync(outPath) || statSync(outPath).size < minBytes) throw new Error(`screenshot is missing or blank: ${outPath}`);
}

async function clickSelector(cdp, selector) {
  const rect = await evaluate(cdp, `(() => { const r = document.querySelector(${JSON.stringify(selector)})?.getBoundingClientRect(); return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width } : null; })()`);
  if (!rect || rect.w <= 0) throw new Error(`cannot click ${selector}: not visible`);
  for (const type of ["mousePressed", "mouseReleased"]) {
    await cdp.send("Input.dispatchMouseEvent", { type, x: rect.x, y: rect.y, button: "left", clickCount: 1 });
  }
}

const SNAPSHOT = `(() => {
  const text = (sel) => (document.querySelector(sel)?.textContent || "").trim();
  const pdf = document.querySelector("[data-testid=pdf-pane]");
  return {
    status: text("[data-testid=status-compile]"),
    pdfPresent: Boolean(pdf),
    pdfFresh: pdf?.dataset.fresh || null,
    staleBadge: Boolean(document.querySelector("[data-testid=pdf-stale-badge]")),
    freshBadge: Boolean(document.querySelector("[data-testid=pdf-fresh-badge]")),
    cancelVisible: Boolean(document.querySelector("[data-testid=compile-cancel]")),
    runVisible: Boolean(document.querySelector("[data-testid=compile-run]")),
    workspace: document.querySelector("[data-testid=workspace-switcher] select")?.value || "",
  };
})()`;

const browser = findBrowser();
if (!browser) {
  console.log("Desktop compile smoke SKIP: Chrome or Edge was not found.");
  process.exit(0);
}

const appPort = await freePort();
const remotePort = await freePort();
const stateRoot = mkdtempSync(join(tmpdir(), "paperos-compile-smoke-state-"));
const workspaceRoot = mkdtempSync(join(tmpdir(), "paperos-compile-smoke-ws-"));
const workspaceId = `compile-smoke-${process.pid}`;
writeFileSync(join(workspaceRoot, "main.tex"), "% PAPEROS_FAKE: success\n\\documentclass{article}\\begin{document}ok\\end{document}\n", "utf8");

const server = spawn("node", ["app/server.mjs"], {
  env: {
    ...process.env,
    PAPER_OS_PORT: String(appPort),
    PAPER_OS_DATA_DIR: join(stateRoot, "data"),
    PAPER_OS_LATEXMK: fakeEngine,
    PATH: isolatedPath(),
  },
  stdio: ["ignore", "pipe", "pipe"],
  windowsHide: true,
});
const profileDir = join(tmpdir(), `paperos-compile-smoke-profile-${process.pid}-${Date.now()}`);
let browserProcess;
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
    if (!response.ok) throw new Error(`${path} -> ${response.status}: ${body.error || JSON.stringify(body)}`);
    return body;
  }
  await api("/api/auth/bootstrap");
  await api("/api/auth/local", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  await api("/api/editor/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: workspaceId, name: "Compile smoke", path: workspaceRoot, pack: "latex" }),
  });

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
  const cdp = await connectCdp(tab.webSocketDebuggerUrl);
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await waitFor(cdp, "Boolean(document.querySelector('[data-testid=workspace-switcher]'))", "desktop IDE boot");

  stage = "open Workspace";
  await waitFor(cdp, `[...document.querySelectorAll('[data-testid=workspace-switcher] option')].some((o) => o.value === ${JSON.stringify(workspaceId)})`, "Workspace catalog");
  await evaluate(cdp, `(() => {
    const select = document.querySelector('[data-testid=workspace-switcher] select');
    if (select.value === ${JSON.stringify(workspaceId)}) return select.value;
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set;
    setter.call(select, ${JSON.stringify(workspaceId)});
    select.dispatchEvent(new Event("change", { bubbles: true }));
    return select.value;
  })()`);
  await waitFor(cdp, `document.querySelector('[data-testid=workspace-switcher] select')?.value === ${JSON.stringify(workspaceId)} && /main\\.tex/.test(document.querySelector('.tabs .tab.active')?.textContent || '')`, "main.tex open");
  await waitFor(cdp, "Boolean(document.querySelector('[data-testid=compile-run]'))", "compile button");

  const outDir = join("dist", "visual-qa");
  mkdirSync(outDir, { recursive: true });

  stage = "successful compile";
  await clickSelector(cdp, "[data-testid=compile-run]");
  await waitFor(cdp, "document.querySelector('[data-testid=status-compile]')?.textContent?.includes('编译中') || document.querySelector('[data-testid=status-compile]')?.textContent?.includes('编译成功')", "compile left idle");
  await waitFor(cdp, "document.querySelector('[data-testid=status-compile]')?.textContent?.includes('编译成功') && Boolean(document.querySelector('[data-testid=pdf-fresh-badge]'))", "fresh PDF");
  const afterOk = await evaluate(cdp, SNAPSHOT);
  if (afterOk.status !== "编译成功") throw new Error(`expected 编译成功, got ${JSON.stringify(afterOk)}`);
  if (!afterOk.pdfPresent || afterOk.pdfFresh !== "fresh" || !afterOk.freshBadge) {
    throw new Error(`successful compile did not show a fresh PDF: ${JSON.stringify(afterOk)}`);
  }
  await screenshot(cdp, join(outDir, "desktop-compile-success.png"));

  stage = "failing compile keeps stale PDF";
  await api("/api/editor/file", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      workspace: workspaceId,
      path: "main.tex",
      content: "% PAPEROS_FAKE: fail\n\\documentclass{article}\\begin{document}\\oops\\end{document}\n",
    }),
  });
  await clickSelector(cdp, "[data-testid=compile-run]");
  await waitFor(cdp, "document.querySelector('[data-testid=status-compile]')?.textContent?.includes('编译失败') && Boolean(document.querySelector('[data-testid=pdf-stale-badge]'))", "stale PDF after failure");
  const afterBad = await evaluate(cdp, SNAPSHOT);
  if (afterBad.status !== "编译失败") throw new Error(`expected 编译失败, got ${JSON.stringify(afterBad)}`);
  if (!afterBad.pdfPresent || afterBad.pdfFresh !== "stale" || !afterBad.staleBadge) {
    throw new Error(`failed compile dropped or mislabeled the previous PDF: ${JSON.stringify(afterBad)}`);
  }
  await screenshot(cdp, join(outDir, "desktop-compile-stale.png"));
  cdp.close();

  writeFileSync(join(outDir, "desktop-compile-behavior.json"), JSON.stringify({
    schema: 1,
    generatedAt: new Date().toISOString(),
    browser,
    workspaceId,
    afterOk,
    afterBad,
  }, null, 2));
  console.log("Desktop compile smoke OK");
  console.log(`  success: ${afterOk.status} fresh=${afterOk.pdfFresh}`);
  console.log(`  failure: ${afterBad.status} fresh=${afterBad.pdfFresh} pdf retained`);
} catch (error) {
  console.error(`Desktop compile smoke failed at ${stage}: ${error.message}`);
  if (serverOutput.trim()) console.error(serverOutput.slice(-4000));
  process.exitCode = 1;
} finally {
  stopProcess(browserProcess);
  stopProcess(server);
  await delay(300);
  for (const dir of [profileDir, stateRoot, workspaceRoot]) {
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
  }
}
