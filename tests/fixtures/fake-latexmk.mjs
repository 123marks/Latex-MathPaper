// Deterministic stand-in for latexmk/tectonic. Used by compile-live HTTP
// tests and the desktop compile smoke so those suites do not depend on a
// real TeX distribution. Mode is taken from the source file
// (`% PAPEROS_FAKE: success|fail|hang`) and falls back to PAPER_OS_FAKE_COMPILE.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

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
  const marked = source.match(/%\s*PAPEROS_FAKE:\s*(\w+)/);
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
  writeFileSync(join(buildDir, pdfName), "%PDF-1.4\n% paper-os fake compile artifact\n%%EOF\n");
  process.stdout.write(`Output written on ${pdfName}\n`);
  process.exit(0);
}
