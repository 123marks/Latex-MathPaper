// Desktop IDE slice 3 smoke: visible AI harness. Isolated data dir.
// Sends a mock-local edit prompt, reviews the unified diff, Apply without
// window.confirm, then checks the file actually contains Revised note.
// Evidence: dist/visual-qa/desktop-ai-*.png and desktop-ai-behavior.json.

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

const root = dirname(fileURLToPath(new URL(".", import.meta.url)));

const TEX = [
  "\\documentclass{article}",
  "\\begin{document}",
  "This is a short note.",
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
      const tab = tabs.find((candidate) => candidate.url === "about:blank" || candidate.url?.startsWith(`http://127.0.0.1:${appPort}/ide/`));
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
    if (el.disabled) return { ok: false, reason: "disabled", label: (el.textContent || "").trim() };
    el.click();
    return { ok: true, label: (el.textContent || "").trim() };
  })()`);
  if (!clicked?.ok) throw new Error(`cannot click ${selector}: ${JSON.stringify(clicked)}`);
  return clicked;
}

const SNAPSHOT = `(() => {
  const text = (sel) => (document.querySelector(sel)?.textContent || "").trim();
  const chip = (id) => text('[data-chip="' + id + '"]');
  return {
    harness: Boolean(document.querySelector("[data-testid=ai-harness]")),
    context: Boolean(document.querySelector("[data-testid=ai-context]")),
    workspace: chip("workspace"),
    pack: chip("pack"),
    file: chip("file"),
    selection: chip("selection"),
    errors: chip("errors"),
    runtime: document.querySelector("[data-testid=ai-runtime]")?.dataset.runtime || null,
    runtimeLabel: text("[data-testid=ai-runtime]"),
    provider: text("[data-testid=ai-provider]"),
    planSteps: [...document.querySelectorAll("[data-testid=ai-plan] [data-step]")].map((el) => ({
      id: el.dataset.step,
      status: el.dataset.status,
      text: (el.textContent || "").trim(),
    })),
    proposalState: document.querySelector("[data-testid=ai-proposal]")?.dataset.state || null,
    diff: Boolean(document.querySelector("[data-testid=ai-diff]")),
    diffAdded: [...document.querySelectorAll("[data-testid=ai-diff] .is-added")].map((el) => (el.textContent || "").trim()),
    applyDisabled: Boolean(document.querySelector("[data-testid=ai-apply]")?.disabled),
    applyInView: (() => {
      const el = document.querySelector("[data-testid=ai-apply]");
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return r.height > 8 && r.top >= 0 && r.bottom <= window.innerHeight + 1;
    })(),
    diffInView: (() => {
      const el = document.querySelector("[data-testid=ai-diff]");
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return r.height > 8 && r.top < window.innerHeight && r.bottom > 0;
    })(),
    confirmCount: Number(window.__confirmCount || 0),
    chatMessages: document.querySelectorAll(".ai-stream .msg").length,
    trace: text("[data-testid=ai-trace]"),
    editorPresent: Boolean(document.querySelector(".monaco-editor")),
  };
})()`;

const browser = findBrowser();
if (!browser) {
  console.log("Desktop AI harness smoke SKIP: Chrome or Edge was not found.");
  process.exit(0);
}

const appPort = await freePort();
const remotePort = await freePort();
const stateRoot = mkdtempSync(join(tmpdir(), "paperos-ai-smoke-state-"));
const workspaceRoot = mkdtempSync(join(tmpdir(), "paperos-ai-smoke-ws-"));
const workspaceId = `ai-smoke-${process.pid}`;
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
const profileDir = join(tmpdir(), `paperos-ai-smoke-profile-${process.pid}-${Date.now()}`);
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
    if (!response.ok) throw new Error(`${path} -> ${response.status}: ${body.error || JSON.stringify(body)}`);
    return body;
  }
  await api("/api/auth/bootstrap");
  await api("/api/auth/local", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  await api("/api/editor/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: workspaceId, name: "AI harness smoke", path: workspaceRoot, pack: "latex" }),
  });

  stage = "browser launch";
  browserProcess = spawn(browser, [
    "--headless=new", "--disable-gpu", "--disable-gpu-compositing", "--disable-accelerated-2d-canvas",
    "--disable-vulkan", "--use-gl=swiftshader", "--enable-unsafe-swiftshader",
    "--disable-features=VizDisplayCompositor,UseSkiaRenderer,DawnGraphite,Dawn",
    "--disable-dev-shm-usage", "--disable-extensions", "--no-first-run", "--no-default-browser-check",
    `--remote-debugging-port=${remotePort}`, `--user-data-dir=${profileDir}`, "--window-size=1440,900",
    "about:blank",
  ], { stdio: ["ignore", "pipe", "pipe"], windowsHide: true });

  stage = "DevTools connection";
  const tab = await waitForTab(remotePort, appPort);
  cdp = await connectCdp(tab.webSocketDebuggerUrl);
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Network.enable");
  await cdp.send("Network.setBlockedURLs", { urls: ["*://fonts.googleapis.com/*", "*://fonts.gstatic.com/*"] });
  await cdp.send("Page.navigate", { url: `http://127.0.0.1:${appPort}/ide/` });
  await waitFor(cdp, "document.readyState === 'complete'", "IDE document");
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
  await waitFor(cdp, `document.querySelector('[data-testid=workspace-switcher] select')?.value === ${JSON.stringify(workspaceId)} && /main\\.tex/.test(document.querySelector('.tabs .tab.active')?.textContent || '') && Boolean(document.querySelector('.editor-wrap .monaco-editor .view-lines .view-line'))`, "main.tex open");
  await waitFor(cdp, "Boolean(document.querySelector('[data-testid=ai-harness]')) && Boolean(document.querySelector('[data-chip=file]'))", "harness chips");

  stage = "install confirm spy";
  await evaluate(cdp, `(() => {
    window.__confirmCount = 0;
    const orig = window.confirm.bind(window);
    window.confirm = (...args) => { window.__confirmCount += 1; return orig(...args); };
    return true;
  })()`);

  const before = await evaluate(cdp, SNAPSHOT);
  if (!before.harness || !before.context) throw new Error(`harness missing: ${JSON.stringify(before)}`);
  if (!/AI harness smoke/i.test(before.workspace)) throw new Error(`workspace chip: ${before.workspace}`);
  if (!/latex/i.test(before.pack)) throw new Error(`pack chip: ${before.pack}`);
  if (!/main\\.tex/.test(before.file) && !/main.tex/.test(before.file)) throw new Error(`file chip: ${before.file}`);

  stage = "send edit prompt";
  await evaluate(cdp, `(() => {
    const area = document.querySelector("[data-testid=ai-input]");
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
    setter.call(area, "修改这段说明");
    area.dispatchEvent(new Event("input", { bubbles: true }));
    return area.value;
  })()`);
  await clickSelector(cdp, "[data-testid=ai-send]");
  await waitFor(cdp, "document.querySelector('[data-testid=ai-runtime]')?.dataset.runtime === 'mock-local'", "mock-local runtime", 30000);
  await waitFor(cdp, "document.querySelector('[data-testid=ai-proposal]')?.dataset.state === 'ready'", "proposal ready", 30000);
  await waitFor(cdp, "Boolean(document.querySelector('[data-testid=ai-diff]'))", "unified diff");
  const ready = await evaluate(cdp, SNAPSHOT);
  if (ready.runtime !== "mock-local") throw new Error(`runtime was not mock-local: ${JSON.stringify(ready)}`);
  if (ready.proposalState !== "ready") throw new Error(`proposal not ready: ${JSON.stringify(ready)}`);
  if (!ready.diff || !ready.diffAdded.some((line) => /Revised note/.test(line))) {
    throw new Error(`diff missing Revised note: ${JSON.stringify(ready)}`);
  }
  if (ready.applyDisabled) throw new Error("Apply stayed disabled on a ready proposal");
  if (!ready.applyInView || !ready.diffInView) {
    throw new Error(`review controls were off-screen: ${JSON.stringify({ applyInView: ready.applyInView, diffInView: ready.diffInView })}`);
  }
  if (ready.confirmCount !== 0) throw new Error(`confirm() fired before Apply: ${ready.confirmCount}`);
  if (!ready.planSteps.some((step) => step.id === "preview" && step.status === "done")) {
    throw new Error(`plan did not mark preview done: ${JSON.stringify(ready.planSteps)}`);
  }

  const outDir = join("dist", "visual-qa");
  mkdirSync(outDir, { recursive: true });
  await screenshot(cdp, join(outDir, "desktop-ai-ready.png"));

  stage = "apply without confirm";
  await clickSelector(cdp, "[data-testid=ai-apply]");
  await waitFor(cdp, "document.querySelector('[data-testid=ai-proposal]')?.dataset.state === 'applied'", "proposal applied", 20000);
  const applied = await evaluate(cdp, SNAPSHOT);
  if (applied.confirmCount !== 0) throw new Error(`Apply used window.confirm: ${applied.confirmCount}`);
  if (applied.proposalState !== "applied") throw new Error(`apply did not finish: ${JSON.stringify(applied)}`);
  if (!/(applied|已应用)/i.test(applied.trace)) throw new Error(`trace missing applied state: ${applied.trace}`);

  const written = await api(`/api/editor/file?workspace=${encodeURIComponent(workspaceId)}&path=main.tex`);
  if (!/Revised note/.test(written.content || "")) {
    throw new Error(`applied file missing Revised note: ${JSON.stringify(written.content)}`);
  }
  await screenshot(cdp, join(outDir, "desktop-ai-applied.png"));
  cdp.close();

  writeFileSync(join(outDir, "desktop-ai-behavior.json"), JSON.stringify({
    schema: 1,
    generatedAt: new Date().toISOString(),
    browser,
    workspaceId,
    before,
    ready,
    applied,
    writtenHasRevisedNote: /Revised note/.test(written.content || ""),
    confirmCount: applied.confirmCount,
  }, null, 2));
  console.log("Desktop AI harness smoke OK");
  console.log(`  runtime=${ready.runtime} proposal=${applied.proposalState} confirm=${applied.confirmCount}`);
  console.log(`  chips workspace=${before.workspace} file=${before.file} pack=${before.pack}`);
  console.log(`  file contains Revised note; trace=${applied.trace}`);
} catch (error) {
  console.error(`Desktop AI harness smoke failed at ${stage}: ${error.message}`);
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
