// T3.6 hero capture: drive the real Web Workbench to a verified AI "preview"
// state with a source file open, then screenshot it to web/public/hero-ide.png.
//
// This runs a headed Edge/Chrome with the real GPU on purpose: the Monaco editor
// does not composite into a screenshot under headless SwiftShader, so a headless
// capture leaves the editor pane blank. Requires no other browser instance to be
// holding the same debugging port. It boots an isolated server and Workspace, so
// it never touches real user data.

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import { connectCdp } from "./lib/cdp-client.mjs";

function findBrowser() {
  return [
    process.env.PAPER_OS_BROWSER,
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  ].filter(Boolean).find((candidate) => existsSync(candidate));
}

function getFreePort() {
  return new Promise((resolvePort, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const port = probe.address().port;
      probe.close(() => resolvePort(port));
    });
  });
}

async function fetchJson(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`${url}: ${response.status} ${JSON.stringify(payload)}`);
    return { response, payload };
  } finally {
    clearTimeout(timeout);
  }
}

async function waitForHealth(port) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    await delay(250);
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/health`);
      if (response.ok) return;
    } catch {
      // Server still binding.
    }
  }
  throw new Error("Paper OS server did not become healthy");
}

function cookiePair(headers, name) {
  const cookie = headers.getSetCookie().find((value) => value.startsWith(`${name}=`));
  if (!cookie) throw new Error(`Response did not return ${name}`);
  return cookie.split(";", 1)[0];
}

async function bootstrapSession(baseUrl) {
  const bootstrap = await fetchJson(`${baseUrl}/api/auth/bootstrap`);
  const bootstrapCookie = cookiePair(bootstrap.response.headers, "paper_os_local_bootstrap");
  const local = await fetchJson(`${baseUrl}/api/auth/local`, {
    method: "POST",
    headers: { Cookie: bootstrapCookie },
  });
  const sessionCookie = cookiePair(local.response.headers, "paper_os_session");
  return decodeURIComponent(sessionCookie.slice(sessionCookie.indexOf("=") + 1));
}

async function waitForTab(remotePort) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    await delay(250);
    try {
      const { payload: tabs } = await fetchJson(`http://127.0.0.1:${remotePort}/json`, {}, 3000);
      const tab = tabs.find((candidate) => candidate.type === "page" && candidate.webSocketDebuggerUrl);
      if (tab) return tab;
    } catch {
      // DevTools still binding.
    }
  }
  throw new Error("Browser DevTools tab did not become available");
}

async function evaluateValue(cdp, expression) {
  const result = await cdp.send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails) {
    const detail = result.exceptionDetails.exception?.description || result.exceptionDetails.text;
    throw new Error(`Browser evaluation failed: ${detail}`);
  }
  return result.result?.value;
}

async function waitForExpression(cdp, expression, label, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = await cdp.send("Runtime.evaluate", {
      expression: `Boolean(${expression})`,
      returnByValue: true,
    });
    if (result.result?.value) return;
    await delay(250);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

async function stopProcess(handle) {
  if (!handle?.pid || handle.exitCode !== null) return;
  handle.stdout?.destroy();
  handle.stderr?.destroy();
  if (process.platform !== "win32") {
    handle.kill();
    return;
  }
  await new Promise((done) => {
    const killer = spawn("taskkill", ["/pid", String(handle.pid), "/t", "/f"], {
      stdio: "ignore",
      windowsHide: true,
    });
    const timeout = setTimeout(done, 4000);
    killer.once("close", () => { clearTimeout(timeout); done(); });
    killer.once("error", () => { clearTimeout(timeout); done(); });
  });
}

const MAIN_TEX = [
  "\\documentclass{article}",
  "\\usepackage{amsmath}",
  "",
  "\\title{Weighted Residual Minimisation}",
  "\\author{Paper OS Workspace}",
  "",
  "\\begin{document}",
  "\\maketitle",
  "",
  "\\section{Methodology}",
  "We minimise the weighted residual between each observed",
  "value $y_i$ and the model prediction $\\hat{y}_i$:",
  "\\begin{equation}",
  "  L(\\theta) = \\sum_i w_i\\,(y_i - \\hat{y}_i)^2 + \\lambda \\lVert\\theta\\rVert^2",
  "\\end{equation}",
  "",
  "% evidence: results/model-fit.json",
  "The regularisation term keeps the estimator stable when the",
  "design matrix is ill-conditioned.",
  "\\end{document}",
  "",
].join("\n");

const browser = findBrowser();
if (!browser) {
  throw new Error("Hero capture needs Edge or Chrome. Set PAPER_OS_BROWSER to enable it.");
}

const heroPath = resolve("web/public/hero-ide.png");
const workspaceId = "hero-ide";
const appPort = await getFreePort();
const remotePort = await getFreePort();
const stateRoot = mkdtempSync(join(tmpdir(), "paper-os-hero-"));
const profileDir = join(stateRoot, "browser-profile");
const workspaceRoot = join(stateRoot, "workspace-hero");
mkdirSync(join(workspaceRoot, "paper"), { recursive: true });
writeFileSync(join(workspaceRoot, "paper", "main.tex"), MAIN_TEX);

const server = spawn("node", ["app/server.mjs"], {
  env: { ...process.env, PAPER_OS_DATA_DIR: join(stateRoot, "data"), PAPER_OS_PORT: String(appPort) },
  stdio: ["ignore", "pipe", "pipe"],
  windowsHide: true,
});
let browserProcess;
let cdp;

try {
  await waitForHealth(appPort);
  const baseUrl = `http://127.0.0.1:${appPort}`;
  const token = await bootstrapSession(baseUrl);

  await fetchJson(`${baseUrl}/api/editor/projects`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `paper_os_session=${encodeURIComponent(token)}`,
    },
    body: JSON.stringify({ id: workspaceId, name: "Hero capture", path: workspaceRoot, pack: "latex" }),
  });

  browserProcess = spawn(browser, [
    "--disable-extensions",
    "--no-first-run",
    "--no-default-browser-check",
    `--remote-debugging-port=${remotePort}`,
    `--user-data-dir=${profileDir}`,
    "--window-size=1460,980",
    "about:blank",
  ], { stdio: ["ignore", "pipe", "pipe"], windowsHide: true });

  const tab = await waitForTab(remotePort);
  cdp = await connectCdp(tab.webSocketDebuggerUrl);
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Network.enable");
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await cdp.send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: "no-preference" }],
  });
  const cookie = await cdp.send("Network.setCookie", {
    name: "paper_os_session",
    value: token,
    url: baseUrl,
    httpOnly: true,
    sameSite: "Lax",
  });
  if (!cookie.success) throw new Error("CDP rejected the isolated bootstrap session cookie");

  await cdp.send("Page.navigate", {
    url: `${baseUrl}/app/workbench?workspace=${encodeURIComponent(workspaceId)}`,
  });
  await waitForExpression(
    cdp,
    `location.pathname === "/app/workbench" && Boolean(document.querySelector(".ide")) && Boolean(document.querySelector("#workbench-ai-input"))`,
    "Workbench AI panel",
  );

  // Open the source file so the editor shows real LaTeX + a docked preview pane.
  const opened = await evaluateValue(
    cdp,
    `(() => {
      const item = [...document.querySelectorAll(".file-tree .item")]
        .find((el) => el.textContent.trim().startsWith("main.tex"));
      if (!item) return false;
      item.click();
      return true;
    })()`,
  );
  if (!opened) throw new Error("Workbench file tree did not expose main.tex");
  await waitForExpression(
    cdp,
    `Boolean([...document.querySelectorAll(".file-tree .item.active")].find((el) => el.textContent.includes("main.tex")))`,
    "main.tex selected in file tree",
  );
  await waitForExpression(
    cdp,
    `document.querySelectorAll(".monaco-editor .view-line").length > 3`,
    "Monaco editor rendered source lines",
  );

  // Drive the real AI review lifecycle to the reviewable "ready" preview state.
  await evaluateValue(
    cdp,
    `(() => {
      const input = document.querySelector("#workbench-ai-input");
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
      setter.call(input, "update [file:paper/main.tex]");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    })()`,
  );
  await evaluateValue(
    cdp,
    `(() => {
      const input = document.querySelector("#workbench-ai-input");
      const button = input?.closest("form")?.querySelector("button[type=submit]");
      if (button && !button.disabled) button.click();
    })()`,
  );
  await waitForExpression(
    cdp,
    `document.querySelector('[data-runtime="mock-local"]') && document.querySelector(".ai-proposal__state--ready")`,
    "mock-local proposal preview",
  );
  await delay(1200);

  const shot = await cdp.send("Page.captureScreenshot", { format: "png", fromSurface: true });
  writeFileSync(heroPath, Buffer.from(shot.data, "base64"));
  console.log(`Hero screenshot: ${heroPath}`);
} finally {
  try { cdp?.close?.(); } catch { /* ignore */ }
  await stopProcess(browserProcess);
  await stopProcess(server);
  await delay(1500);
  // Best-effort temp cleanup; Windows may still hold browser-profile locks briefly.
  try {
    rmSync(stateRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 400 });
  } catch {
    /* leave the temp dir for the OS to reap; never mask the real error */
  }
}
