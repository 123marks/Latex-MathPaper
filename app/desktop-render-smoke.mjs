// Desktop IDE slice 2b smoke: Live math drafts, pdf.js toolbar, SyncTeX
// degrade vs real hit. Isolated PATH + fake latexmk. Evidence lands in
// dist/visual-qa/desktop-render-*.png and desktop-render-behavior.json.

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

const root = dirname(fileURLToPath(new URL(".", import.meta.url)));
const fakeEngine = join(root, "tests", "fixtures", "fake-latexmk.mjs");

const NOSYNC_TEX = [
  "% PAPEROS_FAKE: success-nosync",
  "\\documentclass{article}",
  "\\begin{document}",
  "\\section{Intro}",
  "Good $E=mc^2$ and bad $$\\oops$$",
  "\\end{document}",
  "",
].join("\n");

const SP = 65536;
const SYNCTEX_BODY = [
  "SyncTeX Version:1",
  "Input:1:./main.tex",
  "Output:pdf",
  "Magnification:1000",
  "Unit:1",
  "X Offset:0",
  "Y Offset:0",
  "Content:",
  "{1",
  `[1,1:${72 * SP},${100 * SP}:${300 * SP},${10 * SP},${2 * SP}`,
  `[1,3:${72 * SP},${140 * SP}:${300 * SP},${10 * SP},${2 * SP}`,
  "]",
  "}1",
  "Postamble:",
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

async function screenshot(cdp, outPath, minBytes = 8_000) {
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

async function clickCompile(cdp) {
  const clicked = await evaluate(cdp, `(() => {
    const buttons = [...document.querySelectorAll("[data-testid=compile-run]")];
    const live = buttons.find((button) => !button.disabled) || buttons[buttons.length - 1];
    if (!live) return { ok: false, count: buttons.length };
    live.click();
    return { ok: true, count: buttons.length, disabled: Boolean(live.disabled), label: (live.textContent || "").trim() };
  })()`);
  if (!clicked?.ok) throw new Error(`no compile-run button: ${JSON.stringify(clicked)}`);
  return clicked;
}

const SNAPSHOT = `(() => {
  const text = (sel) => (document.querySelector(sel)?.textContent || "").trim();
  const drafts = [...document.querySelectorAll("[data-testid^=math-draft-]")].filter((el) => /^math-draft-\\d+$/.test(el.dataset.testid || el.getAttribute("data-testid")));
  return {
    mode: document.querySelector("[data-testid=work-mode-render]")?.getAttribute("aria-pressed"),
    drafts: Boolean(document.querySelector("[data-testid=live-math-drafts]")),
    draftCount: drafts.length,
    draftOk: drafts.filter((el) => el.dataset.ok === "1").length,
    draftBad: drafts.filter((el) => el.dataset.ok === "0").length,
    editorPresent: Boolean(document.querySelector(".monaco-editor")),
    pdfToolbar: Boolean(document.querySelector("[data-testid=pdf-toolbar]")),
    pageLabel: text("[data-testid=pdf-page-label]"),
    zoomLabel: text("[data-testid=pdf-zoom-label]"),
    canvas: Boolean(document.querySelector("[data-testid=pdf-page] canvas")),
    canvasWidth: document.querySelector("[data-testid=pdf-page] canvas")?.width || 0,
    pdfError: text("[data-testid=pdf-error]"),
    fresh: Boolean(document.querySelector("[data-testid=pdf-fresh-badge]")),
    syncSource: document.querySelector("[data-testid=sync-source]")?.dataset.source || null,
    synctexCode: document.querySelector("[data-testid=synctex-note]")?.dataset.code || null,
    synctexDegraded: document.querySelector("[data-testid=synctex-note]")?.dataset.degraded || null,
    status: text("[data-testid=status-compile]"),
  };
})()`;

const browser = findBrowser();
if (!browser) {
  console.log("Desktop render smoke SKIP: Chrome or Edge was not found.");
  process.exit(0);
}

const appPort = await freePort();
const remotePort = await freePort();
const stateRoot = mkdtempSync(join(tmpdir(), "paperos-render-smoke-state-"));
const workspaceRoot = mkdtempSync(join(tmpdir(), "paperos-render-smoke-ws-"));
const workspaceId = `render-smoke-${process.pid}`;
writeFileSync(join(workspaceRoot, "main.tex"), NOSYNC_TEX, "utf8");

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
const profileDir = join(tmpdir(), `paperos-render-smoke-profile-${process.pid}-${Date.now()}`);
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
    body: JSON.stringify({ id: workspaceId, name: "Render smoke", path: workspaceRoot, pack: "latex" }),
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
  cdp = await connectCdp(tab.webSocketDebuggerUrl);
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

  stage = "Render live drafts";
  await clickSelector(cdp, "[data-testid=work-mode-render]");
  await waitFor(cdp, "document.querySelector('[data-testid=work-mode-render]')?.getAttribute('aria-pressed') === 'true' && Boolean(document.querySelector('[data-testid=live-math-drafts]'))", "live drafts");
  await waitFor(cdp, "document.querySelectorAll('[data-testid^=math-draft-]').length >= 2", "two formula drafts");
  const drafts = await evaluate(cdp, SNAPSHOT);
  if (!drafts.editorPresent) throw new Error("Render mode unmounted the editor");
  if (drafts.draftOk < 1 || drafts.draftBad < 1) {
    throw new Error(`expected one good and one bad draft: ${JSON.stringify(drafts)}`);
  }
  const outDir = join("dist", "visual-qa");
  mkdirSync(outDir, { recursive: true });
  await screenshot(cdp, join(outDir, "desktop-render-drafts.png"));

  stage = "compile without SyncTeX";
  await clickCompile(cdp);
  await waitFor(cdp, "document.querySelector('[data-testid=status-compile]')?.textContent?.includes('编译中') || document.querySelector('[data-testid=status-compile]')?.textContent?.includes('编译成功')", "compile left idle");
  await waitFor(cdp, "Boolean(document.querySelector('[data-testid=pdf-toolbar]'))", "pdf.js toolbar");
  await waitFor(cdp, "document.querySelector('[data-testid=pdf-page] canvas')?.width > 10", "pdf canvas painted");
  const afterPdf = await evaluate(cdp, SNAPSHOT);
  if (!afterPdf.pdfToolbar || !afterPdf.canvas || afterPdf.canvasWidth < 10) {
    throw new Error(`pdf.js did not paint: ${JSON.stringify(afterPdf)}`);
  }
  if (!/1\s*\/\s*1/.test(afterPdf.pageLabel) || !/%/.test(afterPdf.zoomLabel)) {
    throw new Error(`toolbar labels missing: ${JSON.stringify(afterPdf)}`);
  }
  await screenshot(cdp, join(outDir, "desktop-render-pdf.png"));

  stage = "SyncTeX missing degrade";
  await waitFor(cdp, "Boolean(document.querySelector('[data-testid=sync-forward]'))", "sync chip");
  await clickSelector(cdp, "[data-testid=sync-forward]");
  await waitFor(cdp, "document.querySelector('[data-testid=synctex-note]')?.dataset.code === 'SYNCTEX_MISSING'", "SYNCTEX_MISSING");
  const afterMissing = await evaluate(cdp, SNAPSHOT);
  if (afterMissing.syncSource !== "estimate" || afterMissing.synctexDegraded !== "1") {
    throw new Error(`missing SyncTeX did not degrade honestly: ${JSON.stringify(afterMissing)}`);
  }

  stage = "write SyncTeX record";
  try {
    await api("/api/editor/file", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspace: workspaceId, path: "build/main.synctex", content: SYNCTEX_BODY }),
    });
  } catch (error) {
    if (!String(error.message).includes("409") && !String(error.message).includes("exists")) {
      await api("/api/editor/file", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace: workspaceId, path: "build/main.synctex", content: SYNCTEX_BODY }),
      });
    }
  }
  const synctexHit = await api(`/api/editor/synctex?workspace=${encodeURIComponent(workspaceId)}&tex=main.tex&mode=forward&path=main.tex&line=1`);
  if (!synctexHit.page) throw new Error(`expected a server SyncTeX hit, got ${JSON.stringify(synctexHit)}`);
  await evaluate(cdp, `document.querySelector("[data-testid=sync-forward]")?.click()`);
  await waitFor(cdp, "document.querySelector('[data-testid=sync-source]')?.dataset.source === 'synctex'", "real SyncTeX hit");
  const afterSync = await evaluate(cdp, SNAPSHOT);
  if (afterSync.syncSource !== "synctex") {
    throw new Error(`expected a SyncTeX hit: ${JSON.stringify(afterSync)}`);
  }
  await screenshot(cdp, join(outDir, "desktop-render-synctex.png"));
  cdp.close();

  writeFileSync(join(outDir, "desktop-render-behavior.json"), JSON.stringify({
    schema: 1,
    generatedAt: new Date().toISOString(),
    browser,
    workspaceId,
    drafts,
    afterPdf,
    afterMissing,
    synctexHit,
    afterSync,
  }, null, 2));
  console.log("Desktop render smoke OK");
  console.log(`  drafts: ok=${drafts.draftOk} bad=${drafts.draftBad} editor=${drafts.editorPresent}`);
  console.log(`  pdf.js: page=${afterPdf.pageLabel} zoom=${afterPdf.zoomLabel} canvas=${afterPdf.canvasWidth}`);
  console.log(`  synctex: missing=${afterMissing.synctexCode} then ${afterSync.syncSource}`);
} catch (error) {
  console.error(`Desktop render smoke failed at ${stage}: ${error.message}`);
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
}
