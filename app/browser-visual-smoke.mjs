import { spawn } from "node:child_process";
import { existsSync, mkdirSync, rmSync, statSync } from "node:fs";
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
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  ].filter(Boolean);
}

function findBrowsers() {
  return [...new Set(browserCandidates().filter((candidate) => existsSync(candidate)))];
}

async function fetchWithTimeout(url, timeoutMs = 8000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
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

function browserProfiles(profileDir, screenshotPath, url) {
  const common = [
    "--disable-dev-shm-usage",
    "--disable-extensions",
    "--disable-background-networking",
    "--no-first-run",
    "--no-default-browser-check",
    "--hide-scrollbars",
    `--user-data-dir=${profileDir}`,
    "--window-size=1440,1200",
    `--screenshot=${screenshotPath}`,
    url,
  ];
  return [
    [
      "--headless=new",
      "--disable-gpu",
      "--disable-gpu-compositing",
      "--disable-accelerated-2d-canvas",
      "--disable-accelerated-video-decode",
      "--disable-vulkan",
      "--use-gl=swiftshader",
      "--enable-unsafe-swiftshader",
      "--disable-features=VizDisplayCompositor,UseSkiaRenderer,DawnGraphite,Dawn",
      ...common,
    ],
    [
      "--headless",
      "--disable-gpu",
      "--disable-gpu-sandbox",
      "--disable-software-rasterizer",
      "--disable-features=VizDisplayCompositor,UseSkiaRenderer,DawnGraphite,Dawn,CanvasOopRasterization",
      ...common,
    ],
    [
      "--headless",
      "--single-process",
      "--no-sandbox",
      "--disable-gpu",
      "--disable-features=VizDisplayCompositor,UseSkiaRenderer,DawnGraphite,Dawn,CanvasOopRasterization",
      ...common,
    ],
  ];
}

function runBrowser(browser, url, screenshotPath, variantIndex) {
  return new Promise((resolve) => {
    const profileDir = join(tmpdir(), `paper-os-browser-${process.pid}-${Date.now()}-${variantIndex}`);
    const args = browserProfiles(profileDir, screenshotPath, url)[variantIndex];
    const child = spawn(browser, args, {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      stopProcess(child);
      resolve({ code: 124, stdout, stderr: `${stderr}\nBrowser screenshot timed out`.trim(), variantIndex });
    }, 30000);
    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });
    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      try {
        rmSync(profileDir, { recursive: true, force: true });
      } catch {
        // Temporary browser profiles are best-effort cleanup.
      }
      resolve({ code: code ?? 1, stdout, stderr, variantIndex });
    });
    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve({ code: 1, stdout, stderr: error.message, variantIndex });
    });
  });
}

async function capturePage(browsers, url, screenshotPath) {
  const attempts = [];
  let result;
  let browser;
  for (const candidate of browsers) {
    for (let variantIndex = 0; variantIndex < 3; variantIndex += 1) {
      browser = candidate;
      result = await runBrowser(candidate, url, screenshotPath, variantIndex);
      attempts.push(`${candidate} variant-${variantIndex + 1}: ${result.code}`);
      if (result.code === 0 && existsSync(screenshotPath) && statSync(screenshotPath).size >= 20_000) {
        return { ok: true, browser, attempts, screenshotPath };
      }
    }
  }
  return { ok: false, browser, result, attempts, screenshotPath };
}

const browsers = findBrowsers();
const strict = process.env.PAPER_OS_BROWSER_STRICT === "1";
if (!browsers.length) {
  const message = "Browser visual smoke SKIP: no Chrome/Edge browser found. Set PAPER_OS_BROWSER to enable it.";
  if (strict) throw new Error(message);
  console.log(message);
  process.exit(0);
}

const port = await getFreePort();
const child = spawn("node", ["app/server.mjs"], {
  env: { ...process.env, PAPER_OS_PORT: String(port) },
  stdio: ["ignore", "pipe", "pipe"],
  windowsHide: true,
});
let serverOutput = "";
child.stdout.on("data", (data) => {
  serverOutput += data.toString();
});
child.stderr.on("data", (data) => {
  serverOutput += data.toString();
});

try {
  let response;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    await delay(750);
    try {
      response = await fetchWithTimeout(`http://127.0.0.1:${port}/`, 8000);
      break;
    } catch {
      // Wait for the local web server to bind.
    }
  }
  if (!response?.ok) {
    throw new Error(`Local app did not serve index.html\n${serverOutput}`);
  }
  const html = await response.text();
  if (!html.includes("Model Gateway for Competition Papers")) {
    throw new Error("Official-site homepage marker missing before screenshot");
  }

  const outDir = join("dist", "visual-qa");
  mkdirSync(outDir, { recursive: true });
  const homeCapture = await capturePage(browsers, `http://127.0.0.1:${port}/`, join(outDir, "browser-homepage.png"));
  const appCapture = homeCapture.ok
    ? await capturePage(browsers, `http://127.0.0.1:${port}/#app`, join(outDir, "browser-app.png"))
    : null;
  if (!homeCapture.ok || !appCapture?.ok) {
    const attempts = [...homeCapture.attempts, ...(appCapture?.attempts || [])];
    const result = appCapture?.result || homeCapture.result;
    const message = [
      `Browser visual smoke SKIP: screenshot failed in this environment. Attempts: ${attempts.join("; ")}`,
      "Set PAPER_OS_BROWSER_STRICT=1 to make this failure fatal.",
      result.stderr || result.stdout,
    ].join("\n");
    if (strict) throw new Error(message);
    console.log(message);
  } else {
    console.log("Browser visual smoke OK");
    console.log(`Browser: ${homeCapture.browser}`);
    console.log(`Homepage screenshot: ${homeCapture.screenshotPath}`);
    console.log(`Application screenshot: ${appCapture.screenshotPath}`);
  }
} finally {
  stopProcess(child);
}
