// Installed .vsix registry. Files live under {dataDir}/extensions/installed.
// The host copies static contributes and never imports or evals extracted JS.

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";

import { createStore } from "./store.mjs";
import {
  classifyContributes,
  collectLanguages,
  collectThemes,
  mapThemeColors,
  validateManifest,
} from "./extensions.mjs";
import { assertSafeZipName, extractZipEntries } from "./zip-archive.mjs";

export const VSIX_MAX_BYTES = 8 * 1024 * 1024;
export const VSIX_MAX_FILES = 256;
export const VSIX_MAX_UNCOMPRESSED = 16 * 1024 * 1024;

const SKIP_NAMES = new Set(["[Content_Types].xml", "extension.vsixmanifest"]);

export class ExtensionError extends Error {
  constructor(message, code = "EXTENSION_ERROR", status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function findPackageJson(entries) {
  const names = entries.map((entry) => entry.name);
  if (names.includes("extension/package.json")) return "extension/package.json";
  if (names.includes("package.json")) return "package.json";
  const others = names.filter((name) => name.endsWith("/package.json") && !name.includes("node_modules/"));
  if (others.length === 1) return others[0];
  throw new ExtensionError("VSIX 中找不到 package.json", "MANIFEST_INVALID");
}

function contained(root, candidate) {
  const base = resolve(root);
  const next = resolve(candidate);
  return next === base || next.startsWith(base + sep);
}

function writeContained(root, relative, data) {
  const safe = assertSafeZipName(relative);
  const target = resolve(root, safe);
  if (!contained(root, target)) {
    throw new ExtensionError("压缩条目路径越界", "VSIX_TRAVERSAL");
  }
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, data);
}

function readThemeColors(dataDir, record) {
  const theme = record.contributes?.themes?.[0];
  if (!theme?.path) return null;
  const installRoot = resolve(dataDir, record.installPath);
  const file = resolve(installRoot, theme.path);
  if (!contained(installRoot, file) || !existsSync(file)) return null;
  try {
    const json = JSON.parse(readFileSync(file, "utf8"));
    return {
      label: theme.label,
      uiTheme: theme.uiTheme,
      colors: mapThemeColors(json.colors || {}),
      tokenColors: Array.isArray(json.tokenColors) ? json.tokenColors.length : 0,
    };
  } catch {
    return { label: theme.label, uiTheme: theme.uiTheme, colors: {}, tokenColors: 0, error: "theme-unreadable" };
  }
}

export function createExtensionRegistry({ dataDir }) {
  const root = join(dataDir, "extensions");
  const installRoot = join(root, "installed");
  const store = createStore(join(root, "registry.json"), { extensions: [] });

  function listRecords() {
    return store.read().extensions || [];
  }

  function writeRecords(extensions) {
    store.write({ extensions });
  }

  function install(vsixBuffer, { filename = "extension.vsix" } = {}) {
    const buffer = Buffer.isBuffer(vsixBuffer) ? vsixBuffer : Buffer.from(vsixBuffer);
    if (buffer.length > VSIX_MAX_BYTES) {
      throw new ExtensionError("VSIX 超过 8MB", "VSIX_TOO_LARGE", 413);
    }
    let entries;
    try {
      entries = extractZipEntries(buffer, {
        maxFiles: VSIX_MAX_FILES,
        maxUncompressed: VSIX_MAX_UNCOMPRESSED,
      });
    } catch (error) {
      throw new ExtensionError(error.message || "无法解包 VSIX", error.code || "VSIX_INVALID");
    }
    if (!entries.length) throw new ExtensionError("空的 VSIX", "VSIX_INVALID");

    const pkgName = findPackageJson(entries);
    const pkgEntry = entries.find((entry) => entry.name === pkgName);
    let pkg;
    try {
      pkg = JSON.parse(pkgEntry.data.toString("utf8"));
    } catch {
      throw new ExtensionError("package.json 无法解析", "MANIFEST_INVALID");
    }
    let manifest;
    try {
      manifest = validateManifest(pkg);
    } catch (error) {
      throw new ExtensionError(error.message, error.code || "MANIFEST_INVALID");
    }

    const prefix = pkgName.endsWith("package.json")
      ? pkgName.slice(0, -"package.json".length)
      : "";
    const dest = join(installRoot, manifest.id, manifest.version);
    if (!contained(installRoot, dest)) {
      throw new ExtensionError("安装路径越界", "VSIX_TRAVERSAL");
    }

    const existing = listRecords().find((item) => item.id === manifest.id);
    rmSync(dest, { recursive: true, force: true });
    mkdirSync(dest, { recursive: true });

    for (const entry of entries) {
      const baseName = entry.name.split("/").pop();
      if (SKIP_NAMES.has(baseName) || entry.name.includes("node_modules/")) continue;
      let relative = prefix && entry.name.startsWith(prefix)
        ? entry.name.slice(prefix.length)
        : entry.name;
      if (!relative) continue;
      writeContained(dest, relative, entry.data);
    }

    const record = {
      id: manifest.id,
      publisher: manifest.publisher,
      name: manifest.name,
      displayName: manifest.displayName,
      description: manifest.description,
      version: manifest.version,
      enabled: existing ? existing.enabled !== false : true,
      installPath: `extensions/installed/${manifest.id}/${manifest.version}`,
      contributes: {
        themes: collectThemes(manifest.contributes),
        languages: collectLanguages(manifest.contributes),
      },
      compatibility: classifyContributes(manifest),
      activation: {
        executed: false,
        main: manifest.main || null,
        browser: manifest.browser || null,
        activationEvents: manifest.activationEvents,
      },
      sourceName: String(filename).slice(0, 120),
      installedAt: new Date().toISOString(),
    };

    writeRecords([record, ...listRecords().filter((item) => item.id !== manifest.id)]);
    if (existing && existing.version !== manifest.version) {
      const oldDir = join(dataDir, existing.installPath);
      if (existsSync(oldDir) && resolve(oldDir) !== resolve(dest)) {
        rmSync(oldDir, { recursive: true, force: true });
      }
    }
    return record;
  }

  function setEnabled(id, enabled) {
    let found = null;
    writeRecords(listRecords().map((item) => {
      if (item.id !== id) return item;
      found = { ...item, enabled: !!enabled };
      return found;
    }));
    if (!found) throw new ExtensionError("扩展未安装", "EXTENSION_NOT_FOUND", 404);
    return found;
  }

  function uninstall(id) {
    const records = listRecords();
    const found = records.find((item) => item.id === id);
    if (!found) throw new ExtensionError("扩展未安装", "EXTENSION_NOT_FOUND", 404);
    const dir = join(dataDir, found.installPath);
    const parent = join(installRoot, found.id);
    if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
    if (existsSync(parent) && readdirSync(parent).length === 0) {
      rmSync(parent, { recursive: true, force: true });
    }
    writeRecords(records.filter((item) => item.id !== id));
    return { ok: true, id };
  }

  function catalog() {
    const extensions = listRecords();
    const languages = [];
    const themes = [];
    for (const ext of extensions.filter((item) => item.enabled !== false)) {
      for (const lang of ext.contributes?.languages || []) {
        languages.push({ ...lang, extensionId: ext.id });
      }
      const theme = readThemeColors(dataDir, ext);
      if (theme) themes.push({ ...theme, extensionId: ext.id });
    }
    return { extensions, languages, themes };
  }

  return { install, list: listRecords, setEnabled, uninstall, catalog, installRoot };
}
