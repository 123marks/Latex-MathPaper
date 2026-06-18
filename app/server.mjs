import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const publicDir = join(__dirname, "public");
const userProviderConfig = join(root, "product", "runtime", "providers.local.json");
const exampleProviderConfig = join(root, "product", "runtime", "providers.example.json");
const knowledgeBasePath = join(root, "product", "knowledge-base.json");
const blueprintPath = join(root, "product", "workflows", "competition-blueprint.json");
const packageJsonPath = join(root, "package.json");

const port = Number(process.env.PAPER_OS_PORT || 3719);
const pythonCommand = process.env.PAPER_OS_PYTHON || "python";
const latexmkCommand = process.env.PAPER_OS_LATEXMK || "latexmk";
const runtimeProbeTimeoutMs = Number(process.env.PAPER_OS_RUNTIME_PROBE_TIMEOUT_MS || 2500);
const summaryStatusTimeoutMs = Number(process.env.PAPER_OS_SUMMARY_STATUS_TIMEOUT_MS || 7000);
const debugServer = process.env.PAPER_OS_SERVER_DEBUG === "1";

function debugLog(message, detail = "") {
  if (!debugServer) return;
  const suffix = detail ? ` ${detail}` : "";
  console.log(`[paper-os] ${message}${suffix}`);
}

export function withDeadline(promise, timeoutMs, fallback) {
  let timeoutHandle;
  const timeout = new Promise((resolvePromise) => {
    timeoutHandle = setTimeout(() => resolvePromise(fallback), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutHandle));
}

export function runCommand(command, args = [], options = {}) {
  return new Promise((resolvePromise) => {
    const timeoutMs = options.timeoutMs ?? 0;
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let settled = false;
    let timer;

    const finish = (code) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      resolvePromise({ code, stdout, stderr, timedOut });
    };

    const child = spawn(command, args, {
      cwd: options.cwd || root,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    debugLog("spawn", `${command} ${args.join(" ")}`);

    if (timeoutMs > 0) {
      timer = setTimeout(() => {
        timedOut = true;
        const message = `Command timed out after ${timeoutMs}ms`;
        stderr = stderr ? `${stderr.trimEnd()}\n${message}` : message;
        try {
          child.stdout?.destroy();
          child.stderr?.destroy();
          child.stdin?.destroy();
          if (process.platform === "win32" && child.pid) {
            const killer = spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], {
              stdio: "ignore",
              windowsHide: true,
            });
            killer.unref();
          } else {
            child.kill();
          }
          child.unref();
        } catch {
          // The process may already be exiting; finish still protects the caller.
        }
        debugLog("timeout", `${command} ${args.join(" ")}`);
        finish(124);
      }, timeoutMs);
    }

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });
    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });
    child.on("close", (code) => {
      debugLog("close", `${command} ${args.join(" ")} code=${code}`);
      finish(code ?? 1);
    });
    child.on("error", (error) => {
      stderr = stderr || error.message;
      finish(1);
    });
  });
}

export async function commandStatus(command, args = ["--version"], options = {}) {
  const timeoutMs = options.timeoutMs ?? runtimeProbeTimeoutMs;
  const result = await runCommand(command, args, { timeoutMs });
  const firstLine = (result.stdout || result.stderr).split(/\r?\n/)[0].trim();
  return {
    ok: result.code === 0 && !result.timedOut,
    detail: result.timedOut ? `timed out after ${timeoutMs}ms` : firstLine,
    timedOut: result.timedOut,
  };
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function sendText(res, status, text, contentType = "text/plain; charset=utf-8") {
  res.writeHead(status, {
    "Content-Type": contentType,
    "Content-Length": Buffer.byteLength(text),
  });
  res.end(text);
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf-8");
  return raw ? JSON.parse(raw) : {};
}

function runPaperctl(args, options = {}) {
  return runCommand(pythonCommand, ["paperctl.py", ...args], {
    cwd: root,
    timeoutMs: options.timeoutMs ?? 0,
  });
}

async function runRequiredPaperctl(args) {
  const result = await runPaperctl(args);
  if (result.code !== 0) {
    const detail = result.stderr || result.stdout || `paperctl exited with ${result.code}`;
    throw new Error(detail.trim());
  }
  return result;
}

function safeContestId(value) {
  if (!value || !/^[a-zA-Z0-9._-]+$/.test(value)) {
    throw new Error("contest id must use letters, numbers, dot, underscore, or dash");
  }
  return value;
}

function contestPath(contestId) {
  return join(root, "contests", safeContestId(contestId));
}

function ensureInside(base, candidate) {
  const resolvedBase = resolve(base);
  const resolvedCandidate = resolve(candidate);
  if (resolvedCandidate !== resolvedBase && !resolvedCandidate.startsWith(resolvedBase + sep)) {
    throw new Error("path escapes allowed workspace");
  }
  return resolvedCandidate;
}

function listContests() {
  const contestsDir = join(root, "contests");
  if (!existsSync(contestsDir)) return [];
  return readdirSync(contestsDir)
    .filter((name) => {
      const path = join(contestsDir, name);
      return statSync(path).isDirectory();
    })
    .sort();
}

function parseStatusOutput(text) {
  const statuses = {};
  let nextStage = "";
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^(intake|modeling|figure|writing|verification):\s+(\S+)\s+-\s+(.*)$/);
    if (match) statuses[match[1]] = { state: match[2], note: match[3] };
    if (line.startsWith("Next stage:")) nextStage = line.replace("Next stage:", "").trim();
  }
  return { statuses, nextStage, raw: text };
}

function readProviderConfig() {
  const path = existsSync(userProviderConfig) ? userProviderConfig : exampleProviderConfig;
  return JSON.parse(readFileSync(path, "utf-8"));
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf-8"));
}

function appVersion() {
  try {
    return readJson(packageJsonPath).version || "0.0.0";
  } catch {
    return "0.0.0";
  }
}

function matchesStage(item, stage) {
  const stages = item.stage || item.stages || [];
  return stages.map((value) => String(value).toLowerCase()).includes(stage.toLowerCase());
}

async function api(req, res, path) {
  if (req.method === "GET" && path === "/api/health") {
    return sendJson(res, 200, {
      ok: true,
      name: "Math Modeling Paper OS",
      version: appVersion(),
      port,
      node: process.version,
      root,
    });
  }

  if (req.method === "GET" && path === "/api/summary") {
    debugLog("summary start");
    const contests = listContests();
    const active = contests.includes("sample-contest") ? "sample-contest" : contests[0] || "";
    const statusPromise = active
      ? runPaperctl(["status", active], { timeoutMs: summaryStatusTimeoutMs })
      : Promise.resolve(null);
    const [statusResult, pythonStatus, latexmkStatus] = await Promise.all([
      withDeadline(statusPromise, summaryStatusTimeoutMs + 1000, {
        code: 124,
        stdout: "",
        stderr: "status timed out",
        timedOut: true,
      }),
      withDeadline(commandStatus(pythonCommand, ["--version"]), runtimeProbeTimeoutMs + 1000, {
        ok: false,
        detail: `timed out after ${runtimeProbeTimeoutMs}ms`,
        timedOut: true,
      }),
      withDeadline(commandStatus(latexmkCommand, ["--version"]), runtimeProbeTimeoutMs + 1000, {
        ok: false,
        detail: `timed out after ${runtimeProbeTimeoutMs}ms`,
        timedOut: true,
      }),
    ]);
    debugLog(
      "summary probes done",
      `status=${statusResult?.code ?? "none"} python=${pythonStatus.ok} latexmk=${latexmkStatus.ok}`,
    );
    const status = statusResult?.code === 0 ? parseStatusOutput(statusResult.stdout) : null;
    return sendJson(res, 200, {
      root,
      runtime: {
        url: `http://127.0.0.1:${port}`,
        port,
        node: process.version,
        python: pythonStatus,
        latexmk: latexmkStatus,
      },
      contests,
      activeContest: active,
      status,
      providerConfigPath: existsSync(userProviderConfig) ? userProviderConfig : exampleProviderConfig,
      providerConfig: readProviderConfig(),
    });
  }

  if (req.method === "GET" && path === "/api/intelligence") {
    const kb = readJson(knowledgeBasePath);
    const blueprint = readJson(blueprintPath);
    const stage = new URL(req.url, `http://localhost:${port}`).searchParams.get("stage") || "writing";
    return sendJson(res, 200, {
      stage,
      blueprint,
      skills: (kb.skill_candidates || []).filter((item) => matchesStage(item, stage)),
      mcp: (kb.mcp_candidates || []).filter((item) => matchesStage(item, stage)),
      principles: kb.principles || [],
    });
  }

  if (req.method === "POST" && path === "/api/contest") {
    const body = await readBody(req);
    const contestId = safeContestId(body.contestId);
    const args = ["init", contestId];
    if (body.force) args.push("--force");
    return sendJson(res, 200, await runPaperctl(args));
  }

  if (req.method === "POST" && path === "/api/onboard") {
    const body = await readBody(req);
    const contestId = safeContestId(body.contestId);
    const args = ["onboard", contestId];
    if (body.force) args.push("--force");
    const appendValues = (flag, values) => {
      for (const value of values || []) {
        if (value) args.push(flag, value);
      }
    };
    appendValues("--problem", body.problemFiles);
    appendValues("--data", body.dataFiles);
    appendValues("--reference", body.referenceFiles);
    appendValues("--skill", body.skillFiles);
    return sendJson(res, 200, await runPaperctl(args));
  }

  if (req.method === "GET" && path.startsWith("/api/contest/")) {
    const contestId = safeContestId(path.split("/")[3]);
    const [status, pipeline, verify] = await Promise.all([
      runPaperctl(["status", contestId]),
      runPaperctl(["pipeline", contestId]),
      runPaperctl(["verify", contestId]),
    ]);
    return sendJson(res, 200, {
      contestId,
      status: parseStatusOutput(status.stdout),
      pipeline,
      verify,
    });
  }

  if (req.method === "POST" && path === "/api/provider") {
    const body = await readBody(req);
    const result = await runRequiredPaperctl([
      "provider-set",
      "--provider-config",
      userProviderConfig,
      "--provider",
      body.provider || "default",
      "--base-url",
      body.base_url || "",
      "--api-key-env",
      body.api_key_env || "PAPER_OS_API_KEY",
      "--model",
      body.model || "",
      "--temperature",
      String(body.temperature ?? 0.2),
      "--timeout",
      String(body.timeout ?? 120),
    ]);
    return sendJson(res, 200, {
      providerConfig: readProviderConfig(),
      configPath: userProviderConfig,
      stdout: result.stdout,
    });
  }

  if (req.method === "POST" && path === "/api/upload") {
    const body = await readBody(req);
    const contestId = safeContestId(body.contestId);
    const kind = ["problem", "data", "reference", "skill"].includes(body.targetArea) ? body.targetArea : "reference";
    const result = await runRequiredPaperctl(["ingest", contestId, body.sourcePath || "", "--kind", kind]);
    return sendJson(res, 200, { stdout: result.stdout });
  }

  if (req.method === "POST" && path === "/api/run") {
    const body = await readBody(req);
    const contestId = safeContestId(body.contestId);
    const command = body.command || "status";
    const allowed = {
      status: ["status", contestId],
      pipeline: ["pipeline", contestId],
      advance: ["advance", contestId, "--dry-run"],
      verify: ["verify", contestId],
      build: ["build", contestId],
      "package-submission": ["package-submission", contestId, "--allow-warnings"],
      "skill-audit": ["skill-audit", body.stage || "writing"],
      "mcp-audit": ["mcp-audit"],
      "provider-check": [
        "provider-check",
        "--provider-config",
        existsSync(userProviderConfig) ? userProviderConfig : exampleProviderConfig,
      ],
      blueprint: ["blueprint"],
    };
    if (!allowed[command]) return sendJson(res, 400, { error: "unsupported command" });
    return sendJson(res, 200, await runPaperctl(allowed[command]));
  }

  return sendJson(res, 404, { error: "not found" });
}

function staticFile(res, path) {
  const cleanPath = path === "/" ? "/index.html" : path;
  const filePath = ensureInside(publicDir, join(publicDir, cleanPath));
  if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
    return sendText(res, 404, "Not found");
  }
  const ext = extname(filePath);
  const types = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".svg": "image/svg+xml",
  };
  sendText(res, 200, readFileSync(filePath), types[ext] || "application/octet-stream");
}

const server = createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`);
  if (url.pathname.startsWith("/api/")) {
    api(req, res, url.pathname).catch((error) => sendJson(res, 500, { error: error.message }));
  } else {
    try {
      staticFile(res, url.pathname);
    } catch (error) {
      sendText(res, 403, error.message);
    }
  }
});

export { server };

export function startServer() {
  return server.listen(port, "127.0.0.1", () => {
    console.log(`Math Modeling Paper OS running at http://127.0.0.1:${port}`);
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  startServer();
}
