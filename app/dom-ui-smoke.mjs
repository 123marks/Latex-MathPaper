import { spawn } from "node:child_process";
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

function assertIncludes(label, content, markers) {
  const missing = markers.filter((marker) => !content.includes(marker));
  if (missing.length) {
    throw new Error(`${label} missing markers: ${missing.join(", ")}`);
  }
}

const port = await getFreePort();
const child = spawn("node", ["app/server.mjs"], {
  env: { ...process.env, PAPER_OS_PORT: String(port) },
  stdio: ["ignore", "pipe", "pipe"],
  windowsHide: true,
});

let output = "";
child.stdout.on("data", (data) => {
  output += data.toString();
});
child.stderr.on("data", (data) => {
  output += data.toString();
});

try {
  let response;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    await delay(500);
    try {
      response = await fetchWithTimeout(`http://127.0.0.1:${port}/`, 8000);
      break;
    } catch {
      // Wait for the local server to bind.
    }
  }
  if (!response?.ok) throw new Error(`index failed: ${response?.status || "no response"}\n${output}`);
  const html = await response.text();

  assertIncludes("runtime HTML", html, [
    'body data-view="home"',
    'id="viewToggle"',
    'aria-pressed="false"',
    'id="enterAppBtn"',
    'id="backHomeBtn"',
    'class="official-site hero"',
    'class="app-shell"',
    "gateway-map",
    "route-beam",
    "signal-ledger",
    "paper-health",
    "tool-drawer",
    "data-drawer-tab",
    "data-drawer-panel",
    "Package Submission",
  ]);

  const health = await fetchWithTimeout(`http://127.0.0.1:${port}/api/health`, 8000);
  if (!health.ok) throw new Error(`health failed: ${health.status}`);
  const healthPayload = await health.json();
  if (healthPayload.name !== "Math Modeling Paper OS" || healthPayload.port !== port) {
    throw new Error("health payload mismatch");
  }

  const intelligence = await fetchWithTimeout(`http://127.0.0.1:${port}/api/intelligence?stage=writing`, 8000);
  if (!intelligence.ok) throw new Error(`intelligence failed: ${intelligence.status}`);
  const intelligencePayload = await intelligence.json();
  if (!Array.isArray(intelligencePayload.skills) || !Array.isArray(intelligencePayload.mcp)) {
    throw new Error("intelligence skills or mcp list missing");
  }

  console.log("DOM UI smoke OK");
  console.log(`Runtime: http://127.0.0.1:${port}`);
  console.log(`Writing skills: ${intelligencePayload.skills.length}`);
} catch (error) {
  console.error(output);
  console.error(error.message);
  process.exitCode = 1;
} finally {
  stopProcess(child);
}
