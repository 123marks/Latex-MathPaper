// Desktop IDE slice 5 smoke: .vsix first layer (theme colors + language ids).
// Isolated data dir. Evidence: dist/visual-qa/desktop-vsix-*.png
// and desktop-vsix-behavior.json.

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import {
  buildThemeLanguageVsix,
  FIXTURE_DISPLAY_NAME,
  FIXTURE_EXTENSION_ID,
} from "../tests/fixtures/paperos-theme-language-vsix.mjs";

const TEX = [
  "\\documentclass{article}",
  "\\begin{document}",
  "VSIX smoke.",
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

async function clickSelector(cdp, selector) {
  const clicked = await evaluate(cdp, `(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return { ok: false, reason: "missing" };
    el.scrollIntoView({ block: "center", inline: "nearest" });
    el.click();
    return { ok: true, label: (el.textContent || "").trim() };
  })()`);
  if (!clicked?.ok) throw new Error(`cannot click ${selector}: ${JSON.stringify(clicked)}`);
  return clicked;
}

const SNAPSHOT = `(() => {
  const text = (sel) => (document.querySelector(sel)?.textContent || "").trim();
  const row = document.querySelector("[data-testid=extension-row]");
  return {
    panel: Boolean(document.querySelector("[data-testid=extensions-panel]")),
    note: text("[data-testid=extensions-note]"),
    name: row?.querySelector("div")?.textContent?.trim() || "",
    enabled: row?.dataset.enabled || null,
    empty: Boolean(document.querySelector("[data-testid=extensions-empty]")),
    matrix: text("[data-testid=extensions-matrix]"),
    fakeSkills: /Paper Excellence|Nature Figure/.test(document.body.innerText || ""),
    editorPresent: Boolean(document.querySelector(".monaco-editor")),
  };
})()`;

const browser = findBrowser();
if (!browser) {
  console.log("Desktop vsix smoke SKIP: Chrome or Edge was not found.");
  process.exit(0);
}

const appPort = await freePort();
const remotePort = await freePort();
const stateRoot = mkdtempSync(join(tmpdir(), "paperos-vsix-smoke-state-"));
const workspaceRoot = mkdtempSync(join(tmpdir(), "paperos-vsix-smoke-ws-"));
const workspaceId = `vsix-smoke-${process.pid}`;
writeFileSync(join(workspaceRoot, "main.tex"), TEX, "utf8");

const server = spawn("node", ["app/server.mjs"], {
  env: {
    ...process.env,
    PAPER_OS_PORT: String(appPort),
    PAPER_OS_DATA_DIR: join(stateRoot, "data"),
  },
  stdio: ["ignore", "pipe", "pipe"],
  windowsHide: true,
});
const profileDir = join(tmpdir(), `paperos-vsix-smoke-profile-${process.pid}-${Date.now()}`);
let browserProcess;
let cdp;
let serverOutput = "";
let stage = "server health";

server.stdout.on("data", (d) => { serverOutput += d.toString(); });
server.stderr.on("data", (d) => { serverOutput += d.toString(); });

try {
  await waitForHealth(appPort);

  stage = "register Workspace and install fixture vsix";
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
    body: JSON.stringify({ id: workspaceId, name: "VSIX smoke", path: workspaceRoot, pack: "latex" }),
  });
  const installed = await api("/api/extensions/install", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filename: "fixture.vsix",
      content: buildThemeLanguageVsix().toString("base64"),
    }),
  });
  if (installed.extension?.id !== FIXTURE_EXTENSION_ID) {
    throw new Error(`install returned ${installed.extension?.id}`);
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
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await waitFor(cdp, "Boolean(document.querySelector('[data-testid=workspace-switcher]'))", "desktop IDE boot");

  stage = "open Extensions panel";
  await clickSelector(cdp, "[data-testid=extensions-activity]");
  await waitFor(cdp, "Boolean(document.querySelector('[data-testid=extensions-panel]'))", "extensions panel");
  const pageApi = await evaluate(cdp, `fetch("/api/extensions", { credentials: "same-origin" }).then(async (r) => ({
    status: r.status,
    body: await r.json().catch(() => null),
    error: document.querySelector("[data-testid=extensions-error]")?.textContent || "",
  }))`);
  if (pageApi.status !== 200 || !pageApi.body?.extensions?.length) {
    throw new Error(`page /api/extensions unexpected: ${JSON.stringify(pageApi)}`);
  }
  await waitFor(cdp, `document.querySelector('[data-testid=extension-row]')?.textContent?.includes(${JSON.stringify(FIXTURE_DISPLAY_NAME)})`, "fixture name");
  const installedView = await evaluate(cdp, SNAPSHOT);
  if (installedView.fakeSkills) throw new Error("decorative skill names leaked into Extensions");
  if (!/不执行扩展 JS/.test(installedView.note) || !/不是完整 VS Code/.test(installedView.note)) {
    throw new Error(`honest note missing: ${installedView.note}`);
  }
  if (!/themes\.colors/.test(installedView.matrix) || !/unsupported/.test(installedView.matrix)) {
    throw new Error(`matrix missing: ${installedView.matrix}`);
  }
  if (installedView.enabled !== "1") throw new Error(`expected enabled fixture: ${JSON.stringify(installedView)}`);

  const outDir = join("dist", "visual-qa");
  mkdirSync(outDir, { recursive: true });
  await screenshot(cdp, join(outDir, "desktop-vsix-ready.png"));

  stage = "disable then uninstall";
  await clickSelector(cdp, "[data-testid=extension-disable]");
  await waitFor(cdp, "document.querySelector('[data-testid=extension-row]')?.dataset.enabled === '0'", "disabled");
  const disabledView = await evaluate(cdp, SNAPSHOT);
  await clickSelector(cdp, "[data-testid=extension-uninstall]");
  await waitFor(cdp, "Boolean(document.querySelector('[data-testid=extensions-empty]'))", "uninstalled");
  const emptyView = await evaluate(cdp, SNAPSHOT);
  if (emptyView.fakeSkills) throw new Error("fake skills appeared after uninstall");
  await screenshot(cdp, join(outDir, "desktop-vsix-empty.png"));
  cdp.close();

  writeFileSync(join(outDir, "desktop-vsix-behavior.json"), JSON.stringify({
    schema: 1,
    generatedAt: new Date().toISOString(),
    browser,
    workspaceId,
    fixtureId: FIXTURE_EXTENSION_ID,
    installedView,
    disabledView,
    emptyView,
  }, null, 2));
  console.log("Desktop vsix smoke OK");
  console.log(`  installed=${installedView.name.replace(/\s+/g, " ").slice(0, 80)}`);
  console.log(`  disabled=${disabledView.enabled} empty=${emptyView.empty}`);
} catch (error) {
  console.error(`Desktop vsix smoke failed at ${stage}: ${error.message}`);
  if (cdp) {
    try {
      console.error("page url", await evaluate(cdp, "location.href"));
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
