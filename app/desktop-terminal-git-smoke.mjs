// Desktop IDE slice 4 smoke: policy-gated terminal + honest git status.
// Isolated data dir. Evidence: dist/visual-qa/desktop-term-*.png
// and desktop-term-behavior.json.

import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

const TEX = [
  "\\documentclass{article}",
  "\\begin{document}",
  "Terminal smoke.",
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

async function typeTerminal(cdp, command) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const typed = await evaluate(cdp, `(() => {
      const input = document.querySelector("[data-testid=terminal-input]");
      const run = document.querySelector("[data-testid=terminal-run]");
      if (!input || input.disabled) return { ok: false, reason: "input-disabled" };
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
      setter.call(input, ${JSON.stringify(command)});
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      return {
        ok: input.value === ${JSON.stringify(command)} && run && !run.disabled,
        value: input.value,
        runDisabled: Boolean(run?.disabled),
      };
    })()`);
    if (typed?.ok) return typed;
    await delay(150);
  }
  throw new Error(`could not type ${command}`);
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
  return {
    git: text("[data-testid=status-git]"),
    repo: document.querySelector("[data-testid=status-git]")?.dataset.repo || null,
    terminalTab: Boolean(document.querySelector("[data-testid=terminal-tab]")),
    stream: text("[data-testid=terminal-stream]"),
    policy: /白名单/.test(document.querySelector(".term-path")?.textContent || ""),
    confirmCount: Number(window.__confirmCount || 0),
    lastConfirm: String(window.__lastConfirm || ""),
    editorPresent: Boolean(document.querySelector(".monaco-editor")),
  };
})()`;

const browser = findBrowser();
if (!browser) {
  console.log("Desktop terminal/git smoke SKIP: Chrome or Edge was not found.");
  process.exit(0);
}

const appPort = await freePort();
const remotePort = await freePort();
const stateRoot = mkdtempSync(join(tmpdir(), "paperos-term-smoke-state-"));
const workspaceRoot = mkdtempSync(join(tmpdir(), "paperos-term-smoke-ws-"));
const workspaceId = `term-smoke-${process.pid}`;
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
const profileDir = join(tmpdir(), `paperos-term-smoke-profile-${process.pid}-${Date.now()}`);
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
    body: JSON.stringify({ id: workspaceId, name: "Term git smoke", path: workspaceRoot, pack: "latex" }),
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
  await waitFor(cdp, `document.querySelector('[data-testid=workspace-switcher] select')?.value === ${JSON.stringify(workspaceId)}`, "workspace selected");
  await waitFor(cdp, "document.querySelector('[data-testid=status-git]')?.textContent?.includes('非 git')", "honest non-repo");

  await evaluate(cdp, `(() => {
    window.__confirmCount = 0;
    window.__lastConfirm = "";
    window.confirm = (message) => { window.__confirmCount += 1; window.__lastConfirm = String(message || ""); return false; };
    return true;
  })()`);

  const before = await evaluate(cdp, SNAPSHOT);
  if (before.repo !== "0" || !/非 git/.test(before.git)) {
    throw new Error(`expected 非 git: ${JSON.stringify(before)}`);
  }

  stage = "safe allowlisted command";
  await clickSelector(cdp, "[data-testid=terminal-tab]");
  await waitFor(cdp, "Boolean(document.querySelector('[data-testid=terminal-input]'))", "terminal input");
  await typeTerminal(cdp, "node -e \"console.log('TERM_OK')\"");
  await clickSelector(cdp, "[data-testid=terminal-run]");
  await waitFor(cdp, "document.querySelector('[data-testid=terminal-stream]')?.textContent?.includes('TERM_OK')", "TERM_OK output", 20000);
  const afterSafe = await evaluate(cdp, SNAPSHOT);
  if (afterSafe.confirmCount !== 0) throw new Error(`safe command used confirm: ${JSON.stringify(afterSafe)}`);
  if (!afterSafe.policy) throw new Error("terminal policy copy missing");

  stage = "rejected unsafe command";
  await waitFor(cdp, "document.querySelector('[data-testid=terminal-run]') && !document.querySelector('[data-testid=terminal-input]')?.disabled", "terminal idle");
  await typeTerminal(cdp, "rm -rf .");
  await clickSelector(cdp, "[data-testid=terminal-run]");
  await waitFor(cdp, "document.querySelector('[data-testid=terminal-stream]')?.textContent?.includes('不在允许列表')", "allowlist rejection");
  const afterReject = await evaluate(cdp, SNAPSHOT);
  if (afterReject.confirmCount !== 0) throw new Error("rejected command should not confirm");

  stage = "init real git repo";
  const git = (args) => {
    const result = spawnSync("git", args, { cwd: workspaceRoot, encoding: "utf-8" });
    if (result.status !== 0) {
      throw new Error(`git ${args.join(" ")} -> ${result.status}: ${(result.stderr || result.stdout || result.error?.message || "no output").trim()}`);
    }
    return result;
  };
  git(["--version"]);
  try {
    git(["init", "-q", "-b", "paper-os-term"]);
  } catch {
    git(["init", "-q"]);
    git(["checkout", "-q", "-b", "paper-os-term"]);
  }
  git(["config", "user.email", "t@example.com"]);
  git(["config", "user.name", "T"]);
  git(["add", "-A"]);
  git(["commit", "-q", "-m", "seed"]);
  await clickSelector(cdp, "[data-testid=status-git]");
  await waitFor(cdp, "document.querySelector('[data-testid=status-git]')?.textContent?.includes('paper-os-term')", "branch after refresh");

  stage = "dangerous command confirm";
  await waitFor(cdp, "document.querySelector('[data-testid=terminal-run]') && !document.querySelector('[data-testid=terminal-input]')?.disabled", "terminal idle before danger");
  await typeTerminal(cdp, "git reset --hard");
  await clickSelector(cdp, "[data-testid=terminal-run]");
  await waitFor(cdp, "window.__confirmCount >= 1", "danger confirm");
  const afterDanger = await evaluate(cdp, SNAPSHOT);
  if (!/git reset/.test(afterDanger.lastConfirm)) {
    throw new Error(`confirm text missing reset: ${afterDanger.lastConfirm}`);
  }
  if (/↳ 退出码/.test(afterDanger.stream) && afterDanger.stream.includes("git reset --hard") && /退出码 0/.test(afterDanger.stream.split("git reset --hard").pop() || "")) {
    throw new Error("denied dangerous command still ran");
  }

  const outDir = join("dist", "visual-qa");
  mkdirSync(outDir, { recursive: true });
  await screenshot(cdp, join(outDir, "desktop-term-ready.png"));
  await screenshot(cdp, join(outDir, "desktop-term-git.png"));
  cdp.close();

  writeFileSync(join(outDir, "desktop-term-behavior.json"), JSON.stringify({
    schema: 1,
    generatedAt: new Date().toISOString(),
    browser,
    workspaceId,
    before,
    afterSafe,
    afterReject,
    afterDanger,
  }, null, 2));
  console.log("Desktop terminal/git smoke OK");
  console.log(`  git before=${before.git} after=${afterDanger.git}`);
  console.log(`  safe confirm=${afterSafe.confirmCount} danger confirm=${afterDanger.confirmCount}`);
} catch (error) {
  console.error(`Desktop terminal/git smoke failed at ${stage}: ${error.message}`);
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
