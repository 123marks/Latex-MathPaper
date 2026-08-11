import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const ideSource = readFileSync(new URL("../apps/desktop/src/ide.jsx", import.meta.url), "utf8");
const packCatalog = JSON.parse(readFileSync(new URL("../product/workspace-packs.json", import.meta.url), "utf8"));

test("desktop entry does not create a contest demo behind the user's back", () => {
  assert.doesNotMatch(ideSource, /demo-2024-mcm/);
  assert.doesNotMatch(ideSource, /Auto-create a sample project/);
});

test("desktop entry exposes a Pack-aware Workspace chooser", () => {
  assert.match(ideSource, /data-testid="workspace-chooser"/);
  assert.match(ideSource, /data-testid="workspace-create"/);
  assert.match(ideSource, /data-testid="workspace-register"/);
  assert.match(ideSource, /setPacks\(data\.packs \|\| \[\]\)/);
});

test("title-bar creation opens the chooser instead of using prompt", () => {
  const titlebarStart = ideSource.indexOf('<div className="project-chip"');
  const titlebarEnd = ideSource.indexOf('<div className="titlebar-right">', titlebarStart);
  const titlebarSource = ideSource.slice(titlebarStart, titlebarEnd);

  assert.ok(titlebarStart >= 0 && titlebarEnd > titlebarStart);
  assert.doesNotMatch(titlebarSource, /prompt\(/);
  assert.match(titlebarSource, /setShowWelcome\(true\)/);
});

test("Workspace switching clears the previous editor session", () => {
  assert.match(ideSource, /function switchWorkspace\(/);
  assert.match(ideSource, /setOpenTabs\(\[\]\)/);
  assert.match(ideSource, /setActive\(null\)/);
  assert.match(ideSource, /setEditor\(""\)/);
  assert.match(ideSource, /setOriginal\(""\)/);
});

test("Command Palette receives only commands enabled by the current Pack", () => {
  const paletteStart = ideSource.indexOf("<CommandPalette");
  const paletteEnd = ideSource.indexOf("onRun=", paletteStart);
  const paletteSource = ideSource.slice(paletteStart, paletteEnd);

  assert.ok(paletteStart >= 0 && paletteEnd > paletteStart);
  assert.match(
    paletteSource,
    /\.filter\(\(command\) => !command\.capability \|\| currentCapabilities\.includes\(command\.capability\)\)/,
  );
});

test("Pack-specific function entry points enforce their Capabilities", () => {
  assert.match(ideSource, /async function compile\(\) \{\s+if \(!canCompile\)/);
  assert.match(ideSource, /async function lookupEvidence\(line, q = ""\) \{\s+if \(!canUseEvidence\)/);
});

test("Evidence Activity is hidden when the active Pack lacks evidence", () => {
  const activityStart = ideSource.indexOf("{/* Activity bar */}");
  const activityEnd = ideSource.indexOf("{/* Sidebar */}", activityStart);
  const activitySource = ideSource.slice(activityStart, activityEnd);

  assert.ok(activityStart >= 0 && activityEnd > activityStart);
  assert.match(activitySource, /\{canUseEvidence \? \([\s\S]*lookupEvidence\(cursorPos\.line\)[\s\S]*\) : null\}/);
});

test("Tectonic command requires the LaTeX Capability", () => {
  const installCommand = ideSource
    .split("\n")
    .find((line) => line.includes('id: "cmd.install"')) || "";

  assert.match(installCommand, /capability: "latex"/);
});

test("Workspace chooser and dirty-buffer view use accurate product language", () => {
  const chooserStart = ideSource.indexOf("function WorkspaceChooser(");
  const chooserEnd = ideSource.indexOf("function SearchModal(", chooserStart);
  const chooserSource = ideSource.slice(chooserStart, chooserEnd);

  assert.match(chooserSource, /Workspace Pack/);
  assert.doesNotMatch(chooserSource, /Professional Pack|professional Pack/);
  assert.match(ideSource, /view === "source" \? "Changes"/);
});

test("only the mathematical-modeling Pack exposes paperctl tasks", () => {
  const packs = new Map(packCatalog.packs.map((pack) => [pack.id, pack]));

  for (const id of ["general", "latex", "markdown"]) {
    assert.ok(!packs.get(id).capabilities.includes("terminal"), id + " must not claim an interactive terminal");
    assert.ok(!packs.get(id).capabilities.includes("paperctl"), id + " must not expose paperctl");
  }
  assert.ok(packs.get("math-modeling").capabilities.includes("paperctl"));
  assert.ok(!packs.get("math-modeling").capabilities.includes("terminal"));
  assert.doesNotMatch(packs.get("general").description, /terminal/i);
  assert.match(packs.get("math-modeling").description, /paperctl/i);
});

test("paperctl TASKS and LaTeX controls are gated by their Pack Capabilities", () => {
  const bottomStart = ideSource.indexOf('<div className="terminal">');
  const bottomEnd = ideSource.indexOf("{toast ?", bottomStart);
  const bottomSource = ideSource.slice(bottomStart, bottomEnd);

  assert.match(ideSource, /const canRunPaperctl = currentCapabilities\.includes\("paperctl"\)/);
  assert.match(bottomSource, /canRunPaperctl \? \{ id: "tasks", label: "TASKS" \} : null/);
  assert.doesNotMatch(bottomSource, /label: "TERMINAL"/);
  assert.match(bottomSource, /\{bottomTab === "tasks" && canRunPaperctl && \(/);
  assert.match(bottomSource, /contestId: contest/);
  assert.match(bottomSource, /\{canCompile \? \(\s*<button onClick=\{compile\}/);
  assert.match(bottomSource, /canCompile \? \{ id: "latex", label: "LaTeX" \} : null/);
});

test("paperctl menu entries require the paperctl Capability", () => {
  const menuStart = ideSource.indexOf("function MenuBar(");
  const menuEnd = ideSource.indexOf("function OutlinePanel(", menuStart);
  const menuSource = ideSource.slice(menuStart, menuEnd);

  assert.match(menuSource, /\{ id: "view-tasks", label: "Paperctl 任务", capability: "paperctl" \}/);
  assert.match(menuSource, /id: "tasks", label: "任务\(T\)", capability: "paperctl"/);
  assert.match(menuSource, /menus\.filter\(\(menu\) => !menu\.capability \|\| capabilities\.includes\(menu\.capability\)\)\.map/);
});

test("adapter-bound Packs stay visible but cannot use generic create or register", () => {
  const chooserStart = ideSource.indexOf("function WorkspaceChooser(");
  const chooserEnd = ideSource.indexOf("function SearchModal(", chooserStart);
  const chooserSource = ideSource.slice(chooserStart, chooserEnd);

  assert.match(chooserSource, /const selectedPackRequiresAdapter = Boolean\(selectedPack\?\.adapter\)/);
  assert.match(chooserSource, /const requiresAdapter = Boolean\(pack\.adapter\)/);
  assert.match(chooserSource, /disabled=\{busy \|\| requiresAdapter\}/);
  assert.match(chooserSource, /Compatibility adapter only/);
  assert.match(chooserSource, /disabled=\{busy \|\| !packs\.length \|\| selectedPackRequiresAdapter\}/);
});

test("Pack changes normalize hidden bottom-panel tabs to output", () => {
  assert.match(
    ideSource,
    /if \(\s*\(bottomTab === "latex" && !canCompile\) \|\|\s*\(bottomTab === "tasks" && !canRunPaperctl\)\s*\) \{\s*setBottomTab\("output"\)/,
  );
});
