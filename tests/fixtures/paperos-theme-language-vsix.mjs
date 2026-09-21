import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { packZip } from "../../app/lib/zip-archive.mjs";

const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), "paperos-theme-language");

function file(rel) {
  return readFileSync(join(fixtureDir, rel));
}

export const FIXTURE_EXTENSION_ID = "paperos.theme-language-fixture";
export const FIXTURE_DISPLAY_NAME = "Paper OS Theme+Language Fixture";

export function buildThemeLanguageVsix() {
  return packZip([
    { name: "extension/package.json", data: file("package.json") },
    { name: "extension/themes/fixture-dark.json", data: file("themes/fixture-dark.json") },
    { name: "extension/syntaxes/pfx.tmLanguage.json", data: file("syntaxes/pfx.tmLanguage.json") },
    { name: "extension/out/extension.js", data: file("out/extension.js") },
    { name: "[Content_Types].xml", data: "<?xml version=\"1.0\"?><Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\"></Types>" },
    { name: "extension.vsixmanifest", data: "<PackageManifest Version=\"2.0.0\"></PackageManifest>" },
  ]);
}

export function buildTraversalVsix() {
  return packZip([
    { name: "extension/package.json", data: file("package.json") },
    { name: "../escape.txt", data: "nope" },
  ]);
}

export function buildSymlinkVsix() {
  return packZip([
    { name: "extension/package.json", data: file("package.json") },
    { name: "extension/link", data: "target", unixMode: 0o120777 },
  ]);
}
