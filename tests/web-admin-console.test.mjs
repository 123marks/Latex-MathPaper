import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const read = (p) => readFileSync(resolve("web", p), "utf8");
const monitorSource = read("src/pages/admin/AdminMonitor.jsx");
const sessionsSource = read("src/pages/admin/AdminSessions.jsx");
const auditSource = read("src/pages/admin/AdminAudit.jsx");
const keysSource = read("src/pages/admin/AdminKeys.jsx");
const layoutSource = read("src/pages/admin/AdminLayout.jsx");
const appSource = read("src/App.jsx");
const dashboardSource = read("src/pages/app/Dashboard.jsx");
const css = read("src/styles/pages.css");

test("admin monitor page reads real endpoints and stays honest on win32", () => {
  assert.match(monitorSource, /\/api\/admin\/monitor/);
  assert.match(monitorSource, /platform !== "win32"/);
  assert.match(monitorSource, /没有任何模拟数据/);
});

test("admin sessions page lists and revokes via the real API with confirm", () => {
  assert.match(sessionsSource, /\/api\/admin\/sessions/);
  assert.match(sessionsSource, /window\.confirm/);
  assert.match(sessionsSource, /强制下线/);
  assert.match(sessionsSource, /s\.current/);
});

test("monitor and sessions are routed and in the admin nav", () => {
  assert.match(appSource, /path="\/admin\/monitor" element=\{<AdminMonitor \/>\}/);
  assert.match(appSource, /path="\/admin\/sessions" element=\{<AdminSessions \/>\}/);
  assert.match(layoutSource, /to: "\/admin\/monitor"/);
  assert.match(layoutSource, /to: "\/admin\/sessions"/);
});

test("audit log paginates and keys overview filters client-side", () => {
  assert.match(auditSource, /const PAGE_SIZE = 50/);
  assert.match(auditSource, /pageItems\.map/);
  assert.match(auditSource, /className="pager"/);
  assert.match(keysSource, /onlyConfigured/);
  assert.match(keysSource, /visible\.map/);
  assert.match(css, /\.pager \{/);
});

test("admin usage adds real workspace ranking and 24h distribution", () => {
  const usageSource = read("src/pages/admin/AdminUsage.jsx");
  const overviewSource = read("src/pages/admin/AdminOverview.jsx");
  assert.match(usageSource, /按工作区/);
  assert.match(usageSource, /data\.workspaces/);
  assert.match(usageSource, /24h 分布/);
  assert.match(usageSource, /data\.hours/);
  assert.match(overviewSource, /消耗 Top 工作区/);
  assert.match(overviewSource, /usage\.workspaces/);
});

test("app topbar collapses on narrow viewports instead of overflowing", () => {
  const layoutAppSource = read("src/pages/app/AppLayout.jsx");
  assert.match(layoutAppSource, /topbar-username/);
  assert.match(css, /\.topbar \.topbar-username \{ display: none; \}/);
  assert.match(css, /\.workspace-switch \{ max-width/);
});

test("dashboard is a real control hub fed by live endpoints", () => {
  assert.match(dashboardSource, /\/api\/editor\/projects/);
  assert.match(dashboardSource, /\/api\/chat\/history/);
  assert.match(dashboardSource, /\/api\/usage\/me\?days=7/);
  assert.match(dashboardSource, /\/api\/engine\/status/);
  // Truthfulness + legacy contracts stay intact.
  assert.match(dashboardSource, /模型请求按你配置的 provider 处理/);
  assert.match(dashboardSource, /const workspaceCount =/);
  assert.match(dashboardSource, /const readyCount =/);
});
