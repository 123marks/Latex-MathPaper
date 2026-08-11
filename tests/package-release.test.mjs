import assert from "node:assert/strict";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function write(root, relative, content = "") {
  const target = join(root, relative);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content, "utf8");
}

test("package release rejects a partial native launcher artifact set", () => {
  const root = mkdtempSync(join(tmpdir(), "paper-os-package-test-"));
  try {
    write(root, "package.json", JSON.stringify({ version: "0.0.0-test" }));
    write(root, "app/server.mjs");
    write(root, "app/public/index.html");
    write(root, "app/ide/ide.js");
    write(root, "PaperOS.exe", "partial launcher");
    mkdirSync(join(root, "scripts"), { recursive: true });
    copyFileSync(
      join(repoRoot, "scripts", "package-release.mjs"),
      join(root, "scripts", "package-release.mjs"),
    );

    const result = spawnSync(process.execPath, [join(root, "scripts", "package-release.mjs")], {
      cwd: root,
      encoding: "utf8",
    });

    assert.notEqual(result.status, 0, result.stdout);
    assert.match(result.stderr, /partial native launcher artifacts/i);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
