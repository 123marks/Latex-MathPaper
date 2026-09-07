import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { tokenizeCommand, validateTerminalCommand } from "../app/lib/terminal.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("terminal policy: tokenizer, allowlist, and escape rejection", () => {
  assert.deepEqual(tokenizeCommand('git commit -m "a b" \'c d\''), ["git", "commit", "-m", "a b", "c d"]);
  assert.throws(() => tokenizeCommand("git status | grep x"), /shell 语法/);
  assert.throws(() => tokenizeCommand("echo $HOME"), /shell 语法/);
  assert.throws(() => tokenizeCommand('git "unclosed'), /引号未闭合/);
  assert.deepEqual(validateTerminalCommand("python main.py"), { program: "python", args: ["main.py"] });
  assert.deepEqual(validateTerminalCommand("node.exe -v"), { program: "node.exe", args: ["-v"] });
  assert.throws(() => validateTerminalCommand("rm -rf ."), /不在允许列表/);
  assert.throws(() => validateTerminalCommand("./evil.sh"), /程序名/);
  assert.throws(() => validateTerminalCommand("cat ../secrets.txt"), /工作区之外/);
  assert.throws(() => validateTerminalCommand("cat C:\\Windows\\win.ini"), /工作区之外/);
  assert.throws(() => validateTerminalCommand(""), /请输入命令/);
});

function freePort() {
  return new Promise((resolvePort, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const port = probe.address().port;
      probe.close(() => resolvePort(port));
    });
  });
}

function parseSse(text) {
  return text.split("\n\n").filter(Boolean).map((frame) => ({
    event: (frame.match(/^event: (.+)$/m) || [])[1],
    data: JSON.parse((frame.match(/^data: (.+)$/m) || [])[1] || "{}"),
  }));
}

test("terminal endpoint streams a real process from the workspace cwd and rejects unsafe input", async (t) => {
  const port = await freePort();
  process.env.PAPER_OS_PORT = String(port);
  const workspaceId = `term-${process.pid}-${Date.now()}`;
  const managedRoot = join(root, "workspaces", workspaceId);
  const stateRoot = mkdtempSync(join(tmpdir(), "paperos-term-"));
  const previousDataDir = process.env.PAPER_OS_DATA_DIR;
  process.env.PAPER_OS_DATA_DIR = join(stateRoot, "data");
  const { startServer, server } = await import(`../app/server.mjs?terminal=${Date.now()}`);

  let cookie = "";
  async function request(path, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (cookie) headers.Cookie = cookie;
    const response = await fetch(`http://127.0.0.1:${port}${path}`, { ...options, headers });
    const setCookie = response.headers.get("set-cookie");
    if (setCookie) cookie = setCookie.split(";")[0];
    return response;
  }
  async function json(path, options = {}, expected = 200) {
    const response = await request(path, options);
    const payload = await response.json();
    assert.equal(response.status, expected, `${path}: ${JSON.stringify(payload)}`);
    return payload;
  }
  const jsonBody = (obj) => ({ headers: { "Content-Type": "application/json" }, body: JSON.stringify(obj) });

  startServer();
  t.after(async () => {
    if (server.listening) await new Promise((r) => server.close(r));
    rmSync(managedRoot, { recursive: true, force: true });
    rmSync(stateRoot, { recursive: true, force: true });
    if (previousDataDir === undefined) delete process.env.PAPER_OS_DATA_DIR;
    else process.env.PAPER_OS_DATA_DIR = previousDataDir;
  });

  // Unauthenticated -> 401.
  const anon = await fetch(`http://127.0.0.1:${port}/api/editor/terminal`, { method: "POST", ...jsonBody({ workspace: "x", command: "git status" }) });
  assert.equal(anon.status, 401);

  await json("/api/auth/bootstrap");
  await json("/api/auth/local", { method: "POST", ...jsonBody({}) });
  await json("/api/editor/projects", { method: "POST", ...jsonBody({ id: workspaceId, name: "Term", pack: "latex" }) }, 201);

  // Policy rejections come back as 400 before anything spawns.
  const rejected = await json("/api/editor/terminal", { method: "POST", ...jsonBody({ workspace: workspaceId, command: "rm -rf ." }) }, 400);
  assert.equal(rejected.code, "TERMINAL_REJECTED");
  await json("/api/editor/terminal", { method: "POST", ...jsonBody({ workspace: workspaceId, command: "git status && echo hi" }) }, 400);

  // A real allowlisted process runs with cwd = workspace root and streams.
  const run = await request("/api/editor/terminal", {
    method: "POST",
    ...jsonBody({ workspace: workspaceId, command: 'node -e "console.log(\\"CWD:\\" + process.cwd()); console.error(\\"warn\\")"' }),
  });
  assert.equal(run.status, 200);
  assert.match(run.headers.get("content-type") || "", /text\/event-stream/);
  const frames = parseSse(await run.text());
  assert.equal(frames[0].event, "start");
  assert.equal(frames[0].data.program, "node");
  const stdout = frames.filter((f) => f.event === "stdout").map((f) => f.data.text).join("");
  const stderr = frames.filter((f) => f.event === "stderr").map((f) => f.data.text).join("");
  assert.match(stdout, /CWD:/);
  assert.ok(stdout.replace(/\\/g, "/").includes(workspaceId), "process should run inside the workspace folder");
  assert.match(stderr, /warn/);
  const exit = frames.find((f) => f.event === "exit");
  assert.equal(exit.data.code, 0);

  // A failing process reports its non-zero exit honestly (node exits 1 on throw).
  const failing = await request("/api/editor/terminal", {
    method: "POST",
    ...jsonBody({ workspace: workspaceId, command: 'node -e "process.exit(3)"' }),
  });
  const failingFrames = parseSse(await failing.text());
  const failingExit = failingFrames.find((f) => f.event === "exit");
  assert.ok(failingExit, "exit frame expected");
  assert.equal(failingExit.data.code, 3);
});
