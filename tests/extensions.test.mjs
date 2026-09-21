import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { createExtensionRegistry } from "../app/lib/extension-registry.mjs";
import {
  classifyContributes,
  languageIdForFile,
  mapThemeColors,
  validateManifest,
  VSIX_HOST,
} from "../app/lib/extensions.mjs";
import { extractZipEntries, packZip } from "../app/lib/zip-archive.mjs";
import {
  buildSymlinkVsix,
  buildThemeLanguageVsix,
  buildTraversalVsix,
  FIXTURE_DISPLAY_NAME,
  FIXTURE_EXTENSION_ID,
} from "./fixtures/paperos-theme-language-vsix.mjs";

test("zip store round-trips and rejects traversal plus symlink entries", () => {
  const packed = packZip([
    { name: "extension/package.json", data: "{\"name\":\"x\"}" },
    { name: "extension/readme.txt", data: "hello" },
  ]);
  const files = extractZipEntries(packed);
  assert.deepEqual(files.map((file) => file.name), ["extension/package.json", "extension/readme.txt"]);
  assert.equal(files[1].data.toString("utf8"), "hello");

  assert.throws(() => extractZipEntries(buildTraversalVsix()), { code: "VSIX_TRAVERSAL" });
  assert.throws(() => extractZipEntries(buildSymlinkVsix()), { code: "VSIX_SYMLINK" });
});

test("manifest validation and contribute classification stay honest", () => {
  assert.throws(() => validateManifest({ name: "only-name", version: "1.0.0" }), { code: "MANIFEST_INVALID" });
  const manifest = validateManifest(JSON.parse(readFileSync(new URL("./fixtures/paperos-theme-language/package.json", import.meta.url), "utf8")));
  assert.equal(manifest.id, FIXTURE_EXTENSION_ID);
  const classified = classifyContributes(manifest);
  assert.deepEqual(classified.supported, ["themes.colors", "languages"]);
  assert.ok(classified.planned.includes("grammars"));
  assert.ok(classified.planned.includes("themes.tokenColors"));
  assert.ok(classified.unsupported.includes("commands"));
  assert.ok(classified.unsupported.includes("main"));
  assert.equal(VSIX_HOST.executesExtensionJs, false);
  assert.equal(VSIX_HOST.claim, "not-full-vscode-compat");
});

test("theme mapping keeps editor colors and drops workbench keys", () => {
  const mapped = mapThemeColors({
    "editor.background": "#1A2B3C",
    "sideBar.background": "#111111",
    "editor.foreground": "red",
  });
  assert.deepEqual(mapped, { "editor.background": "#1A2B3C" });
  assert.equal(languageIdForFile("notes.pfx", [{ id: "paperos-fixture", extensions: [".pfx"] }]), "paperos-fixture");
  assert.equal(languageIdForFile("main.tex", [{ id: "paperos-fixture", extensions: [".pfx"] }]), null);
});

test("registry installs, versions, toggles, and never executes extension JS", () => {
  const dataDir = mkdtempSync(join(tmpdir(), "paperos-ext-"));
  const registry = createExtensionRegistry({ dataDir });
  const record = registry.install(buildThemeLanguageVsix(), { filename: "fixture.vsix" });
  assert.equal(record.id, FIXTURE_EXTENSION_ID);
  assert.equal(record.displayName, FIXTURE_DISPLAY_NAME);
  assert.equal(record.activation.executed, false);
  assert.equal(record.activation.main, "./out/extension.js");
  assert.ok(record.compatibility.unsupported.includes("main"));

  const catalog = registry.catalog();
  assert.equal(catalog.themes[0].colors["editor.background"], "#1A2B3C");
  assert.equal(catalog.themes[0].colors["sideBar.background"], undefined);
  assert.equal(catalog.languages[0].id, "paperos-fixture");

  const jsPath = join(dataDir, record.installPath, "out", "extension.js");
  assert.equal(existsSync(jsPath), true);
  const require = createRequire(import.meta.url);
  assert.throws(() => require(jsPath), /must not execute/);
  assert.equal(registry.catalog().extensions[0].activation.executed, false);

  registry.setEnabled(record.id, false);
  assert.equal(registry.catalog().themes.length, 0);
  registry.setEnabled(record.id, true);
  assert.equal(registry.catalog().themes.length, 1);

  const bumped = JSON.parse(readFileSync(new URL("./fixtures/paperos-theme-language/package.json", import.meta.url), "utf8"));
  bumped.version = "0.2.0";
  const next = registry.install(packZip([
    { name: "extension/package.json", data: JSON.stringify(bumped) },
    { name: "extension/themes/fixture-dark.json", data: "{\"colors\":{\"editor.background\":\"#010203\"}}" },
  ]));
  assert.equal(next.version, "0.2.0");
  assert.equal(existsSync(join(dataDir, record.installPath)), false);
  assert.equal(registry.catalog().themes[0].colors["editor.background"], "#010203");

  registry.uninstall(record.id);
  assert.equal(registry.list().length, 0);
  rmSync(dataDir, { recursive: true, force: true });
});
