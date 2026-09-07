// Integrated terminal policy (VS Code-style panel, local-first security).
// The server is loopback-only, but a terminal is still the highest-risk
// surface, so: no shell interpretation (argv only), a fixed program
// allowlist, workspace-root cwd, wall-clock timeout, output cap.

export const TERMINAL_ALLOWED = new Set([
  // TeX toolchain
  "tectonic", "latexmk", "pdflatex", "xelatex", "lualatex", "bibtex", "biber", "makeindex",
  // scripting / data
  "python", "python3", "node", "npm", "npx",
  // version control & inspection (read-mostly)
  "git", "ls", "dir", "cat", "type", "head", "tail", "wc", "pwd", "echo", "rg", "grep", "find", "where", "which",
]);

export const TERMINAL_TIMEOUT_MS = 120_000;
export const TERMINAL_OUTPUT_CAP = 512 * 1024;

// Minimal argv tokenizer: whitespace-separated, double/single quotes group,
// backslash escapes inside double quotes. No globbing, pipes, redirects or
// env expansion — anything shell-like is rejected upstream.
export function tokenizeCommand(input) {
  const src = String(input || "").trim();
  if (!src) return [];
  const out = [];
  let cur = "";
  let quote = null;
  let has = false;
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (quote) {
      if (ch === quote) { quote = null; continue; }
      if (quote === '"' && ch === "\\" && i + 1 < src.length) { cur += src[i + 1]; i += 1; continue; }
      cur += ch;
      continue;
    }
    if (ch === '"' || ch === "'") { quote = ch; has = true; continue; }
    // Shell operators are only meaningful outside quotes; since we never hand
    // the string to a shell, inside quotes they are plain data (e.g. JS code
    // passed to node -e). Outside quotes they signal intent we refuse.
    if ("|&;<>`$".includes(ch)) {
      throw new Error("终端不解释 shell 语法（| & ; < > ` $ 不可用）；请一次运行一个程序。");
    }
    if (/\s/.test(ch)) {
      if (has || cur) { out.push(cur); cur = ""; has = false; }
      continue;
    }
    cur += ch;
  }
  if (quote) throw new Error("引号未闭合。");
  if (has || cur) out.push(cur);
  return out;
}

export function validateTerminalCommand(input) {
  const argv = tokenizeCommand(input);
  if (argv.length === 0) throw new Error("请输入命令。");
  const program = argv[0].replace(/\.(exe|cmd|bat)$/i, "").toLowerCase();
  if (program.includes("/") || program.includes("\\")) {
    throw new Error("请直接写程序名（如 python、git），不支持路径形式。");
  }
  if (!TERMINAL_ALLOWED.has(program)) {
    throw new Error(`「${argv[0]}」不在允许列表。可用：${[...TERMINAL_ALLOWED].sort().join(" ")}`);
  }
  // Arguments may not escape the workspace via .. segments.
  for (const arg of argv.slice(1)) {
    if (/(^|[\\/])\.\.([\\/]|$)/.test(arg) || /^[a-zA-Z]:[\\/]/.test(arg) || arg.startsWith("/")) {
      throw new Error(`参数「${arg}」看起来指向工作区之外，已拒绝。`);
    }
  }
  return { program: argv[0], args: argv.slice(1) };
}
