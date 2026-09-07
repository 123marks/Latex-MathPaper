// Build the self-contained Windows installer: PaperOS-<v>-Setup.exe.
//
// Pipeline (all local, honest about what each step needs):
//   1. dotnet publish launcher --self-contained (bundles the .NET runtime;
//      the user no longer needs .NET 8 Desktop Runtime).
//   2. Download the official Node.js win-x64 zip (or reuse the cached one),
//      verify its SHA-256 against the official SHASUMS256.txt, and stage it
//      under runtime\node so the launcher runs without a system Node.
//   3. Stage app/ + product/ + templates/ + paperctl.py, and pre-install the
//      server's production npm dependencies so first run needs no npm.
//   4. Compile the Inno Setup script into a wizard installer.
// Code signing is NOT done here — it needs a certificate the project does not
// have; without it Windows SmartScreen shows an "unknown publisher" warning.
//
// Prereqs: `npm run build` first; dotnet SDK 8; Inno Setup 6 (ISCC.exe) on the
// machine (winget install JRSoftware.InnoSetup). Network for the Node zip.
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const version = JSON.parse(readFileSync(join(root, "package.json"), "utf-8")).version;
const NODE_VERSION = process.env.PAPER_OS_NODE_VERSION || "22.12.0";
const releaseDir = join(root, "dist", "release");
const cacheDir = join(root, "dist", "cache");
const stage = join(root, "dist", "stage", `PaperOS-${version}-installer`);
const publishDir = join(root, "dist", "launcher-sc");
mkdirSync(releaseDir, { recursive: true });
mkdirSync(cacheDir, { recursive: true });
rmSync(stage, { recursive: true, force: true });
mkdirSync(stage, { recursive: true });

function must(path, label) {
  if (!existsSync(path)) throw new Error(`missing ${label}: ${path}`);
}
function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: "inherit", shell: false, ...opts });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(" ")} failed (exit ${r.status})`);
}
function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

must(join(root, "app", "public", "index.html"), "web build (run npm run build)");
must(join(root, "app", "ide", "ide.js"), "IDE build (run npm run build)");

// 1. Self-contained launcher.
console.log("[1/4] dotnet publish --self-contained");
rmSync(publishDir, { recursive: true, force: true });
run("dotnet", [
  "publish", join(root, "launcher", "PaperOS.Launcher.csproj"),
  "-c", "Release", "-r", "win-x64", "--self-contained", "true",
  "-p:PublishSingleFile=false", "-p:DebugType=None", "-p:DebugSymbols=false",
  "-o", publishDir,
], { env: { ...process.env, DOTNET_CLI_HOME: join(root, ".dotnet"), DOTNET_NOLOGO: "1", DOTNET_SKIP_FIRST_TIME_EXPERIENCE: "1" } });
must(join(publishDir, "PaperOS.exe"), "published launcher");
cpSync(publishDir, stage, { recursive: true });

// 2. Bundled Node runtime with checksum verification.
console.log(`[2/4] Node ${NODE_VERSION} runtime`);
const nodeZipName = `node-v${NODE_VERSION}-win-x64.zip`;
const nodeZip = join(cacheDir, nodeZipName);
const shasums = join(cacheDir, `SHASUMS256-${NODE_VERSION}.txt`);
const base = `https://nodejs.org/dist/v${NODE_VERSION}`;
async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download failed ${res.status}: ${url}`);
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}
if (!existsSync(shasums)) await download(`${base}/SHASUMS256.txt`, shasums);
if (!existsSync(nodeZip)) await download(`${base}/${nodeZipName}`, nodeZip);
const expected = readFileSync(shasums, "utf-8").split("\n").find((l) => l.trim().endsWith(nodeZipName))?.split(/\s+/)[0];
if (!expected) throw new Error("node zip not listed in SHASUMS256.txt");
const actual = sha256(nodeZip);
if (actual !== expected) {
  rmSync(nodeZip, { force: true });
  throw new Error(`Node zip checksum mismatch (expected ${expected}, got ${actual}); cached file removed, re-run.`);
}
const nodeExtract = join(cacheDir, `node-v${NODE_VERSION}-win-x64`);
if (!existsSync(join(nodeExtract, "node.exe"))) {
  rmSync(nodeExtract, { recursive: true, force: true });
  run("tar", ["-xf", nodeZip, "-C", cacheDir]);
}
mkdirSync(join(stage, "runtime"), { recursive: true });
cpSync(nodeExtract, join(stage, "runtime", "node"), { recursive: true });
// Trim what the server never needs from the runtime.
for (const extra of ["node_modules/npm/docs", "node_modules/npm/man", "CHANGELOG.md", "README.md"]) {
  rmSync(join(stage, "runtime", "node", extra), { recursive: true, force: true });
}

// 3. Application payload with production deps pre-installed.
console.log("[3/4] app payload + production dependencies");
const skip = new Set(["data", "node_modules", ".tectonic"]);
cpSync(join(root, "app"), join(stage, "app"), {
  recursive: true,
  filter: (src) => !src.split(/[\\/]/).some((seg) => skip.has(seg)),
});
for (const rel of ["paperctl.py", "package.json", "LICENSE"]) {
  if (existsSync(join(root, rel))) copyFileSync(join(root, rel), join(stage, rel));
}
for (const dir of ["product", "templates"]) {
  if (existsSync(join(root, dir))) cpSync(join(root, dir), join(stage, dir), { recursive: true });
}
const bundledNpm = join(stage, "runtime", "node", "npm.cmd");
run(bundledNpm, ["ci", "--omit=dev", "--no-audit", "--no-fund"], { cwd: join(stage, "app"), shell: true });
must(join(stage, "app", "node_modules", "ws"), "server production deps");

// 4. Inno Setup.
console.log("[4/4] Inno Setup");
const iscc = [
  process.env.ISCC_PATH,
  "C:\\Program Files (x86)\\Inno Setup 6\\ISCC.exe",
  "C:\\Program Files\\Inno Setup 6\\ISCC.exe",
].filter(Boolean).find((p) => existsSync(p));
const iss = join(root, "dist", "stage", `PaperOS-${version}.iss`);
writeFileSync(iss, `
#define AppName "Paper OS"
#define AppVersion "${version}"
[Setup]
AppId={{8E1D7C3A-4B2F-4F0E-9C6A-PAPEROS00070}}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher=Paper OS
DefaultDirName={autopf}\\PaperOS
DefaultGroupName=Paper OS
UninstallDisplayIcon={app}\\PaperOS.exe
OutputDir=${releaseDir.replace(/\\/g, "\\\\")}
OutputBaseFilename=PaperOS-${version}-Setup
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
ArchitecturesInstallIn64BitMode=x64compatible
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog
[Languages]
Name: "chinesesimplified"; MessagesFile: "compiler:Default.isl"
[Files]
Source: "${stage.replace(/\\/g, "\\\\")}\\\\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
[Icons]
Name: "{group}\\Paper OS"; Filename: "{app}\\PaperOS.exe"
Name: "{autodesktop}\\Paper OS"; Filename: "{app}\\PaperOS.exe"; Tasks: desktopicon
[Tasks]
Name: "desktopicon"; Description: "创建桌面快捷方式"; GroupDescription: "附加任务:"
[Run]
Filename: "{app}\\PaperOS.exe"; Description: "启动 Paper OS"; Flags: nowait postinstall skipifsilent
`.trimStart(), "utf-8");

const zipFallback = join(releaseDir, `PaperOS-${version}-windows-x64-selfcontained.zip`);
if (iscc) {
  run(iscc, ["/Q", iss]);
  const setup = join(releaseDir, `PaperOS-${version}-Setup.exe`);
  must(setup, "installer output");
  const sum = sha256(setup);
  writeFileSync(`${setup}.sha256`, `${sum}  PaperOS-${version}-Setup.exe\n`, "utf-8");
  console.log(`\nInstaller: ${setup}\nSize:      ${(statSync(setup).size / 1048576).toFixed(1)} MB\nSHA-256:   ${sum}`);
} else {
  // No Inno Setup on this machine: still produce the self-contained payload
  // as a zip so the result is usable and honestly labelled.
  rmSync(zipFallback, { force: true });
  execFileSync("powershell", ["-NoProfile", "-NonInteractive", "-Command",
    `Compress-Archive -Path '${stage}\\*' -DestinationPath '${zipFallback}' -Force`], { stdio: "inherit" });
  const sum = sha256(zipFallback);
  writeFileSync(`${zipFallback}.sha256`, `${sum}  ${zipFallback.split(/[\\/]/).pop()}\n`, "utf-8");
  console.log(`\nInno Setup (ISCC.exe) not found — produced self-contained ZIP instead:\n${zipFallback}\nSize:    ${(statSync(zipFallback).size / 1048576).toFixed(1)} MB\nSHA-256: ${sum}\nInstall Inno Setup 6 (winget install JRSoftware.InnoSetup) and re-run for a Setup.exe wizard.`);
}
console.log("\nNOTE: unsigned. Windows SmartScreen will warn until a code-signing certificate is provided.");
rmSync(join(root, "dist", "stage"), { recursive: true, force: true });
