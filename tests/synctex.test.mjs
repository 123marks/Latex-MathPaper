import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import test from "node:test";
import { forwardLookup, inverseLookup, parseSyncTeX, spToPdfPt } from "../app/lib/synctex.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// A small but realistic synctex body: two inputs, two pages, boxes + points.
// Coordinates in sp (1pt = 65536sp). Page 1: line 3 of main.tex at y=100pt,
// line 12 of sections/intro.tex at y=300pt. Page 2: line 20 of intro at y=80pt.
const SP = 65536;
const FIXTURE = [
  "SyncTeX Version:1",
  "Input:1:./main.tex",
  "Input:2:./sections/intro.tex",
  "Output:pdf",
  "Magnification:1000",
  "Unit:1",
  "X Offset:0",
  "Y Offset:0",
  "Content:",
  "{1",
  `[1,3:${72 * SP},${100 * SP}:${300 * SP},${10 * SP},${2 * SP}`,
  `(2,12:${72 * SP},${300 * SP}:${300 * SP},${10 * SP},${2 * SP}`,
  `x2,13:${80 * SP},${312 * SP}`,
  ")",
  "]",
  "}1",
  "{2",
  `[2,20:${72 * SP},${80 * SP}:${300 * SP},${10 * SP},${2 * SP}`,
  "]",
  "}2",
  "Postamble:",
].join("\n");

test("parseSyncTeX reads inputs, pages, boxes and points", () => {
  const parsed = parseSyncTeX(FIXTURE);
  assert.equal(parsed.inputs.get(1), "./main.tex");
  assert.equal(parsed.inputs.get(2), "./sections/intro.tex");
  assert.equal(parsed.records.length, 4);
  assert.deepEqual(parsed.records.map((r) => [r.page, r.tag, r.line]), [[1, 1, 3], [1, 2, 12], [1, 2, 13], [2, 2, 20]]);
  assert.ok(Math.abs(spToPdfPt(72.27 * SP) - 72) < 0.01, "72.27 TeX pt is 72 PDF pt");
});

test("forwardLookup maps a source line to page + PDF coordinates, nearest-following on gaps", () => {
  const parsed = parseSyncTeX(FIXTURE);
  const exact = forwardLookup(parsed, "sections/intro.tex", 12);
  assert.equal(exact.page, 1);
  assert.ok(Math.abs(exact.y - spToPdfPt(300 * SP)) < 0.01);
  // Line 15 has no record; the next recorded line (20, page 2) is used.
  const gap = forwardLookup(parsed, "sections/intro.tex", 15);
  assert.equal(gap.page, 2);
  assert.equal(gap.line, 20);
  // Path matching tolerates the ./ prefix and suffix forms.
  assert.equal(forwardLookup(parsed, "main.tex", 3).page, 1);
  assert.equal(forwardLookup(parsed, "nope.tex", 1), null);
});

test("inverseLookup maps a PDF click to the nearest source line", () => {
  const parsed = parseSyncTeX(FIXTURE);
  const near12 = inverseLookup(parsed, 1, spToPdfPt(100 * SP), spToPdfPt(298 * SP));
  assert.equal(near12.path, "./sections/intro.tex");
  assert.equal(near12.line, 12);
  const near3 = inverseLookup(parsed, 1, spToPdfPt(100 * SP), spToPdfPt(95 * SP));
  assert.equal(near3.line, 3);
  assert.equal(inverseLookup(parsed, 2, 10, spToPdfPt(75 * SP)).line, 20);
  assert.equal(inverseLookup(parsed, 9, 0, 0), null);
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

test("synctex endpoint serves forward/inverse from build/*.synctex.gz and 404s honestly", async (t) => {
  const port = await freePort();
  process.env.PAPER_OS_PORT = String(port);
  const workspaceId = `sync-${process.pid}-${Date.now()}`;
  const managedRoot = join(root, "workspaces", workspaceId);
  const stateRoot = mkdtempSync(join(tmpdir(), "paperos-synctex-"));
  const previousDataDir = process.env.PAPER_OS_DATA_DIR;
  process.env.PAPER_OS_DATA_DIR = join(stateRoot, "data");
  const { startServer, server } = await import(`../app/server.mjs?synctex=${Date.now()}`);

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
  const ws = encodeURIComponent(workspaceId);

  startServer();
  t.after(async () => {
    if (server.listening) await new Promise((r) => server.close(r));
    rmSync(managedRoot, { recursive: true, force: true });
    rmSync(stateRoot, { recursive: true, force: true });
    if (previousDataDir === undefined) delete process.env.PAPER_OS_DATA_DIR;
    else process.env.PAPER_OS_DATA_DIR = previousDataDir;
  });

  await json("/api/auth/bootstrap");
  await json("/api/auth/local", { method: "POST", ...jsonBody({}) });
  await json("/api/editor/projects", { method: "POST", ...jsonBody({ id: workspaceId, name: "Sync", pack: "latex" }) }, 201);

  // Before any compile: honest 404 with a code the UI can explain.
  const missing = await json(`/api/editor/synctex?workspace=${ws}&tex=main.tex&mode=forward&line=3`, {}, 404);
  assert.equal(missing.code, "SYNCTEX_MISSING");

  // Simulate Tectonic's --synctex output.
  mkdirSync(join(managedRoot, "build"), { recursive: true });
  writeFileSync(join(managedRoot, "build", "main.synctex.gz"), gzipSync(Buffer.from(FIXTURE, "utf-8")));

  const fwd = await json(`/api/editor/synctex?workspace=${ws}&tex=main.tex&mode=forward&path=${encodeURIComponent("sections/intro.tex")}&line=12`);
  assert.equal(fwd.page, 1);
  assert.ok(fwd.y > 290 && fwd.y < 310);

  const inv = await json(`/api/editor/synctex?workspace=${ws}&tex=main.tex&mode=inverse&page=1&x=100&y=${fwd.y}`);
  assert.equal(inv.path, "sections/intro.tex"); // ./ prefix normalised away
  assert.equal(inv.line, 12);

  await json(`/api/editor/synctex?workspace=${ws}&tex=main.tex&mode=inverse&page=9&x=0&y=0`, {}, 404);
  await json(`/api/editor/synctex?workspace=${ws}&tex=main.tex&mode=sideways`, {}, 400);
});
