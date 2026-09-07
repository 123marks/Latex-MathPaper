import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { WebSocketServer } from "ws";
import { existsSync, readFileSync, writeFileSync, renameSync, unlinkSync, chmodSync, rmSync, mkdirSync, readdirSync, lstatSync, statSync } from "node:fs";
import { basename, dirname, extname, join, resolve, sep } from "node:path";
import { cpus, freemem, loadavg, totalmem, uptime as osUptime } from "node:os";
import { fileURLToPath } from "node:url";

import { createStore } from "./lib/store.mjs";
import { createSecretBox } from "./lib/secret-box.mjs";
import { createSigner } from "./lib/signer.mjs";
import {
  hashPassword,
  verifyPassword,
  newToken,
  parseCookies,
  serializeCookie,
} from "./lib/auth.mjs";
import {
  WorkspaceKernelError,
  createWorkspaceKernel,
  safeWorkspaceId,
  workspaceIdFrom,
} from "./lib/workspaces.mjs";
import { readModelingStatus } from "./lib/modeling-status.mjs";
import { estimateCost, aggregateUsage } from "./lib/usage.mjs";
import { parseBibTeX } from "./lib/bibtex.mjs";
import {
  ANNOTATION_INTENTS,
  ANNOTATION_PRIORITIES,
  ANNOTATION_STATUSES,
  normalizeAnnotationTarget,
} from "./lib/annotations.mjs";
import { PLAN_LIMITS, effectivePlan, planLimits, trimUserThreads } from "./lib/plans.mjs";
import { paymentProviderStatus } from "./lib/payments.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const publicDir = join(__dirname, "public");
const ideDir = join(__dirname, "ide"); // Desktop IDE is kept OUTSIDE publicDir
// (Vite's web build uses emptyOutDir on publicDir, which would wipe the
// IDE on every web rebuild). The server routes /ide/* from ideDir.
const userProviderConfig = join(root, "product", "runtime", "providers.local.json");
const exampleProviderConfig = join(root, "product", "runtime", "providers.example.json");
const knowledgeBasePath = join(root, "product", "knowledge-base.json");
const blueprintPath = join(root, "product", "workflows", "competition-blueprint.json");
const packageJsonPath = join(root, "package.json");
const dataDir = resolve(process.env.PAPER_OS_DATA_DIR || join(__dirname, "data"));
const workspaceKernel = createWorkspaceKernel({
  repoRoot: root,
  registryPath: join(dataDir, "workspaces.json"),
  packsPath: join(root, "product", "workspace-packs.json"),
});

const SESSION_COOKIE = "paper_os_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
// Filesystem walker bounds (tree/search/export): a runaway or adversarial
// directory must not pin the event loop with an unbounded synchronous walk.
const WALKER_MAX_DEPTH = Number(process.env.PAPER_OS_WALKER_MAX_DEPTH || 24);
const WALKER_MAX_ENTRIES = Number(process.env.PAPER_OS_WALKER_MAX_ENTRIES || 20000);
const LOCAL_BOOTSTRAP_COOKIE = "paper_os_local_bootstrap";
const LOCAL_BOOTSTRAP_TTL_SECONDS = 60;
const localBootstrapTokens = new Map();
const DUMMY_BOOTSTRAP_TOKEN = Buffer.alloc(32);
const POST_CATEGORIES = ["讨论", "求助", "分享", "公告"];
const START_TIME = Date.now();

const usersStore = createStore(join(dataDir, "users.json"), { users: [] });
const sessionsStore = createStore(join(dataDir, "sessions.json"), { sessions: {} });
const postsStore = createStore(join(dataDir, "posts.json"), { posts: [] });
const auditStore = createStore(join(dataDir, "audit.json"), { entries: [] });
const contentStore = createStore(join(dataDir, "content.json"), {});
const skillsStore = createStore(join(dataDir, "skills.json"), { skills: defaultSkills() });
const teamsStore = createStore(join(dataDir, "teams.json"), { teams: [] });
const tasksStore = createStore(join(dataDir, "tasks.json"), { tasks: [] });
const installsStore = createStore(join(dataDir, "installs.json"), { installs: [] });
const chatStore = createStore(join(dataDir, "chat.json"), { threads: [] });
const licensesStore = createStore(join(dataDir, "licenses.json"), { codes: [] });
const usageStore = createStore(join(dataDir, "usage.json"), { records: [] });
// Per-user AI gateway config; the API key is stored encrypted (AES-256-GCM),
// never in plaintext and never returned to any client.
const accountProviderStore = createStore(join(dataDir, "account-providers.json"), { providers: {} });
const secretBox = createSecretBox({ keyPath: join(dataDir, ".secret-key") });
// Ed25519 signer for verifiable release manifests + downloads.
const releaseSigner = createSigner({ keyPath: join(dataDir, ".signing-key.pem") });
// System settings (admin-controllable): registration + login rate limits.
const systemSettingsStore = createStore(join(dataDir, "system.json"), {
  registrationOpen: true,
  loginRateMax: 15,
  loginRateWindowMinutes: 15,
});
function readSystemSettings() {
  const s = systemSettingsStore.read();
  return {
    registrationOpen: s.registrationOpen !== false,
    loginRateMax: Number.isFinite(s.loginRateMax) ? s.loginRateMax : 15,
    loginRateWindowMinutes: Number.isFinite(s.loginRateWindowMinutes) ? s.loginRateWindowMinutes : 15,
  };
}

// Per-1k-token pricing in USD (rough defaults; tune in admin later).
function recordUsage(userId, { model, kind, promptTokens = 0, completionTokens = 0, durationMs = 0, ok = true, workspace = "" }) {
  const cost = estimateCost(model, promptTokens, completionTokens);
  usageStore.update((d) => {
    d.records.push({
      id: newToken().slice(0, 10),
      userId,
      model,
      kind,
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      costUsd: Number(cost.toFixed(6)),
      durationMs,
      ok,
      workspace: String(workspace || "").slice(0, 64),
      at: new Date().toISOString(),
    });
    // keep the last 10k records
    if (d.records.length > 10000) d.records = d.records.slice(-10000);
    return d;
  });
}
function defaultSkills() {
  return [
    { id: "sci-figure", cat: "figure", name: "SCI Figure Studio", desc: "出版级科学图表,自动按 Nature 风格与配色出图,带图注主张。", team: "Paper OS Studio", ver: "1.4.2", installs: 12800, stars: "4.8",
      systemPrompt: "你是 SCI Figure Studio。接收用户给的 (数据, 描述),输出 Nature 风格的 LaTeX TikZ/Matplotlib 脚本,带图注主张(caption claim)。所有图必须自包含。",
      execute: "figure" },
    { id: "mcm-tutor", cat: "model", name: "美赛教练 Skill", desc: "方法选择、模型族、被否方案;按评委视角对每个方案给出 pros/cons。", team: "Modeling Guild", ver: "0.9.1", installs: 8400, stars: "4.7",
      systemPrompt: "你是 MCM/ICM 教练。给用户的问题至少给出 3 个候选模型族(线性规划/整数规划/启发式/机器学习/微分方程…),每个方案必须有 pros/cons/为什么在这个场景下选/不选。",
      execute: "model" },
    { id: "scientific-analysis", cat: "writing", name: "Scientific Analysis", desc: "把方法段落、实验段落改写为更紧凑、可被审稿人复述的语气。", team: "Paper OS Studio", ver: "2.0.0", installs: 6200, stars: "4.6",
      systemPrompt: "你是 Scientific Analysis 助手。接收一段论文方法或实验描述,把它改写为更紧凑、更可被审稿人复述的语气(不引入新事实)。",
      execute: "writing" },
    { id: "sensitivity-pro", cat: "model", name: "Sensitivity Pro", desc: "为当前模型自动生成参数灵敏度、稳健性、跨数据集敏感性分析。", team: "Open Quant", ver: "0.6.0", installs: 5100, stars: "4.6",
      systemPrompt: "你是 Sensitivity Pro。接收一个已训练的模型描述与数据集,输出参数扫描、扰动测试、跨数据集评估的最小可执行清单。",
      execute: "model" },
    { id: "tbl-icml", cat: "layout", name: "ICML Table", desc: "学术论文常见表格样式(数据表/对比表/显著性表),自动套用。", team: "Open Quant", ver: "1.0.0", installs: 4400, stars: "4.5",
      systemPrompt: "你是 ICML Table 助手。接收数据矩阵,产出 booktabs 风格的 LaTeX tabular 片段,带 toprule/midrule/bottomrule/显著性标注。",
      execute: "layout" },
    { id: "tao-ref", cat: "model", name: "TAO Refs", desc: "为优化/调度/分配类问题自动检索近 5 年顶会相关方法与文献。", team: "Modeling Guild", ver: "0.3.4", installs: 3700, stars: "4.4",
      systemPrompt: "你是 TAO Refs。接收一个优化/调度/分配类问题,推荐 3-5 个近 5 年顶会方法,带简短说明与一篇代表性引用。",
      execute: "model" },
    { id: "citation-verifier", cat: "proof", name: "Citation Verifier", desc: "校验论文引用的真实可达性、作者、出版年,标记可疑引用。", team: "Paper OS Studio", ver: "1.1.0", installs: 3200, stars: "4.5",
      systemPrompt: "你是 Citation Verifier。接收一行 BibTeX 或引用,产出可达性/作者/出版年核验结果,标记可疑项。",
      execute: "citation" },
    { id: "data-sniffer", cat: "figure", name: "Data Sniffer", desc: "上传 CSV/Excel,自动推荐可视化方案并产出图与统计摘要。", team: "Community", ver: "0.8.7", installs: 2900, stars: "4.3",
      systemPrompt: "你是 Data Sniffer。接收 CSV 路径,产出前 5 行预览、列类型、最合适的 1-2 种可视化建议。",
      execute: "csv" },
    { id: "review-loupe", cat: "proof", name: "Review Loupe", desc: "对论文做同行评审式批注:逻辑漏洞、证据缺口、可重现性。", team: "Paper OS Studio", ver: "0.5.1", installs: 2100, stars: "4.4",
      systemPrompt: "你是 Review Loupe。接收论文段落,产出 3-5 条同行评审式批注(逻辑漏洞 / 证据缺口 / 可重现性 / 措辞模糊),按严重度排序。",
      execute: "review" },
  ];
}

const CONTENT_DEFAULTS = {
  announcement: { enabled: false, text: "" },
  hero: {
    kicker: "本地模型网关 · 证据运行时 · LaTeX 交付",
    titleLines: ["路由模型，", "校验证据，", "交付论文。"],
    subtitle:
      "Paper OS 把 OpenAI 兼容的模型网关与确定性的 LaTeX 证据流水线结合，从官方赛题接入一路走到可验证的 PDF，不丢失任何一个数字。",
  },
};

const port = Number(process.env.PAPER_OS_PORT || 3719);
const pythonCommand = process.env.PAPER_OS_PYTHON || "python";
const latexmkCommand = process.env.PAPER_OS_LATEXMK || "latexmk";
const runtimeProbeTimeoutMs = Number(process.env.PAPER_OS_RUNTIME_PROBE_TIMEOUT_MS || 2500);
const debugServer = process.env.PAPER_OS_SERVER_DEBUG === "1";

const allowedHosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);
const allowedOrigins = new Set([`http://127.0.0.1:${port}`, `http://localhost:${port}`]);
function debugLog(message, detail = "") {
  if (!debugServer) return;
  const suffix = detail ? ` ${detail}` : "";
  console.log(`[paper-os] ${message}${suffix}`);
}


function rawHeaderValues(req, name) {
  const target = name.toLowerCase();
  const values = [];
  for (let index = 0; index < req.rawHeaders.length; index += 2) {
    if (String(req.rawHeaders[index]).toLowerCase() === target) {
      values.push(String(req.rawHeaders[index + 1] || ""));
    }
  }
  return values;
}

function requestPath(req) {
  const target = String(req.url || "");
  const queryIndex = target.indexOf("?");
  return queryIndex === -1 ? target : target.slice(0, queryIndex);
}

function requestPolicyError(req) {
  const hosts = rawHeaderValues(req, "host");
  if (hosts.length !== 1 || !allowedHosts.has(hosts[0])) {
    return { status: 421, code: "INVALID_HOST", error: "Loopback Host header required." };
  }
  const origins = rawHeaderValues(req, "origin");
  if (origins.length > 1 || (origins.length === 1 && !allowedOrigins.has(origins[0]))) {
    return { status: 403, code: "INVALID_ORIGIN", error: "Loopback Origin required." };
  }
  const method = String(req.method || "GET").toUpperCase();
  const unsafe = !["GET", "HEAD", "OPTIONS"].includes(method);
  const bootstrapGet = method === "GET" && requestPath(req) === "/api/auth/bootstrap";
  const crossSite = rawHeaderValues(req, "sec-fetch-site").some(
    (value) => value.toLowerCase() === "cross-site",
  );
  if (crossSite && (unsafe || bootstrapGet)) {
    return { status: 403, code: "CROSS_SITE_REQUEST", error: "Cross-site request rejected." };
  }
  return null;
}

function rejectUpgrade(socket, policy) {
  const reason = policy.status === 421 ? "Misdirected Request" : "Forbidden";
  const body = JSON.stringify({ error: policy.error, code: policy.code });
  socket.write(
    `HTTP/1.1 ${policy.status} ${reason}\r\n` +
    "Content-Type: application/json; charset=utf-8\r\n" +
    `Content-Length: ${Buffer.byteLength(body)}\r\n` +
    "Connection: close\r\n\r\n" +
    body,
  );
  socket.destroy();
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

// Check if a command exists on PATH (sync). Used to pick a compile engine.
function whichCommand(command) {
  if (!command) return null;
  if (command.includes("/") || command.includes("\\")) {
    return existsSync(command) ? command : null;
  }
  const pathEnv = process.env.PATH || process.env.Path || "";
  const sep = process.platform === "win32" ? ";" : ":";
  const exts = process.platform === "win32"
    ? (process.env.PATHEXT || ".EXE;.CMD;.BAT;.COM").split(";")
    : [""];
  for (const dir of pathEnv.split(sep)) {
    if (!dir) continue;
    for (const ext of exts) {
      const candidate = join(dir, command + ext);
      try { if (statSync(candidate).isFile()) return candidate; } catch { /* missing */ }
    }
  }
  return null;
}

function commandAvailability(command) {
  const path = whichCommand(command);
  return {
    ok: Boolean(path),
    detail: path || "not found on PATH",
    timedOut: false,
  };
}
function sendJson(res, status, payload) {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
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

// Cap request bodies so a hostile or buggy client cannot exhaust memory.
// Editor saves allow more headroom; everything else is small JSON.
const MAX_BODY_BYTES = Number(process.env.PAPER_OS_MAX_BODY_BYTES || 8 * 1024 * 1024);

class RequestBodyTooLarge extends Error {
  constructor() {
    super("请求体过大");
    this.code = "BODY_TOO_LARGE";
  }
}

function readBody(req, limit = MAX_BODY_BYTES) {
  return new Promise((resolvePromise, reject) => {
    const chunks = [];
    let size = 0;
    let done = false;
    const onData = (chunk) => {
      if (done) return;
      size += chunk.length;
      if (size > limit) {
        done = true;
        req.off("data", onData);
        req.off("end", onEnd);
        req.off("error", onError);
        // Stop consuming but leave the socket alive so the 413 response can be
        // written by the caller's catch handler.
        req.pause();
        reject(new RequestBodyTooLarge());
        return;
      }
      chunks.push(chunk);
    };
    const onEnd = () => {
      if (done) return;
      done = true;
      const raw = Buffer.concat(chunks).toString("utf-8");
      try {
        resolvePromise(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    };
    const onError = (error) => {
      if (done) return;
      done = true;
      reject(error);
    };
    req.on("data", onData);
    req.on("end", onEnd);
    req.on("error", onError);
  });
}

// In-memory sliding-window rate limiter (per key). Local-first: a single
// process, so a Map is sufficient and avoids external dependencies.
const rateBuckets = new Map();
function rateLimit(key, { windowMs, max }) {
  const now = Date.now();
  const bucket = (rateBuckets.get(key) || []).filter((t) => now - t < windowMs);
  if (bucket.length >= max) {
    const retryAfterMs = windowMs - (now - bucket[0]);
    rateBuckets.set(key, bucket);
    return { limited: true, retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)) };
  }
  bucket.push(now);
  rateBuckets.set(key, bucket);
  // Opportunistic cleanup so the Map cannot grow without bound.
  if (rateBuckets.size > 5000) {
    for (const [k, times] of rateBuckets) {
      if (!times.length || now - times[times.length - 1] > windowMs) rateBuckets.delete(k);
    }
  }
  return { limited: false };
}

function clientKey(req) {
  const socketIp = req.socket?.remoteAddress || "local";
  return socketIp;
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
  return safeWorkspaceId(value);
}

function queryWorkspaceId(url) {
  return workspaceIdFrom({
    workspace: url.searchParams.get("workspace"),
    contest: url.searchParams.get("contest"),
  });
}

function bodyWorkspaceId(body) {
  return workspaceIdFrom({
    workspace: body.workspace,
    contest: body.contest,
  });
}

function workspaceRoot(workspaceId) {
  return workspaceKernel.getWorkspace(workspaceId).root;
}

// Source snapshots (Mimir lesson): per-workspace state/snapshots/<id>.json
// holding one file's content at a known-good moment (e.g. successful compile).
// Capped per file so the folder never grows unbounded.
const SNAPSHOTS_PER_FILE = 20;
function snapshotsDir(workspaceId) {
  return join(workspaceRoot(workspaceId), "state", "snapshots");
}
function listSnapshots(workspaceId, relPath = null) {
  const dir = snapshotsDir(workspaceId);
  if (!existsSync(dir)) return [];
  const out = [];
  for (const name of readdirSync(dir)) {
    if (!name.endsWith(".json")) continue;
    try {
      const meta = JSON.parse(readFileSync(join(dir, name), "utf-8"));
      if (relPath && meta.path !== relPath) continue;
      out.push({ id: meta.id, path: meta.path, reason: meta.reason, createdAt: meta.createdAt, bytes: meta.bytes });
    } catch { /* skip corrupt snapshot */ }
  }
  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
function saveSnapshot(workspaceId, relPath, reason) {
  const source = workspacePath(workspaceId, relPath);
  if (!existsSync(source) || !statSync(source).isFile()) return null;
  const content = readFileSync(source, "utf-8");
  const dir = snapshotsDir(workspaceId);
  mkdirSync(dir, { recursive: true });
  const id = `${Date.now().toString(36)}-${newToken().slice(0, 6)}`;
  const meta = { id, path: relPath, reason, createdAt: new Date().toISOString(), bytes: Buffer.byteLength(content, "utf-8"), content };
  writeFileAtomic(join(dir, `${id}.json`), `${JSON.stringify(meta)}\n`);
  // Prune oldest beyond the per-file cap.
  const mine = listSnapshots(workspaceId, relPath);
  for (const old of mine.slice(SNAPSHOTS_PER_FILE)) {
    try { rmSync(join(dir, `${old.id}.json`), { force: true }); } catch { /* best effort */ }
  }
  return id;
}
function readSnapshot(workspaceId, id) {
  if (!/^[a-z0-9-]+$/i.test(String(id))) return null;
  const file = join(snapshotsDir(workspaceId), `${id}.json`);
  if (!existsSync(file)) return null;
  try { return JSON.parse(readFileSync(file, "utf-8")); } catch { return null; }
}

// Atomic document write (latex-stickies lesson): temp file in the same dir,
// then rename over the target, so a crash mid-write leaves the previous
// content intact instead of a truncated file.
function writeFileAtomic(filePath, content) {
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tmp, content, "utf-8");
  try {
    renameSync(tmp, filePath);
  } catch (error) {
    // Windows can refuse to rename over a file held open by another process;
    // fall back to an in-place write rather than losing the save.
    try { rmSync(tmp, { force: true }); } catch { /* best effort */ }
    if (error?.code === "EPERM" || error?.code === "EEXIST" || error?.code === "EBUSY") {
      writeFileSync(filePath, content, "utf-8");
      return;
    }
    throw error;
  }
}

function workspacePath(workspaceId, relativePath = ".", options = {}) {
  return workspaceKernel.resolvePath(workspaceId, relativePath, options);
}

// ── Visual review annotations (docs/redesign/09-integrations Epic 1a) ──
// Vocabulary + target normalisation live in lib/annotations.mjs; only the
// per-Workspace state/annotations.json storage glue stays here.
function annotationsPath(workspaceId) {
  return join(workspaceRoot(workspaceId), "state", "annotations.json");
}

function readAnnotations(workspaceId) {
  try {
    const filePath = annotationsPath(workspaceId);
    if (!existsSync(filePath)) return [];
    const parsed = JSON.parse(readFileSync(filePath, "utf-8"));
    return Array.isArray(parsed?.annotations) ? parsed.annotations : [];
  } catch {
    return [];
  }
}

function writeAnnotations(workspaceId, annotations) {
  const filePath = annotationsPath(workspaceId);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify({ annotations }, null, 2)}\n`, "utf-8");
}

function workspaceEntry(workspaceId, relativePath) {
  try {
    const absolute = workspacePath(workspaceId, relativePath);
    const stat = lstatSync(absolute);
    if (stat.isSymbolicLink()) return null;
    return { absolute, stat };
  } catch (error) {
    if (
      error instanceof WorkspaceKernelError ||
      error?.code === "ENOENT" ||
      error?.code === "ENOTDIR"
    ) return null;
    throw error;
  }
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
  return workspaceKernel
    .listWorkspaces()
    .filter((workspace) => workspace.source === "legacy-contest")
    .map((workspace) => workspace.id)
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

// ---- identity, sessions, RBAC ----
function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    email: user.email || "",
    displayName: user.displayName || user.username,
    role: user.role || "member",
    plan: user.plan || "free",
    planExpiresAt: user.planExpiresAt || null,
    createdAt: user.createdAt,
  };
}

// 许可证/激活码（诚实的付费骨架）：管理员签发 → 用户兑换 → 计划生效。
// 支付渠道（微信/支付宝/Stripe）需要真实商户凭据，这里不伪造对接——
// 收款在渠道外完成后由管理员发码，是自部署产品的常见诚实做法。
const LICENSE_PLANS = new Set(["pro", "team"]);
function formatLicenseCode(plan) {
  const raw = newToken().replace(/[^a-zA-Z0-9]/g, "").toUpperCase().padEnd(12, "X");
  return `${plan.slice(0, 3).toUpperCase()}-${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
}

function adminUserView(user, posts) {
  return {
    ...publicUser(user),
    status: user.status || "active",
    posts: posts.filter((p) => p.authorId === user.id).length,
  };
}

function pruneSessions(sessions) {
  const now = Date.now();
  for (const [token, session] of Object.entries(sessions)) {
    if (!session || session.expiresAt < now) delete sessions[token];
  }
  return sessions;
}

function getSessionUser(req) {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[SESSION_COOKIE];
  if (!token) return null;
  const { sessions } = sessionsStore.read();
  const session = sessions[token];
  if (!session || session.expiresAt < Date.now()) return null;
  const { users } = usersStore.read();
  const user = users.find((u) => u.id === session.userId) || null;
  if (user && user.status === "disabled") return null;
  return user;
}

function shortLabelFromUserAgent(userAgent = "") {
  const ua = String(userAgent);
  let os = "未知系统";
  if (/Windows/i.test(ua)) os = "Windows";
  else if (/Mac OS X|Macintosh/i.test(ua)) os = "macOS";
  else if (/Android/i.test(ua)) os = "Android";
  else if (/iPhone|iPad|iOS/i.test(ua)) os = "iOS";
  else if (/Linux/i.test(ua)) os = "Linux";
  let browser = "浏览器";
  if (/Edg\//i.test(ua)) browser = "Edge";
  else if (/Chrome\//i.test(ua)) browser = "Chrome";
  else if (/Firefox\//i.test(ua)) browser = "Firefox";
  else if (/Safari\//i.test(ua)) browser = "Safari";
  else if (/PaperOS|WebView2/i.test(ua)) browser = "桌面客户端";
  return `${os} · ${browser}`;
}

function startSession(res, userId, req = null) {
  const token = newToken();
  const expiresAt = Date.now() + SESSION_TTL_SECONDS * 1000;
  const label = shortLabelFromUserAgent(req?.headers?.["user-agent"]);
  sessionsStore.update((data) => {
    pruneSessions(data.sessions);
    data.sessions[token] = { userId, expiresAt, createdAt: Date.now(), label };
    return data;
  });
  res.setHeader(
    "Set-Cookie",
    serializeCookie(SESSION_COOKIE, token, { maxAge: SESSION_TTL_SECONDS }),
  );
  return token;
}

// ---- per-user AI gateway (encrypted key at rest) ----
function readAccountProvider(userId) {
  const { providers } = accountProviderStore.read();
  return providers[userId] || null;
}

// Resolve the effective provider for a user's AI calls: their own encrypted
// key first, otherwise fall back to the shared file-based provider so the
// product still works before a user configures anything.
function resolveEffectiveProvider(userId, requestedProfileId = null) {
  const own = readAccountProvider(userId);
  // 09-integrations Epic 4a/4b: a per-request profile override wins over the
  // activated profile; unknown ids simply fall through to the usual order.
  const wantedId = requestedProfileId || own?.activeProfileId;
  const active = own?.profiles?.find?.((p) => p.id === wantedId);
  if (active && active.apiKeyEnc) {
    const apiKey = secretBox.decrypt(active.apiKeyEnc);
    if (apiKey) {
      return {
        source: `profile:${active.name || active.id}`,
        base_url: active.base_url || "https://api.openai.com/v1",
        model: active.model || "gpt-4o",
        temperature: active.temperature ?? 0.2,
        apiKey,
      };
    }
  }
  if (own && own.apiKeyEnc) {
    const apiKey = secretBox.decrypt(own.apiKeyEnc);
    if (apiKey) {
      return {
        source: "user",
        base_url: own.base_url || "https://api.openai.com/v1",
        model: own.model || "gpt-4o",
        temperature: own.temperature ?? 0.2,
        apiKey,
      };
    }
  }
  try {
    const configPath = existsSync(userProviderConfig) ? userProviderConfig : exampleProviderConfig;
    const provider = loadProvider(configPath, "default");
    return {
      source: "fallback",
      base_url: provider.base_url || "",
      model: provider.model || "",
      temperature: provider.temperature ?? 0.2,
      apiKey: provider.api_key || "",
    };
  } catch {
    return { source: "none", base_url: "", model: "", temperature: 0.2, apiKey: "" };
  }
}

// Public (safe) view of a user's gateway config — NEVER includes the key.
function accountProviderView(userId) {
  const own = readAccountProvider(userId);
  const activeProfileId = own?.activeProfileId || null;
  const profiles = (own?.profiles || []).map((p) => ({
    id: p.id,
    name: p.name || "",
    base_url: p.base_url || "",
    model: p.model || "",
    temperature: p.temperature ?? 0.2,
    hasKey: Boolean(p.apiKeyEnc),
    active: p.id === activeProfileId,
    createdAt: p.createdAt || null,
  }));
  const activeProfile = profiles.find((p) => p.active && p.hasKey);
  const owner = usersStore.read().users.find((u) => u.id === userId) || null;
  const profileLimit = planLimits(owner).providerProfiles;
  if (own) {
    return {
      base_url: own.base_url || "",
      model: own.model || "",
      temperature: own.temperature ?? 0.2,
      hasKey: Boolean(own.apiKeyEnc),
      source: activeProfile ? "profile" : own.apiKeyEnc ? "user" : "fallback",
      updatedAt: own.updatedAt || null,
      profiles,
      activeProfileId,
      profileLimit,
    };
  }
  const effective = resolveEffectiveProvider(userId);
  return {
    base_url: effective.base_url,
    model: effective.model,
    temperature: effective.temperature,
    hasKey: false,
    source: effective.apiKey ? "fallback" : "none",
    updatedAt: null,
    profiles: [],
    activeProfileId: null,
    profileLimit,
  };
}

function userSessionsView(userId, currentToken) {
  const { sessions } = sessionsStore.read();
  const now = Date.now();
  return Object.entries(sessions)
    .filter(([, s]) => s && s.userId === userId && s.expiresAt > now)
    .map(([token, s]) => ({
      id: token.slice(0, 12),
      current: token === currentToken,
      createdAt: new Date(s.createdAt || now).toISOString(),
      expiresAt: new Date(s.expiresAt).toISOString(),
      label: s.label || "会话",
    }))
    .sort((a, b) => (a.current ? -1 : b.current ? 1 : b.createdAt.localeCompare(a.createdAt)));
}

function appendSetCookie(res, cookie) {
  const current = res.getHeader("Set-Cookie");
  if (!current) res.setHeader("Set-Cookie", cookie);
  else if (Array.isArray(current)) res.setHeader("Set-Cookie", [...current, cookie]);
  else res.setHeader("Set-Cookie", [String(current), cookie]);
}

function pruneLocalBootstrapTokens(now = Date.now()) {
  for (const [id, entry] of localBootstrapTokens) {
    if (entry.expiresAt <= now) localBootstrapTokens.delete(id);
  }
}

function issueLocalBootstrapToken() {
  pruneLocalBootstrapTokens();
  const token = randomBytes(32);
  const id = randomBytes(16).toString("hex");
  localBootstrapTokens.set(id, {
    token,
    expiresAt: Date.now() + LOCAL_BOOTSTRAP_TTL_SECONDS * 1000,
  });
  return token.toString("base64url");
}

function consumeLocalBootstrapToken(value) {
  const now = Date.now();
  pruneLocalBootstrapTokens(now);
  const text = String(value || "");
  let supplied = DUMMY_BOOTSTRAP_TOKEN;
  if (/^[A-Za-z0-9_-]{43}$/.test(text)) {
    const decoded = Buffer.from(text, "base64url");
    if (decoded.length === 32) supplied = decoded;
  }
  let matchedId = null;
  const entries = localBootstrapTokens.size
    ? [...localBootstrapTokens.entries()]
    : [[null, { token: DUMMY_BOOTSTRAP_TOKEN, expiresAt: 0 }]];
  for (const [id, entry] of entries) {
    const matches = timingSafeEqual(entry.token, supplied);
    if (matches && entry.expiresAt > now && matchedId === null) matchedId = id;
  }
  if (matchedId === null) return false;
  localBootstrapTokens.delete(matchedId);
  return true;
}

function localBootstrapCookie(value, maxAge) {
  return serializeCookie(LOCAL_BOOTSTRAP_COOKIE, value, {
    maxAge,
    path: "/api/auth/local",
    sameSite: "Strict",
  });
}

function clearSession(req, res) {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[SESSION_COOKIE];
  if (token) {
    sessionsStore.update((data) => {
      delete data.sessions[token];
      return data;
    });
  }
  res.setHeader("Set-Cookie", serializeCookie(SESSION_COOKIE, "", { maxAge: 0 }));
}

function killUserSessions(userId) {
  sessionsStore.update((data) => {
    for (const [token, session] of Object.entries(data.sessions)) {
      if (session.userId === userId) delete data.sessions[token];
    }
    return data;
  });
}

function requireUser(req, res) {
  const user = getSessionUser(req);
  if (!user) {
    sendJson(res, 401, { error: "请先登录" });
    return null;
  }
  return user;
}

function requireAdmin(req, res) {
  const user = requireUser(req, res);
  if (!user) return null;
  if (user.role !== "owner" && user.role !== "admin") {
    sendJson(res, 403, { error: "需要管理员权限" });
    return null;
  }
  return user;
}

// Password strength: >= 10 chars and at least two of {lower, upper, digit,
// symbol}. Returns an error string or null.
function passwordPolicyError(password) {
  const value = String(password || "");
  if (value.length < 10) return "密码至少需要 10 位";
  if (value.length > 256) return "密码过长";
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/].filter((re) => re.test(value)).length;
  if (classes < 2) return "密码需包含大小写字母、数字或符号中的至少两类";
  return null;
}

function validateCredentials(body) {
  const username = String(body.username || "").trim();
  const email = String(body.email || "").trim();
  const password = String(body.password || "");
  if (
    username.length < 3 ||
    username.length > 32 ||
    !/^[a-zA-Z0-9._-]+$/.test(username)
  ) {
    return { error: "用户名需为 3-32 位的字母、数字、点、下划线或短横线" };
  }
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { error: "邮箱格式不正确" };
  }
  const policy = passwordPolicyError(password);
  if (policy) return { error: policy };
  return { username, email, password };
}

// ---- audit + content + metrics ----
function audit(actor, action, detail = "") {
  auditStore.update((data) => {
    data.entries.push({
      id: newToken().slice(0, 10),
      at: new Date().toISOString(),
      actor: actor ? actor.displayName || actor.username : "system",
      actorId: actor?.id || "",
      role: actor?.role || "",
      action,
      detail,
    });
    if (data.entries.length > 500) data.entries = data.entries.slice(-500);
    return data;
  });
}

function readContent() {
  const saved = contentStore.read() || {};
  return {
    announcement: { ...CONTENT_DEFAULTS.announcement, ...(saved.announcement || {}) },
    hero: { ...CONTENT_DEFAULTS.hero, ...(saved.hero || {}) },
  };
}

const releasesPath = join(root, "product", "releases.json");
// Build the public release manifest. Each asset is checked against disk: when
// the artifact exists we expose its real size + SHA-256 and mark it available;
// otherwise the download endpoint returns a friendly "not ready" message.
function readReleases() {
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(releasesPath, "utf-8"));
  } catch {
    manifest = { version: appVersion(), channel: "stable", publishedAt: "", notes: [], assets: [] };
  }
  const assets = (manifest.assets || []).map((asset) => {
    const rel = String(asset.file || "");
    const absolutePath = rel ? join(root, rel) : "";
    let available = false;
    let size = 0;
    let sha256 = "";
    let filename = rel ? rel.split("/").pop() : "";
    try {
      if (absolutePath && statSync(absolutePath).isFile()) {
        const data = readFileSync(absolutePath);
        size = data.length;
        sha256 = createHash("sha256").update(data).digest("hex");
        available = true;
      }
    } catch {
      available = false;
    }
    return {
      os: asset.os,
      label: asset.label || "",
      ext: asset.ext || "",
      minimum: asset.minimum || "",
      filename,
      available,
      size,
      sha256,
      url: `/api/download/${asset.os}`,
      absolutePath,
    };
  });
  return {
    version: manifest.version || appVersion(),
    channel: manifest.channel || "stable",
    publishedAt: manifest.publishedAt || "",
    notes: Array.isArray(manifest.notes) ? manifest.notes : [],
    assets, // includes absolutePath; strip before sending to clients
  };
}

// Public manifest: server absolute paths removed, plus an Ed25519 signature
// over the canonical payload so clients can verify authenticity + integrity
// (version, per-asset filename/size/sha256) offline.
function publicReleases() {
  const manifest = readReleases();
  const payload = {
    version: manifest.version,
    channel: manifest.channel,
    publishedAt: manifest.publishedAt,
    notes: manifest.notes,
    assets: manifest.assets.map(({ absolutePath, url, ...rest }) => rest),
  };
  const canonical = JSON.stringify(payload);
  const signature = releaseSigner.sign(canonical);
  return {
    ...payload,
    assets: manifest.assets.map(({ absolutePath, ...rest }) => rest),
    signed: true,
    algorithm: releaseSigner.algorithm,
    signature,
    publicKey: releaseSigner.publicKeyBase64,
  };
}

function dayKey(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

function computeMetrics() {
  const { users } = usersStore.read();
  const { posts } = postsStore.read();
  const { sessions } = sessionsStore.read();
  const now = Date.now();
  const activeSessions = Object.values(sessions).filter(
    (s) => s && s.expiresAt > now,
  ).length;
  const replies = posts.reduce((n, p) => n + (p.replies?.length || 0), 0);
  const days = [];
  for (let i = 6; i >= 0; i -= 1) days.push(dayKey(now - i * 86400000));
  const series = (rows) =>
    days.map((day) => ({
      day,
      count: rows.filter((r) => String(r.createdAt).slice(0, 10) === day).length,
    }));
  const roles = { owner: 0, admin: 0, member: 0 };
  for (const u of users) roles[u.role] = (roles[u.role] || 0) + 1;
  return {
    totals: { users: users.length, posts: posts.length, replies, activeSessions },
    roles,
    signupSeries: series(users),
    postSeries: series(posts),
    uptimeSeconds: Math.floor((now - START_TIME) / 1000),
    generatedAt: new Date().toISOString(),
  };
}

async function api(req, res, path) {
  // ---- live metrics stream (SSE) ----
  if (req.method === "GET" && path === "/api/admin/stream") {
    const user = getSessionUser(req);
    if (!user || (user.role !== "owner" && user.role !== "admin")) {
      return sendJson(res, 403, { error: "需要管理员权限" });
    }
    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    });
    const push = () => {
      try {
        res.write(`data: ${JSON.stringify(computeMetrics())}\n\n`);
      } catch {
        // client gone; the close handler clears the interval
      }
    };
    push();
    const interval = setInterval(push, 4000);
    req.on("close", () => clearInterval(interval));
    return undefined;
  }

  if (req.method === "GET" && path === "/api/health") {
    return sendJson(res, 200, {
      ok: true,
      name: "Paper OS",
      version: appVersion(),
      port,
      node: process.version,
      root,
      uptimeSeconds: Math.floor((Date.now() - START_TIME) / 1000),
    });
  }

  if (req.method === "GET" && path === "/api/content") {
    return sendJson(res, 200, readContent());
  }

  // ---- releases + downloads (real artifacts + checksums when present) ----
  if (req.method === "GET" && path === "/api/releases") {
    return sendJson(res, 200, publicReleases());
  }

  // Public signing key (Ed25519) so clients/launcher can verify the manifest.
  if (req.method === "GET" && path === "/api/releases/pubkey") {
    return sendJson(res, 200, {
      algorithm: releaseSigner.algorithm,
      publicKey: releaseSigner.publicKeyBase64,
      publicKeyPem: releaseSigner.publicKeyPem,
    });
  }

  if (req.method === "GET" && /^\/api\/download\/[a-z0-9-]+$/.test(path)) {
    const os = path.split("/")[3];
    const manifest = readReleases();
    const asset = manifest.assets.find((a) => a.os === os);
    if (!asset) return sendJson(res, 404, { error: "未知平台", code: "UNKNOWN_OS" });
    if (!asset.available || !asset.absolutePath) {
      return sendJson(res, 404, {
        error: `${asset.label || os} 安装包尚未发布；请关注更新日志。`,
        code: "ASSET_NOT_READY",
      });
    }
    try {
      const data = readFileSync(asset.absolutePath);
      const filename = asset.filename || `PaperOS-${os}${asset.ext || ""}`;
      res.writeHead(200, {
        "Content-Type": "application/octet-stream",
        "Content-Length": data.length,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "X-Checksum-SHA256": asset.sha256 || "",
      });
      res.end(data);
      audit(getSessionUser(req), "download", `${os} ${manifest.version}`);
      return undefined;
    } catch {
      return sendJson(res, 500, { error: "下载失败", code: "DOWNLOAD_FAILED" });
    }
  }

  if (req.method === "GET" && path === "/api/summary") {
    debugLog("summary start");
    const workspaces = workspaceKernel.listWorkspaces();
    const activeWorkspace =
      workspaces.find((workspace) => workspace.id === "sample-contest")?.id ||
      workspaces[0]?.id ||
      "";
    const mathModelingWorkspaces = workspaces.filter(
      (workspace) => workspace.pack === "math-modeling",
    );
    const contests = listContests();
    const activeContest = contests.includes("sample-contest") ? "sample-contest" : contests[0] || "";
    const activeMathModelingWorkspace = activeContest || mathModelingWorkspaces[0]?.id || "";
    const status = activeMathModelingWorkspace
      ? readModelingStatus(workspaceKernel.getWorkspace(activeMathModelingWorkspace).root)
      : null;
    const pythonStatus = commandAvailability(pythonCommand);
    const latexmkStatus = commandAvailability(latexmkCommand);
    return sendJson(res, 200, {
      root,
      runtime: {
        url: `http://127.0.0.1:${port}`,
        port,
        node: process.version,
        python: pythonStatus,
        latexmk: latexmkStatus,
      },
      workspaces,
      activeWorkspace,
      mathModeling: {
        workspaces: mathModelingWorkspaces,
        activeWorkspace: activeMathModelingWorkspace,
        status,
      },
      contests,
      activeContest,
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
    if (!requireUser(req, res)) return undefined;
    const body = await readBody(req);
    const contestId = safeContestId(body.contestId);
    const args = ["init", contestId];
    if (body.force) args.push("--force");
    return sendJson(res, 200, await runPaperctl(args));
  }

  if (req.method === "POST" && path === "/api/onboard") {
    if (!requireUser(req, res)) return undefined;
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

  // Read the active provider config with secrets stripped: the IDE shows
  // the real configured model instead of pretending with a static list. The
  // effective provider prefers the caller's own encrypted key.
  if (req.method === "GET" && path === "/api/provider") {
    const user = requireUser(req, res);
    if (!user) return undefined;
    let config;
    try {
      config = readProviderConfig();
    } catch {
      config = { providers: {} };
    }
    const providers = Object.entries(config.providers || {}).map(([id, entry]) => ({
      id,
      kind: entry.kind || "openai-compatible",
      base_url: entry.base_url || "",
      api_key_env: entry.api_key_env || "",
      keyPresent: Boolean(entry.api_key_env && process.env[entry.api_key_env]),
      model: entry.model || "",
      temperature: entry.temperature ?? 0.2,
      timeout: entry.timeout ?? 120,
    }));
    const effective = resolveEffectiveProvider(user.id);
    const account = accountProviderView(user.id);
    const base = providers.find((entry) => entry.id === "default") || providers[0] || null;
    // active reflects what the caller's AI calls will actually use.
    const active = {
      ...(base || {}),
      base_url: effective.base_url,
      model: effective.model,
      temperature: effective.temperature,
      keyPresent: Boolean(effective.apiKey),
      source: effective.source,
    };
    return sendJson(res, 200, {
      providers,
      active,
      account,
      configured: existsSync(userProviderConfig),
      configPath: existsSync(userProviderConfig) ? userProviderConfig : exampleProviderConfig,
    });
  }

  if (req.method === "POST" && path === "/api/provider") {
    if (!requireUser(req, res)) return undefined;
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
    if (!requireUser(req, res)) return undefined;
    const body = await readBody(req);
    const contestId = safeContestId(body.contestId);
    const kind = ["problem", "data", "reference", "skill"].includes(body.targetArea) ? body.targetArea : "reference";
    const result = await runRequiredPaperctl(["ingest", contestId, body.sourcePath || "", "--kind", kind]);
    return sendJson(res, 200, { stdout: result.stdout });
  }

  if (req.method === "POST" && path === "/api/run") {
    if (!requireUser(req, res)) return undefined;
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

  // ---- auth ----
  if (req.method === "POST" && path === "/api/auth/register") {
    const rl = rateLimit(`register:${clientKey(req)}`, { windowMs: 60 * 60 * 1000, max: 20 });
    if (rl.limited) {
      res.setHeader("Retry-After", String(rl.retryAfterSeconds));
      return sendJson(res, 429, { error: "注册尝试过于频繁，请稍后再试", code: "RATE_LIMITED" });
    }
    const body = await readBody(req);
    const data0 = usersStore.read();
    // Registration can be closed by an admin — but always allow the very
    // first account (bootstraps the owner on a fresh install).
    if (!readSystemSettings().registrationOpen && data0.users.length > 0) {
      return sendJson(res, 403, { error: "注册已关闭，请联系管理员", code: "REGISTRATION_CLOSED" });
    }
    const result = validateCredentials(body);
    if (result.error) return sendJson(res, 400, { error: result.error });
    const data = usersStore.read();
    const taken = data.users.some(
      (u) =>
        u.username.toLowerCase() === result.username.toLowerCase() ||
        (result.email && u.email && u.email.toLowerCase() === result.email.toLowerCase()),
    );
    if (taken) return sendJson(res, 409, { error: "用户名或邮箱已被注册" });
    const user = {
      id: newToken().slice(0, 16),
      username: result.username,
      email: result.email,
      displayName:
        String(body.displayName || result.username).trim().slice(0, 48) || result.username,
      password: hashPassword(result.password),
      role: data.users.length === 0 ? "owner" : "member",
      status: "active",
      createdAt: new Date().toISOString(),
    };
    data.users.push(user);
    usersStore.write(data);
    startSession(res, user.id, req);
    audit(user, "auth.register", user.username);
    return sendJson(res, 200, { user: publicUser(user) });
  }

  if (req.method === "POST" && path === "/api/auth/login") {
    const sys = readSystemSettings();
    const rl = rateLimit(`login:${clientKey(req)}`, {
      windowMs: sys.loginRateWindowMinutes * 60 * 1000,
      max: sys.loginRateMax,
    });
    if (rl.limited) {
      res.setHeader("Retry-After", String(rl.retryAfterSeconds));
      return sendJson(res, 429, { error: "登录尝试过于频繁，请稍后再试", code: "RATE_LIMITED" });
    }
    const body = await readBody(req);
    const identifier = String(body.identifier || body.username || "").trim().toLowerCase();
    const password = String(body.password || "");
    if (!identifier || !password) {
      return sendJson(res, 400, { error: "请输入账号与密码" });
    }
    const { users } = usersStore.read();
    const user = users.find(
      (u) =>
        u.username.toLowerCase() === identifier ||
        (u.email && u.email.toLowerCase() === identifier),
    );
    if (!user || !verifyPassword(password, user.password)) {
      return sendJson(res, 401, { error: "账号或密码错误" });
    }
    if (user.status === "disabled") {
      return sendJson(res, 403, { error: "账号已被禁用，请联系管理员" });
    }
    startSession(res, user.id, req);
    audit(user, "auth.login", user.username);
    return sendJson(res, 200, { user: publicUser(user) });
  }

  if (req.method === "GET" && path === "/api/auth/bootstrap") {
    const token = issueLocalBootstrapToken();
    res.setHeader("Set-Cookie", localBootstrapCookie(token, LOCAL_BOOTSTRAP_TTL_SECONDS));
    return sendJson(res, 200, { ok: true, expiresInSeconds: LOCAL_BOOTSTRAP_TTL_SECONDS });
  }

  // Desktop local mode: no password, gated by a short-lived one-time bootstrap cookie.
  if (req.method === "POST" && path === "/api/auth/local") {
    let bootstrapToken = "";
    try {
      bootstrapToken = parseCookies(req.headers.cookie)[LOCAL_BOOTSTRAP_COOKIE] || "";
    } catch {
      bootstrapToken = "";
    }
    if (!consumeLocalBootstrapToken(bootstrapToken)) {
      return sendJson(res, 403, {
        error: "Local bootstrap authorization required.",
        code: "LOCAL_BOOTSTRAP_REQUIRED",
      });
    }
    const data = usersStore.read();
    let user = data.users.find((u) => u.username === "local") || data.users.find((u) => u.role === "owner");
    if (!user) {
      user = {
        id: newToken().slice(0, 16),
        username: "local",
        email: "local@paperos.local",
        displayName: "Local",
        password: hashPassword(newToken()),
        role: "owner",
        status: "active",
        createdAt: new Date().toISOString(),
      };
      data.users.push(user);
      usersStore.write(data);
    }
    startSession(res, user.id, req);
    audit(user, "auth.local", user.username);
    appendSetCookie(res, localBootstrapCookie("", 0));
    return sendJson(res, 200, { user: publicUser(user), mode: "local" });
  }

  if (req.method === "POST" && path === "/api/auth/logout") {
    clearSession(req, res);
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === "GET" && path === "/api/auth/me") {
    const me = getSessionUser(req);
    return sendJson(res, 200, { user: me ? publicUser(me) : null });
  }

  // ---- account self-service ----
  if (req.method === "GET" && path === "/api/account/overview") {
    const user = requireUser(req, res);
    if (!user) return undefined;
    const currentToken = parseCookies(req.headers.cookie)[SESSION_COOKIE] || "";
    return sendJson(res, 200, {
      user: publicUser(user),
      provider: accountProviderView(user.id),
      sessions: userSessionsView(user.id, currentToken),
    });
  }

  if (req.method === "PUT" && path === "/api/account/profile") {
    const user = requireUser(req, res);
    if (!user) return undefined;
    const body = await readBody(req);
    const nextDisplay = body.displayName === undefined
      ? user.displayName
      : String(body.displayName).trim().slice(0, 48);
    const nextEmail = body.email === undefined ? (user.email || "") : String(body.email).trim();
    if (nextDisplay !== undefined && nextDisplay.length < 1) {
      return sendJson(res, 400, { error: "显示名不能为空" });
    }
    if (nextEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(nextEmail)) {
      return sendJson(res, 400, { error: "邮箱格式不正确" });
    }
    let updated = null;
    let conflict = false;
    usersStore.update((data) => {
      if (nextEmail) {
        const taken = data.users.some(
          (u) => u.id !== user.id && u.email && u.email.toLowerCase() === nextEmail.toLowerCase(),
        );
        if (taken) { conflict = true; return data; }
      }
      const target = data.users.find((u) => u.id === user.id);
      if (target) {
        target.displayName = nextDisplay || target.displayName;
        target.email = nextEmail;
        updated = target;
      }
      return data;
    });
    if (conflict) return sendJson(res, 409, { error: "该邮箱已被其他账号使用" });
    if (!updated) return sendJson(res, 404, { error: "用户不存在" });
    audit(user, "account.profile", user.username);
    return sendJson(res, 200, { user: publicUser(updated) });
  }

  if (req.method === "POST" && path === "/api/account/password") {
    const user = requireUser(req, res);
    if (!user) return undefined;
    const body = await readBody(req);
    const current = String(body.current || "");
    const next = String(body.next || "");
    if (!verifyPassword(current, user.password)) {
      return sendJson(res, 400, { error: "当前密码不正确" });
    }
    const policy = passwordPolicyError(next);
    if (policy) return sendJson(res, 400, { error: policy });
    if (secretBox.safeEqual(current, next)) {
      return sendJson(res, 400, { error: "新密码不能与当前密码相同" });
    }
    usersStore.update((data) => {
      const target = data.users.find((u) => u.id === user.id);
      if (target) target.password = hashPassword(next);
      return data;
    });
    // Rotate: drop every other session, keep the caller signed in.
    const currentToken = parseCookies(req.headers.cookie)[SESSION_COOKIE] || "";
    sessionsStore.update((data) => {
      for (const [token, s] of Object.entries(data.sessions)) {
        if (s.userId === user.id && token !== currentToken) delete data.sessions[token];
      }
      return data;
    });
    audit(user, "account.password", user.username);
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === "PUT" && path === "/api/account/provider") {
    const user = requireUser(req, res);
    if (!user) return undefined;
    const body = await readBody(req);
    let saved = null;
    accountProviderStore.update((data) => {
      const prev = data.providers[user.id] || {};
      const next = { ...prev };
      if (body.base_url !== undefined) next.base_url = String(body.base_url).trim().slice(0, 300);
      if (body.model !== undefined) next.model = String(body.model).trim().slice(0, 120);
      if (body.temperature !== undefined) {
        const t = Number(body.temperature);
        next.temperature = Number.isFinite(t) ? Math.min(2, Math.max(0, t)) : 0.2;
      }
      if (body.apiKey !== undefined && String(body.apiKey).length > 0) {
        // Encrypt at rest; the plaintext key never persists and never leaves.
        next.apiKeyEnc = secretBox.encrypt(String(body.apiKey));
      }
      next.updatedAt = new Date().toISOString();
      data.providers[user.id] = next;
      saved = next;
      return data;
    });
    audit(user, "account.provider", body.apiKey ? "key+config" : "config");
    return sendJson(res, 200, { provider: accountProviderView(user.id) });
  }

  if (req.method === "DELETE" && path === "/api/account/provider/key") {
    const user = requireUser(req, res);
    if (!user) return undefined;
    accountProviderStore.update((data) => {
      const prev = data.providers[user.id];
      if (prev) {
        delete prev.apiKeyEnc;
        prev.updatedAt = new Date().toISOString();
      }
      return data;
    });
    audit(user, "account.provider", "key-removed");
    return sendJson(res, 200, { provider: accountProviderView(user.id) });
  }

  // Multi-provider profiles (09-integrations Epic 4a): named provider configs
  // per user; the activated one wins for AI calls, keys encrypted at rest.
  if (req.method === "POST" && path === "/api/account/providers") {
    const user = requireUser(req, res);
    if (!user) return undefined;
    const body = await readBody(req);
    const name = String(body.name || "").trim().slice(0, 60);
    const apiKey = String(body.apiKey || "");
    if (!name) return sendJson(res, 400, { error: "name is required" });
    if (!apiKey) return sendJson(res, 400, { error: "apiKey is required" });
    const existing = readAccountProvider(user.id);
    const profileLimit = planLimits(user).providerProfiles;
    if ((existing?.profiles?.length || 0) >= profileLimit) {
      return sendJson(res, 400, {
        error: `当前计划（${effectivePlan(user)}）最多 ${profileLimit} 个 provider 档案${effectivePlan(user) === "free" ? `，升级 Pro 可到 ${PLAN_LIMITS.pro.providerProfiles} 个` : ""}`,
        code: "PLAN_LIMIT",
        limit: profileLimit,
        plan: effectivePlan(user),
      });
    }
    const t = Number(body.temperature);
    const profile = {
      id: newToken().slice(0, 10),
      name,
      base_url: String(body.base_url || "https://api.openai.com/v1").trim().slice(0, 300),
      model: String(body.model || "gpt-4o").trim().slice(0, 120),
      temperature: Number.isFinite(t) ? Math.min(2, Math.max(0, t)) : 0.2,
      apiKeyEnc: secretBox.encrypt(apiKey),
      createdAt: new Date().toISOString(),
    };
    accountProviderStore.update((data) => {
      const prev = data.providers[user.id] || {};
      const profiles = Array.isArray(prev.profiles) ? prev.profiles : [];
      profiles.push(profile);
      const next = { ...prev, profiles };
      if (!next.activeProfileId) next.activeProfileId = profile.id;
      next.updatedAt = new Date().toISOString();
      data.providers[user.id] = next;
      return data;
    });
    audit(user, "account.provider", `profile-added:${name}`);
    return sendJson(res, 201, { provider: accountProviderView(user.id) });
  }

  if (req.method === "POST" && path === "/api/account/providers/activate") {
    const user = requireUser(req, res);
    if (!user) return undefined;
    const body = await readBody(req);
    const id = String(body.id || "");
    const own = readAccountProvider(user.id);
    if (!own?.profiles?.some((p) => p.id === id)) {
      return sendJson(res, 404, { error: "profile not found" });
    }
    accountProviderStore.update((data) => {
      const prev = data.providers[user.id];
      prev.activeProfileId = id;
      prev.updatedAt = new Date().toISOString();
      return data;
    });
    audit(user, "account.provider", `profile-activated:${id}`);
    return sendJson(res, 200, { provider: accountProviderView(user.id) });
  }

  if (req.method === "DELETE" && /^\/api\/account\/providers\/[\w-]+$/.test(path)) {
    const user = requireUser(req, res);
    if (!user) return undefined;
    const id = path.split("/").pop();
    const own = readAccountProvider(user.id);
    if (!own?.profiles?.some((p) => p.id === id)) {
      return sendJson(res, 404, { error: "profile not found" });
    }
    accountProviderStore.update((data) => {
      const prev = data.providers[user.id];
      prev.profiles = prev.profiles.filter((p) => p.id !== id);
      if (prev.activeProfileId === id) prev.activeProfileId = null;
      prev.updatedAt = new Date().toISOString();
      return data;
    });
    audit(user, "account.provider", `profile-removed:${id}`);
    return sendJson(res, 200, { provider: accountProviderView(user.id) });
  }

  // 兑换激活码：设置/续期用户计划（同计划未到期则从到期日顺延）。
  if (req.method === "POST" && path === "/api/account/redeem") {
    const user = requireUser(req, res);
    if (!user) return undefined;
    const body = await readBody(req);
    const code = String(body.code || "").trim().toUpperCase();
    if (!code) return sendJson(res, 400, { error: "请输入激活码" });
    let entry = null;
    let conflict = false;
    licensesStore.update((data) => {
      const found = data.codes.find((c) => c.code === code);
      if (!found) return data;
      if (found.redeemedBy) { conflict = true; return data; }
      found.redeemedBy = user.id;
      found.redeemedAt = new Date().toISOString();
      entry = found;
      return data;
    });
    if (conflict) return sendJson(res, 409, { error: "该激活码已被使用" });
    if (!entry) return sendJson(res, 404, { error: "激活码不存在，请检查输入" });
    let updated = null;
    usersStore.update((data) => {
      const target = data.users.find((u) => u.id === user.id);
      if (!target) return data;
      const now = Date.now();
      const sameActivePlan = target.plan === entry.plan
        && target.planExpiresAt
        && new Date(target.planExpiresAt).getTime() > now;
      const base = sameActivePlan ? new Date(target.planExpiresAt).getTime() : now;
      target.plan = entry.plan;
      target.planExpiresAt = new Date(base + entry.days * 86400000).toISOString();
      updated = target;
      return data;
    });
    audit(user, "account.redeem", `${entry.plan} +${entry.days}d (${code.slice(0, 8)}…)`);
    return sendJson(res, 200, { plan: updated?.plan, planExpiresAt: updated?.planExpiresAt });
  }

  // 管理员签发激活码。
  if (req.method === "POST" && path === "/api/admin/licenses") {
    const actor = requireAdmin(req, res);
    if (!actor) return undefined;
    const body = await readBody(req);
    const plan = String(body.plan || "pro");
    if (!LICENSE_PLANS.has(plan)) return sendJson(res, 400, { error: "plan 只支持 pro / team" });
    const days = Math.min(3650, Math.max(1, Math.floor(Number(body.days) || 365)));
    const count = Math.min(50, Math.max(1, Math.floor(Number(body.count) || 1)));
    const created = [];
    licensesStore.update((data) => {
      for (let i = 0; i < count; i += 1) {
        const entry = {
          code: formatLicenseCode(plan),
          plan,
          days,
          createdBy: actor.id,
          createdAt: new Date().toISOString(),
          redeemedBy: null,
          redeemedAt: null,
        };
        data.codes.push(entry);
        created.push(entry);
      }
      return data;
    });
    audit(actor, "admin.license.issue", `${plan} x${count} (${days}d)`);
    return sendJson(res, 201, { codes: created });
  }

  // 支付通道状态（诚实骨架）：manual 可用；其余按环境凭据如实报告。
  if (req.method === "GET" && path === "/api/admin/payments") {
    if (!requireAdmin(req, res)) return undefined;
    return sendJson(res, 200, { providers: paymentProviderStatus() });
  }

  if (req.method === "GET" && path === "/api/admin/licenses") {
    if (!requireAdmin(req, res)) return undefined;
    const { users } = usersStore.read();
    const byId = new Map(users.map((u) => [u.id, u]));
    const codes = licensesStore.read().codes
      .slice()
      .reverse()
      .map((c) => ({
        ...c,
        redeemedByName: c.redeemedBy
          ? (byId.get(c.redeemedBy)?.displayName || byId.get(c.redeemedBy)?.username || "已注销用户")
          : null,
      }));
    return sendJson(res, 200, { codes });
  }

  if (req.method === "POST" && path === "/api/account/sessions/revoke-others") {
    const user = requireUser(req, res);
    if (!user) return undefined;
    const currentToken = parseCookies(req.headers.cookie)[SESSION_COOKIE] || "";
    let kept = 0;
    sessionsStore.update((data) => {
      for (const [token, s] of Object.entries(data.sessions)) {
        if (s.userId === user.id && token !== currentToken) delete data.sessions[token];
      }
      kept = Object.values(data.sessions).filter((s) => s.userId === user.id).length;
      return data;
    });
    audit(user, "account.sessions", "revoke-others");
    return sendJson(res, 200, { ok: true, kept });
  }

  // ---- community ----
  if (req.method === "GET" && path === "/api/community/posts") {
    const { posts } = postsStore.read();
    const sorted = posts
      .slice()
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    return sendJson(res, 200, { posts: sorted });
  }

  if (req.method === "POST" && path === "/api/community/posts") {
    const user = requireUser(req, res);
    if (!user) return undefined;
    const body = await readBody(req);
    const title = String(body.title || "").trim().slice(0, 120);
    const content = String(body.content || body.body || "").trim().slice(0, 4000);
    const category = POST_CATEGORIES.includes(body.category) ? body.category : "讨论";
    if (title.length < 2 || content.length < 2) {
      return sendJson(res, 400, { error: "标题和内容不能为空" });
    }
    const post = {
      id: newToken().slice(0, 12),
      title,
      content,
      category,
      author: user.displayName || user.username,
      authorId: user.id,
      createdAt: new Date().toISOString(),
      replies: [],
    };
    postsStore.update((data) => {
      data.posts.push(post);
      return data;
    });
    return sendJson(res, 200, { post });
  }

  if (req.method === "POST" && /^\/api\/community\/posts\/[\w-]+\/replies$/.test(path)) {
    const user = requireUser(req, res);
    if (!user) return undefined;
    const id = path.split("/")[4];
    const body = await readBody(req);
    const content = String(body.content || "").trim().slice(0, 2000);
    if (content.length < 1) return sendJson(res, 400, { error: "回复不能为空" });
    let reply = null;
    postsStore.update((data) => {
      const post = data.posts.find((p) => p.id === id);
      if (post) {
        reply = {
          id: newToken().slice(0, 10),
          content,
          author: user.displayName || user.username,
          createdAt: new Date().toISOString(),
        };
        post.replies.push(reply);
      }
      return data;
    });
    if (!reply) return sendJson(res, 404, { error: "帖子不存在" });
    return sendJson(res, 200, { reply });
  }

  // 源码快照：列出 / 手动创建 / 回滚（回滚前先自动存一份当前内容，可再回去）。
  if (req.method === "GET" && path === "/api/editor/snapshots") {
    const user = requireUser(req, res);
    if (!user) return undefined;
    const url = new URL(req.url, `http://localhost:${port}`);
    const workspaceId = queryWorkspaceId(url);
    workspaceRoot(workspaceId); // kernel error -> mapped 404
    const relPath = String(url.searchParams.get("path") || "").replace(/^\/+/, "") || null;
    return sendJson(res, 200, { snapshots: listSnapshots(workspaceId, relPath) });
  }

  if (req.method === "POST" && path === "/api/editor/snapshots") {
    const user = requireUser(req, res);
    if (!user) return undefined;
    const body = await readBody(req);
    const workspaceId = bodyWorkspaceId(body);
    const relPath = String(body.path || "").replace(/^\/+/, "");
    if (!relPath || relPath.includes("..") || relPath.includes("\\")) return sendJson(res, 400, { error: "invalid path" });
    const id = saveSnapshot(workspaceId, relPath, String(body.reason || "manual").slice(0, 40));
    if (!id) return sendJson(res, 404, { error: "file not found" });
    audit(user, "snapshot.create", `${workspaceId}/${relPath}`);
    return sendJson(res, 201, { id, snapshots: listSnapshots(workspaceId, relPath) });
  }

  if (req.method === "POST" && /^\/api\/editor\/snapshots\/[a-z0-9-]+\/restore$/i.test(path)) {
    const user = requireUser(req, res);
    if (!user) return undefined;
    const id = path.split("/")[4];
    const body = await readBody(req);
    const workspaceId = bodyWorkspaceId(body);
    const snap = readSnapshot(workspaceId, id);
    if (!snap) return sendJson(res, 404, { error: "snapshot not found" });
    const target = workspacePath(workspaceId, snap.path);
    // Safety net: the state being replaced becomes its own snapshot.
    if (existsSync(target)) saveSnapshot(workspaceId, snap.path, "pre-restore");
    mkdirSync(dirname(target), { recursive: true });
    writeFileAtomic(target, snap.content);
    audit(user, "snapshot.restore", `${workspaceId}/${snap.path} <- ${id}`);
    return sendJson(res, 200, { ok: true, path: snap.path, content: snap.content, snapshots: listSnapshots(workspaceId, snap.path) });
  }

  // 工作区归档导出：整包 tar.gz 备份（排除缓存/依赖目录），本地优先的数据
  // 自由。注意：/api/editor/export（无 -archive）是既有的 JSON 文件快照接口。
  if (req.method === "GET" && path === "/api/editor/export-archive") {
    const user = requireUser(req, res);
    if (!user) return undefined;
    const url = new URL(req.url, `http://localhost:${port}`);
    const workspaceId = queryWorkspaceId(url);
    let rootPath;
    try { rootPath = workspaceRoot(workspaceId); } catch { return sendJson(res, 404, { error: "Workspace not found" }); }
    if (!existsSync(rootPath)) return sendJson(res, 404, { error: "Workspace not found" });

    const tmpPath = join(dataDir, `export-${process.pid}-${Date.now()}.tar.gz`);
    try {
      await new Promise((resolveTar, rejectTar) => {
        const child = spawn("tar", [
          "-czf", tmpPath,
          "--exclude", "node_modules",
          "--exclude", ".git",
          "--exclude", "build",
          "--exclude", ".tectonic",
          "--exclude", "__pycache__",
          "-C", dirname(rootPath),
          basename(rootPath),
        ], { windowsHide: true, stdio: ["ignore", "ignore", "pipe"] });
        let stderr = "";
        child.stderr.on("data", (chunk) => { stderr += chunk; });
        child.on("error", rejectTar);
        child.on("exit", (code) => (code === 0 ? resolveTar() : rejectTar(new Error(`tar exit ${code}: ${stderr.slice(0, 200)}`))));
      });
      const size = statSync(tmpPath).size;
      if (size > 512 * 1024 * 1024) {
        return sendJson(res, 413, { error: "工作区超过 512MB，请手动打包" });
      }
      const buf = readFileSync(tmpPath);
      const stamp = new Date().toISOString().slice(0, 10);
      res.writeHead(200, {
        "Content-Type": "application/gzip",
        "Content-Disposition": `attachment; filename="${workspaceId}-${stamp}.tar.gz"`,
        "Content-Length": buf.length,
        "X-Checksum-SHA256": createHash("sha256").update(buf).digest("hex"),
        "Cache-Control": "no-store",
      });
      res.end(buf);
      audit(user, "workspace.export", `${workspaceId} ${buf.length}B`);
      return undefined;
    } catch (error) {
      return sendJson(res, 500, { error: `导出失败: ${String(error.message || error).slice(0, 200)}` });
    } finally {
      rmSync(tmpPath, { force: true });
    }
  }

  // 全局聚合搜索（⌘K）：工作区 / 文件名 / 本人会话 / 社区帖，全部真实数据，
  // 带遍历上限；q 少于 2 字符时返回空组。
  if (req.method === "GET" && path === "/api/search") {
    const user = requireUser(req, res);
    if (!user) return undefined;
    const url = new URL(req.url, `http://localhost:${port}`);
    const q = String(url.searchParams.get("q") || "").trim().toLowerCase();
    if (q.length < 2) return sendJson(res, 200, { workspaces: [], files: [], sessions: [], posts: [] });

    let registered = [];
    try { registered = workspaceKernel.listWorkspaces(); } catch { registered = []; }
    const workspaces = registered
      .filter((w) => `${w.id} ${w.name || ""}`.toLowerCase().includes(q))
      .slice(0, 6)
      .map((w) => ({ id: w.id, name: w.name || w.id, pack: w.pack }));

    const files = [];
    const SKIP = new Set(["__pycache__", "node_modules", ".git", "submission-package", "build", ".tectonic", "state", ".paperos"]);
    for (const w of registered.slice(0, 12)) {
      if (files.length >= 12) break;
      let budget = 400;
      (function walkNames(dir, rel, depth) {
        if (depth > 6 || files.length >= 12 || budget <= 0) return;
        let names;
        try { names = readdirSync(dir); } catch { return; }
        for (const name of names.sort()) {
          if (SKIP.has(name)) continue;
          if (files.length >= 12 || budget <= 0) return;
          budget -= 1;
          const relPath = rel ? `${rel}/${name}` : name;
          const entry = workspaceEntry(w.id, relPath);
          if (!entry) continue;
          if (entry.stat.isDirectory()) walkNames(entry.absolute, relPath, depth + 1);
          else if (relPath.toLowerCase().includes(q)) files.push({ workspace: w.id, path: relPath });
        }
      })(w.root, "", 0);
    }

    const sessions = chatStore.read().threads
      .filter((t) => t.userId === user.id && `${t.prompt} ${t.reply}`.toLowerCase().includes(q))
      .slice(-6)
      .reverse()
      .map((t) => ({ id: t.id, prompt: String(t.prompt || "").slice(0, 80), workspace: t.workspace || "" }));

    const posts = postsStore.read().posts
      .filter((p) => `${p.title || ""} ${p.content || ""}`.toLowerCase().includes(q))
      .slice(-6)
      .reverse()
      .map((p) => ({ id: p.id, title: p.title || "(无标题)" }));

    return sendJson(res, 200, { workspaces, files, sessions, posts });
  }

  // ---- admin console ----
  if (req.method === "GET" && path === "/api/admin/metrics") {
    if (!requireAdmin(req, res)) return undefined;
    return sendJson(res, 200, computeMetrics());
  }

  // 服务监控（mars-admin 式）：进程/系统/数据存储的真实事实，无编造指标。
  if (req.method === "GET" && path === "/api/admin/monitor") {
    if (!requireAdmin(req, res)) return undefined;
    const mem = process.memoryUsage();
    const storeFiles = [
      "users.json", "sessions.json", "posts.json", "skills.json", "installs.json",
      "chat.json", "usage.json", "account-providers.json", "audit.json", "workspaces.json",
    ];
    const stores = storeFiles.map((name) => {
      try {
        const st = statSync(join(dataDir, name));
        return { name, bytes: st.size, mtime: st.mtimeMs };
      } catch {
        return { name, bytes: 0, mtime: null };
      }
    });
    let workspaceCount = 0;
    try { workspaceCount = workspaceKernel.listWorkspaces().length; } catch { /* registry unreadable */ }
    return sendJson(res, 200, {
      process: {
        node: process.version,
        pid: process.pid,
        uptimeSeconds: Math.round(process.uptime()),
        rssBytes: mem.rss,
        heapUsedBytes: mem.heapUsed,
        heapTotalBytes: mem.heapTotal,
      },
      system: {
        platform: process.platform,
        arch: process.arch,
        cpus: cpus().length,
        totalMemBytes: totalmem(),
        freeMemBytes: freemem(),
        // Unix load averages; Windows reports zeros — UI labels this honestly.
        loadavg: loadavg().map((v) => Number(v.toFixed(2))),
        hostUptimeSeconds: Math.round(osUptime()),
      },
      stores,
      workspaceCount,
      dataDir,
    });
  }

  // 在线会话管理：列出未过期会话（只暴露 token 前缀），支持强制下线。
  if (req.method === "GET" && path === "/api/admin/sessions") {
    if (!requireAdmin(req, res)) return undefined;
    const { sessions } = sessionsStore.read();
    const { users } = usersStore.read();
    const byId = new Map(users.map((u) => [u.id, u]));
    const now = Date.now();
    const currentToken = parseCookies(req.headers.cookie)[SESSION_COOKIE] || "";
    const list = Object.entries(sessions)
      .filter(([, s]) => s && s.expiresAt > now)
      .map(([token, s]) => {
        const u = byId.get(s.userId);
        return {
          id: token.slice(0, 12),
          current: token === currentToken,
          username: u?.username || "unknown",
          displayName: u?.displayName || u?.username || "未知用户",
          role: u?.role || "member",
          label: s.label || "会话",
          createdAt: new Date(s.createdAt || now).toISOString(),
          expiresAt: new Date(s.expiresAt).toISOString(),
        };
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return sendJson(res, 200, { sessions: list });
  }

  if (req.method === "DELETE" && /^\/api\/admin\/sessions\/[\w-]{6,}$/.test(path)) {
    const actor = requireAdmin(req, res);
    if (!actor) return undefined;
    const prefix = path.split("/").pop();
    const currentToken = parseCookies(req.headers.cookie)[SESSION_COOKIE] || "";
    let removed = false;
    let refusedCurrent = false;
    sessionsStore.update((data) => {
      for (const token of Object.keys(data.sessions)) {
        if (token.slice(0, 12) === prefix) {
          if (token === currentToken) { refusedCurrent = true; continue; }
          delete data.sessions[token];
          removed = true;
        }
      }
      return data;
    });
    if (refusedCurrent && !removed) {
      return sendJson(res, 400, { error: "不能强制下线自己的当前会话" });
    }
    if (!removed) return sendJson(res, 404, { error: "会话不存在或已过期" });
    audit(actor, "admin.session.revoke", prefix);
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === "GET" && path === "/api/admin/users") {
    if (!requireAdmin(req, res)) return undefined;
    const { users } = usersStore.read();
    const { posts } = postsStore.read();
    const records = usageStore.read().records;
    const usageByUser = {};
    for (const r of records) {
      const agg = usageByUser[r.userId] || (usageByUser[r.userId] = { tokens: 0, costUsd: 0, requests: 0, lastActiveAt: "" });
      agg.tokens += r.totalTokens;
      agg.costUsd += r.costUsd;
      agg.requests += 1;
      if (r.at > agg.lastActiveAt) agg.lastActiveAt = r.at;
    }
    return sendJson(res, 200, {
      users: users.map((u) => {
        const use = usageByUser[u.id];
        return {
          ...adminUserView(u, posts),
          usage: use
            ? { tokens: use.tokens, requests: use.requests, costUsd: Number(use.costUsd.toFixed(6)), lastActiveAt: use.lastActiveAt }
            : { tokens: 0, requests: 0, costUsd: 0, lastActiveAt: "" },
        };
      }),
    });
  }

  if (req.method === "POST" && /^\/api\/admin\/users\/[\w-]+\/role$/.test(path)) {
    const actor = requireUser(req, res);
    if (!actor) return undefined;
    if (actor.role !== "owner") return sendJson(res, 403, { error: "仅 owner 可调整角色" });
    const id = path.split("/")[4];
    const body = await readBody(req);
    if (!["admin", "member"].includes(body.role)) {
      return sendJson(res, 400, { error: "角色只能为 admin 或 member" });
    }
    let updated = null;
    usersStore.update((data) => {
      const u = data.users.find((x) => x.id === id);
      if (u && u.role !== "owner") {
        u.role = body.role;
        updated = u;
      }
      return data;
    });
    if (!updated) return sendJson(res, 404, { error: "用户不存在或不可修改 (owner 固定)" });
    audit(actor, "role.change", `${updated.username} → ${body.role}`);
    return sendJson(res, 200, { user: adminUserView(updated, postsStore.read().posts) });
  }

  if (req.method === "POST" && /^\/api\/admin\/users\/[\w-]+\/status$/.test(path)) {
    const actor = requireAdmin(req, res);
    if (!actor) return undefined;
    const id = path.split("/")[4];
    if (id === actor.id) return sendJson(res, 400, { error: "不能禁用自己" });
    const body = await readBody(req);
    const status = body.status === "disabled" ? "disabled" : "active";
    let updated = null;
    usersStore.update((data) => {
      const u = data.users.find((x) => x.id === id);
      if (u && u.role !== "owner") {
        u.status = status;
        updated = u;
      }
      return data;
    });
    if (!updated) return sendJson(res, 404, { error: "用户不存在或不可修改 (owner 不可禁用)" });
    if (status === "disabled") killUserSessions(id);
    audit(actor, "user.status", `${updated.username} → ${status}`);
    return sendJson(res, 200, { user: adminUserView(updated, postsStore.read().posts) });
  }

  if (req.method === "DELETE" && /^\/api\/admin\/community\/posts\/[\w-]+$/.test(path)) {
    const actor = requireAdmin(req, res);
    if (!actor) return undefined;
    const id = path.split("/")[5];
    let removed = false;
    postsStore.update((data) => {
      const before = data.posts.length;
      data.posts = data.posts.filter((p) => p.id !== id);
      removed = data.posts.length < before;
      return data;
    });
    if (!removed) return sendJson(res, 404, { error: "帖子不存在" });
    audit(actor, "post.delete", id);
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === "GET" && path === "/api/admin/audit") {
    if (!requireAdmin(req, res)) return undefined;
    const { entries } = auditStore.read();
    return sendJson(res, 200, { entries: entries.slice(-120).reverse() });
  }

  if (req.method === "GET" && path === "/api/admin/system") {
    if (!requireAdmin(req, res)) return undefined;
    const settings = readSystemSettings();
    const { users } = usersStore.read();
    const { sessions } = sessionsStore.read();
    const now = Date.now();
    const providerKeys = Object.values(accountProviderStore.read().providers || {})
      .filter((p) => p && p.apiKeyEnc).length;
    let workspaceCount = 0;
    try { workspaceCount = (workspaceKernel.listWorkspaces?.() || []).length; } catch { workspaceCount = 0; }
    return sendJson(res, 200, {
      settings: { ...settings, maxBodyMB: Math.round(MAX_BODY_BYTES / (1024 * 1024)) },
      build: {
        version: appVersion(),
        node: process.version,
        uptimeSeconds: Math.floor((Date.now() - START_TIME) / 1000),
        dataDir,
      },
      counts: {
        users: users.length,
        workspaces: workspaceCount,
        sessions: Object.values(sessions).filter((s) => s && s.expiresAt > now).length,
        providerKeys,
      },
    });
  }

  if (req.method === "PUT" && path === "/api/admin/system") {
    const actor = requireAdmin(req, res);
    if (!actor) return undefined;
    const body = await readBody(req);
    let saved;
    systemSettingsStore.update((data) => {
      if (body.registrationOpen !== undefined) data.registrationOpen = Boolean(body.registrationOpen);
      if (body.loginRateMax !== undefined) {
        const n = Number(body.loginRateMax);
        data.loginRateMax = Number.isFinite(n) ? Math.min(1000, Math.max(1, Math.round(n))) : data.loginRateMax;
      }
      if (body.loginRateWindowMinutes !== undefined) {
        const n = Number(body.loginRateWindowMinutes);
        data.loginRateWindowMinutes = Number.isFinite(n) ? Math.min(1440, Math.max(1, Math.round(n))) : data.loginRateWindowMinutes;
      }
      saved = data;
      return data;
    });
    audit(actor, "admin.system", JSON.stringify(readSystemSettings()));
    return sendJson(res, 200, { settings: readSystemSettings() });
  }

  if (req.method === "GET" && path === "/api/admin/keys") {
    if (!requireAdmin(req, res)) return undefined;
    const { users } = usersStore.read();
    const providers = accountProviderStore.read().providers || {};
    const rows = users.map((u) => {
      const own = providers[u.id];
      const view = accountProviderView(u.id);
      return {
        id: u.id,
        username: u.username,
        displayName: u.displayName || u.username,
        role: u.role,
        hasProviderKey: Boolean(own && own.apiKeyEnc),
        providerModel: view.model || "",
        providerSource: view.source,
        updatedAt: own?.updatedAt || null,
      };
    });
    return sendJson(res, 200, { users: rows });
  }

  if (req.method === "GET" && path === "/api/admin/releases") {
    if (!requireAdmin(req, res)) return undefined;
    return sendJson(res, 200, publicReleases());
  }

  if (req.method === "PUT" && path === "/api/admin/content") {
    const actor = requireAdmin(req, res);
    if (!actor) return undefined;
    const body = await readBody(req);
    const next = readContent();
    if (body.announcement) {
      next.announcement = {
        enabled: !!body.announcement.enabled,
        text: String(body.announcement.text || "").slice(0, 240),
      };
    }
    if (body.hero) {
      next.hero = {
        kicker: String(body.hero.kicker ?? next.hero.kicker).slice(0, 120),
        titleLines: Array.isArray(body.hero.titleLines)
          ? body.hero.titleLines.slice(0, 4).map((s) => String(s).slice(0, 80))
          : next.hero.titleLines,
        subtitle: String(body.hero.subtitle ?? next.hero.subtitle).slice(0, 400),
      };
    }
    contentStore.write(next);
    audit(actor, "content.update", "homepage");
    return sendJson(res, 200, next);
  }

  // ===========================================================
  // Editor: real file tree, file read/write, run, evidence
  // ===========================================================
  if (req.method === "GET" && path === "/api/editor/tree") {
    const user = requireUser(req, res);
    if (!user) return undefined;
    const url = new URL(req.url, `http://localhost:${port}`);
    const workspaceId = queryWorkspaceId(url);
    const rootPath = workspaceRoot(workspaceId);
    if (!existsSync(rootPath)) return sendJson(res, 404, { error: "Workspace not found" });
    const SKIP = new Set(["__pycache__", "node_modules", ".git", "submission-package", "build", ".tectonic"]);
    // Bounded walk: a giant or adversarial folder must not pin the event
    // loop. Depth/entry caps end the walk and flag the response instead.
    let budget = WALKER_MAX_ENTRIES;
    let truncated = false;
    function walk(dir, rel, depth) {
      const out = [];
      if (depth > WALKER_MAX_DEPTH) { truncated = true; return out; }
      let entries;
      try { entries = readdirSync(dir); } catch { return out; }
      for (const name of entries.sort()) {
        if (SKIP.has(name)) continue;
        if (budget <= 0) { truncated = true; return out; }
        const path = rel ? `${rel}/${name}` : name;
        const entry = workspaceEntry(workspaceId, path);
        if (!entry) continue;
        const { absolute: abs, stat: st } = entry;
        budget -= 1;
        if (st.isDirectory()) {
          out.push({ name, type: "dir", path, children: walk(abs, path, depth + 1) });
        } else {
          out.push({ name, type: "file", path, size: st.size });
        }
      }
      return out;
    }
    const tree = walk(rootPath, "", 0);
    return sendJson(res, 200, { workspace: workspaceId, tree, truncated });
  }

  // References Pack (09-integrations Epic 3a): parse the workspace's real .bib
  // files and cross-link them with \cite… usage across .tex sources.
  if (req.method === "GET" && path === "/api/editor/references") {
    const user = requireUser(req, res);
    if (!user) return undefined;
    const url = new URL(req.url, `http://localhost:${port}`);
    const workspaceId = queryWorkspaceId(url);
    let rootPath;
    try { rootPath = workspaceRoot(workspaceId); } catch { return sendJson(res, 404, { error: "Workspace not found" }); }
    if (!existsSync(rootPath)) return sendJson(res, 404, { error: "Workspace not found" });
    const SKIP = new Set(["__pycache__", "node_modules", ".git", "submission-package", "build", ".tectonic", "state"]);
    let budget = WALKER_MAX_ENTRIES;
    let truncated = false;
    const bibFiles = [];
    const texFiles = [];
    (function collect(dir, rel, depth) {
      if (depth > WALKER_MAX_DEPTH) { truncated = true; return; }
      let names;
      try { names = readdirSync(dir); } catch { return; }
      for (const name of names.sort()) {
        if (SKIP.has(name)) continue;
        if (budget <= 0) { truncated = true; return; }
        const relPath = rel ? `${rel}/${name}` : name;
        const entry = workspaceEntry(workspaceId, relPath);
        if (!entry) continue;
        budget -= 1;
        if (entry.stat.isDirectory()) collect(entry.absolute, relPath, depth + 1);
        else if (/\.bib$/i.test(name)) bibFiles.push(relPath);
        else if (/\.tex$/i.test(name)) texFiles.push(relPath);
      }
    })(rootPath, "", 0);

    const entries = [];
    for (const rel of bibFiles.slice(0, 20)) {
      if (entries.length >= 500) break;
      try {
        const text = readFileSync(workspacePath(workspaceId, rel), "utf-8");
        for (const parsed of parseBibTeX(text)) {
          if (entries.length >= 500) break;
          entries.push({ ...parsed, file: rel });
        }
      } catch { /* unreadable .bib is skipped, not fatal */ }
    }

    const citations = {};
    const citeRe = /\\(?:no)?(?:cite|citep|citet|parencite|textcite|autocite|footcite)\*?(?:\[[^\]]*\]){0,2}\{([^}]+)\}/g;
    for (const rel of texFiles.slice(0, 80)) {
      let text = "";
      try { text = readFileSync(workspacePath(workspaceId, rel), "utf-8"); } catch { continue; }
      const lines = text.split(/\r?\n/);
      for (let ln = 0; ln < lines.length; ln += 1) {
        citeRe.lastIndex = 0;
        let m;
        while ((m = citeRe.exec(lines[ln])) !== null) {
          for (const rawKey of m[1].split(",")) {
            const key = rawKey.trim();
            if (!key) continue;
            const list = (citations[key] = citations[key] || []);
            if (list.length < 200) list.push({ file: rel, line: ln + 1 });
          }
        }
      }
    }

    const known = new Set(entries.map((e) => e.key));
    const missing = Object.keys(citations)
      .filter((k) => !known.has(k))
      .sort()
      .map((key) => ({ key, locations: citations[key].slice(0, 20) }));
    const withCounts = entries.map((e) => ({ ...e, citedCount: (citations[e.key] || []).length }));
    return sendJson(res, 200, { workspace: workspaceId, bibFiles, entries: withCounts, citations, missing, truncated });
  }

  // References Pack (09-integrations Epic 3d): DOI / arXiv -> BibTeX import.
  // Requires network (bases overridable for tests); fails honestly offline.
  if (req.method === "POST" && path === "/api/editor/references/import") {
    const user = requireUser(req, res);
    if (!user) return undefined;
    const body = await readBody(req);
    if (!body.workspace && !body.contest) return sendJson(res, 400, { error: "workspace is required" });
    const workspaceId = bodyWorkspaceId(body);
    let rootPath;
    try { rootPath = workspaceRoot(workspaceId); } catch { return sendJson(res, 404, { error: "Workspace not found" }); }
    if (!existsSync(rootPath)) return sendJson(res, 404, { error: "Workspace not found" });

    // Accept a bare DOI, a doi.org URL, an arXiv id (2401.12345[v2]),
    // arXiv:ID, or an arxiv.org/abs|pdf URL.
    const raw = String(body.doi || body.id || "").trim();
    const doi = raw.replace(/^https?:\/\/(dx\.)?doi\.org\//i, "").trim();
    const isDoi = /^10\.\d{4,9}\/\S+$/i.test(doi);
    const arxivMatch = isDoi ? null : raw.match(/(?:^|abs\/|pdf\/|arxiv:\s*)(\d{4}\.\d{4,5})(v\d+)?\/?$/i);
    if (!isDoi && !arxivMatch) {
      return sendJson(res, 400, { error: "无法识别：请输入 DOI（10.xxxx/yyy）、doi.org 链接、arXiv ID（如 2401.12345）或 arxiv.org 链接" });
    }

    let bibText = "";
    if (isDoi) {
      const doiBase = String(process.env.PAPER_OS_DOI_BASE || "https://doi.org").replace(/\/+$/, "");
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 10000);
        const resp = await fetch(`${doiBase}/${doi}`, {
          headers: { Accept: "application/x-bibtex; charset=utf-8" },
          redirect: "follow",
          signal: controller.signal,
        });
        clearTimeout(timer);
        if (resp.status === 404) return sendJson(res, 404, { error: `DOI 未找到: ${doi}` });
        if (!resp.ok) return sendJson(res, 502, { error: `doi.org 返回 ${resp.status}` });
        bibText = (await resp.text()).trim();
      } catch {
        return sendJson(res, 502, { error: "无法访问 doi.org（离线或超时）。可手动把 BibTeX 粘贴进 .bib 文件。" });
      }
    } else {
      const baseId = arxivMatch[1];
      const fullId = baseId + (arxivMatch[2] || "");
      const arxivBase = String(process.env.PAPER_OS_ARXIV_BASE || "http://export.arxiv.org").replace(/\/+$/, "");
      let atom = "";
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 10000);
        const resp = await fetch(`${arxivBase}/api/query?id_list=${encodeURIComponent(fullId)}`, {
          signal: controller.signal,
        });
        clearTimeout(timer);
        if (!resp.ok) return sendJson(res, 502, { error: `arXiv API 返回 ${resp.status}` });
        atom = await resp.text();
      } catch {
        return sendJson(res, 502, { error: "无法访问 arXiv（离线或超时）。可手动把 BibTeX 粘贴进 .bib 文件。" });
      }
      const entryXml = (atom.match(/<entry>([\s\S]*?)<\/entry>/) || [])[1] || "";
      const title = String((entryXml.match(/<title[^>]*>([\s\S]*?)<\/title>/) || [])[1] || "")
        .replace(/\s+/g, " ").trim();
      // An unknown id still returns a feed, but without a usable entry.
      if (!entryXml || !title) return sendJson(res, 404, { error: `arXiv ID 未找到: ${fullId}` });
      const authors = [...entryXml.matchAll(/<name>([^<]+)<\/name>/g)].map((m) => m[1].trim()).filter(Boolean);
      const year = (entryXml.match(/<published>(\d{4})/) || [])[1] || "";
      // Key uses the versionless id so re-imports of v2 dedupe against v1.
      bibText = [
        `@misc{arxiv${baseId},`,
        `  title = {${title}},`,
        `  author = {${authors.join(" and ") || "arXiv"}},`,
        `  year = {${year}},`,
        `  eprint = {${fullId}},`,
        `  archivePrefix = {arXiv},`,
        `  url = {https://arxiv.org/abs/${fullId}},`,
        `}`,
      ].join("\n");
    }

    const parsed = parseBibTeX(bibText);
    if (!parsed.length || !bibText.startsWith("@")) {
      return sendJson(res, 502, { error: "返回内容不是可解析的 BibTeX" });
    }
    const entry = parsed[0];

    // Append to the first existing .bib (shallow scan), else create the default.
    let targetRel = "paper/references.bib";
    const found = [];
    (function scanBib(dir, rel, depth) {
      if (depth > 3 || found.length) return;
      let names;
      try { names = readdirSync(dir); } catch { return; }
      for (const name of names.sort()) {
        if (found.length) return;
        const relPath = rel ? `${rel}/${name}` : name;
        const item = workspaceEntry(workspaceId, relPath);
        if (!item) continue;
        if (item.stat.isDirectory()) {
          if (!["node_modules", ".git", "state", "build", ".tectonic"].includes(name)) scanBib(item.absolute, relPath, depth + 1);
        } else if (/\.bib$/i.test(name)) {
          found.push(relPath);
        }
      }
    })(rootPath, "", 0);
    if (found.length) targetRel = found[0];

    const targetAbs = workspacePath(workspaceId, targetRel);
    let existingText = "";
    if (existsSync(targetAbs)) existingText = readFileSync(targetAbs, "utf-8");
    const existingKeys = new Set(parseBibTeX(existingText).map((e) => e.key));
    if (existingKeys.has(entry.key)) {
      return sendJson(res, 409, { error: `条目已存在: ${entry.key}`, key: entry.key, file: targetRel });
    }
    mkdirSync(dirname(targetAbs), { recursive: true });
    const joined = existingText.trim().length > 0
      ? `${existingText.replace(/\s+$/, "")}\n\n${bibText}\n`
      : `${bibText}\n`;
    writeFileSync(targetAbs, joined, "utf-8");
    audit(user, "references.import", `${workspaceId} ${doi} -> ${targetRel}`);
    return sendJson(res, 201, { ok: true, key: entry.key, file: targetRel, entry });
  }

  if (req.method === "GET" && path === "/api/editor/file") {
    const user = requireUser(req, res);
    if (!user) return undefined;
    const url = new URL(req.url, `http://localhost:${port}`);
    const workspaceId = queryWorkspaceId(url);
    const relPath = String(url.searchParams.get("path") || "").replace(/^\/+/, "");
    if (!relPath) return sendJson(res, 400, { error: "path is required" });
    if (relPath.includes("..") || relPath.includes("\\")) {
      return sendJson(res, 400, { error: "invalid path" });
    }
    const filePath = workspacePath(workspaceId, relPath);
    if (!existsSync(filePath) || !statSync(filePath).isFile()) {
      return sendJson(res, 404, { error: "file not found" });
    }
    const lower = relPath.toLowerCase();
    if (/\.(pdf|png|jpe?g|gif|webp|bmp|ico|zip|7z|rar|exe|dll|woff2?|ttf|otf|bin)$/.test(lower)) {
      return sendJson(res, 415, {
        error: "binary file — open via /api/editor/raw",
        binary: true,
        path: relPath,
      });
    }
    const stat = statSync(filePath);
    if (stat.size > 2_097_152) {
      return sendJson(res, 413, { error: "file too large (>2MB)" });
    }
    const content = readFileSync(filePath, "utf-8");
    return sendJson(res, 200, { workspace: workspaceId, path: relPath, content, size: stat.size, mtime: stat.mtimeMs });
  }

  if (req.method === "PUT" && path === "/api/editor/file") {
    const user = requireUser(req, res);
    if (!user) return undefined;
    const body = await readBody(req);
    const workspaceId = bodyWorkspaceId(body);
    const relPath = String(body.path || "").replace(/^\/+/, "");
    if (!relPath) return sendJson(res, 400, { error: "path is required" });
    if (relPath.includes("..") || relPath.includes("\\")) {
      return sendJson(res, 400, { error: "invalid path" });
    }
    const content = String(body.content ?? "");
    const filePath = workspacePath(workspaceId, relPath);
    if (!existsSync(filePath) || !statSync(filePath).isFile()) {
      return sendJson(res, 404, { error: "file not found" });
    }
    writeFileAtomic(filePath, content);
    audit(user, "file.save", `${workspaceId}/${relPath}`);
    return sendJson(res, 200, { ok: true, workspace: workspaceId, contest: workspaceId, path: relPath, size: Buffer.byteLength(content, "utf-8") });
  }

  // ── create new file ──
  if (req.method === "POST" && /^\/api\/editor\/file$/.test(path)) {
    const user = requireUser(req, res);
    if (!user) return undefined;
    const body = await readBody(req);
    const workspaceId = bodyWorkspaceId(body);
    const relPath = String(body.path || "").replace(/^\/+/, "");
    if (!relPath) return sendJson(res, 400, { error: "path is required" });
    if (relPath.includes("..") || relPath.includes("\\")) {
      return sendJson(res, 400, { error: "invalid path" });
    }
    const content = String(body.content ?? "");
    const filePath = workspacePath(workspaceId, relPath);
    if (existsSync(filePath)) return sendJson(res, 409, { error: "file already exists" });
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileAtomic(filePath, content);
    audit(user, "file.create", `${workspaceId}/${relPath}`);
    return sendJson(res, 201, { ok: true, workspace: workspaceId, contest: workspaceId, path: relPath, size: Buffer.byteLength(content, "utf-8") });
  }

  // ── create folder（文件夹管理）──
  if (req.method === "POST" && path === "/api/editor/folder") {
    const user = requireUser(req, res);
    if (!user) return undefined;
    const body = await readBody(req);
    if (!body.workspace && !body.contest) return sendJson(res, 400, { error: "workspace is required" });
    const workspaceId = bodyWorkspaceId(body);
    const relPath = String(body.path || "").replace(/^\/+/, "").replace(/\/+$/, "");
    if (!relPath) return sendJson(res, 400, { error: "path is required" });
    if (relPath.includes("..") || relPath.includes("\\")) {
      return sendJson(res, 400, { error: "invalid path" });
    }
    const dirPath = workspacePath(workspaceId, relPath);
    if (existsSync(dirPath)) return sendJson(res, 409, { error: "folder already exists" });
    mkdirSync(dirPath, { recursive: true });
    audit(user, "folder.create", `${workspaceId}/${relPath}`);
    return sendJson(res, 201, { ok: true, workspace: workspaceId, path: relPath });
  }

  // ── delete file or folder ──
  if (req.method === "DELETE" && path === "/api/editor/file") {
    const user = requireUser(req, res);
    if (!user) return undefined;
    const url = new URL(req.url, `http://localhost:${port}`);
    const workspaceId = queryWorkspaceId(url);
    const relPath = String(url.searchParams.get("path") || "").replace(/^\/+/, "");
    if (!relPath) return sendJson(res, 400, { error: "path is required" });
    if (relPath.includes("..") || relPath.includes("\\")) {
      return sendJson(res, 400, { error: "invalid path" });
    }
    let target;
    try {
      target = workspacePath(workspaceId, relPath, { allowRoot: false });
    } catch (error) {
      if (error instanceof WorkspaceKernelError && error.code === "WORKSPACE_ROOT_FORBIDDEN") {
        return sendJson(res, 400, { error: error.message, code: error.code });
      }
      throw error;
    }
    if (!existsSync(target)) return sendJson(res, 404, { error: "not found" });
    const st = statSync(target);
    if (st.isDirectory()) rmSync(target, { recursive: true, force: true });
    else unlinkSync(target);
    audit(user, "file.delete", `${workspaceId}/${relPath}`);
    return sendJson(res, 200, { ok: true });
  }

  // ── rename / move file ──
  if (req.method === "PATCH" && path === "/api/editor/file") {
    const user = requireUser(req, res);
    if (!user) return undefined;
    const body = await readBody(req);
    const workspaceId = bodyWorkspaceId(body);
    const from = String(body.from || "").replace(/^\/+/, "");
    const to = String(body.to || "").replace(/^\/+/, "");
    if (!from || !to) return sendJson(res, 400, { error: "from and to are required" });
    if (from.includes("..") || to.includes("..") || from.includes("\\") || to.includes("\\")) {
      return sendJson(res, 400, { error: "invalid path" });
    }
    const src = workspacePath(workspaceId, from);
    const dst = workspacePath(workspaceId, to);
    if (!existsSync(src)) return sendJson(res, 404, { error: "source not found" });
    if (existsSync(dst)) return sendJson(res, 409, { error: "destination exists" });
    mkdirSync(dirname(dst), { recursive: true });
    renameSync(src, dst);
    audit(user, "file.rename", `${workspaceId}/${from} -> ${to}`);
    return sendJson(res, 200, { ok: true, from, to });
  }

  // ── list all registered Workspaces ──
  if (req.method === "GET" && path === "/api/editor/projects") {
    const user = requireUser(req, res);
    if (!user) return undefined;
    return sendJson(res, 200, {
      projects: workspaceKernel.listWorkspaces(),
      packs: workspaceKernel.listPacks(),
    });
  }

  // ── remove a Workspace（external 解除注册 / managed 需 deleteFiles=1 删除文件夹）──
  if (req.method === "DELETE" && /^\/api\/editor\/projects\/[\w.-]+$/.test(path)) {
    const user = requireUser(req, res);
    if (!user) return undefined;
    const id = decodeURIComponent(path.split("/").pop());
    const url = new URL(req.url, `http://localhost:${port}`);
    const deleteFiles = url.searchParams.get("deleteFiles") === "1";
    const result = workspaceKernel.removeWorkspace(id, { deleteFiles });
    audit(user, "workspace.remove", `${id} (${result.source}${result.deletedFiles ? ", files deleted" : ", files kept"})`);
    return sendJson(res, 200, { ok: true, ...result });
  }

  // ── create a managed Workspace or register an existing folder ──
  if (req.method === "POST" && path === "/api/editor/projects") {
    const user = requireUser(req, res);
    if (!user) return undefined;
    const body = await readBody(req);
    try {
      let workspace;
      if (body.path) {
        workspace = workspaceKernel.registerWorkspace({
          id: body.id,
          name: body.name,
          path: body.path,
          pack: body.pack,
        });
      } else {
        const workspaceId = safeWorkspaceId(body.id || "");
        const pack = String(body.pack || "latex");
        if (pack === "math-modeling") {
          const result = await runPaperctl(["init", workspaceId]);
          if (result.code !== 0) {
            return sendJson(res, 500, {
              error: (result.stderr || result.stdout || "math-modeling init failed").trim(),
            });
          }
          workspace = workspaceKernel.getWorkspace(workspaceId);
        } else {
          workspace = workspaceKernel.createManagedWorkspace({
            id: workspaceId,
            name: body.name,
            pack,
          });
        }
      }
      audit(user, body.path ? "workspace.register" : "workspace.create", workspace.id);
      return sendJson(res, 201, { ok: true, workspace, id: workspace.id });
    } catch (error) {
      if (error instanceof WorkspaceKernelError) {
        const status = error.code === "WORKSPACE_EXISTS" ? 409 : 400;
        return sendJson(res, status, { error: error.message, code: error.code });
      }
      throw error;
    }
  }

  // ── full-text search across one Workspace ──
  if (req.method === "GET" && path === "/api/editor/search") {
    const user = requireUser(req, res);
    if (!user) return undefined;
    const url = new URL(req.url, `http://localhost:${port}`);
    const workspaceId = queryWorkspaceId(url);
    const q = String(url.searchParams.get("q") || "").trim();
    if (!q) return sendJson(res, 200, { results: [] });
    const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit")) || 50));
    const base = workspaceRoot(workspaceId);
    if (!existsSync(base)) return sendJson(res, 404, { error: "Workspace not found" });
    const SKIP = new Set(["__pycache__", "node_modules", ".git", "submission-package", "build"]);
    const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    const results = [];
    let scanBudget = WALKER_MAX_ENTRIES;
    let truncated = false;
    function walk(dir, rel, depth) {
      if (results.length >= limit) return;
      if (depth > WALKER_MAX_DEPTH) { truncated = true; return; }
      let entries;
      try { entries = readdirSync(dir); } catch { return; }
      for (const name of entries) {
        if (results.length >= limit) return;
        if (SKIP.has(name)) continue;
        if (scanBudget <= 0) { truncated = true; return; }
        const path = rel ? `${rel}/${name}` : name;
        const entry = workspaceEntry(workspaceId, path);
        if (!entry) continue;
        const { absolute: abs, stat: st } = entry;
        scanBudget -= 1;
        if (st.isDirectory()) walk(abs, path, depth + 1);
        else if (st.size < 1_048_576) {
          try {
            const txt = readFileSync(abs, "utf-8");
            const lines = txt.split(/\r?\n/);
            for (let i = 0; i < lines.length; i++) {
              if (results.length >= limit) return;
              if (re.test(lines[i])) {
                results.push({
                  file: path,
                  line: i + 1,
                  text: lines[i].slice(0, 240),
                });
              }
            }
          } catch { /* binary */ }
        }
      }
    }
    walk(base, "", 0);
    return sendJson(res, 200, { results, count: results.length, truncated });
  }

  // ── export project: list of files with size + mtime (for download UI) ──
  if (req.method === "GET" && path === "/api/editor/export") {
    const user = requireUser(req, res);
    if (!user) return undefined;
    const url = new URL(req.url, `http://localhost:${port}`);
    const workspaceId = queryWorkspaceId(url);
    const base = workspaceRoot(workspaceId);
    if (!existsSync(base)) return sendJson(res, 404, { error: "Workspace not found" });
    const SKIP = new Set(["__pycache__", "node_modules", ".git", "submission-package", "build"]);
    const files = [];
    let exportBudget = WALKER_MAX_ENTRIES;
    let truncated = false;
    function walk(dir, rel, depth) {
      if (depth > WALKER_MAX_DEPTH) { truncated = true; return; }
      let entries;
      try { entries = readdirSync(dir); } catch { return; }
      for (const name of entries) {
        if (SKIP.has(name)) continue;
        if (exportBudget <= 0) { truncated = true; return; }
        const path = rel ? `${rel}/${name}` : name;
        const entry = workspaceEntry(workspaceId, path);
        if (!entry) continue;
        const { absolute: abs, stat: st } = entry;
        exportBudget -= 1;
        if (st.isDirectory()) walk(abs, path, depth + 1);
        else files.push({ path, size: st.size, mtime: st.mtimeMs });
      }
    }
    walk(base, "", 0);
    audit(user, "project.export", workspaceId);
    return sendJson(res, 200, { workspace: workspaceId, files, truncated, totalSize: files.reduce((a, f) => a + f.size, 0) });
  }

  // ── export: download a single file's raw content ──
  if (req.method === "GET" && path === "/api/editor/raw") {
    const user = requireUser(req, res);
    if (!user) return undefined;
    const url = new URL(req.url, `http://localhost:${port}`);
    const workspaceId = queryWorkspaceId(url);
    const rel = String(url.searchParams.get("path") || "").replace(/^\/+/, "");
    if (!rel || rel.includes("..") || rel.includes("\\")) {
      return sendJson(res, 400, { error: "invalid path" });
    }
    const filePath = workspacePath(workspaceId, rel);
    if (!existsSync(filePath) || !statSync(filePath).isFile()) {
      return sendJson(res, 404, { error: "not found" });
    }
    const content = readFileSync(filePath);
    const ext = (rel.split(".").pop() || "").toLowerCase();
    const mime = {
      pdf: "application/pdf",
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      gif: "image/gif",
      webp: "image/webp",
      bmp: "image/bmp",
      svg: "image/svg+xml",
    }[ext] || "application/octet-stream";
    res.writeHead(200, {
      "Content-Type": mime,
      "Content-Length": content.length,
      "Cache-Control": "no-store",
    });
    res.end(content);
    return undefined;
  }

  if (req.method === "POST" && path === "/api/editor/run") {
    const user = requireUser(req, res);
    if (!user) return undefined;
    const body = await readBody(req);
    const workspaceId = bodyWorkspaceId(body);
    const workspace = workspaceKernel.getWorkspace(workspaceId);
    if (!workspace.capabilities.includes("stages")) {
      return sendJson(res, 409, {
        error: "This command requires the mathematical-modeling Pack.",
        code: "CAPABILITY_UNAVAILABLE",
      });
    }
    const command = String(body.command || "status");
    const argMap = {
      status: ["status", workspaceId],
      pipeline: ["pipeline", workspaceId],
      advance: ["advance", workspaceId, "--dry-run"],
      verify: ["verify", workspaceId],
      build: ["build", workspaceId],
      "package-submission": ["package-submission", workspaceId, "--allow-warnings"],
    };
    const args = argMap[command];
    if (!args) return sendJson(res, 400, { error: "unsupported command" });
    const result = await runPaperctl(args, { timeoutMs: 30_000 });
    return sendJson(res, 200, {
      command,
      code: result.code,
      timedOut: result.timedOut,
      stdout: result.stdout,
      stderr: result.stderr,
    });
  }

  // ===========================================================
  // Engine: status / install (Tectonic) / compile
  // ===========================================================
  const engineDir = join(dataDir, "engine");

  function engineBinaryPath() {
    return process.platform === "win32"
      ? join(engineDir, "tectonic.exe")
      : join(engineDir, "tectonic");
  }

  async function probeEngine(bin) {
    const r = await runCommand(bin, ["--version"], { timeoutMs: 4000 });
    if (r.code === 0 && !r.timedOut) {
      const v = (r.stdout || r.stderr || "").split(/\r?\n/)[0].trim();
      return { present: true, detail: v };
    }
    return { present: false, detail: r.timedOut ? "timeout" : "not found" };
  }

  function tectonicReleaseMeta() {
    // Pin a known-good release. `/releases/latest/download/tectonic-0.15.0-*`
    // 404s once latest moves past 0.15.0 (currently 0.16.9).
    const version = "0.16.9";
    const tag = `tectonic%40${version}`;
    const base = `https://github.com/tectonic-typesetting/tectonic/releases/download/${tag}`;
    let asset;
    if (process.platform === "win32") {
      // No arm64-msvc asset published for 0.16.9 — always use x86_64.
      asset = `tectonic-${version}-x86_64-pc-windows-msvc.zip`;
    } else if (process.platform === "darwin") {
      asset = process.arch === "arm64"
        ? `tectonic-${version}-aarch64-apple-darwin.tar.gz`
        : `tectonic-${version}-x86_64-apple-darwin.tar.gz`;
    } else {
      asset = process.arch === "arm64"
        ? `tectonic-${version}-aarch64-unknown-linux-musl.tar.gz`
        : `tectonic-${version}-x86_64-unknown-linux-gnu.tar.gz`;
    }
    return { version, url: `${base}/${asset}`, asset };
  }

  function tectonicReleaseUrl() {
    return tectonicReleaseMeta().url;
  }

  async function extractEngineArchive(archivePath, destDir, targetBin) {
    mkdirSync(destDir, { recursive: true });
    const lower = archivePath.toLowerCase();
    let code = 1;
    let detail = "";
    if (lower.endsWith(".zip")) {
      // Windows 10+ / macOS / Linux ship tar that can extract zip
      const tar = await runCommand("tar", ["-xf", archivePath, "-C", destDir], { timeoutMs: 60_000 });
      code = tar.code;
      detail = tar.stderr || tar.stdout || "";
      if (code !== 0 && process.platform === "win32") {
        const ps = await runCommand("powershell", [
          "-NoProfile",
          "-Command",
          `Expand-Archive -LiteralPath '${archivePath.replace(/'/g, "''")}' -DestinationPath '${destDir.replace(/'/g, "''")}' -Force`,
        ], { timeoutMs: 60_000 });
        code = ps.code;
        detail = ps.stderr || ps.stdout || detail;
      }
      if (code !== 0) {
        const uz = await runCommand("unzip", ["-o", archivePath, "-d", destDir], { timeoutMs: 60_000 });
        code = uz.code;
        detail = uz.stderr || uz.stdout || detail;
      }
    } else {
      const tar = await runCommand("tar", ["-xzf", archivePath, "-C", destDir], { timeoutMs: 60_000 });
      code = tar.code;
      detail = tar.stderr || tar.stdout || "";
    }
    if (code !== 0) {
      throw new Error(`extract failed (code ${code}): ${String(detail).slice(0, 240)}`);
    }

    function findBin(dir, depth = 0) {
      let entries;
      try { entries = readdirSync(dir); } catch { return null; }
      for (const name of entries) {
        const p = join(dir, name);
        let st;
        try { st = statSync(p); } catch { continue; }
        if (st.isFile() && /^tectonic(\.exe)?$/i.test(name)) return p;
        if (st.isDirectory() && depth < 2 && !name.startsWith(".")) {
          const hit = findBin(p, depth + 1);
          if (hit) return hit;
        }
      }
      return null;
    }

    const found = findBin(destDir);
    if (!found) throw new Error("tectonic binary not found in archive");
    if (found !== targetBin) {
      try { if (existsSync(targetBin)) unlinkSync(targetBin); } catch { /* */ }
      renameSync(found, targetBin);
    }
    try { chmodSync(targetBin, 0o755); } catch { /* windows */ }
    return targetBin;
  }

  function resolveCompiledPdf(activeWorkspaceRoot, relPath) {
    const base = String(relPath || "").replace(/\\/g, "/").split("/").pop().replace(/\.tex$/i, ".pdf");
    const candidates = [
      join(activeWorkspaceRoot, "build", base),
      join(activeWorkspaceRoot, "build", String(relPath).replace(/\.tex$/i, ".pdf")),
      join(activeWorkspaceRoot, String(relPath).replace(/\.tex$/i, ".pdf")),
      join(activeWorkspaceRoot, "paper", base),
    ];
    for (const p of candidates) {
      if (p && existsSync(p) && statSync(p).isFile()) return p;
    }
    // last resort: newest pdf under build/
    const buildDir = join(activeWorkspaceRoot, "build");
    if (existsSync(buildDir)) {
      try {
        const pdfs = readdirSync(buildDir)
          .filter((n) => n.toLowerCase().endsWith(".pdf"))
          .map((n) => {
            const p = join(buildDir, n);
            return { p, m: statSync(p).mtimeMs };
          })
          .sort((a, b) => b.m - a.m);
        if (pdfs[0]) return pdfs[0].p;
      } catch { /* */ }
    }
    return null;
  }

  function ensureBuildDir(activeWorkspaceRoot) {
    mkdirSync(join(activeWorkspaceRoot, "build"), { recursive: true });
  }

  if (req.method === "GET" && path === "/api/engine/status") {
    const user = requireUser(req, res);
    if (!user) return undefined;
    const localBin = engineBinaryPath();
    const localExists = existsSync(localBin);
    const [tectonic, latexmk, python] = await Promise.all([
      localExists ? probeEngine(localBin) : probeEngine("tectonic"),
      probeEngine(latexmkCommand),
      commandStatus(pythonCommand),
    ]);
    return sendJson(res, 200, {
      tectonic: { ...tectonic, path: localExists ? localBin : (tectonic.present ? "system" : null), source: localExists ? "bundled" : "system" },
      latexmk,
      python,
      platform: process.platform,
      arch: process.arch,
      downloadUrl: tectonicReleaseUrl(),
    });
  }

  // EventSource is always GET — accept both methods for the SSE installer.
  if ((req.method === "GET" || req.method === "POST") && path === "/api/engine/install/tectonic") {
    const user = requireUser(req, res);
    if (!user) return undefined;
    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    const send = (event, data) => {
      try { res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); } catch { /* closed */ }
    };
    try {
      const meta = tectonicReleaseMeta();
      const url = new URL(req.url, `http://localhost:${port}`);
      const force = url.searchParams.get("force") === "1";
      const target = engineBinaryPath();
      if (!force && existsSync(target)) {
        const verify = await probeEngine(target);
        if (verify.present) {
          send("start", { skipped: true, version: verify.detail, path: target });
          send("done", { path: target, version: verify.detail, skipped: true });
          return undefined;
        }
      }
      send("start", { url: meta.url, version: meta.version, asset: meta.asset, force });
      mkdirSync(engineDir, { recursive: true });
      const resp = await fetch(meta.url, {
        redirect: "follow",
        headers: { "User-Agent": "PaperOS-EngineInstaller/0.5", Accept: "application/octet-stream" },
      });
      if (!resp.ok) throw new Error(`download HTTP ${resp.status} for ${meta.asset}`);
      const total = Number(resp.headers.get("content-length") || 0);
      const reader = resp.body.getReader();
      const chunks = [];
      let received = 0;
      let lastSent = 0;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.byteLength;
        if (received - lastSent > 65536 || (total && received === total)) {
          send("progress", { received, total, percent: total ? Math.round((received / total) * 100) : null });
          lastSent = received;
        }
      }
      const buf = Buffer.concat(chunks.map((c) => Buffer.from(c)));
      if (buf.length < 1024) throw new Error(`download too small (${buf.length} bytes) — likely HTML error page`);
      const ext = meta.asset.endsWith(".tar.gz") ? ".tar.gz" : ".zip";
      const tmpArchive = join(engineDir, `tectonic-download${ext}`);
      writeFileSync(tmpArchive, buf);
      send("downloaded", { bytes: buf.length });

      send("progress", { received: buf.length, total: buf.length, percent: 100, phase: "extract" });
      await extractEngineArchive(tmpArchive, engineDir, target);
      try { unlinkSync(tmpArchive); } catch { /* */ }

      const verify = await probeEngine(target);
      if (!verify.present) {
        throw new Error(`installed binary not runnable: ${verify.detail}`);
      }
      send("done", { path: target, version: verify.detail });
    } catch (e) {
      send("error", { message: String(e.message || e) });
    } finally {
      try { res.end(); } catch { /* */ }
    }
    return undefined;
  }

  if (req.method === "POST" && path === "/api/editor/compile") {
    const user = requireUser(req, res);
    if (!user) return undefined;
    const body = await readBody(req);
    const workspaceId = bodyWorkspaceId(body);
    const relPath = String(body.path || "").replace(/^\/+/, "");
    if (!relPath) return sendJson(res, 400, { error: "path is required" });
    if (relPath.includes("..") || relPath.includes("\\")) {
      return sendJson(res, 400, { error: "invalid path" });
    }
    const filePath = workspacePath(workspaceId, relPath);
    if (!existsSync(filePath)) return sendJson(res, 404, { error: "file not found" });
    // pick engine: bundled tectonic > system tectonic > latexmk
    const localBin = engineBinaryPath();
    let bin = null, args = null;
    if (existsSync(localBin)) { bin = localBin; args = [relPath, "--keep-intermediates", "--outdir", "build"]; }
    else {
      const which = await runCommand("tectonic", ["--version"], { timeoutMs: 1500 });
      if (which.code === 0) { bin = "tectonic"; args = [relPath, "--keep-intermediates", "--outdir", "build"]; }
      else if (whichCommand(latexmkCommand)) { bin = latexmkCommand; args = ["-pdf", "-synctex=1", "-interaction=nonstopmode", "-halt-on-error", relPath]; }
    }
    if (!bin) {
      return sendJson(res, 412, {
        error: "no LaTeX engine available",
        hint: "Run: paperctl engine install-tectonic (or visit /app/workbench → Engine)",
      });
    }
    const cwd = workspaceRoot(workspaceId);
    ensureBuildDir(cwd);
    const result = await runCommand(bin, args, { cwd, timeoutMs: 180_000 });
    // try to attach the produced PDF as base64
    let pdfB64 = null;
    const pdfPath = resolveCompiledPdf(cwd, relPath);
    if (pdfPath) {
      pdfB64 = readFileSync(pdfPath).toString("base64");
    }
    return sendJson(res, 200, {
      engine: bin,
      code: result.code,
      timedOut: result.timedOut,
      stdout: (result.stdout || "").split("\n").slice(-40).join("\n"),
      stderr: (result.stderr || "").split("\n").slice(-40).join("\n"),
      pdf: pdfB64,
      pdfPath: pdfPath ? pdfPath.replace(cwd, "").replace(/\\/g, "/") : null,
    });
  }

  // Real-time compile: streams stdout/stderr via WS channel compile:<contest>
  // and returns the final result in the HTTP response. This is what the
  // Workbench calls when the user wants to see live progress.
  if (req.method === "POST" && path === "/api/editor/compile-live") {
    const user = requireUser(req, res);
    if (!user) return undefined;
    const body = await readBody(req);
    const workspaceId = bodyWorkspaceId(body);
    const relPath = String(body.path || "").replace(/^\/+/, "");
    if (!relPath) return sendJson(res, 400, { error: "path is required" });
    if (relPath.includes("..") || relPath.includes("\\")) {
      return sendJson(res, 400, { error: "invalid path" });
    }
    const filePath = workspacePath(workspaceId, relPath);
    if (!existsSync(filePath)) return sendJson(res, 404, { error: "file not found" });
    const localBin = engineBinaryPath();
    let bin = null, args = null;
    if (existsSync(localBin)) { bin = localBin; args = [relPath, "--keep-intermediates", "--outdir", "build"]; }
    else if (whichCommand("tectonic")) { bin = "tectonic"; args = [relPath, "--keep-intermediates", "--outdir", "build"]; }
    else if (whichCommand(latexmkCommand)) { bin = latexmkCommand; args = ["-pdf", "-synctex=1", "-interaction=nonstopmode", "-halt-on-error", relPath]; }
    if (!bin) {
      return sendJson(res, 412, { error: "no LaTeX engine available" });
    }
    const activeWorkspaceRoot = workspaceRoot(workspaceId);
    ensureBuildDir(activeWorkspaceRoot);
    const channel = `compile:${workspaceId}`;
    const child = spawn(bin, args, { cwd: activeWorkspaceRoot, windowsHide: true });
    const startedAt = Date.now();
    broadcast(channel, { event: "start", engine: bin, args, startedAt });
    let stdoutBuf = "", stderrBuf = "";
    child.stdout.on("data", (b) => {
      const s = b.toString();
      stdoutBuf += s;
      broadcast(channel, { event: "stdout", text: s });
    });
    child.stderr.on("data", (b) => {
      const s = b.toString();
      stderrBuf += s;
      broadcast(channel, { event: "stderr", text: s });
    });
    child.on("close", (code) => {
      let pdfB64 = null;
      const pdfPath = resolveCompiledPdf(activeWorkspaceRoot, relPath);
      if (pdfPath) pdfB64 = readFileSync(pdfPath).toString("base64");
      // Mimir lesson: a successful compile is a known-good state — snapshot the
      // compiled source so the user can roll back to it later.
      let snapshotId = null;
      if (code === 0) {
        try { snapshotId = saveSnapshot(workspaceId, relPath, "compile"); } catch { snapshotId = null; }
      }
      broadcast(channel, {
        event: "done",
        code,
        snapshotId,
        pdf: pdfB64,
        pdfPath: pdfPath ? pdfPath.replace(activeWorkspaceRoot, "").replace(/\\/g, "/") : null,
        durationMs: Date.now() - startedAt,
      });
    });
    child.on("error", (e) => broadcast(channel, { event: "error", message: String(e.message || e) }));
    return sendJson(res, 202, { accepted: true, channel, engine: bin });
  }

  if (req.method === "GET" && path === "/api/editor/evidence") {
    const user = requireUser(req, res);
    if (!user) return undefined;
    const url = new URL(req.url, `http://localhost:${port}`);
    const workspaceId = queryWorkspaceId(url);
    const file = String(url.searchParams.get("file") || "");
    const line = Number(url.searchParams.get("line") || 0);
    const q = String(url.searchParams.get("q") || "").trim();
    const activeWorkspaceRoot = workspaceRoot(workspaceId);
    const stateDir = join(activeWorkspaceRoot, "state");
    function loadCsv(name) {
      const p = join(stateDir, name);
      if (!existsSync(p)) return [];
      const txt = readFileSync(p, "utf-8");
      const lines = txt.split(/\r?\n/).filter(Boolean);
      if (lines.length < 2) return [];
      const headers = lines[0].split(",").map((h) => h.trim());
      return lines.slice(1).map((row) => {
        // naive CSV: enough for ledger rows without embedded commas in critical fields
        const cells = [];
        let cur = "", inQ = false;
        for (let i = 0; i < row.length; i++) {
          const ch = row[i];
          if (ch === '"') { inQ = !inQ; continue; }
          if (ch === "," && !inQ) { cells.push(cur); cur = ""; continue; }
          cur += ch;
        }
        cells.push(cur);
        const obj = {};
        headers.forEach((h, i) => { obj[h] = (cells[i] || "").trim(); });
        return obj;
      });
    }
    const claims = loadCsv("claim-ledger.csv");
    const results = loadCsv("result-ledger.csv");
    const figures = loadCsv("figure-ledger.csv");
    const sources = loadCsv("source-ledger.csv");
    const fileBase = file.split("/").pop() || file;
    let lineText = "";
    if (file && line > 0) {
      try {
        const abs = workspacePath(workspaceId, file);
        if (existsSync(abs)) {
          const lines = readFileSync(abs, "utf-8").split(/\r?\n/);
          lineText = lines[line - 1] || "";
        }
      } catch { /* */ }
    }
    const needle = (q || lineText || fileBase).toLowerCase();
    function scoreClaim(c) {
      const hay = `${c.section || ""} ${c.claim_text || ""} ${c.question || ""} ${c.result_ids || ""}`.toLowerCase();
      let s = 0;
      if ((c.section || "").includes(fileBase)) s += 3;
      if (needle && hay.includes(needle.slice(0, 24))) s += 4;
      if (q && (c.claim_text || "").includes(q)) s += 5;
      return s;
    }
    const rankedClaims = claims
      .map((c) => ({ ...c, _score: scoreClaim(c) }))
      .filter((c) => c._score > 0 || claims.length <= 5)
      .sort((a, b) => b._score - a._score);
    const resultIds = new Set();
    const figureIds = new Set();
    const sourceIds = new Set();
    for (const c of rankedClaims.slice(0, 8)) {
      String(c.result_ids || "").split(/[;|]/).map((x) => x.trim()).filter(Boolean).forEach((id) => resultIds.add(id));
      String(c.figure_ids || "").split(/[;|]/).map((x) => x.trim()).filter(Boolean).forEach((id) => figureIds.add(id));
      String(c.source_ids || "").split(/[;|]/).map((x) => x.trim()).filter(Boolean).forEach((id) => sourceIds.add(id));
    }
    const matchedResults = results.filter((r) =>
      resultIds.has(r.result_id || r.metric || "") ||
      (r.script || "").includes(fileBase) ||
      (r.metric || "").toLowerCase().includes(needle.slice(0, 16))
    );
    const matchedFigures = figures.filter((f) =>
      figureIds.has(f.figure_id || f.id || "") ||
      (f.path || "").includes(fileBase) ||
      (f.caption_claim || f.purpose || "").toLowerCase().includes(needle.slice(0, 16))
    );
    const matchedSources = sources.filter((s) =>
      sourceIds.has(s.source_id || s.id || "") || sources.length <= 5
    );
    return sendJson(res, 200, {
      workspace: workspaceId, file, line, lineText, q,
      claims: rankedClaims.slice(0, 10).map(({ _score, ...rest }) => rest),
      results: matchedResults.slice(0, 10),
      figures: matchedFigures.slice(0, 10),
      sources: matchedSources.slice(0, 10),
      chain: rankedClaims.slice(0, 3).map((c) => ({
        claim: c.claim_text,
        results: String(c.result_ids || ""),
        figures: String(c.figure_ids || ""),
        sources: String(c.source_ids || ""),
        section: c.section,
        status: c.status,
      })),
    });
  }

  // ── Visual review annotations CRUD (09-integrations Epic 1a) ──
  if (req.method === "GET" && path === "/api/editor/annotations") {
    const user = requireUser(req, res);
    if (!user) return undefined;
    const url = new URL(req.url, `http://localhost:${port}`);
    if (!url.searchParams.get("workspace") && !url.searchParams.get("contest")) {
      return sendJson(res, 400, { error: "workspace is required" });
    }
    return sendJson(res, 200, { annotations: readAnnotations(queryWorkspaceId(url)) });
  }

  if (req.method === "POST" && path === "/api/editor/annotations") {
    const user = requireUser(req, res);
    if (!user) return undefined;
    const body = await readBody(req);
    if (!body.workspace && !body.contest) return sendJson(res, 400, { error: "workspace is required" });
    const workspaceId = bodyWorkspaceId(body);
    try { workspaceRoot(workspaceId); } catch { return sendJson(res, 400, { error: "unknown workspace" }); }
    const target = normalizeAnnotationTarget(body.target);
    if (!target) return sendJson(res, 400, { error: "invalid annotation target" });
    const note = String(body.note || "").trim().slice(0, 2000);
    if (!note) return sendJson(res, 400, { error: "note is required" });
    const now = new Date().toISOString();
    const annotation = {
      id: newToken().slice(0, 10),
      target,
      note,
      intent: ANNOTATION_INTENTS.has(body.intent) ? body.intent : "edit",
      priority: ANNOTATION_PRIORITIES.has(body.priority) ? body.priority : "normal",
      status: "open",
      author: user.displayName || user.username,
      createdAt: now,
      updatedAt: now,
    };
    const annotations = readAnnotations(workspaceId);
    annotations.push(annotation);
    writeAnnotations(workspaceId, annotations);
    audit(user, "annotation.create", `${workspaceId}/${target.path}:${target.startLine}-${target.endLine}`);
    return sendJson(res, 200, { annotation });
  }

  const annotationRoute = /^\/api\/editor\/annotations\/([\w-]+)$/.exec(path);
  if (annotationRoute && (req.method === "PATCH" || req.method === "DELETE")) {
    const user = requireUser(req, res);
    if (!user) return undefined;
    const id = annotationRoute[1];
    const url = new URL(req.url, `http://localhost:${port}`);
    let body = {};
    if (req.method === "PATCH") body = await readBody(req);
    const hasWorkspace = url.searchParams.get("workspace") || url.searchParams.get("contest") || body.workspace || body.contest;
    if (!hasWorkspace) return sendJson(res, 400, { error: "workspace is required" });
    const workspaceId = queryWorkspaceId(url) || bodyWorkspaceId(body);
    const annotations = readAnnotations(workspaceId);
    const idx = annotations.findIndex((a) => a.id === id);
    if (idx < 0) return sendJson(res, 404, { error: "annotation not found" });
    if (req.method === "DELETE") {
      annotations.splice(idx, 1);
      writeAnnotations(workspaceId, annotations);
      audit(user, "annotation.delete", `${workspaceId}/${id}`);
      return sendJson(res, 200, { ok: true });
    }
    const current = annotations[idx];
    if (typeof body.note === "string") current.note = body.note.trim().slice(0, 2000);
    if (ANNOTATION_INTENTS.has(body.intent)) current.intent = body.intent;
    if (ANNOTATION_PRIORITIES.has(body.priority)) current.priority = body.priority;
    if (ANNOTATION_STATUSES.has(body.status)) current.status = body.status;
    current.updatedAt = new Date().toISOString();
    writeAnnotations(workspaceId, annotations);
    audit(user, "annotation.update", `${workspaceId}/${id}`);
    return sendJson(res, 200, { annotation: current });
  }

  // Apply strict BEGIN_FILE / END_FILE blocks from an AI response into the
  // Workspace. Transactional (EditTransaction v1):
  //   preview  → per-block { path, bytes, exists, mtime } baseline stamps
  //   apply    → optional body.baseline [{ path, mtime }] is verified against
  //              the current disk state; any drift aborts with 409 before a
  //              single byte is written
  //   failure  → every block written so far is rolled back (prior content
  //              restored, created files removed) and 500 APPLY_ROLLBACK
  if (req.method === "POST" && path === "/api/editor/apply-blocks") {
    const user = requireUser(req, res);
    if (!user) return undefined;
    const body = await readBody(req);
    const workspaceId = bodyWorkspaceId(body);
    const text = String(body.text || "");
    if (!workspaceId) return sendJson(res, 400, { error: "workspace is required" });
    const re = /BEGIN_FILE:\s*([^\r\n]+)\r?\n([\s\S]*?)END_FILE/g;
    const blocks = [];
    let m;
    while ((m = re.exec(text)) !== null) {
      const rel = String(m[1] || "").trim().replace(/^\/+/, "").replace(/\\/g, "/");
      if (!rel || rel.includes("..") || /^[a-zA-Z]:/.test(rel)) {
        return sendJson(res, 400, { error: `invalid path in block: ${rel}` });
      }
      blocks.push({ path: rel, content: m[2].replace(/\n$/, "") });
    }
    if (!blocks.length) return sendJson(res, 400, { error: "no BEGIN_FILE blocks found" });
    // Resolve every target before touching disk so containment violations
    // abort the whole transaction up front.
    const resolved = blocks.map((block) => ({
      ...block,
      abs: workspacePath(workspaceId, block.path),
    }));
    const stat = (abs) => {
      try {
        const s = statSync(abs);
        return s.isFile() ? s : null;
      } catch {
        return null;
      }
    };
    const preview = body.apply !== true;
    const describe = () => resolved.map((block) => {
      const s = stat(block.abs);
      return {
        path: block.path,
        bytes: Buffer.byteLength(block.content, "utf-8"),
        exists: Boolean(s),
        mtime: s ? s.mtimeMs : null,
      };
    });
    if (preview) {
      return sendJson(res, 200, { preview: true, blocks: describe(), written: [] });
    }
    // Conflict detection: the client passes back the stamps it previewed.
    const baseline = Array.isArray(body.baseline) ? body.baseline : [];
    const baselineMap = new Map(
      baseline
        .filter((entry) => entry && typeof entry.path === "string")
        .map((entry) => [entry.path, entry.mtime == null ? null : Number(entry.mtime)]),
    );
    const conflicts = [];
    for (const block of resolved) {
      if (!baselineMap.has(block.path)) continue;
      const expected = baselineMap.get(block.path);
      const current = stat(block.abs)?.mtimeMs ?? null;
      const drifted = expected == null
        ? current != null
        : current == null || Math.abs(current - expected) > 0.001;
      if (drifted) conflicts.push(block.path);
    }
    if (conflicts.length) {
      return sendJson(res, 409, {
        error: `files changed after preview: ${conflicts.join(", ")}`,
        code: "APPLY_CONFLICT",
        conflicts,
      });
    }
    // Journaled write with rollback.
    const written = [];
    const journal = [];
    try {
      for (const block of resolved) {
        const existing = stat(block.abs);
        journal.push({
          abs: block.abs,
          path: block.path,
          existed: Boolean(existing),
          prior: existing ? readFileSync(block.abs) : null,
        });
        mkdirSync(dirname(block.abs), { recursive: true });
        writeFileSync(block.abs, block.content, "utf-8");
        written.push(block.path);
      }
    } catch (error) {
      for (const entry of journal.reverse()) {
        try {
          if (entry.existed) writeFileSync(entry.abs, entry.prior);
          else if (stat(entry.abs)) unlinkSync(entry.abs);
        } catch { /* best-effort rollback */ }
      }
      return sendJson(res, 500, {
        error: `apply failed at ${journal[0]?.path || "unknown"}: ${error.message}; all changes were rolled back`,
        code: "APPLY_ROLLBACK",
        rolledBack: journal.map((entry) => entry.path),
      });
    }
    audit(user, "editor.apply", `${workspaceId} ${written.length} file(s)`);
    return sendJson(res, 200, { preview: false, blocks: describe(), written });
  }

  // ===========================================================
  // Market: skill listings + install tracking
  // ===========================================================
  if (req.method === "GET" && path === "/api/market/skills") {
    const url = new URL(req.url, `http://localhost:${port}`);
    const cat = url.searchParams.get("cat");
    const data = skillsStore.read();
    const skills = cat && cat !== "all" ? data.skills.filter((s) => s.cat === cat) : data.skills;
    const user = getSessionUser(req);
    const installed = new Set();
    if (user) {
      installsStore.read().installs
        .filter((i) => i.userId === user.id)
        .forEach((i) => installed.add(i.skillId));
    }
    return sendJson(res, 200, {
      skills: skills.map((s) => ({ ...s, installed: installed.has(s.id) })),
    });
  }

  if (req.method === "POST" && /^\/api\/market\/skills\/[\w-]+\/install$/.test(path)) {
    const user = requireUser(req, res);
    if (!user) return undefined;
    const skillId = path.split("/")[4];
    const data = skillsStore.read();
    const skill = data.skills.find((s) => s.id === skillId);
    if (!skill) return sendJson(res, 404, { error: "skill not found" });
    installsStore.update((d) => {
      const idx = d.installs.findIndex((i) => i.userId === user.id && i.skillId === skillId);
      if (idx >= 0) d.installs[idx].installedAt = new Date().toISOString();
      else d.installs.push({ id: newToken().slice(0, 10), userId: user.id, skillId, installedAt: new Date().toISOString() });
      return d;
    });
    audit(user, "skill.install", skillId);
    return sendJson(res, 200, { ok: true, skillId });
  }

  // ===========================================================
  // Skills: list + real run (citation-verifier does HTTP HEAD,
  // data-sniffer reads CSVs from contest dir, review-loupe does
  // heuristic checks, others return a chat envelope for the
  // frontend to seed AI Chat with the skill system prompt)
  // ===========================================================
  if (req.method === "GET" && path === "/api/skills") {
    const user = getSessionUser(req);
    const data = skillsStore.read();
    const installed = new Set();
    if (user) {
      installsStore.read().installs
        .filter((i) => i.userId === user.id)
        .forEach((i) => installed.add(i.skillId));
    }
    return sendJson(res, 200, {
      skills: data.skills.map((s) => ({ ...s, installed: installed.has(s.id) })),
    });
  }

  if (req.method === "POST" && /^\/api\/skills\/[\w-]+\/run$/.test(path)) {
    const user = requireUser(req, res);
    if (!user) return undefined;
    const skillId = path.split("/")[3];
    const skill = skillsStore.read().skills.find((s) => s.id === skillId);
    if (!skill) return sendJson(res, 404, { error: "skill not found" });
    // requires install
    const installed = installsStore.read().installs.some(
      (i) => i.userId === user.id && i.skillId === skillId,
    );
    if (!installed) return sendJson(res, 403, { error: "skill not installed" });
    const body = await readBody(req);
    const input = String(body.input || "").trim();
    const ctx = body.context || {};
    if (!input) return sendJson(res, 400, { error: "input is required" });

    audit(user, "skill.run", `${skillId} (${skill.execute})`);
    recordUsage(user.id, { model: `skill:${skillId}`, kind: "skill", promptTokens: input.length, completionTokens: 0, ok: true, workspace: String(ctx.workspace || ctx.contest || body.workspace || body.contest || "").trim().slice(0, 64) });

    const ts = new Date().toISOString();
    try {
      if (skill.execute === "citation") {
        // extract first URL from input; HEAD-probe; return verdict
        const m = input.match(/https?:\/\/\S+/);
        if (!m) return sendJson(res, 200, {
          ok: true, mode: "citation", verdict: "no URL found in input", citations: [], ranAt: ts,
        });
        let url = m[0];
        try { const r = await fetch(url, { method: "HEAD", redirect: "follow" });
          return sendJson(res, 200, {
            ok: true, mode: "citation", ranAt: ts,
            citations: [{ url, status: r.status, ok: r.ok, contentType: r.headers.get("content-type") }],
            verdict: r.ok ? `URL ${url} is reachable (${r.status}).` : `URL ${url} NOT reachable (${r.status}).`,
          });
        } catch (e) {
          return sendJson(res, 200, { ok: false, mode: "citation", ranAt: ts, verdict: `request failed: ${e.message}` });
        }
      }

      if (skill.execute === "csv") {
        // resolve path under contests/<ctx.contest>/
        const contestId = safeContestId(ctx.contest || "sample-contest");
        const rel = String(ctx.path || input).replace(/^\/+/, "");
        const fp = join(root, "contests", contestId, rel);
        if (!existsSync(fp) || !statSync(fp).isFile()) {
          return sendJson(res, 200, { ok: false, mode: "csv", ranAt: ts, error: "file not found", path: fp });
        }
        const txt = readFileSync(fp, "utf-8");
        const lines = txt.split(/\r?\n/).filter(Boolean);
        const head = lines.slice(0, 6);
        const cols = (head[0] || "").split(",").map((c) => c.trim());
        const numericCols = cols.filter((c) => {
          const sample = head.slice(1).map((r) => r.split(",")[cols.indexOf(c)]).filter(Boolean);
          return sample.length && sample.every((v) => !Number.isNaN(Number(v)));
        });
        return sendJson(res, 200, {
          ok: true, mode: "csv", ranAt: ts, path: rel, rows: lines.length - 1,
          columns: cols, numericColumns: numericCols,
          preview: head, suggestedCharts: numericCols.length >= 1
            ? [`histogram(${numericCols[0]})`, numericCols.length >= 2 ? `scatter(${numericCols[0]}, ${numericCols[1]})` : null].filter(Boolean)
            : ["bar-count(categorical)"],
        });
      }

      if (skill.execute === "review") {
        // heuristic review: word count, evidence markers, sentence length
        const words = input.split(/\s+/).filter(Boolean).length;
        const sentences = input.split(/[.!?。！？]/).filter((s) => s.trim().length > 4);
        const avgLen = sentences.length ? Math.round(words / sentences.length) : 0;
        const evidenceHits = (input.match(/(实验|数据|结果|表|图|figure|table|results?|fig\.|tab\.|exp\.)/gi) || []).length;
        const markers = {
          ok: ["method", "result", "conclude", "data", "图", "表", "实验"],
        };
        const comments = [];
        if (avgLen > 35) comments.push({ severity: "high", note: `平均句长 ${avgLen} 词,可能过于冗长` });
        if (avgLen > 0 && avgLen < 8) comments.push({ severity: "medium", note: `平均句长 ${avgLen} 词,可能过于碎片` });
        if (evidenceHits < 1) comments.push({ severity: "high", note: "段落缺少证据指代(图/表/实验/数据)" });
        if (words < 80) comments.push({ severity: "medium", note: `仅 ${words} 词,可能不够展开` });
        if (comments.length === 0) comments.push({ severity: "info", note: "结构与证据指代均合理" });
        return sendJson(res, 200, {
          ok: true, mode: "review", ranAt: ts,
          stats: { words, sentences: sentences.length, avgLen, evidenceHits },
          comments,
        });
      }

      if (skill.execute === "writing") {
        // simple heuristic tightening: collapse repeated words, trim whitespace
        const tightened = input
          .replace(/[ \t]+/g, " ")
          .replace(/\n{3,}/g, "\n\n")
          .replace(/\b(the|The)\s+(the|The)\b/g, "$2")
          .replace(/\bin order to\b/gi, "to")
          .replace(/\bin the (case|context) of\b/gi, "for")
          .replace(/\b(it is (worth|noteworthy|important) to (note|mention|observe))\b[^.]*\.\s*/gi, "")
          .trim();
        return sendJson(res, 200, {
          ok: true, mode: "writing", ranAt: ts,
          before: input, after: tightened,
          ratio: tightened.length / Math.max(1, input.length),
        });
      }

      // Default (figure/model/layout): return a chat envelope for the frontend
      return sendJson(res, 200, {
        ok: true, mode: "envelope", ranAt: ts,
        skill: { id: skill.id, name: skill.name, systemPrompt: skill.systemPrompt },
        suggestedSeed: `请用 ${skill.name} 技能处理以下输入:\n\n${input}`,
      });
    } catch (e) {
      return sendJson(res, 500, { ok: false, error: String(e.message || e) });
    }
  }

  // ===========================================================
  // Team: single default team per user, Kanban tasks
  // ===========================================================
  function getOrCreateTeam(user) {
    const data = teamsStore.read();
    let team = data.teams.find((t) => t.members.includes(user.id));
    if (!team) {
      team = {
        id: newToken().slice(0, 10),
        name: user.displayName || user.username,
        members: [user.id],
        createdAt: new Date().toISOString(),
      };
      data.teams.push(team);
      teamsStore.write(data);
    }
    return team;
  }

  if (req.method === "GET" && path === "/api/team") {
    const user = requireUser(req, res);
    if (!user) return undefined;
    const team = getOrCreateTeam(user);
    const tasks = tasksStore.read().tasks.filter((t) => t.teamId === team.id);
    const { users } = usersStore.read();
    const members = team.members.map((id) => {
      const u = users.find((x) => x.id === id);
      return u ? { id: u.id, username: u.username, displayName: u.displayName || u.username, role: u.role } : null;
    }).filter(Boolean);
    return sendJson(res, 200, { team, members, tasks });
  }

  if (req.method === "GET" && path === "/api/team/tasks") {
    const user = requireUser(req, res);
    if (!user) return undefined;
    const team = getOrCreateTeam(user);
    const tasks = tasksStore.read().tasks.filter((t) => t.teamId === team.id);
    return sendJson(res, 200, { tasks });
  }

  if (req.method === "POST" && path === "/api/team/tasks") {
    const user = requireUser(req, res);
    if (!user) return undefined;
    const body = await readBody(req);
    const team = getOrCreateTeam(user);
    const title = String(body.title || "").trim().slice(0, 120);
    if (title.length < 2) return sendJson(res, 400, { error: "title is required" });
    const task = {
      id: newToken().slice(0, 10),
      teamId: team.id,
      title,
      assignee: String(body.assignee || user.username),
      due: String(body.due || "今日"),
      file: String(body.file || "paper.tex"),
      ev: Number(body.ev) || 1,
      state: "todo",
      createdBy: user.id,
      createdAt: new Date().toISOString(),
    };
    tasksStore.update((d) => { d.tasks.push(task); return d; });
    broadcast(`team:${team.id}`, { event: "task.created", task });
    return sendJson(res, 200, { task });
  }

  if (req.method === "PATCH" && /^\/api\/team\/tasks\/[\w-]+$/.test(path)) {
    const user = requireUser(req, res);
    if (!user) return undefined;
    const id = path.split("/")[4];
    const body = await readBody(req);
    let updated = null;
    let teamId = null;
    tasksStore.update((d) => {
      const t = d.tasks.find((x) => x.id === id);
      if (t) {
        if (typeof body.state === "string") t.state = body.state;
        if (typeof body.title === "string") t.title = body.title.slice(0, 120);
        if (typeof body.assignee === "string") t.assignee = body.assignee;
        updated = t;
        teamId = t.teamId;
      }
      return d;
    });
    if (!updated) return sendJson(res, 404, { error: "task not found" });
    if (teamId) broadcast(`team:${teamId}`, { event: "task.updated", task: updated });
    return sendJson(res, 200, { task: updated });
  }

  // ===========================================================
  // AI Chat: stream from configured OpenAI-compatible provider
  // ===========================================================
  // AI session history (09-integrations Epic 2a): list/search the caller's own
  // recorded chat threads; ?id= returns one thread's full prompt + reply.
  if (req.method === "GET" && path === "/api/chat/history") {
    const user = requireUser(req, res);
    if (!user) return undefined;
    const url = new URL(req.url, `http://localhost:${port}`);
    const threadId = url.searchParams.get("id");
    const q = String(url.searchParams.get("q") || "").trim().toLowerCase();
    const own = chatStore.read().threads.filter((t) => t.userId === user.id);
    if (threadId) {
      const thread = own.find((t) => t.id === threadId);
      if (!thread) return sendJson(res, 404, { error: "thread not found" });
      const { userId, ...safe } = thread;
      return sendJson(res, 200, { thread: safe });
    }
    const fileBlocksOf = (text) => {
      const re = /BEGIN_FILE:\s*([^\r\n]+)/g;
      const paths = [];
      let m;
      while ((m = re.exec(String(text || ""))) !== null) paths.push(m[1].trim());
      return paths;
    };
    let threads = own.slice().reverse();
    if (q) threads = threads.filter((t) => `${t.prompt} ${t.reply}`.toLowerCase().includes(q));
    const summary = threads.slice(0, 100).map((t) => ({
      id: t.id,
      mode: t.mode,
      workspace: t.workspace || "",
      createdAt: t.createdAt,
      prompt: String(t.prompt || "").slice(0, 200),
      replyPreview: String(t.reply || "").replace(/\s+/g, " ").trim().slice(0, 200),
      fileBlocks: fileBlocksOf(t.reply),
    }));
    return sendJson(res, 200, { threads: summary, total: own.length });
  }

  if (req.method === "POST" && path === "/api/chat") {
    const user = requireUser(req, res);
    if (!user) return undefined;
    const body = await readBody(req);
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const mode = String(body.mode || "chat");
    const selection = String(body.selection || "");
    // Usage attribution only; not validated against the kernel on purpose so a
    // stale workspace id never blocks a chat.
    const chatWorkspace = String(body.workspace || body.contest || "").trim().slice(0, 64);
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    const userText = String(lastUser?.content || body.prompt || "").trim();
    if (!userText && mode !== "inline") return sendJson(res, 400, { error: "no user message" });
    if (mode === "inline" && !selection) return sendJson(res, 400, { error: "no selection" });

    const systemChat = "You are Paper OS Assistant for a LaTeX IDE. Be concise and evidence-traced. When proposing file edits, ALWAYS emit complete file replacements using:\nBEGIN_FILE: relative/path.tex\n...full file content...\nEND_FILE\nUse forward-slash relative paths inside the contest workspace only. Never invent numbers without naming a ledger row.";
    const systemInline = "You are Paper OS Inline Edit. Rewrite ONLY the provided LaTeX selection per the user instruction. Output MUST be:\nBEGIN_SELECTION\n...rewritten selection only...\nEND_SELECTION\nKeep surrounding structure valid. Do not invent numeric claims. Prefer minimal edits.";

    // Try to use the configured provider; fall back to a deterministic mock
    // response so the UI works even when no API key is set.
    let reply = "";
    let usedModel = "";
    let promptTok = 0;
    let completionTok = 0;
    let chatStart = Date.now();
    let fallbackReason = "provider-not-configured";
    let providerResponseStarted = false;
    try {
      // Prefer the caller's own encrypted key; fall back to the shared config.
      // Epic 4b: the request may pin a specific provider profile for this call.
      const provider = resolveEffectiveProvider(user.id, String(body.profileId || "") || null);
      usedModel = provider.model || "default";
      const endpoint = `${String(provider.base_url || "").replace(/\/+$/, "")}/chat/completions`;
      const apiKey = provider.apiKey || "";
      if (apiKey && provider.model) {
        fallbackReason = "provider-unavailable";
        const llmMessages = mode === "inline"
          ? [
              { role: "system", content: systemInline },
              { role: "user", content: `Instruction:\n${userText || "Improve clarity and LaTeX style."}\n\nSelection:\n${selection}` },
            ]
          : [
              { role: "system", content: systemChat },
              ...messages,
            ];
        const resp = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: provider.model,
            messages: llmMessages,
            temperature: Number(provider.temperature || 0.2),
            stream: true,
          }),
        });
        if (resp.ok && resp.body) {
          const reader = resp.body.getReader();
          const decoder = new TextDecoder();
          let upstreamBuffer = "";
          const forwardProviderLine = (line) => {
            if (!line.startsWith("data:")) return;
            const data = line.slice(5).trim();
            if (!data || data === "[DONE]") return;
            try {
              const json = JSON.parse(data);
              const delta = json?.choices?.[0]?.delta?.content;
              if (delta) {
                res.write(`data: ${JSON.stringify({ delta })}\n\n`);
                reply += delta;
                completionTok += Math.ceil(delta.length / 4);
              }
              const usage = json?.usage;
              if (usage) {
                promptTok = usage.prompt_tokens || promptTok;
                completionTok = usage.completion_tokens || completionTok;
              }
            } catch {
              // Ignore complete malformed upstream frames; partial frames stay buffered.
            }
          };
          providerResponseStarted = true;
          res.writeHead(200, { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache", Connection: "keep-alive" });
          res.write(`data: ${JSON.stringify({
            meta: {
              runtime: "provider",
              model: usedModel,
              source: provider.source,
            },
          })}\n\n`);
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            upstreamBuffer += decoder.decode(value, { stream: true });
            const lines = upstreamBuffer.split(/\r?\n/);
            upstreamBuffer = lines.pop() || "";
            for (const line of lines) forwardProviderLine(line);
          }
          upstreamBuffer += decoder.decode();
          for (const line of upstreamBuffer.split(/\r?\n/)) {
            forwardProviderLine(line);
          }
          res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
          res.end();
          chatStore.update((d) => { d.threads.push({ id: newToken().slice(0, 10), userId: user.id, prompt: userText, reply, createdAt: new Date().toISOString(), mode, workspace: chatWorkspace }); d.threads = trimUserThreads(d.threads, user.id, planLimits(user).chatHistory); return d; });
          recordUsage(user.id, { model: usedModel, kind: mode === "inline" ? "inline" : "chat", promptTokens: promptTok, completionTokens: completionTok, durationMs: Date.now() - chatStart, ok: true, workspace: chatWorkspace });
          return undefined;
        }
      }
    } catch {
      if (providerResponseStarted) {
        if (!res.writableEnded) {
          res.write(`data: ${JSON.stringify({
            error: {
              code: "PROVIDER_STREAM_ERROR",
              message: "Provider stream interrupted",
            },
          })}\n\n`);
          res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
          res.end();
        }
        recordUsage(user.id, {
          model: usedModel || "provider",
          kind: mode === "inline" ? "inline" : "chat",
          promptTokens: promptTok,
          completionTokens: completionTok,
          durationMs: Date.now() - chatStart,
          ok: false,
          workspace: chatWorkspace,
        });
        return undefined;
      }
      fallbackReason = "provider-error";
      // fall through to mock
    }
    // Mock reply (deterministic, useful when no provider is configured)
    const echo = userText.length > 200 ? userText.slice(0, 200) + "…" : userText;
    if (mode === "inline") {
      const cleaned = selection
        .replace(/\s+$/g, "")
        .split("\n")
        .map((ln) => ln.replace(/[ \t]+$/g, ""))
        .join("\n");
      const note = userText ? `% inline: ${userText.replace(/\n/g, " ").slice(0, 80)}\n` : "";
      reply = `BEGIN_SELECTION\n${note}${cleaned || selection}\nEND_SELECTION\n`;
    } else {
      const wantsEdit = /(改|修改|更新|补|写|edit|update|fix|rewrite|apply)/i.test(userText);
      const fileHint = (userText.match(/\[file:([^\]]+)\]/) || [])[1] || "paper/main.tex";
      if (wantsEdit) {
        reply = `Paper OS Assistant (本地兜底) · 已准备可审查的文件块。确认后点击「Apply」写入工作区。\n\n关于:\n> ${echo}\n\nBEGIN_FILE: ${fileHint}\n% Auto-drafted by Paper OS Assistant (review before apply)\n\\section{Revised note}\nUpdated based on your request. Replace this scaffold with verified content.\n% request: ${echo.replace(/\n/g, " ").slice(0, 120)}\nEND_FILE\n`;
      } else {
        reply = `Paper OS Assistant (本地兜底) · 已读到 ${userText.length} 字符的上下文。\n\n关于:\n> ${echo}\n\n建议:选中源码后按 Ctrl+K 做 Inline Edit；需要整文件改动时我会给出 BEGIN_FILE 块，你确认后再 Apply。配置 OpenAI 兼容 provider 后可获得真实流式回答。`;
      }
    }
    res.writeHead(200, { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache", Connection: "keep-alive" });
    res.write(`data: ${JSON.stringify({
      meta: {
        runtime: "mock-local",
        model: "mock-local",
        reason: fallbackReason,
      },
    })}\n\n`);
    const tokens = reply.split(/(\s+)/);
    let i = 0;
    function push() {
      if (i >= tokens.length) { res.write(`data: ${JSON.stringify({ done: true })}\n\n`); res.end(); return; }
      res.write(`data: ${JSON.stringify({ delta: tokens[i] })}\n\n`);
      i += 1;
      setTimeout(push, 12);
    }
    push();
    chatStore.update((d) => { d.threads.push({ id: newToken().slice(0, 10), userId: user.id, prompt: userText, reply, createdAt: new Date().toISOString(), mode, workspace: chatWorkspace }); d.threads = trimUserThreads(d.threads, user.id, planLimits(user).chatHistory); return d; });
    recordUsage(user.id, { model: "mock-local", kind: mode === "inline" ? "inline" : "chat", promptTokens: userText.length + selection.length, completionTokens: reply.length, durationMs: Date.now() - chatStart, ok: true, workspace: chatWorkspace });
    return undefined;
  }

  // ===========================================================
  // Usage: API relay-style stats (per-user, sub2api/newapi style)
  // ===========================================================
  if (req.method === "GET" && path === "/api/usage/me") {
    const user = requireUser(req, res);
    if (!user) return undefined;
    const url = new URL(req.url, `http://localhost:${port}`);
    const days = Math.min(180, Math.max(1, Number(url.searchParams.get("days")) || 30));
    const my = usageStore.read().records.filter((r) => r.userId === user.id);
    return sendJson(res, 200, { days, ...aggregateUsage(my, days) });
  }

  if (req.method === "GET" && path === "/api/admin/usage") {
    if (!requireAdmin(req, res)) return undefined;
    const url = new URL(req.url, `http://localhost:${port}`);
    const days = Math.min(180, Math.max(1, Number(url.searchParams.get("days")) || 30));
    const all = usageStore.read().records;
    const agg = aggregateUsage(all, days);
    const byUser = {};
    const since = Date.now() - days * 86400000;
    for (const r of all) {
      if (new Date(r.at).getTime() < since) continue;
      byUser[r.userId] = byUser[r.userId] || { tokens: 0, cost: 0, requests: 0 };
      byUser[r.userId].tokens += r.totalTokens;
      byUser[r.userId].cost += r.costUsd;
      byUser[r.userId].requests += 1;
    }
    const users = usersStore.read().users;
    const userRows = Object.entries(byUser).map(([uid, v]) => {
      const u = users.find((x) => x.id === uid);
      return {
        id: uid,
        username: u?.username,
        displayName: u?.displayName || u?.username,
        tokens: v.tokens,
        requests: v.requests,
        costUsd: Number(v.cost.toFixed(6)),
      };
    }).sort((a, b) => b.tokens - a.tokens);
    return sendJson(res, 200, { days, ...agg, users: userRows });
  }

  // ===========================================================
  // OAuth: Google / GitHub / WeChat Work
  // Start: returns the OAuth provider URL (or, in dev, a local callback URL).
  // Callback: exchanges the code for a session, returns a paperos:// deep link.
  // ===========================================================
  const OAUTH_PROVIDERS = {
    google: { name: "Google", scope: "openid email profile" },
    github: { name: "GitHub", scope: "read:user user:email" },
    "wechat-work": { name: "企业微信", scope: "snsapi_login" },
  };

  if (req.method === "GET" && /^\/api\/auth\/oauth\/[\w-]+\/start$/.test(path)) {
    const provider = path.split("/")[5];
    if (!OAUTH_PROVIDERS[provider]) return sendJson(res, 400, { error: "unknown provider" });
    const url = new URL(req.url, `http://localhost:${port}`);
    const wantsRedirect = url.searchParams.get("redirect") === "1";
    // In production this would be the real provider authorize URL.
    // In dev / demo we redirect to our own callback with a fake code.
    const devCallback = `http://${req.headers.host || `127.0.0.1:${port}`}/api/auth/oauth/${provider}/callback?code=dev-${provider}-${Date.now()}&state=desktop&provider=${provider}`;
    return sendJson(res, 200, { provider, url: devCallback, dev: true, openInSystemBrowser: wantsRedirect });
  }

  if (req.method === "GET" && /^\/api\/auth\/oauth\/[\w-]+\/callback$/.test(path)) {
    const provider = path.split("/")[5];
    if (!OAUTH_PROVIDERS[provider]) return sendJson(res, 400, { error: "unknown provider" });
    const url = new URL(req.url, `http://localhost:${port}`);
    const code = String(url.searchParams.get("code") || "");
    if (!code.startsWith("dev-")) return sendJson(res, 400, { error: "only dev-codes accepted in this build" });
    // Mint a session for a deterministic test user keyed off the OAuth code.
    const handle = `@${provider}-${code.slice(-6)}`;
    const data = usersStore.read();
    let user = data.users.find((u) => u.username === handle);
    if (!user) {
      user = {
        id: newToken().slice(0, 16),
        username: handle,
        email: `${handle}@oauth.${provider}`,
        displayName: OAUTH_PROVIDERS[provider].name + " User",
        password: hashPassword(code),
        role: data.users.length === 0 ? "owner" : "member",
        status: "active",
        oauthProvider: provider,
        createdAt: new Date().toISOString(),
      };
      data.users.push(user);
      usersStore.write(data);
    }
    const token = newToken();
    sessionsStore.update((d) => {
      d.sessions[token] = {
        userId: user.id,
        expiresAt: Date.now() + SESSION_TTL_SECONDS * 1000,
        createdAt: Date.now(),
        label: `${OAUTH_PROVIDERS[provider].name} 登录`,
      };
      return d;
    });
    audit(user, "auth.oauth", `${provider}`);
    // The callback page tells the user to return to the desktop; the
    // paperos:// deep link would normally be auto-opened by the OS.
    const desktopDeepLink = `paperos://auth?token=${token}&provider=${provider}&user=${encodeURIComponent(user.username)}`;
    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    });
    res.end(`<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>登录成功 · ${OAUTH_PROVIDERS[provider].name}</title>
<style>
body { background:#0a0a0c; color:#e8e3da; font-family: -apple-system, system-ui, sans-serif; display:grid; place-items:center; min-height:100vh; margin:0; }
.card { background:#0e0e12; border:1px solid rgba(255,255,255,0.1); border-radius:12px; padding:28px 32px; max-width:420px; text-align:center; }
h1 { font-size:20px; margin:0 0 8px; }
p { color:#7d8896; font-size:14px; margin:0 0 18px; }
code { display:block; background:#050507; border:1px solid rgba(255,255,255,0.06); border-radius:6px; padding:8px 10px; font-family: ui-monospace, "Cascadia Mono", monospace; font-size:12px; color:#e2b564; word-break: break-all; }
.btn { display:inline-block; background:#d4a341; color:#1a0f02; padding:10px 20px; border-radius:8px; text-decoration:none; font-weight:600; margin-top:14px; }
.hint { color:#4d5663; font-size:12px; margin-top:12px; }
</style></head><body>
<div class="card">
  <h1>✓ 授权成功</h1>
  <p>${OAUTH_PROVIDERS[provider].name} 账号已绑定到 Paper OS。点击下方按钮回到桌面端继续。</p>
  <a class="btn" href="${desktopDeepLink}">回到 Paper OS 桌面端</a>
  <p class="hint">如果桌面端没有自动打开,请复制下方深链到桌面端:</p>
  <code>${desktopDeepLink}</code>
</div>
</body></html>`);
    return undefined;
  }

  return sendJson(res, 404, { error: "not found" });
}

function staticFile(res, path) {
  // The desktop IDE lives at /ide/* and is served from ideDir (a sibling
  // of publicDir so Vite's emptyOutDir on publicDir cannot wipe it).
  if (path === "/ide" || path === "/ide/") path = "/ide/index.html";
  if (path.startsWith("/ide/")) {
    const cleaned = path.slice("/ide".length) || "/index.html";
    const filePath = ensureInside(ideDir, join(ideDir, cleaned));
    if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
      return sendText(res, 404, "Not found");
    }
    return sendFile(res, filePath);
  }
  const cleanPath = path === "/" ? "/index.html" : path;
  const filePath = ensureInside(publicDir, join(publicDir, cleanPath));
  if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
    // SPA history fallback: client-side routes (e.g. /pricing, /app/account)
    // have no file on disk. Serve index.html for extension-less GET paths so
    // deep links work, but never for asset requests (those should 404).
    const looksLikeRoute = !extname(cleanPath) && !cleanPath.startsWith("/assets/");
    const indexHtml = join(publicDir, "index.html");
    if (looksLikeRoute && existsSync(indexHtml)) {
      return sendFile(res, indexHtml);
    }
    return sendText(res, 404, "Not found");
  }
  return sendFile(res, filePath);
}

function sendFile(res, filePath) {
  const ext = extname(filePath);
  const types = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".map": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".woff2": "font/woff2",
    ".woff": "font/woff",
    ".ttf": "font/ttf",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".ico": "image/x-icon",
    ".mp4": "video/mp4",
  };
  sendText(res, 200, readFileSync(filePath), types[ext] || "application/octet-stream");
}

// Security headers applied to every response. The IDE bundles Monaco (needs
// worker blobs + wasm eval) and renders compiled PDFs from blob: URLs, so the
// CSP is scoped to allow those local sources while blocking remote origins.
function applySecurityHeaders(res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Permitted-Cross-Domain-Policies", "none");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      // Monaco/editor + bundled React need inline + eval + blob workers.
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:",
      "worker-src 'self' blob:",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "media-src 'self' blob: data:",
      // Compiled PDF preview + binary previews load from blob: in an iframe.
      "frame-src 'self' blob:",
      "object-src 'self' blob:",
      // Same-origin XHR/fetch + local WebSocket for live compile logs.
      "connect-src 'self' ws: wss:",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  );
}

const server = createServer({ requireHostHeader: false }, (req, res) => {
  applySecurityHeaders(res);
  const policy = requestPolicyError(req);
  if (policy) return sendJson(res, policy.status, { error: policy.error, code: policy.code });
  const url = new URL(req.url, `http://localhost:${port}`);
  if (url.pathname.startsWith("/api/")) {
    api(req, res, url.pathname).catch((error) => {
      if (res.headersSent) return;
      if (error instanceof RequestBodyTooLarge) {
        res.setHeader("Connection", "close");
        return sendJson(res, 413, { error: error.message, code: error.code });
      }
      // Kernel errors carry intentional, safe messages — map them to proper
      // statuses instead of a generic 500 (e.g. unknown workspace id -> 404).
      if (error instanceof WorkspaceKernelError) {
        const notFound = error.code === "WORKSPACE_NOT_FOUND" || error.code === "MISSING_DIRECTORY";
        const conflict = error.code === "WORKSPACE_EXISTS";
        const status = notFound ? 404 : conflict ? 409 : 400;
        return sendJson(res, status, { error: error.message, code: error.code });
      }
      // Never leak internal error details to the client.
      const isSyntax = error instanceof SyntaxError;
      return sendJson(res, isSyntax ? 400 : 500, {
        error: isSyntax ? "请求体不是合法 JSON" : "服务器内部错误",
      });
    });
  } else {
    try {
      staticFile(res, url.pathname);
    } catch (error) {
      sendText(res, 403, error.message);
    }
  }
});

// ===========================================================
// WebSocket: real-time compile logs + team events
// ===========================================================
// Channels:
//   compile:<contest>      live stdout/stderr while a compile runs
//   team:<teamId>          task create/update/move broadcasts
const wss = new WebSocketServer({ noServer: true });
const wsSubs = new Map(); // channel -> Set<ws>

function broadcast(channel, payload) {
  const set = wsSubs.get(channel);
  if (!set) return;
  const data = JSON.stringify({ channel, ts: Date.now(), ...payload });
  for (const ws of set) {
    if (ws.readyState === 1) {
      try { ws.send(data); } catch { /* closed mid-flight */ }
    }
  }
}

server.on("upgrade", (req, socket, head) => {
  const policy = requestPolicyError(req);
  if (policy) {
    rejectUpgrade(socket, policy);
    return;
  }
  const url = new URL(req.url, `http://localhost:${port}`);
  if (!url.pathname.startsWith("/ws/")) {
    socket.destroy();
    return;
  }
  // auth via session cookie
  const user = (() => {
    const cookies = parseCookies(req.headers.cookie);
    const token = cookies[SESSION_COOKIE];
    if (!token) return null;
    const { sessions } = sessionsStore.read();
    const s = sessions[token];
    if (!s || s.expiresAt < Date.now()) return null;
    return usersStore.read().users.find((u) => u.id === s.userId) || null;
  })();
  if (!user) {
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => {
    ws.user = user;
    ws.subs = new Set();
    wss.emit("connection", ws, req);
  });
});

wss.on("connection", (ws) => {
  ws.on("message", (raw) => {
    // A malformed frame from an authenticated client must never throw:
    // an exception here would take down the whole server process.
    try {
      let msg;
      try { msg = JSON.parse(raw.toString()); } catch { return; }
      if (!msg || typeof msg.channel !== "string") return;
      const known = msg.channel.startsWith("compile:") || msg.channel.startsWith("team:");
      if (msg.op === "subscribe" && known) {
        // scope check
        if (msg.channel.startsWith("team:")) {
          const teamId = msg.channel.slice("team:".length);
          const team = teamsStore.read().teams.find((t) => t.id === teamId);
          if (!team || !team.members.includes(ws.user.id)) return;
        }
        if (!wsSubs.has(msg.channel)) wsSubs.set(msg.channel, new Set());
        wsSubs.get(msg.channel).add(ws);
        ws.subs.add(msg.channel);
      } else if (msg.op === "unsubscribe") {
        wsSubs.get(msg.channel)?.delete(ws);
        ws.subs.delete(msg.channel);
      }
    } catch { /* drop bad frame */ }
  });
  ws.on("close", () => {
    for (const ch of ws.subs) wsSubs.get(ch)?.delete(ws);
  });
});

export { server };

export function startServer() {
  return server.listen(port, "127.0.0.1", () => {
    console.log(`Paper OS running at http://127.0.0.1:${port}`);
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  startServer();
}
