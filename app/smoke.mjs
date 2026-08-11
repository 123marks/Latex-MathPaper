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

let cookie = "";
async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const { timeout = 8000, ...fetchOptions } = options;
  const timeoutHandle = setTimeout(() => controller.abort(), timeout);
  try {
    const headers = { ...(fetchOptions.headers || {}) };
    if (cookie) headers.Cookie = cookie;
    const res = await fetch(url, { ...fetchOptions, headers, signal: controller.signal });
    const setc = res.headers.get("set-cookie");
    if (setc) cookie = setc.split(";")[0];
    return res;
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

async function jsonStep(name, path, options = {}) {
  const res = await step(name, () =>
    fetchWithTimeout(`http://127.0.0.1:${port}${path}`, options),
  );
  if (!res.ok) throw new Error(`${name} failed: ${res.status}`);
  return res.json();
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
  if (healthPayload.name !== "Paper OS") throw new Error("health.name mismatch");
  if (healthPayload.port !== port) throw new Error("health.port mismatch");

  // summary + intelligence backend contract
  const summary = await jsonStep("summary", "/api/summary", { timeout: 15000 });
  if (!Array.isArray(summary.contests)) throw new Error("summary.contests missing");
  if (!summary.runtime?.node) throw new Error("summary.runtime.node missing");
  const intel = await jsonStep("intelligence", "/api/intelligence?stage=figure");
  if (!Array.isArray(intel.skills)) throw new Error("intelligence.skills missing");

  // SPA shell: index serves the React mount point + hashed assets
  const html = await step("index", () =>
    fetchWithTimeout(`http://127.0.0.1:${port}/`, { timeout: 8000 }),
  );
  const htmlText = await html.text();
  if (!htmlText.includes('id="root"')) throw new Error("SPA root mount missing");
  if (!htmlText.includes("assets/")) throw new Error("built assets reference missing");

  // auth flow: register -> me -> logout -> me(null)
  const username = `smoke_${Date.now()}`;
  const reg = await jsonStep("register", "/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password: "smoke-password", displayName: "Smoke" }),
  });
  if (reg.user?.username !== username) throw new Error("register did not return user");
  const me = await jsonStep("auth/me", "/api/auth/me");
  if (me.user?.username !== username) throw new Error("session not established");

  // community: create a post under session, confirm it lists with the reply
  const created = await jsonStep("community/create", "/api/community/posts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: "smoke title", content: "smoke content", category: "讨论" }),
  });
  const postId = created.post?.id;
  if (!postId) throw new Error("community post not created");
  await jsonStep("community/reply", `/api/community/posts/${postId}/replies`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: "smoke reply" }),
  });
  const list = await jsonStep("community/list", "/api/community/posts");
  const found = (list.posts || []).find((p) => p.id === postId);
  if (!found || found.replies.length < 1) throw new Error("community post/reply not persisted");

  await jsonStep("logout", "/api/auth/logout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  const after = await jsonStep("auth/me after logout", "/api/auth/me");
  if (after.user !== null) throw new Error("logout did not clear session");

  console.log("App smoke OK");
} catch (error) {
  console.error(output);
  console.error(error.message);
  process.exitCode = 1;
} finally {
  stopChildProcess(child);
}
