// Desktop IDE Agent/Render work-mode smoke.
//
// Starts app/server.mjs against an isolated PAPER_OS_DATA_DIR, registers a
// temporary LaTeX folder as an external Workspace, opens /ide/ in a headless
// Chromium/Edge through CDP, and proves the slice-1 contract from
// docs/plans/2026-09-18-desktop-ide-dual-mode-plan.md:
//   - switching modes keeps Workspace, tabs, dirty buffers, and chat;
//   - the choice survives a full page reload;
//   - the Render stage is an honest empty state when no PDF exists;
//   - 1440/1280/1024/800 widths never overflow or overlap columns.
// Evidence: dist/visual-qa/desktop-mode-*.png + desktop-mode-behavior.json.

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 1280, height: 800 },
  { width: 1024, height: 768 },
  { width: 800, height: 600 },
];

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
  } catch {
    // cleanup must not mask the assertion result
  }
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
  const listeners = new Map();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const command = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) command.reject(new Error(message.error.message || "CDP command failed"));
      else command.resolve(message.result || {});
      return;
    }
    if (message.method && listeners.has(message.method)) {
      for (const listener of listeners.get(message.method)) listener(message.params || {});
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
      on(method, listener) {
        if (!listeners.has(method)) listeners.set(method, []);
        listeners.get(method).push(listener);
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

async function waitFor(cdp, expression, label, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await evaluate(cdp, expression)) return;
    await delay(200);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

async function setViewport(cdp, { width, height }) {
  await cdp.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
  await evaluate(cdp, "new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))");
  await delay(150);
}

// Everything the smoke compares before/after a mode switch, read in one shot.
const SNAPSHOT = `(() => {
  const rect = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 ? { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height } : null;
  };
  const text = (sel) => (document.querySelector(sel)?.textContent || "").trim();
  return {
    mode: document.querySelector('[data-testid=workbench-split]')?.dataset.mode || null,
    stored: (() => { try { return localStorage.getItem("paperos.workMode"); } catch { return null; } })(),
    workspace: document.querySelector('[data-testid=workspace-switcher] select')?.value || "",
    tabs: document.querySelectorAll(".tabs .tab .tab-ico").length,
    activeTab: text(".tabs .tab.active"),
    dirtyTabs: document.querySelectorAll(".tabs .tab .dot").length,
    chatMessages: document.querySelectorAll(".ai-stream .msg").length,
    streaming: document.querySelectorAll(".ai-stream .msg .who").length
      ? [...document.querySelectorAll(".ai-stream .msg .who")].some((el) => /正在输入/.test(el.textContent)) : false,
    editorPresent: Boolean(document.querySelector(".editor-wrap .monaco-editor")),
    editorFirstLine: text(".monaco-editor .view-lines .view-line"),
    renderStage: Boolean(rect(document.querySelector('[data-testid=render-stage]'))),
    renderStageText: text('[data-testid=render-stage] .render-stage-body'),
    renderEngine: text('[data-testid=render-engine]'),
    aiModeLabel: text('[data-testid=ai-mode-label]'),
    statusModeLabel: text('[data-testid=status-work-mode]'),
    agentPressed: document.querySelector('[data-testid=work-mode-agent]')?.getAttribute("aria-pressed"),
    renderPressed: document.querySelector('[data-testid=work-mode-render]')?.getAttribute("aria-pressed"),
    viewport: { width: window.innerWidth, height: window.innerHeight },
    scrollWidth: document.documentElement.scrollWidth,
    overflowX: document.documentElement.scrollWidth > window.innerWidth + 1,
    rects: {
      app: rect(document.querySelector(".ide-app")),
      main: rect(document.querySelector(".main")),
      split: rect(document.querySelector('[data-testid=workbench-split]')),
      titlebarLeft: rect(document.querySelector(".titlebar-left")),
      titlebarRight: rect(document.querySelector(".titlebar-right")),
      menubar: rect(document.querySelector(".menubar")),
      menubarCompact: rect(document.querySelector('[data-testid=menubar-compact]')),
      workspaceChip: rect(document.querySelector(".project-chip")),
      cmdk: rect(document.querySelector(".cmdk-btn")),
      modeSwitch: rect(document.querySelector('[data-testid=work-mode-switch]')),
      switchAgent: rect(document.querySelector('[data-testid=work-mode-agent]')),
      switchRender: rect(document.querySelector('[data-testid=work-mode-render]')),
      editor: rect(document.querySelector(".split > .editor-wrap")),
      stage: rect(document.querySelector('[data-testid=render-stage]')),
      pdf: rect(document.querySelector(".split > .pdf-pane")),
      assistant: rect(document.querySelector(".main > .ai-panel")),
      statusMode: rect(document.querySelector('[data-testid=status-work-mode]')),
    },
  };
})()`;

function intersects(a, b) {
  if (!a || !b) return false;
  return a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;
}

function assertLayout(snapshot, label) {
  const { viewport, rects } = snapshot;
  const fail = (message) => {
    throw new Error(`${label}: ${message}\n${JSON.stringify({ viewport, scrollWidth: snapshot.scrollWidth, rects }, null, 2)}`);
  };
  if (snapshot.overflowX) fail("page overflows horizontally");
  if (rects.main && rects.main.right > viewport.width + 0.5) fail(`main area extends past the viewport (${rects.main.right})`);
  // Title bar: the left group's children may overflow their flex box, so
  // check the actual controls against each other and the right group.
  const titleControls = ["menubar", "workspaceChip", "cmdk", "modeSwitch", "titlebarRight"].filter((key) => rects[key]);
  for (const key of ["workspaceChip", "cmdk", "modeSwitch", "titlebarRight"]) {
    if (!rects[key]) fail(`${key} is not visible`);
  }
  for (let i = 0; i < titleControls.length; i += 1) {
    for (let j = i + 1; j < titleControls.length; j += 1) {
      const a = titleControls[i];
      const b = titleControls[j];
      if (a === "modeSwitch" && b === "titlebarRight") continue; // the switch lives inside the right group
      if (intersects(rects[a], rects[b])) fail(`title bar ${a} overlaps ${b}`);
    }
  }
  for (const key of titleControls) {
    if (rects[key].right > viewport.width + 0.5 || rects[key].left < -0.5) fail(`title bar ${key} escapes the viewport`);
  }
  const compactExpected = viewport.width <= 1100;
  if (compactExpected !== Boolean(rects.menubarCompact)) fail(`compact menubar ${compactExpected ? "missing" : "unexpected"}`);
  if (rects.workspaceChip.width < 90) fail(`Workspace chip collapsed to ${rects.workspaceChip.width}px`);
  for (const key of ["switchAgent", "switchRender", "statusMode"]) {
    const r = rects[key];
    if (!r) fail(`${key} is not visible`);
    if (r.left < -0.5 || r.right > viewport.width + 0.5) fail(`${key} escapes the viewport`);
  }
  const columns = ["editor", "stage", "pdf", "assistant"].filter((key) => rects[key]);
  for (let i = 0; i < columns.length; i += 1) {
    for (let j = i + 1; j < columns.length; j += 1) {
      if (intersects(rects[columns[i]], rects[columns[j]])) fail(`${columns[i]} overlaps ${columns[j]}`);
    }
  }
  for (const key of columns) {
    const r = rects[key];
    if (r.right > viewport.width + 0.5) fail(`${key} extends past the viewport (${r.right})`);
    if (r.width < 200) fail(`${key} is narrower than 200px (${r.width})`);
  }
  if (!rects.assistant) fail("Assistant column is missing");
  if (snapshot.mode === "render" && !rects.stage && !rects.pdf) fail("Render mode shows neither stage nor PDF");
  if (snapshot.mode === "agent" && !rects.editor) fail("Agent mode hides the editor column");
}

async function screenshot(cdp, outPath, minBytes = 12_000) {
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

const browser = findBrowser();
if (!browser) {
  console.log("Desktop mode visual smoke SKIP: Chrome or Edge was not found.");
  process.exit(0);
}

const appPort = await freePort();
const remotePort = await freePort();
const stateRoot = mkdtempSync(join(tmpdir(), "paperos-mode-smoke-state-"));
const workspaceRoot = mkdtempSync(join(tmpdir(), "paperos-mode-smoke-ws-"));
const workspaceId = `mode-smoke-${process.pid}`;
mkdirSync(join(workspaceRoot, "sections"), { recursive: true });
writeFileSync(join(workspaceRoot, "main.tex"), [
  "\\documentclass{article}",
  "\\usepackage{amsmath}",
  "\\begin{document}",
  "\\section{Mode smoke}",
  "Inline $E = mc^2$ and display",
  "\\[ \\int_0^1 x^2 \\,dx = \\tfrac{1}{3} \\]",
  "\\input{sections/intro}",
  "\\end{document}",
  "",
].join("\n"), "utf8");
writeFileSync(join(workspaceRoot, "sections", "intro.tex"), "\\subsection{Intro}\nHello.\n", "utf8");

const server = spawn("node", ["app/server.mjs"], {
  env: { ...process.env, PAPER_OS_PORT: String(appPort), PAPER_OS_DATA_DIR: join(stateRoot, "data") },
  stdio: ["ignore", "pipe", "pipe"],
  windowsHide: true,
});
const profileDir = join(tmpdir(), `paperos-mode-smoke-profile-${process.pid}-${Date.now()}`);
let browserProcess;
let browserOutput = "";
let serverOutput = "";
let stage = "server health";
const dialogs = [];
server.stdout.on("data", (d) => { serverOutput += d.toString(); });
server.stderr.on("data", (d) => { serverOutput += d.toString(); });
server.on("exit", (code, signal) => { serverOutput += `[exit] code=${code} signal=${signal}\n`; });

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
  const registered = await api("/api/editor/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: workspaceId, name: "Mode smoke", path: workspaceRoot, pack: "latex" }),
  });
  if (registered.workspace?.pack !== "latex") throw new Error(`expected latex Pack, got ${registered.workspace?.pack}`);

  stage = "browser launch";
  browserProcess = spawn(browser, [
    "--headless=new", "--disable-gpu", "--disable-gpu-compositing", "--disable-accelerated-2d-canvas",
    "--disable-vulkan", "--use-gl=swiftshader", "--enable-unsafe-swiftshader",
    "--disable-features=VizDisplayCompositor,UseSkiaRenderer,DawnGraphite,Dawn",
    "--disable-dev-shm-usage", "--disable-extensions", "--no-first-run", "--no-default-browser-check",
    `--remote-debugging-port=${remotePort}`, `--user-data-dir=${profileDir}`, "--window-size=1440,900",
    `http://127.0.0.1:${appPort}/ide/`,
  ], { stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
  browserProcess.stdout.on("data", (d) => { browserOutput += d.toString(); });
  browserProcess.stderr.on("data", (d) => { browserOutput += d.toString(); });

  stage = "DevTools connection";
  const tab = await waitForTab(remotePort, appPort);
  const cdp = await connectCdp(tab.webSocketDebuggerUrl);
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  cdp.on("Page.javascriptDialogOpening", (params) => {
    dialogs.push(params.message);
    cdp.send("Page.handleJavaScriptDialog", { accept: true }).catch(() => {});
  });
  await setViewport(cdp, VIEWPORTS[0]);
  await waitFor(cdp, "Boolean(document.querySelector('[data-testid=workspace-switcher]'))", "desktop IDE boot");
  await evaluate(cdp, "document.fonts?.ready || Promise.resolve()");

  // Select the smoke Workspace (if the catalog put another one first) and
  // wait for the IDE's own auto-open of main.tex to land in Monaco.
  async function ensureSmokeWorkspaceOpen() {
    await waitFor(cdp, `[...document.querySelectorAll('[data-testid=workspace-switcher] option')].some((o) => o.value === ${JSON.stringify(workspaceId)})`, "Workspace catalog");
    await evaluate(cdp, `(() => {
      const select = document.querySelector('[data-testid=workspace-switcher] select');
      if (select.value === ${JSON.stringify(workspaceId)}) return select.value;
      const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set;
      setter.call(select, ${JSON.stringify(workspaceId)});
      select.dispatchEvent(new Event("change", { bubbles: true }));
      return select.value;
    })()`);
    await waitFor(cdp, `document.querySelector('[data-testid=workspace-switcher] select')?.value === ${JSON.stringify(workspaceId)} && /main\\.tex/.test(document.querySelector('.tabs .tab.active')?.textContent || '') && Boolean(document.querySelector('.editor-wrap .monaco-editor .view-lines .view-line'))`, "main.tex in Monaco");
    await waitFor(cdp, "(document.querySelector('[data-testid=workbench-split]')?.dataset.mode || '') !== ''", "workbench split");
  }

  stage = "open smoke Workspace";
  await ensureSmokeWorkspaceOpen();
  // Start from a known mode regardless of what an earlier run left behind.
  if ((await evaluate(cdp, SNAPSHOT)).mode !== "agent") {
    await clickSelector(cdp, "[data-testid=work-mode-agent]");
    await waitFor(cdp, "document.querySelector('[data-testid=workbench-split]')?.dataset.mode === 'agent'", "agent mode");
  }

  stage = "dirty the buffer";
  await clickSelector(cdp, ".monaco-editor .view-lines");
  await cdp.send("Input.insertText", { text: "% mode smoke edit " });
  await waitFor(cdp, "document.querySelectorAll('.tabs .tab .dot').length >= 1", "dirty tab marker", 10000);

  stage = "send a chat message";
  await evaluate(cdp, `(() => {
    const area = document.querySelector(".ai-input textarea");
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
    setter.call(area, "mode smoke: summarize this section");
    area.dispatchEvent(new Event("input", { bubbles: true }));
    return area.value;
  })()`);
  await clickSelector(cdp, ".ai-input button[type=submit]");
  await waitFor(cdp, "document.querySelectorAll('.ai-stream .msg').length >= 2 && ![...document.querySelectorAll('.ai-stream .msg .who')].some((el) => /正在输入/.test(el.textContent))", "chat round trip", 45000);

  stage = "agent snapshot";
  const before = await evaluate(cdp, SNAPSHOT);
  if (before.mode !== "agent" || before.agentPressed !== "true") throw new Error(`expected agent mode, got ${JSON.stringify(before)}`);
  if (!before.editorPresent || before.renderStage) throw new Error("agent mode must show the editor and no Render stage");
  if (before.dirtyTabs < 1) throw new Error("buffer is not dirty before the switch");
  if (before.chatMessages < 2) throw new Error("chat did not record the round trip");
  if (before.aiModeLabel !== "编辑" || before.statusModeLabel !== "编辑模式") throw new Error("mode labels do not say 编辑");

  stage = "switch to Render";
  await clickSelector(cdp, "[data-testid=work-mode-render]");
  await waitFor(cdp, "document.querySelector('[data-testid=workbench-split]')?.dataset.mode === 'render'", "render mode");
  await waitFor(cdp, "!/正在探测/.test(document.querySelector('[data-testid=render-engine]')?.textContent || '')", "engine probe", 15000).catch(() => {});
  const after = await evaluate(cdp, SNAPSHOT);
  const shared = ["workspace", "tabs", "activeTab", "dirtyTabs", "chatMessages", "editorFirstLine"];
  for (const key of shared) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      throw new Error(`mode switch changed ${key}: ${JSON.stringify(before[key])} -> ${JSON.stringify(after[key])}`);
    }
  }
  if (after.stored !== "render" || after.renderPressed !== "true") throw new Error(`Render mode not persisted: ${JSON.stringify(after)}`);
  if (!after.renderStage) throw new Error("Render mode without a PDF must show the Render stage");
  if (!after.editorPresent) throw new Error("Render mode at 1440px must keep the editor mounted");
  if (!/main\.tex/.test(after.renderStageText)) throw new Error(`Render stage does not name the compile target: ${after.renderStageText}`);
  if (after.aiModeLabel !== "预览" || after.statusModeLabel !== "预览模式") throw new Error("mode labels do not say 预览");
  assertLayout(after, "render 1440x900");

  stage = "reload persistence";
  await cdp.send("Page.reload", { ignoreCache: false });
  await delay(500);
  await waitFor(cdp, "Boolean(document.querySelector('[data-testid=workbench-split]'))", "IDE after reload");
  const reloadedEarly = await evaluate(cdp, SNAPSHOT);
  if (reloadedEarly.mode !== "render" || reloadedEarly.stored !== "render") throw new Error(`mode did not survive reload: ${JSON.stringify(reloadedEarly)}`);
  // Tabs are not persisted across reloads yet (documented boundary); the IDE
  // reopens main.tex itself, so wait for that instead of an empty editor.
  await ensureSmokeWorkspaceOpen();
  const reloaded = await evaluate(cdp, SNAPSHOT);
  if (reloaded.mode !== "render" || !reloaded.renderStage) throw new Error(`Render stage missing after reload: ${JSON.stringify(reloaded)}`);
  if (reloaded.workspace !== workspaceId) throw new Error(`Workspace did not survive reload: ${reloaded.workspace}`);

  stage = "switch back to Agent";
  await clickSelector(cdp, "[data-testid=work-mode-agent]");
  await waitFor(cdp, "document.querySelector('[data-testid=workbench-split]')?.dataset.mode === 'agent' && !document.querySelector('[data-testid=render-stage]')", "agent mode restored");
  const restored = await evaluate(cdp, SNAPSHOT);
  if (!restored.editorPresent || restored.stored !== "agent") throw new Error(`agent restore failed: ${JSON.stringify(restored)}`);

  stage = "viewport matrix";
  const outDir = join("dist", "visual-qa");
  mkdirSync(outDir, { recursive: true });
  const matrix = [];
  for (const mode of ["agent", "render"]) {
    await clickSelector(cdp, `[data-testid=work-mode-${mode}]`);
    await waitFor(cdp, `document.querySelector('[data-testid=workbench-split]')?.dataset.mode === '${mode}'`, `${mode} mode`);
    if (mode === "render") {
      // The engine probe (latexmk --version) can take a few seconds after reload;
      // the screenshots should show the settled state, not the probing copy.
      await waitFor(cdp, "!/正在探测/.test(document.querySelector('[data-testid=render-engine]')?.textContent || '')", "engine probe", 20000).catch(() => {});
    }
    for (const viewport of VIEWPORTS) {
      await setViewport(cdp, viewport);
      const label = `${mode} ${viewport.width}x${viewport.height}`;
      const snap = await evaluate(cdp, SNAPSHOT);
      assertLayout(snap, label);
      const file = join(outDir, `desktop-mode-${mode}-${viewport.width}x${viewport.height}.png`);
      await screenshot(cdp, file);
      matrix.push({ mode, viewport, overflowX: snap.overflowX, rects: snap.rects, editorPresent: snap.editorPresent, renderStage: snap.renderStage, file });
    }
  }
  await setViewport(cdp, VIEWPORTS[0]);
  cdp.close();

  const report = {
    schema: 1,
    generatedAt: new Date().toISOString(),
    browser,
    workspaceId,
    dialogs,
    before: { ...before, rects: undefined },
    after: { ...after, rects: undefined },
    reloaded: { ...reloaded, rects: undefined },
    restored: { ...restored, rects: undefined },
    matrix,
  };
  writeFileSync(join(outDir, "desktop-mode-behavior.json"), `${JSON.stringify(report, null, 2)}\n`);
  if (dialogs.length) throw new Error(`unexpected browser dialogs: ${dialogs.join(" | ")}`);

  console.log("Desktop mode visual smoke OK");
  console.log(JSON.stringify({
    before: { tabs: before.tabs, dirty: before.dirtyTabs, chat: before.chatMessages },
    after: { tabs: after.tabs, dirty: after.dirtyTabs, chat: after.chatMessages, stored: after.stored, engine: after.renderEngine },
    reloaded: { mode: reloaded.mode, workspace: reloaded.workspace },
    matrix: matrix.map((m) => `${m.mode} ${m.viewport.width}x${m.viewport.height}: overflowX=${m.overflowX} editor=${m.editorPresent} stage=${m.renderStage}`),
  }, null, 2));
} catch (error) {
  console.error(`Desktop mode visual smoke failed at ${stage}`);
  console.error(`Browser exit code: ${browserProcess?.exitCode ?? "not started"}; server exit code: ${server.exitCode ?? "running"}`);
  if (dialogs.length) console.error(`Dialogs: ${dialogs.join(" | ")}`);
  if (browserOutput.trim()) console.error(browserOutput.slice(-6000));
  if (serverOutput.trim()) console.error(serverOutput.slice(-4000));
  throw error;
} finally {
  stopProcess(browserProcess);
  stopProcess(server);
  await delay(300);
  for (const dir of [profileDir, stateRoot, workspaceRoot]) {
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
  }
}
