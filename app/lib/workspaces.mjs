import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

const MANIFEST_PATH = join(".paperos", "workspace.json");

export class WorkspaceKernelError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "WorkspaceKernelError";
    this.code = code;
  }
}

export function safeWorkspaceId(value) {
  const id = String(value || "").trim();
  if (!id || id === "." || id === ".." || !/^[a-zA-Z0-9._-]+$/.test(id)) {
    throw new WorkspaceKernelError(
      "INVALID_ID",
      "Workspace ID may contain letters, numbers, dots, underscores, and dashes.",
    );
  }
  return id;
}

export function workspaceIdFrom(values = {}) {
  return safeWorkspaceId(values.workspace || values.contest || "");
}

function readJson(path, fallback) {
  if (!existsSync(path)) return fallback;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJsonAtomic(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  const temp = `${path}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  try {
    renameSync(temp, path);
  } catch (error) {
    if (!existsSync(path)) throw error;
    rmSync(path, { force: true });
    renameSync(temp, path);
  }
}

function directoryNames(path) {
  if (!existsSync(path)) return [];
  return readdirSync(path)
    .filter((name) => {
      try {
        return statSync(join(path, name)).isDirectory();
      } catch {
        return false;
      }
    })
    .sort((left, right) => left.localeCompare(right));
}

// Mimir lesson (project import): find the real LaTeX entry file instead of
// guessing fixed names. Conventional names win; otherwise the shallow-scanned
// .tex files that declare \documentclass are candidates (first sorted wins).
export function detectTexEntry(root) {
  for (const path of ["main.tex", "paper.tex", join("paper", "main.tex")]) {
    if (existsSync(join(root, path))) return path.replace(/\\/g, "/");
  }
  const candidates = [];
  const SKIP = new Set(["node_modules", ".git", "build", ".tectonic", "state", "__pycache__"]);
  (function scan(dir, rel, depth) {
    if (depth > 2 || candidates.length >= 20) return;
    let names;
    try { names = readdirSync(dir); } catch { return; }
    for (const name of names.sort()) {
      if (SKIP.has(name)) continue;
      const abs = join(dir, name);
      const relPath = rel ? `${rel}/${name}` : name;
      let st;
      try { st = statSync(abs); } catch { continue; }
      if (st.isDirectory()) { scan(abs, relPath, depth + 1); continue; }
      if (!/\.tex$/i.test(name) || st.size > 2_000_000) continue;
      try {
        const head = readFileSync(abs, "utf8").slice(0, 20000);
        if (/^\s*\\documentclass\b/m.test(head)) candidates.push(relPath);
      } catch { /* unreadable file is not an entry */ }
    }
  })(root, "", 0);
  return candidates.length ? candidates.sort()[0] : null;
}

function hasTexEntry(root) {
  return detectTexEntry(root) !== null;
}

function isMissingPathError(error) {
  return error?.code === "ENOENT" || error?.code === "ENOTDIR";
}

function canonicalExistingAncestor(candidate, boundary) {
  let current = candidate;
  while (true) {
    let exists = false;
    try {
      lstatSync(current);
      exists = true;
    } catch (error) {
      if (!isMissingPathError(error)) throw error;
    }
    if (exists) {
      try {
        return realpathSync.native(current);
      } catch {
        throw new WorkspaceKernelError(
          "PATH_UNRESOLVABLE",
          "Document path cannot be resolved safely.",
        );
      }
    }
    if (current === boundary) return null;
    const parent = dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

function isCanonicalChild(root, candidate) {
  const relation = relative(root, candidate);
  return (
    relation === "" ||
    (relation !== ".." && !relation.startsWith(`..${sep}`) && !isAbsolute(relation))
  );
}

function inferPack(root) {
  if (hasTexEntry(root)) return "latex";
  if (["README.md", "notes.md", "index.md"].some((path) => existsSync(join(root, path)))) {
    return "markdown";
  }
  return "general";
}

export function createWorkspaceKernel({
  repoRoot,
  registryPath,
  packsPath,
  managedRoot = join(repoRoot, "workspaces"),
  legacyContestRoot = join(repoRoot, "contests"),
}) {
  const absoluteRepoRoot = resolve(repoRoot);
  const absoluteManagedRoot = resolve(managedRoot);
  const absoluteLegacyRoot = resolve(legacyContestRoot);
  const catalog = readJson(packsPath, { version: 1, defaultPack: "general", packs: [] });
  const packs = new Map((catalog.packs || []).map((pack) => [pack.id, Object.freeze({ ...pack })]));
  const defaultPack = catalog.defaultPack || "general";

  function packById(packId) {
    const pack = packs.get(packId);
    if (!pack) {
      throw new WorkspaceKernelError("UNKNOWN_PACK", `Unknown Workspace Pack: ${packId}`);
    }
    return pack;
  }

  function readRegistry() {
    const data = readJson(registryPath, { version: 1, workspaces: [] });
    return {
      version: 1,
      workspaces: Array.isArray(data.workspaces) ? data.workspaces : [],
    };
  }

  function readManifest(root) {
    return readJson(join(root, MANIFEST_PATH), null);
  }

  function workspaceStatus(root) {
    const reportPath = join(root, "state", "verification-report.md");
    if (existsSync(reportPath)) {
      const report = readFileSync(reportPath, "utf8");
      if (report.includes("- FAIL: 0")) return "verified";
      if (report.includes("- FAIL:")) return "failing";
    }
    if (
      [
        "main.pdf",
        join("build", "main.pdf"),
        join("paper", "main.pdf"),
      ].some((path) => existsSync(join(root, path)))
    ) {
      return "built";
    }
    return "ready";
  }

  function decorate(entry) {
    const root = resolve(entry.root);
    const packId = entry.pack || inferPack(root) || defaultPack;
    const pack = packById(packId);
    let mtime = 0;
    try {
      mtime = statSync(root).mtimeMs;
    } catch {
      // Missing external folders are retained in the registry and surfaced as missing.
    }
    return {
      id: safeWorkspaceId(entry.id),
      name: entry.name || entry.id,
      root,
      path: root,
      pack: packId,
      packName: pack.name || packId,
      source: entry.source,
      capabilities: [...(pack.capabilities || [])],
      hasTex: hasTexEntry(root),
      texEntry: existsSync(root) ? detectTexEntry(root) : null,
      status: existsSync(root) ? workspaceStatus(root) : "missing",
      mtime,
    };
  }

  function listWorkspaces() {
    const items = new Map();

    for (const entry of readRegistry().workspaces) {
      if (!entry?.id || !entry?.path) continue;
      const id = safeWorkspaceId(entry.id);
      items.set(id, decorate({
        id,
        name: entry.name || id,
        root: entry.path,
        pack: entry.pack || defaultPack,
        source: "external",
      }));
    }

    for (const id of directoryNames(absoluteManagedRoot)) {
      if (items.has(id)) continue;
      const root = join(absoluteManagedRoot, id);
      const manifest = readManifest(root) || {};
      items.set(id, decorate({
        id,
        name: manifest.name || id,
        root,
        pack: manifest.pack || inferPack(root),
        source: "managed",
      }));
    }

    for (const id of directoryNames(absoluteLegacyRoot)) {
      if (items.has(id)) continue;
      const root = join(absoluteLegacyRoot, id);
      const manifest = readManifest(root) || {};
      items.set(id, decorate({
        id,
        name: manifest.name || id,
        root,
        pack: manifest.pack || "math-modeling",
        source: "legacy-contest",
      }));
    }

    return [...items.values()].sort((left, right) =>
      right.mtime - left.mtime || left.name.localeCompare(right.name),
    );
  }

  function getWorkspace(id) {
    const workspaceId = safeWorkspaceId(id);
    const workspace = listWorkspaces().find((item) => item.id === workspaceId);
    if (!workspace) {
      throw new WorkspaceKernelError("WORKSPACE_NOT_FOUND", `Workspace not found: ${workspaceId}`);
    }
    return workspace;
  }

  function assertAvailableId(id) {
    if (listWorkspaces().some((workspace) => workspace.id === id)) {
      throw new WorkspaceKernelError("WORKSPACE_EXISTS", `Workspace already exists: ${id}`);
    }
  }

  // Remove a workspace from the product. Semantics follow the source:
  //   external — drop the registry entry, files on disk stay untouched;
  //   managed  — the folder IS the registration, so removal must delete it
  //              (caller passes deleteFiles: true after explicit confirm);
  //   legacy-contest — refused here (sample content, use its own tooling).
  function removeWorkspace(id, { deleteFiles = false } = {}) {
    const workspace = getWorkspace(id);
    if (workspace.source === "external") {
      const registry = readRegistry();
      registry.workspaces = registry.workspaces.filter(
        (entry) => safeWorkspaceId(entry.id) !== workspace.id,
      );
      writeJsonAtomic(registryPath, registry);
      return { id: workspace.id, source: workspace.source, deletedFiles: false };
    }
    if (workspace.source === "managed") {
      if (!deleteFiles) {
        throw new WorkspaceKernelError(
          "DELETE_REQUIRES_CONFIRM",
          "Removing a managed workspace deletes its folder; pass deleteFiles after user confirmation.",
        );
      }
      const target = resolve(workspace.root);
      if (target !== join(absoluteManagedRoot, workspace.id)) {
        throw new WorkspaceKernelError("PATH_ESCAPE", "Managed workspace root escapes the managed directory.");
      }
      rmSync(target, { recursive: true, force: true });
      return { id: workspace.id, source: workspace.source, deletedFiles: true };
    }
    throw new WorkspaceKernelError(
      "PACK_REQUIRES_ADAPTER",
      "Legacy contest workspaces cannot be removed here.",
    );
  }

  function registerWorkspace({ id, name, path, pack }) {
    const workspaceId = safeWorkspaceId(id || basename(String(path || "")));
    const root = resolve(String(path || ""));
    if (!existsSync(root) || !statSync(root).isDirectory()) {
      throw new WorkspaceKernelError("MISSING_DIRECTORY", `Workspace folder does not exist: ${root}`);
    }
    assertAvailableId(workspaceId);
    const packId = pack || inferPack(root) || defaultPack;
    packById(packId);

    const registry = readRegistry();
    registry.workspaces.push({
      id: workspaceId,
      name: name || workspaceId,
      path: root,
      pack: packId,
    });
    writeJsonAtomic(registryPath, registry);
    return decorate({
      id: workspaceId,
      name: name || workspaceId,
      root,
      pack: packId,
      source: "external",
    });
  }

  function createManagedWorkspace({ id, name, pack = defaultPack }) {
    const workspaceId = safeWorkspaceId(id);
    const packConfig = packById(pack);
    assertAvailableId(workspaceId);
    if (packConfig.adapter === "legacy-contest") {
      throw new WorkspaceKernelError(
        "PACK_REQUIRES_ADAPTER",
        `${pack} must be created by its compatibility adapter.`,
      );
    }

    const root = join(absoluteManagedRoot, workspaceId);
    const template = packConfig.template
      ? resolve(absoluteRepoRoot, packConfig.template)
      : null;
    if (template && existsSync(template)) {
      cpSync(template, root, { recursive: true, errorOnExist: true });
    } else {
      mkdirSync(root, { recursive: false });
    }
    writeJsonAtomic(join(root, MANIFEST_PATH), {
      version: 1,
      id: workspaceId,
      name: name || workspaceId,
      pack,
      createdAt: new Date().toISOString(),
    });
    return decorate({
      id: workspaceId,
      name: name || workspaceId,
      root,
      pack,
      source: "managed",
    });
  }

  function resolvePath(id, relativePath = ".", options = {}) {
    const workspace = getWorkspace(id);
    const value = String(relativePath || ".");
    if (isAbsolute(value) || value.includes("\0")) {
      throw new WorkspaceKernelError("PATH_ESCAPE", "Document path must be Workspace-relative.");
    }
    const candidate = resolve(workspace.root, value);
    if (candidate !== workspace.root && !candidate.startsWith(workspace.root + sep)) {
      throw new WorkspaceKernelError("PATH_ESCAPE", "Document path escapes the Workspace root.");
    }
    const canonicalRoot = canonicalExistingAncestor(workspace.root, workspace.root);
    if (canonicalRoot) {
      const canonicalAncestor = canonicalExistingAncestor(candidate, workspace.root);
      if (!canonicalAncestor || !isCanonicalChild(canonicalRoot, canonicalAncestor)) {
        throw new WorkspaceKernelError("PATH_ESCAPE", "Document path escapes the Workspace root.");
      }
    }
    if (candidate === workspace.root && options.allowRoot === false) {
      throw new WorkspaceKernelError(
        "WORKSPACE_ROOT_FORBIDDEN",
        "Workspace root is not allowed for this operation.",
      );
    }

    return candidate;
  }

  return Object.freeze({
    createManagedWorkspace,
    getWorkspace,
    listPacks: () => [...packs.values()].map((pack) => ({ ...pack })),
    listWorkspaces,
    registerWorkspace,
    removeWorkspace,
    resolvePath,
  });
}
