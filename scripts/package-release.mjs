// Package a Windows development archive for Paper OS and write it to
// dist/release/ so the server's /api/releases + /api/download/windows flow
// serves a real artifact with a real SHA-256. The bundle is a zip containing:
//   PaperOS.exe (+ WebView2 dlls + runtimes)  — the native launcher
//   app/                                       — the Node server + built web + IDE
//   paperctl.py, product/, templates/          — runtime assets
//   START.txt                                  — prerequisites and run instructions
//
// Prereqs: run `npm run build` (web + ide) first; optionally `./build-launcher.ps1`
// to produce PaperOS.exe. Node 20+; uses PowerShell Compress-Archive (Windows).
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, statSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const version = JSON.parse(readFileSync(join(root, "package.json"), "utf-8")).version;
const releaseDir = join(root, "dist", "release");
const stage = join(root, "dist", "stage", `PaperOS-${version}-windows-x64`);
mkdirSync(releaseDir, { recursive: true });
rmSync(stage, { recursive: true, force: true });
mkdirSync(stage, { recursive: true });

function must(path, label) {
  if (!existsSync(path)) throw new Error(`missing ${label}: ${path}. Run \`npm run build\` first.`);
}
must(join(root, "app", "server.mjs"), "server");
must(join(root, "app", "public", "index.html"), "web build");
must(join(root, "app", "ide", "ide.js"), "IDE build");

// Copy the runtime tree (skip data/, node_modules, caches).
const skip = new Set(["data", "node_modules", ".tectonic"]);
cpSync(join(root, "app"), join(stage, "app"), {
  recursive: true,
  filter: (src) => !src.split(/[\\/]/).some((seg) => skip.has(seg)),
});
for (const rel of ["paperctl.py", "package.json"]) {
  if (existsSync(join(root, rel))) copyFileSync(join(root, rel), join(stage, rel));
}
for (const dir of ["product", "templates", "runtimes"]) {
  if (existsSync(join(root, dir))) cpSync(join(root, dir), join(stage, dir), { recursive: true });
}
// Native launcher + WebView2, if the complete framework-dependent set exists.
const launcherFiles = ["PaperOS.exe", "PaperOS.dll", "PaperOS.deps.json", "PaperOS.runtimeconfig.json"];
const presentLauncherFiles = launcherFiles.filter((file) => existsSync(join(root, file)));
if (presentLauncherFiles.length > 0 && presentLauncherFiles.length < launcherFiles.length) {
  throw new Error(`partial native launcher artifacts: found ${presentLauncherFiles.join(", ")}; expected ${launcherFiles.join(", ")}`);
}
const hasLauncher = presentLauncherFiles.length === launcherFiles.length;
if (hasLauncher) {
  for (const file of launcherFiles) copyFileSync(join(root, file), join(stage, file));
}
for (const f of ["Microsoft.Web.WebView2.Core.dll", "Microsoft.Web.WebView2.WinForms.dll", "Microsoft.Web.WebView2.Wpf.dll"]) {
  if (existsSync(join(root, f))) copyFileSync(join(root, f), join(stage, f));
}

writeFileSync(join(stage, "START.txt"), [
  "Paper OS " + version + " (Windows x64 development archive)",
  "This archive is not self-contained or install-free.",
  "",
  "Prerequisites: Node.js 20+ and Edge WebView2 Runtime.",
  hasLauncher ? ".NET 8 Desktop Runtime (x64) is also required." : "",
  "After extraction, run once:  npm --prefix app ci --omit=dev",
  "",
  hasLauncher
    ? "Then double-click PaperOS.exe. It starts the local server and opens the IDE window."
    : "Then run:  node app/server.mjs  and open http://127.0.0.1:3719/",
  "",
  "All data stays on this machine under app/data/. Configure your model API key",
  "in the app (Account -> 模型 API Key); it is stored AES-256-GCM encrypted.",
  "",
].join("\r\n"), "utf-8");

// Zip via PowerShell (available on Windows runners + dev machines).
const zipPath = join(releaseDir, `PaperOS-${version}-windows-x64.zip`);
rmSync(zipPath, { force: true });
execFileSync("powershell", [
  "-NoProfile", "-NonInteractive", "-Command",
  `Compress-Archive -Path '${stage}\\*' -DestinationPath '${zipPath}' -Force`,
], { stdio: "inherit" });

const buf = readFileSync(zipPath);
const sha256 = createHash("sha256").update(buf).digest("hex");
writeFileSync(`${zipPath}.sha256`, `${sha256}  ${`PaperOS-${version}-windows-x64.zip`}\n`, "utf-8");
rmSync(join(root, "dist", "stage"), { recursive: true, force: true });

console.log(`Packaged: ${zipPath}`);
console.log(`Size:     ${(statSync(zipPath).size / 1048576).toFixed(1)} MB`);
console.log(`SHA-256:  ${sha256}`);
console.log(hasLauncher ? "Included framework-dependent native launcher (PaperOS.exe)." : "No PaperOS.exe found — use the Node-run fallback (build-launcher.ps1 to include it).");
console.log("\nUpdate product/releases.json windows asset `file` to:");
console.log(`  dist/release/PaperOS-${version}-windows-x64.zip`);
