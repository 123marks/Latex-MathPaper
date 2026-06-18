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

const port = await getFreePort();
const child = spawn("node", ["app/server.mjs"], {
  env: { ...process.env, PAPER_OS_PORT: String(port) },
  stdio: ["ignore", "pipe", "pipe"],
  windowsHide: true,
});

let output = "";
const debug = process.env.PAPER_OS_SMOKE_DEBUG === "1";
child.stdout.on("data", (data) => {
  output += data.toString();
});
child.stderr.on("data", (data) => {
  output += data.toString();
});

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const { timeout = 8000, ...fetchOptions } = options;
  const timeoutHandle = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, { ...fetchOptions, signal: controller.signal });
  } finally {
    clearTimeout(timeoutHandle);
  }
}

async function step(name, operation) {
  if (debug) console.log(`SMOKE ${name} start`);
  try {
    const result = await operation();
    if (debug) console.log(`SMOKE ${name} ok`);
    return result;
  } catch (error) {
    throw new Error(`${name} failed: ${error.message}`);
  }
}

function stopChildProcess(processHandle) {
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
    // Smoke test cleanup should not mask the assertion result.
  }
}

try {
  let health;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    await delay(750);
    try {
      health = await step(`health attempt ${attempt + 1}`, () =>
        fetchWithTimeout(`http://127.0.0.1:${port}/api/health`, { timeout: 5000 }),
      );
      break;
    } catch {
      // Keep retrying while the local server binds.
    }
  }
  if (!health) throw new Error(`health failed: server did not respond\n${output}`);
  if (!health.ok) throw new Error(`health failed: ${health.status}`);
  const healthPayload = await health.json();
  if (healthPayload.name !== "Math Modeling Paper OS") throw new Error("health.name mismatch");
  if (healthPayload.ok !== true) throw new Error("health.ok missing");
  if (healthPayload.port !== port) throw new Error("health.port mismatch");
  const response = await step("summary", () =>
    fetchWithTimeout(`http://127.0.0.1:${port}/api/summary`, { timeout: 15000 }),
  );
  if (!response) throw new Error(`summary failed: server did not respond\n${output}`);
  if (!response.ok) throw new Error(`summary failed: ${response.status}`);
  const summary = await response.json();
  if (!Array.isArray(summary.contests)) throw new Error("summary.contests missing");
  if (!summary.runtime?.port) throw new Error("summary.runtime.port missing");
  if (!summary.runtime?.node) throw new Error("summary.runtime.node missing");
  const intelligence = await step("intelligence", () =>
    fetchWithTimeout(`http://127.0.0.1:${port}/api/intelligence?stage=figure`, { timeout: 8000 }),
  );
  if (!intelligence.ok) throw new Error(`intelligence failed: ${intelligence.status}`);
  const intel = await intelligence.json();
  if (!Array.isArray(intel.skills)) throw new Error("intelligence.skills missing");
  const html = await step("index", () => fetchWithTimeout(`http://127.0.0.1:${port}/`, { timeout: 8000 }));
  if (!html.ok) throw new Error(`index failed: ${html.status}`);
  const htmlText = await html.text();
  if (!htmlText.includes("Model Gateway for Competition Papers")) {
    throw new Error("landing hero missing");
  }
  if (!htmlText.includes("Application Workbench")) throw new Error("app workbench shell missing");
  if (!htmlText.includes("Official Site")) throw new Error("official site shell missing");
  if (!htmlText.includes("Signal relay")) throw new Error("gateway relay shell missing");
  if (!htmlText.includes("Local Runtime")) throw new Error("runtime landing section missing");
  if (!htmlText.includes("MathModelingPaperOS.exe")) throw new Error("exe runtime marker missing");
  if (!htmlText.includes('data-view="home"')) throw new Error("home/app view shell missing");
  if (!htmlText.includes("viewToggle")) throw new Error("view toggle missing");
  if (!htmlText.includes("Back to Official Site")) throw new Error("back to homepage control missing");
  if (!htmlText.includes("ops-ribbon")) throw new Error("application operating ribbon missing");
  if (!htmlText.includes("gateway-node")) throw new Error("animated gateway preview missing");
  if (!htmlText.includes("model-orbit")) throw new Error("persistent model orbit missing");
  if (!htmlText.includes("traffic-lane")) throw new Error("continuous traffic lane missing");
  if (!htmlText.includes("Contest Onboard")) throw new Error("onboard panel missing");
  if (!htmlText.includes("Package Submission")) throw new Error("submission package action missing");
  console.log("App smoke OK");
} catch (error) {
  console.error(output);
  console.error(error.message);
  process.exitCode = 1;
} finally {
  stopChildProcess(child);
}
