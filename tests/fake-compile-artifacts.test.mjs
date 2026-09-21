import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { buildMinimalPdf } from "./fixtures/minimal-pdf.mjs";

const fixture = fileURLToPath(new URL("./fixtures/fake-latexmk.mjs", import.meta.url));

function runFake(mode) {
  const cwd = mkdtempSync(join(tmpdir(), "paperos-fake-art-"));
  writeFileSync(join(cwd, "main.tex"), `% PAPEROS_FAKE: ${mode}\n\\documentclass{article}\\begin{document}ok\\end{document}\n`);
  const result = spawnSync(process.execPath, [fixture], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, PAPER_OS_FAKE_COMPILE: mode },
    windowsHide: true,
  });
  return { cwd, result };
}

test("minimal PDF has a valid xref table", () => {
  const pdf = buildMinimalPdf("Hello");
  assert.match(pdf, /^%PDF-1.4/);
  assert.match(pdf, /xref\n0 6\n/);
  assert.match(pdf, /startxref\n/);
  assert.match(pdf, /%%EOF\n$/);
  assert.match(pdf, /Hello/);
});

test("fake latexmk success writes a renderable PDF and SyncTeX", () => {
  const { cwd, result } = runFake("success");
  try {
    assert.equal(result.status, 0, result.stderr);
    const pdf = readFileSync(join(cwd, "build", "main.pdf"), "utf8");
    assert.match(pdf, /^%PDF-1.4/);
    assert.match(pdf, /xref/);
    const synctex = readFileSync(join(cwd, "build", "main.synctex"), "utf8");
    assert.match(synctex, /Input:1:\.\/main\.tex/);
    assert.match(synctex, /\{1/);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("fake latexmk success-nosync writes a PDF but no SyncTeX", () => {
  const { cwd, result } = runFake("success-nosync");
  try {
    assert.equal(result.status, 0, result.stderr);
    assert.equal(existsSync(join(cwd, "build", "main.pdf")), true);
    assert.equal(existsSync(join(cwd, "build", "main.synctex")), false);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
