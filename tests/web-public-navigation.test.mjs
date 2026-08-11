import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import React from "../web/node_modules/react/index.js";
import { renderToStaticMarkup } from "../web/node_modules/react-dom/server.node.js";
import { StaticRouter } from "../web/node_modules/react-router-dom/server.mjs";
import { createServer as createViteServer } from "../web/node_modules/vite/dist/node/index.js";

const webRoot = resolve("web");
const headerSource = readFileSync(resolve(webRoot, "src/components/SiteHeader.jsx"), "utf8");
const baseCss = readFileSync(resolve(webRoot, "src/styles/base.css"), "utf8");
const pagesCss = readFileSync(resolve(webRoot, "src/styles/pages.css"), "utf8");
const smokeSource = readFileSync(resolve("app/home-hero-visual-smoke.mjs"), "utf8");
let vite;
let pricingHeaderMarkup;

test.before(async () => {
  vite = await createViteServer({
    root: webRoot,
    appType: "custom",
    logLevel: "silent",
    resolve: { dedupe: ["react", "react-dom"] },
    server: { middlewareMode: true },
  });

  const [{ default: SiteHeader }, { AuthProvider }] = await Promise.all([
    vite.ssrLoadModule("/src/components/SiteHeader.jsx?navigation-contract=" + Date.now()),
    vite.ssrLoadModule("/src/lib/auth.jsx"),
  ]);
  pricingHeaderMarkup = renderToStaticMarkup(
    React.createElement(
      StaticRouter,
      { location: "/pricing" },
      React.createElement(AuthProvider, null, React.createElement(SiteHeader)),
    ),
  );
});

test.after(async () => {
  await vite?.close();
});

test("public navigation exposes one current route with a 2px indicator", () => {
  const currentLinks = [...pricingHeaderMarkup.matchAll(/<a\b([^>]*)>/g)]
    .filter(([, attributes]) => attributes.includes("aria-current=\"page\""));

  assert.equal(currentLinks.length, 1);
  assert.match(currentLinks[0][1], /href="\/pricing"/);
  assert.match(
    pagesCss,
    /\.nav-links a\[aria-current="page"\]::after\s*\{[\s\S]*?height:\s*2px;/,
  );
});

test("public navigation keeps download primary and account actions secondary", () => {
  const anchors = [...pricingHeaderMarkup.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)];
  const primaryAnchors = anchors.filter(([, attributes]) => /class="[^"]*btn-primary/.test(attributes));
  const registerAnchor = anchors.find(([, attributes]) => attributes.includes('href="/register"'));

  assert.equal(primaryAnchors.length, 1);
  assert.match(primaryAnchors[0][1], /href="\/download"/);
  assert.match(primaryAnchors[0][2].replace(/<[^>]+>/g, ""), /下载桌面端/);
  assert.ok(registerAnchor, "the secondary registration route must remain available");
  assert.doesNotMatch(registerAnchor[1], /btn-primary/);
  assert.match(headerSource, /className="mobile-nav__account"/);

  const compactStart = pagesCss.indexOf("@media (max-width: 880px)");
  const mobileStart = pagesCss.indexOf("@media (max-width: 640px)", compactStart);
  const compactRules = pagesCss.slice(compactStart, mobileStart);
  assert.match(compactRules, /\.nav-account-action\s*\{\s*display:\s*none;/);
});

test("public navigation compacts after 40px with a passive cleaned-up listener", () => {
  assert.match(headerSource, /const SCROLL_THRESHOLD = 40;/);
  assert.match(headerSource, /window\.scrollY > SCROLL_THRESHOLD/);
  assert.match(
    headerSource,
    /window\.addEventListener\("scroll",\s*syncScrolled,\s*\{ passive: true \}\);/,
  );
  assert.match(
    headerSource,
    /return \(\) => window\.removeEventListener\("scroll",\s*syncScrolled\);/,
  );
  assert.match(headerSource, /scrolled \? " nav--scrolled" : ""/);
  assert.match(headerSource, /scrolled \? " glass-frost" : ""/);
  assert.match(
    pagesCss,
    /\.nav-inner\s*\{[\s\S]*?transition:[\s\S]*?transform var\(--dur-3\) var\(--ease\)/,
  );
  assert.match(pagesCss, /\.nav--scrolled \.nav-inner\s*\{[\s\S]*?transform:/);
  assert.match(
    baseCss,
    /@media \(prefers-reduced-motion: reduce\)[\s\S]*?transition-duration:\s*0\.001ms !important;/,
  );
});

test("Home Edge smoke records the public navigation threshold and state", () => {
  assert.match(smokeSource, /async function verifyPublicNavigation\(cdp\)/);
  assert.match(smokeSource, /window\.scrollTo\(0, 40\)/);
  assert.match(smokeSource, /window\.scrollTo\(0, 41\)/);
  assert.match(smokeSource, /aria-current=\\"page\\"/);
  assert.match(smokeSource, /\.nav-download/);
  assert.match(smokeSource, /compactHeight/);
  assert.match(smokeSource, /compactBoxShadow/);
  assert.match(smokeSource, /navigationTransitionDuration/);
  assert.match(smokeSource, /const publicNavigation = await verifyPublicNavigation\(cdp\)/);
  assert.match(smokeSource, /publicNavigation,/);
});

test("Home Edge smoke protects the 881px desktop navigation edge", () => {
  assert.match(smokeSource, /width:\s*881,/);
  assert.match(smokeSource, /desktopEdge/);
});

test("Home Edge smoke opens the menu at 390px and focuses its first link", () => {
  assert.match(smokeSource, /const mobileWidths = \[820, 390\];/);
  assert.match(
    smokeSource,
    /document\.activeElement === document\.querySelector\(["']#mobile-site-nav \.mobile-nav__link["']\)/,
  );
});

test("Home Edge smoke locks the authenticated primary CTA contract", () => {
  assert.match(smokeSource, /Page\.addScriptToEvaluateOnNewDocument/);
  assert.match(smokeSource, /authenticatedPrimaryCount/);
  assert.match(smokeSource, /authenticatedPrimaryHref/);
});
