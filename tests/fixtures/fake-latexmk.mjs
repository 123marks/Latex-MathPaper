// Deterministic stand-in for latexmk/tectonic. Used by compile-live HTTP
// tests and the desktop compile smoke so those suites do not depend on a
// real TeX distribution. Mode is taken from the source file
// (`% PAPEROS_FAKE: success|success-nosync|fail|hang`) and falls back to PAPER_OS_FAKE_COMPILE.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { buildMinimalPdf } from "./minimal-pdf.mjs";

const SP = 65536;

function writeFakeSynctex(buildDir, pdfName) {
  const body = [
    "SyncTeX Version:1",
    "Input:1:./main.tex",
    "Output:pdf",
    "Magnification:1000",
    "Unit:1",
    "X Offset:0",
    "Y Offset:0",
    "Content:",
    "{1",
    `[1,1:${72 * SP},${100 * SP}:${300 * SP},${10 * SP},${2 * SP}`,
    `[1,3:${72 * SP},${140 * SP}:${300 * SP},${10 * SP},${2 * SP}`,
    "]",
    "}1",
    "Postamble:",
    "",
  ].join("\n");
  writeFileSync(join(buildDir, pdfName.replace(/\.pdf$/i, ".synctex")), body);
}

if (process.argv.includes("--version") || process.argv.includes("-v") || process.argv.includes("-version")) {
  process.stdout.write("fake-latexmk 0.0.1 (Paper OS test fixture)\n");
  process.exit(0);
}

const cwd = process.cwd();
const texArg = process.argv.slice(2).find((arg) => /\.tex$/i.test(arg)) || "main.tex";
const texPath = texArg.includes("\\") || texArg.includes("/") ? texArg : join(cwd, texArg);

let mode = process.env.PAPER_OS_FAKE_COMPILE || "success";
try {
  const source = readFileSync(texPath, "utf8");
  const marked = source.match(/%\s*PAPEROS_FAKE:\s*([\w-]+)/);
  if (marked) mode = marked[1];
} catch {
  // missing source still follows the env fallback
}

const pdfName = basename(texArg).replace(/\.tex$/i, ".pdf");
const buildDir = join(cwd, "build");

if (mode === "hang") {
  process.stdout.write("fake engine hanging\n");
  const stay = setInterval(() => {}, 1 << 30);
  const stop = () => {
    clearInterval(stay);
    process.exit(124);
  };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
  process.on("SIGHUP", stop);
} else if (mode === "fail" || mode === "fail-stale") {
  process.stderr.write("! LaTeX Error: Fake compile failure.\n");
  process.exit(1);
} else {
  mkdirSync(buildDir, { recursive: true });
  writeFileSync(join(buildDir, pdfName), buildMinimalPdf("Paper OS"));
  if (mode !== "success-nosync") writeFakeSynctex(buildDir, pdfName);
  process.stdout.write(`Output written on ${pdfName}\n`);
  process.exit(0);
}
