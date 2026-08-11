import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

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

const BIB = `% comment line
@comment{ignored}
@article{smith2020,
  title = {Deep {R}esidual Estimation},
  author = {Smith, Jane and Doe, John},
  journal = {Annals of Statistics},
  year = {2020},
}

@inproceedings{lee2019,
  title = "Robust BibTeX Parsing",
  booktitle = {Proc. of XYZ},
  author = {Lee, K.},
  year = 2019
}
`;

const NOTE_TEX = `\\section{Related}
As shown in \\cite{smith2020}, residuals matter.
Both \\citep[see][p.~3]{lee2019,smith2020} agree.
`;

const EXTRA_TEX = `Broken ref here: \\cite{ghost2021}.
`;

test("references API parses real .bib files and cross-links \\cite usage", async (t) => {
  const port = await freePort();
  process.env.PAPER_OS_PORT = String(port);
  const workspaceId = `refs-${process.pid}-${Date.now()}`;
  const managedRoot = join(root, "workspaces", workspaceId);
  const stateRoot = mkdtempSync(join(tmpdir(), "paperos-refs-state-"));
  const previousDataDir = process.env.PAPER_OS_DATA_DIR;
  process.env.PAPER_OS_DATA_DIR = join(stateRoot, "data");
  const { startServer, server } = await import(`../app/server.mjs?references=${Date.now()}`);

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

  await json("/api/auth/bootstrap");
  await json("/api/auth/local", { method: "POST", ...jsonBody({}) });
  await json("/api/editor/projects", { method: "POST", ...jsonBody({ id: workspaceId, name: "Refs", pack: "latex" }) }, 201);

  await json("/api/editor/file", { method: "POST", ...jsonBody({ workspace: workspaceId, path: "paper/references.bib", content: BIB }) }, 201);
  await json("/api/editor/file", { method: "POST", ...jsonBody({ workspace: workspaceId, path: "paper/refs-note.tex", content: NOTE_TEX }) }, 201);
  await json("/api/editor/file", { method: "POST", ...jsonBody({ workspace: workspaceId, path: "notes/extra.tex", content: EXTRA_TEX }) }, 201);

  const data = await json(`/api/editor/references?workspace=${encodeURIComponent(workspaceId)}`);
  assert.ok(data.bibFiles.includes("paper/references.bib"));

  const smith = data.entries.find((e) => e.key === "smith2020");
  assert.ok(smith, "smith2020 entry parsed");
  assert.equal(smith.type, "article");
  assert.equal(smith.title, "Deep Residual Estimation");
  assert.equal(smith.venue, "Annals of Statistics");
  assert.equal(smith.year, "2020");
  assert.equal(smith.citedCount, 2);

  const lee = data.entries.find((e) => e.key === "lee2019");
  assert.ok(lee, "lee2019 entry parsed");
  assert.equal(lee.title, "Robust BibTeX Parsing");
  assert.equal(lee.venue, "Proc. of XYZ");
  assert.equal(lee.year, "2019");
  assert.equal(lee.citedCount, 1);

  // citation -> source locations (file + line)
  const smithLocs = data.citations.smith2020;
  assert.deepEqual(
    smithLocs.map((l) => `${l.file}:${l.line}`).sort(),
    ["paper/refs-note.tex:2", "paper/refs-note.tex:3"],
  );

  // cited-but-undefined keys are reported as missing with their locations
  const ghost = data.missing.find((m) => m.key === "ghost2021");
  assert.ok(ghost, "ghost2021 reported missing");
  assert.equal(ghost.locations[0].file, "notes/extra.tex");

  // @comment must not leak into entries
  assert.equal(data.entries.some((e) => e.type === "comment"), false);

  // unknown workspace -> 404
  await json("/api/editor/references?workspace=nope-refs", {}, 404);
});
