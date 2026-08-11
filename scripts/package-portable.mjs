// Package a cross-platform PORTABLE archive (macOS / Linux) for Paper OS.
// This is honestly labelled: it is NOT a native .app/.AppImage — it is the
// Node server + built web + IDE with a start script, requiring Node.js 20+.
// Both the macOS and Linux rows in product/releases.json point at this file;
// the server verifies existence + SHA-256 at request time.
//
// Prereqs: `npm run build` first. Uses the system `tar` (bsdtar ships with
// Windows 10+, macOS and Linux have it natively).
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const version = JSON.parse(readFileSync(join(root, "package.json"), "utf-8")).version;
const releaseDir = join(root, "dist", "release");
const stageName = `PaperOS-${version}-portable-node`;
const stage = join(root, "dist", "stage", stageName);
mkdirSync(releaseDir, { recursive: true });
rmSync(stage, { recursive: true, force: true });
mkdirSync(stage, { recursive: true });

function must(path, label) {
  if (!existsSync(path)) throw new Error(`missing ${label}: ${path}. Run \`npm run build\` first.`);
}
must(join(root, "app", "server.mjs"), "server");
must(join(root, "app", "public", "index.html"), "web build");
must(join(root, "app", "ide", "ide.js"), "IDE build");

const skip = new Set(["data", "node_modules", ".tectonic"]);
cpSync(join(root, "app"), join(stage, "app"), {
  recursive: true,
  filter: (src) => !src.split(/[\\/]/).some((seg) => skip.has(seg)),
});
for (const rel of ["paperctl.py", "package.json"]) {
  if (existsSync(join(root, rel))) copyFileSync(join(root, rel), join(stage, rel));
}
for (const dir of ["product", "templates"]) {
  if (existsSync(join(root, dir))) cpSync(join(root, dir), join(stage, dir), { recursive: true });
}

writeFileSync(join(stage, "start.sh"), [
  "#!/bin/sh",
  '# Paper OS portable start script (macOS / Linux). Requires Node.js 20+.',
  'cd "$(dirname "$0")" || exit 1',
  'if ! command -v node >/dev/null 2>&1; then',
  '  echo "Node.js 20+ is required: https://nodejs.org" >&2',
  "  exit 1",
  "fi",
  'if [ ! -d app/node_modules ]; then',
  '  echo "First run: installing server dependencies..."',
  "  npm --prefix app ci --omit=dev || exit 1",
  "fi",
  "exec node app/server.mjs",
  "",
].join("\n"), "utf-8");

writeFileSync(join(stage, "README-PORTABLE.txt"), [
  `Paper OS ${version} — portable (macOS / Linux)`,
  "",
  "This is NOT a signed native app. It is the local Node.js server with the",
  "built web UI. Everything runs and stays on your machine (app/data/).",
  "",
  "Requirements: Node.js 20+ (https://nodejs.org)",
  "",
  "Run:",
  "  sh start.sh",
  "then open http://127.0.0.1:3719/",
  "",
  "Model API keys are configured in-app and stored AES-256-GCM encrypted.",
  "LaTeX compilation uses Tectonic, downloadable inside the Workbench.",
  "",
].join("\n"), "utf-8");

const tarPath = join(releaseDir, `${stageName}.tar.gz`);
rmSync(tarPath, { force: true });
execFileSync("tar", ["-czf", tarPath, "-C", join(root, "dist", "stage"), stageName], { stdio: "inherit" });

const buf = readFileSync(tarPath);
const sha256 = createHash("sha256").update(buf).digest("hex");
writeFileSync(`${tarPath}.sha256`, `${sha256}  ${stageName}.tar.gz\n`, "utf-8");
rmSync(join(root, "dist", "stage"), { recursive: true, force: true });

console.log(`Packaged: ${tarPath}`);
console.log(`Size:     ${(statSync(tarPath).size / 1048576).toFixed(1)} MB`);
console.log(`SHA-256:  ${sha256}`);
console.log("\nproduct/releases.json macos/linux assets can point `file` to:");
console.log(`  dist/release/${stageName}.tar.gz`);
