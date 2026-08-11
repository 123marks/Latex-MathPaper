import assert from "node:assert/strict";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  WorkspaceKernelError,
  createWorkspaceKernel,
  safeWorkspaceId,
  workspaceIdFrom,
} from "../app/lib/workspaces.mjs";

function writeJson(path, value) {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function makeFixture() {
  const repoRoot = mkdtempSync(join(tmpdir(), "paperos-workspace-kernel-"));
  const dataDir = join(repoRoot, "app", "data");
  const packsPath = join(repoRoot, "product", "workspace-packs.json");
  const registryPath = join(dataDir, "workspaces.json");

  mkdirSync(join(repoRoot, "contests"), { recursive: true });
  mkdirSync(join(repoRoot, "workspaces"), { recursive: true });
  mkdirSync(join(repoRoot, "templates", "workspaces", "latex"), { recursive: true });
  writeFileSync(
    join(repoRoot, "templates", "workspaces", "latex", "main.tex"),
    "\\documentclass{article}\n\\begin{document}\nHello\n\\end{document}\n",
    "utf8",
  );

  writeJson(packsPath, {
    version: 1,
    defaultPack: "general",
    packs: [
      {
        id: "general",
        name: "General folder",
        capabilities: ["files", "search", "terminal", "ai"],
      },
      {
        id: "latex",
        name: "LaTeX document",
        template: "templates/workspaces/latex",
        capabilities: ["files", "search", "terminal", "ai", "latex", "pdf"],
      },
      {
        id: "math-modeling",
        name: "Mathematical modeling",
        capabilities: ["files", "search", "terminal", "ai", "latex", "pdf", "evidence", "stages"],
      },
    ],
  });

  return {
    repoRoot,
    registryPath,
    packsPath,
    kernel: createWorkspaceKernel({ repoRoot, registryPath, packsPath }),
  };
}

function serverSource() {
  return readFileSync(new URL("../app/server.mjs", import.meta.url), "utf8");
}

function routeHandler(source, marker) {
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `missing route marker: ${marker}`);
  const end = source.indexOf("\n  if (req.method ===", start + marker.length);
  return source.slice(start, end === -1 ? source.length : end);
}

test("lists legacy contest folders through the math-modeling adapter", () => {
  const { repoRoot, kernel } = makeFixture();
  const legacyRoot = join(repoRoot, "contests", "legacy-mcm");
  mkdirSync(join(legacyRoot, "paper"), { recursive: true });
  writeFileSync(join(legacyRoot, "paper", "main.tex"), "legacy", "utf8");

  const workspace = kernel.listWorkspaces().find((item) => item.id === "legacy-mcm");

  assert.ok(workspace);
  assert.equal(workspace.pack, "math-modeling");
  assert.equal(workspace.source, "legacy-contest");
  assert.equal(workspace.root, legacyRoot);
  assert.equal(workspace.hasTex, true);
  assert.ok(workspace.capabilities.includes("stages"));
});

test("registers an existing folder and persists it across kernel instances", () => {
  const { repoRoot, registryPath, packsPath, kernel } = makeFixture();
  const externalRoot = join(repoRoot, "external", "research-notes");
  mkdirSync(join(externalRoot, "chapters"), { recursive: true });
  writeFileSync(join(externalRoot, "chapters", "intro.md"), "# Intro\n", "utf8");

  const registered = kernel.registerWorkspace({
    id: "research-notes",
    name: "Research Notes",
    path: externalRoot,
    pack: "general",
  });

  assert.equal(registered.source, "external");
  assert.equal(
    kernel.resolvePath("research-notes", "chapters/intro.md"),
    join(externalRoot, "chapters", "intro.md"),
  );
  assert.throws(
    () => kernel.resolvePath("research-notes", "../outside.txt"),
    (error) => error instanceof WorkspaceKernelError && error.code === "PATH_ESCAPE",
  );
  assert.equal(kernel.resolvePath("research-notes", "."), externalRoot);
  for (const rootPath of [".", "./"]) {
    assert.throws(
      () => kernel.resolvePath("research-notes", rootPath, { allowRoot: false }),
      (error) =>
        error instanceof WorkspaceKernelError && error.code === "WORKSPACE_ROOT_FORBIDDEN",
    );
  }


  const reloaded = createWorkspaceKernel({ repoRoot, registryPath, packsPath });
  assert.equal(reloaded.getWorkspace("research-notes").name, "Research Notes");
});

test("creates a managed workspace from a pack template and manifest", () => {
  const { repoRoot, kernel } = makeFixture();

  const created = kernel.createManagedWorkspace({
    id: "article-one",
    name: "Article One",
    pack: "latex",
  });

  assert.equal(created.source, "managed");
  assert.equal(created.pack, "latex");
  assert.match(readFileSync(join(created.root, "main.tex"), "utf8"), /documentclass/);
  const manifest = JSON.parse(
    readFileSync(join(created.root, ".paperos", "workspace.json"), "utf8"),
  );
  assert.equal(manifest.id, "article-one");
  assert.equal(manifest.pack, "latex");
  assert.equal(kernel.getWorkspace("article-one").root, join(repoRoot, "workspaces", "article-one"));
  assert.throws(
    () => kernel.createManagedWorkspace({ id: "article-one", pack: "latex" }),
    (error) => error instanceof WorkspaceKernelError && error.code === "WORKSPACE_EXISTS",
  );
});

test("rejects invalid ids, missing folders, and unknown packs", () => {
  const { kernel } = makeFixture();

  assert.throws(
    () => kernel.registerWorkspace({ id: "../bad", path: "C:/missing" }),
    (error) => error instanceof WorkspaceKernelError && error.code === "INVALID_ID",
  );
  assert.throws(
    () => kernel.registerWorkspace({ id: "missing", path: "C:/definitely-not-here" }),
    (error) => error instanceof WorkspaceKernelError && error.code === "MISSING_DIRECTORY",
  );
  assert.throws(
    () => kernel.createManagedWorkspace({ id: "unknown-pack", pack: "unknown" }),
    (error) => error instanceof WorkspaceKernelError && error.code === "UNKNOWN_PACK",
  );
});

test("prefers the workspace field while accepting the legacy contest alias", () => {
  assert.equal(
    workspaceIdFrom({ workspace: "general-docs", contest: "legacy-mcm" }),
    "general-docs",
  );
  assert.equal(workspaceIdFrom({ contest: "legacy-mcm" }), "legacy-mcm");
  assert.throws(
    () => workspaceIdFrom({}),
    (error) => error instanceof WorkspaceKernelError && error.code === "INVALID_ID",
  );
});

test("evidence lookup resolves its document through the Workspace Kernel", () => {
  const server = serverSource();
  const start = server.indexOf('path === "/api/editor/evidence"');
  const end = server.indexOf('path === "/api/editor/apply-blocks"', start);
  const evidenceHandler = server.slice(start, end);

  assert.match(evidenceHandler, /workspacePath\(workspaceId, file\)/);
  assert.doesNotMatch(evidenceHandler, /join\(activeWorkspaceRoot, file\)/);
});

test("Workspace file mutations return the preferred workspace response field", () => {
  const server = serverSource();
  const saveHandler = routeHandler(
    server,
    'if (req.method === "PUT" && path === "/api/editor/file")',
  );
  const createHandler = routeHandler(
    server,
    'if (req.method === "POST" && /^\\/api\\/editor\\/file$/.test(path))',
  );

  for (const handler of [saveHandler, createHandler]) {
    assert.match(handler, /workspace:\s*workspaceId/);
    assert.match(handler, /contest:\s*workspaceId/);
  }
});

test("summary exposes generic Workspaces and scopes modeling status to its Pack", () => {
  const summaryHandler = routeHandler(
    serverSource(),
    'if (req.method === "GET" && path === "/api/summary")',
  );

  assert.match(summaryHandler, /const workspaces = workspaceKernel\.listWorkspaces\(\)/);
  assert.match(summaryHandler, /activeWorkspace:/);
  assert.match(summaryHandler, /mathModeling:\s*\{/);
  assert.match(summaryHandler, /workspaces:\s*mathModelingWorkspaces/);
  assert.match(summaryHandler, /status/);
  assert.match(summaryHandler, /contests/);
  assert.match(summaryHandler, /activeContest,/);
});

test("every Workspace-scoped editor route uses the shared field adapters", () => {
  const server = serverSource();
  const queryRoutes = [
    'if (req.method === "GET" && path === "/api/editor/tree")',
    'if (req.method === "GET" && path === "/api/editor/file")',
    'if (req.method === "DELETE" && path === "/api/editor/file")',
    'if (req.method === "GET" && path === "/api/editor/search")',
    'if (req.method === "GET" && path === "/api/editor/export")',
    'if (req.method === "GET" && path === "/api/editor/raw")',
    'if (req.method === "GET" && path === "/api/editor/evidence")',
  ];
  const bodyRoutes = [
    'if (req.method === "PUT" && path === "/api/editor/file")',
    'if (req.method === "POST" && /^\\/api\\/editor\\/file$/.test(path))',
    'if (req.method === "PATCH" && path === "/api/editor/file")',
    'if (req.method === "POST" && path === "/api/editor/run")',
    'if (req.method === "POST" && path === "/api/editor/compile")',
    'if (req.method === "POST" && path === "/api/editor/compile-live")',
    'if (req.method === "POST" && path === "/api/editor/apply-blocks")',
  ];

  for (const marker of queryRoutes) {
    assert.match(routeHandler(server, marker), /queryWorkspaceId\(url\)/, marker);
  }
  for (const marker of bodyRoutes) {
    assert.match(routeHandler(server, marker), /bodyWorkspaceId\(body\)/, marker);
  }
});

test("file mutation routes resolve all user paths through the Workspace Kernel", () => {
  const server = serverSource();
  const mutations = [
    ['if (req.method === "PUT" && path === "/api/editor/file")', /workspacePath\(workspaceId, relPath\)/],
    ['if (req.method === "POST" && /^\\/api\\/editor\\/file$/.test(path))', /workspacePath\(workspaceId, relPath\)/],
    ['if (req.method === "DELETE" && path === "/api/editor/file")', /workspacePath\(workspaceId, relPath, \{ allowRoot: false \}\)/],
    ['if (req.method === "PATCH" && path === "/api/editor/file")', /workspacePath\(workspaceId, from\)[\s\S]*workspacePath\(workspaceId, to\)/],
    ['if (req.method === "POST" && path === "/api/editor/apply-blocks")', /workspacePath\(workspaceId, block\.path\)/],
  ];

  for (const [marker, expected] of mutations) {
    assert.match(routeHandler(server, marker), expected, marker);
  }
});

test("canonical path resolution rejects directory junction escapes", (t) => {
  const { repoRoot, kernel } = makeFixture();
  t.after(() => rmSync(repoRoot, { recursive: true, force: true }));

  const workspaceRoot = join(repoRoot, "external", "MixedCaseRoot");
  const outsideRoot = join(repoRoot, "outside");
  mkdirSync(join(workspaceRoot, "safe"), { recursive: true });
  mkdirSync(outsideRoot, { recursive: true });
  writeFileSync(join(workspaceRoot, "safe", "note.txt"), "safe\n", "utf8");
  writeFileSync(join(outsideRoot, "existing.txt"), "outside\n", "utf8");

  const registeredRoot = process.platform === "win32" ? workspaceRoot.toUpperCase() : workspaceRoot;
  kernel.registerWorkspace({ id: "junction-check", path: registeredRoot, pack: "general" });

  try {
    symlinkSync(
      outsideRoot,
      join(workspaceRoot, "escape"),
      process.platform === "win32" ? "junction" : "dir",
    );
  } catch (error) {
    if (process.platform === "win32") {
      assert.fail(`Windows junction setup failed: ${error.code || error.message}`);
    }
    t.skip(`directory symlinks unavailable: ${error.code || error.message}`);
    return;
  }

  for (const path of ["escape/existing.txt", "escape/new.txt"]) {
    assert.throws(
      () => kernel.resolvePath("junction-check", path),
      (error) => error instanceof WorkspaceKernelError && error.code === "PATH_ESCAPE",
    );
  }
  assert.equal(
    readFileSync(kernel.resolvePath("junction-check", "safe/note.txt"), "utf8"),
    "safe\n",
  );
  assert.equal(kernel.resolvePath("junction-check", "."), kernel.getWorkspace("junction-check").root);
});

test("server supports an isolated data directory for HTTP tests", () => {
  assert.match(serverSource(), /process\.env\.PAPER_OS_DATA_DIR/);
});

test("rejects dot-segment Workspace IDs before managed paths are touched", (t) => {
  const { repoRoot, kernel } = makeFixture();
  t.after(() => rmSync(repoRoot, { recursive: true, force: true }));
  const manifestPaths = [
    join(repoRoot, ".paperos", "workspace.json"),
    join(repoRoot, "workspaces", ".paperos", "workspace.json"),
  ];

  for (const id of [".", ".."]) {
    assert.throws(
      () => safeWorkspaceId(id),
      (error) => error instanceof WorkspaceKernelError && error.code === "INVALID_ID",
    );
    assert.throws(
      () => kernel.createManagedWorkspace({ id, pack: "latex" }),
      (error) => error instanceof WorkspaceKernelError && error.code === "INVALID_ID",
    );
  }
  for (const path of manifestPaths) assert.equal(existsSync(path), false);
});
