import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer as createHttpServer } from "node:http";
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

const GOOD_BIB = `@article{Good2020,
  title = {Mock Title},
  author = {Mock, A. and Tester, B.},
  journal = {Mock Journal},
  year = {2020}
}`;

test("DOI import fetches BibTeX, appends once, and fails honestly offline", async (t) => {
  const port = await freePort();
  process.env.PAPER_OS_PORT = String(port);
  const workspaceId = `doi-${process.pid}-${Date.now()}`;
  const managedRoot = join(root, "workspaces", workspaceId);
  const stateRoot = mkdtempSync(join(tmpdir(), "paperos-doi-state-"));
  const previousDataDir = process.env.PAPER_OS_DATA_DIR;
  const previousDoiBase = process.env.PAPER_OS_DOI_BASE;
  process.env.PAPER_OS_DATA_DIR = join(stateRoot, "data");
  const { startServer, server } = await import(`../app/server.mjs?doi-import=${Date.now()}`);

  // Local stand-in for doi.org content negotiation.
  const mockDoi = createHttpServer((req, res) => {
    if (req.url === "/10.1234/good") {
      res.writeHead(200, { "Content-Type": "application/x-bibtex; charset=utf-8" });
      res.end(GOOD_BIB);
      return;
    }
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("DOI not found");
  });
  const mockPort = await freePort();
  await new Promise((r) => mockDoi.listen(mockPort, "127.0.0.1", r));
  process.env.PAPER_OS_DOI_BASE = `http://127.0.0.1:${mockPort}`;

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
    await new Promise((r) => mockDoi.close(r));
    if (server.listening) await new Promise((r) => server.close(r));
    rmSync(managedRoot, { recursive: true, force: true });
    rmSync(stateRoot, { recursive: true, force: true });
    if (previousDataDir === undefined) delete process.env.PAPER_OS_DATA_DIR;
    else process.env.PAPER_OS_DATA_DIR = previousDataDir;
    if (previousDoiBase === undefined) delete process.env.PAPER_OS_DOI_BASE;
    else process.env.PAPER_OS_DOI_BASE = previousDoiBase;
  });

  await json("/api/auth/bootstrap");
  await json("/api/auth/local", { method: "POST", ...jsonBody({}) });
  await json("/api/editor/projects", { method: "POST", ...jsonBody({ id: workspaceId, name: "DOI", pack: "latex" }) }, 201);

  // Validation and workspace guards.
  await json("/api/editor/references/import", { method: "POST", ...jsonBody({ workspace: workspaceId, doi: "not-a-doi" }) }, 400);
  await json("/api/editor/references/import", { method: "POST", ...jsonBody({ workspace: "no-such-ws", doi: "10.1234/good" }) }, 404);

  // First import creates/extends a .bib and returns the parsed entry.
  const imported = await json("/api/editor/references/import", {
    method: "POST",
    ...jsonBody({ workspace: workspaceId, doi: "10.1234/good" }),
  }, 201);
  assert.equal(imported.key, "Good2020");
  assert.match(imported.file, /\.bib$/);
  assert.equal(imported.entry.title, "Mock Title");

  const listed = await json(`/api/editor/references?workspace=${encodeURIComponent(workspaceId)}`);
  const entry = listed.entries.find((e) => e.key === "Good2020");
  assert.ok(entry, "imported entry not listed");
  assert.equal(entry.venue, "Mock Journal");

  // Re-import (bare or doi.org URL form) dedupes on the entry key.
  await json("/api/editor/references/import", { method: "POST", ...jsonBody({ workspace: workspaceId, doi: "10.1234/good" }) }, 409);
  await json("/api/editor/references/import", { method: "POST", ...jsonBody({ workspace: workspaceId, doi: "https://doi.org/10.1234/good" }) }, 409);

  // Unknown DOI surfaces the upstream 404.
  await json("/api/editor/references/import", { method: "POST", ...jsonBody({ workspace: workspaceId, doi: "10.1234/missing" }) }, 404);

  // Offline/unreachable upstream -> honest 502, no fabricated entry.
  process.env.PAPER_OS_DOI_BASE = "http://127.0.0.1:1";
  await json("/api/editor/references/import", { method: "POST", ...jsonBody({ workspace: workspaceId, doi: "10.1234/good2" }) }, 502);
});

const ARXIV_ATOM = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title type="html">ArXiv Query</title>
  <entry>
    <id>http://arxiv.org/abs/2401.10001v2</id>
    <published>2024-01-18T12:00:00Z</published>
    <title>Residual  Estimation
      with Deep Nets</title>
    <author><name>Jane Smith</name></author>
    <author><name>Bob Lee</name></author>
  </entry>
</feed>`;

const ARXIV_EMPTY = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom"><title type="html">ArXiv Query</title></feed>`;

test("arXiv import builds a BibTeX entry and dedupes across versions", async (t) => {
  const port = await freePort();
  process.env.PAPER_OS_PORT = String(port);
  const workspaceId = `arxiv-${process.pid}-${Date.now()}`;
  const managedRoot = join(root, "workspaces", workspaceId);
  const stateRoot = mkdtempSync(join(tmpdir(), "paperos-arxiv-state-"));
  const previousDataDir = process.env.PAPER_OS_DATA_DIR;
  const previousArxivBase = process.env.PAPER_OS_ARXIV_BASE;
  process.env.PAPER_OS_DATA_DIR = join(stateRoot, "data");
  const { startServer, server } = await import(`../app/server.mjs?arxiv-import=${Date.now()}`);

  const mockArxiv = createHttpServer((req, res) => {
    res.writeHead(200, { "Content-Type": "application/atom+xml; charset=utf-8" });
    res.end(req.url.includes("2401.10001") ? ARXIV_ATOM : ARXIV_EMPTY);
  });
  const mockPort = await freePort();
  await new Promise((r) => mockArxiv.listen(mockPort, "127.0.0.1", r));
  process.env.PAPER_OS_ARXIV_BASE = `http://127.0.0.1:${mockPort}`;

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
    await new Promise((r) => mockArxiv.close(r));
    if (server.listening) await new Promise((r) => server.close(r));
    rmSync(managedRoot, { recursive: true, force: true });
    rmSync(stateRoot, { recursive: true, force: true });
    if (previousDataDir === undefined) delete process.env.PAPER_OS_DATA_DIR;
    else process.env.PAPER_OS_DATA_DIR = previousDataDir;
    if (previousArxivBase === undefined) delete process.env.PAPER_OS_ARXIV_BASE;
    else process.env.PAPER_OS_ARXIV_BASE = previousArxivBase;
  });

  await json("/api/auth/bootstrap");
  await json("/api/auth/local", { method: "POST", ...jsonBody({}) });
  await json("/api/editor/projects", { method: "POST", ...jsonBody({ id: workspaceId, name: "ArXiv", pack: "latex" }) }, 201);

  // Unrecognisable input -> 400.
  await json("/api/editor/references/import", { method: "POST", ...jsonBody({ workspace: workspaceId, doi: "not-anything" }) }, 400);

  // arXiv:ID form imports as an @misc entry with a versionless key.
  const imported = await json("/api/editor/references/import", {
    method: "POST",
    ...jsonBody({ workspace: workspaceId, doi: "arXiv:2401.10001" }),
  }, 201);
  assert.equal(imported.key, "arxiv2401.10001");
  assert.equal(imported.entry.title, "Residual Estimation with Deep Nets");
  assert.match(imported.entry.author, /Jane Smith and Bob Lee/);
  assert.equal(imported.entry.year, "2024");

  const listed = await json(`/api/editor/references?workspace=${encodeURIComponent(workspaceId)}`);
  assert.ok(listed.entries.some((e) => e.key === "arxiv2401.10001"));

  // URL form with a version resolves to the same key -> 409 dedupe.
  await json("/api/editor/references/import", {
    method: "POST",
    ...jsonBody({ workspace: workspaceId, doi: "https://arxiv.org/abs/2401.10001v2" }),
  }, 409);

  // Unknown id: feed without an entry -> 404.
  await json("/api/editor/references/import", { method: "POST", ...jsonBody({ workspace: workspaceId, doi: "2401.99999" }) }, 404);

  // Unreachable arXiv -> honest 502.
  process.env.PAPER_OS_ARXIV_BASE = "http://127.0.0.1:1";
  await json("/api/editor/references/import", { method: "POST", ...jsonBody({ workspace: workspaceId, doi: "2401.10001" }) }, 502);
});
