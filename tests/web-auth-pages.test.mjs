import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import React from "../web/node_modules/react/index.js";
import { renderToStaticMarkup } from "../web/node_modules/react-dom/server.node.js";
import { StaticRouter } from "../web/node_modules/react-router-dom/server.mjs";
import { createServer as createViteServer } from "../web/node_modules/vite/dist/node/index.js";

const webRoot = resolve("web");
const pagesCss = readFileSync(resolve(webRoot, "src/styles/pages.css"), "utf8");
let vite;
let AuthProvider;

test.before(async () => {
  vite = await createViteServer({
    root: webRoot,
    appType: "custom",
    logLevel: "silent",
    resolve: { dedupe: ["react", "react-dom"] },
    server: { middlewareMode: true },
  });
  ({ AuthProvider } = await vite.ssrLoadModule("/src/lib/auth.jsx"));
});

test.after(async () => {
  await vite?.close();
});

async function loadPage(name) {
  const module = await vite.ssrLoadModule("/src/pages/" + name + ".jsx?t1-5=" + Date.now() + "-" + name);
  return module.default;
}

function render(Page, location) {
  return renderToStaticMarkup(
    React.createElement(
      StaticRouter,
      { location },
      React.createElement(
        AuthProvider,
        null,
        React.createElement(Page),
      ),
    ),
  );
}

test("Login and Register share accessible mode, OAuth, and offline controls", async () => {
  const Login = await loadPage("Login");
  const Register = await loadPage("Register");
  const login = render(Login, "/login");
  const register = render(Register, "/register");

  for (const [mode, markup] of [["login", login], ["register", register]]) {
    assert.ok(markup.includes('role="radiogroup"'), mode + " is missing Segmented semantics");
    assert.ok(markup.includes('aria-label="登录或注册"'));
    assert.equal((markup.match(/role="radio"/g) || []).length, 2);
    assert.ok(markup.includes('href="/download"'));
    assert.ok(markup.includes("离线打开本地项目"));
    for (const provider of ["Google", "GitHub", "企业微信"]) {
      assert.ok(markup.includes(provider), mode + " is missing " + provider);
    }
    assert.ok(markup.includes("开发流程"));
    assert.ok(markup.includes("项目文件保留在本机"));
    assert.equal(markup.includes("Team First"), false);
    assert.equal(markup.includes("五阶段工作流"), false);
    assert.equal(markup.includes("论文流水线"), false);
  }

  assert.match(login, /aria-checked="true"[^>]*>登录</);
  assert.match(register, /aria-checked="true"[^>]*>注册</);
  assert.ok(login.includes(">登录并继续</button>"));
  assert.ok(register.includes(">免费开始</button>"));
});

test("AuthAside uses neutral product copy and renders code, PDF, and trace fragments", async () => {
  const Login = await loadPage("Login");
  const markup = render(Login, "/login");

  assert.ok(markup.includes("Local First · Pack Powered"));
  assert.ok(markup.includes("从想法，到可以交付的"));
  assert.ok(markup.includes("文档工作区"));
  assert.ok(markup.includes("Workspace + Packs"));
  assert.ok(markup.includes("LaTeX 原生"));
  assert.ok(markup.includes("证据可追溯"));
  assert.ok(markup.includes("技能生态"));
  assert.ok(markup.includes('class="auth-fragment auth-fragment--code"'));
  assert.ok(markup.includes('class="auth-fragment auth-fragment--pdf"'));
  assert.equal((markup.match(/class="auth-trace__step"/g) || []).length, 5);
});

test("Register password feedback mirrors every server policy boundary", async () => {
  const policyPath = resolve(webRoot, "src/lib/password-policy.js");
  assert.equal(existsSync(policyPath), true, "shared password policy helper is missing");
  const { passwordPolicyError } = await vite.ssrLoadModule("/src/lib/password-policy.js?t1-5-policy=" + Date.now());

  assert.equal(passwordPolicyError(""), "");
  assert.equal(passwordPolicyError("abcdefghij"), "需包含大小写字母、数字或符号中的至少两类");
  assert.equal(passwordPolicyError("Abcdefghij"), "");
  assert.equal(passwordPolicyError("a".repeat(257) + "1"), "密码过长");
});

test("Register requires a matching password confirmation", async () => {
  const Register = await loadPage("Register");
  const markup = render(Register, "/register");
  const policyPath = resolve(webRoot, "src/lib/password-policy.js");
  assert.equal(existsSync(policyPath), true, "shared password policy helper is missing");
  const { passwordConfirmationError } = await vite.ssrLoadModule("/src/lib/password-policy.js?t1-5-confirm=" + Date.now());

  assert.equal((markup.match(/type="password"/g) || []).length, 2);
  assert.ok(markup.includes('name="confirmPassword"'));
  assert.equal(passwordConfirmationError("", ""), "");
  assert.equal(passwordConfirmationError("Abcdefghij", "Abcdefghik"), "两次输入的密码不一致");
  assert.equal(passwordConfirmationError("Abcdefghij", "Abcdefghij"), "");
});

test("T1.5 auth CSS protects touch, responsive layout, and reduced motion", () => {
  for (const selector of [
    ".auth-mode",
    ".auth-card__top",
    ".auth-offline",
    ".auth-boundary",
    ".auth-aside__visual",
    ".auth-fragment",
    ".auth-trace",
  ]) {
    assert.ok(pagesCss.includes(selector), "missing CSS selector " + selector);
  }
  assert.ok(pagesCss.includes("@media (prefers-reduced-motion: reduce)"));
  assert.match(pagesCss, /\.auth[^}]*min-height:\s*44px/s);
  assert.ok(pagesCss.includes("@media (max-width: 880px)"));
});

test("Register keeps server-owned roles out of the public form", () => {
  const source = readFileSync(resolve(webRoot, "src/pages/Register.jsx"), "utf8");
  assert.equal(source.includes("role-pick"), false);
  assert.equal(source.includes('name="role"'), false);
});

test("dedicated auth Edge smoke covers both routes and four viewports", () => {
  const smokePath = resolve("app/auth-visual-smoke.mjs");
  assert.equal(existsSync(smokePath), true, "auth visual smoke is missing");
  const source = readFileSync(smokePath, "utf8");
  for (const value of [
    '"/login"',
    '"/register"',
    "[1440, 900]",
    "[1100, 720]",
    "[820, 800]",
    "[390, 844]",
    "ArrowRight",
    "prefers-reduced-motion",
    "auth-pages-behavior.json",
    "离线打开本地项目",
  ]) {
    assert.ok(source.includes(value), "auth smoke is missing " + value);
  }
});
