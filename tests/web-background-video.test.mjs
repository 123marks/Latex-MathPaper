import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createServer } from "node:net";
import test from "node:test";
import React from "../web/node_modules/react/index.js";
import { createServer as createViteServer } from "../web/node_modules/vite/dist/node/index.js";

const webRoot = resolve("web");
const baseCss = readFileSync(
  new URL("../web/src/styles/base.css", import.meta.url),
  "utf8",
);
const smokeSource = readFileSync(
  new URL("../app/kitchensink-visual-smoke.mjs", import.meta.url),
  "utf8",
);
let vite;
const dispatcherRef =
  React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentDispatcher;

test.before(async () => {
  vite = await createViteServer({
    root: webRoot,
    appType: "custom",
    logLevel: "silent",
    resolve: { dedupe: ["react", "react-dom"] },
    server: { middlewareMode: true },
  });
});

test.after(async () => {
  await vite?.close();
});

async function loadResponseGuard() {
  const module = await vite.ssrLoadModule("/src/components/BackgroundVideo.jsx");
  return module.isUsableVideoResponse;
}

function renderComponentWithEffects(Component) {
  const effects = [];
  const layoutEffects = [];
  const dispatcher = {
    useEffect(effect) {
      effects.push(effect);
    },
    useLayoutEffect(effect) {
      layoutEffects.push(effect);
    },
    useState(initialValue) {
      const value = typeof initialValue === "function" ? initialValue() : initialValue;
      return [value, () => {}];
    },
  };

  const previous = dispatcherRef.current;
  dispatcherRef.current = dispatcher;
  let result;
  try {
    result = Component();
  } finally {
    dispatcherRef.current = previous;
  }

  const cleanups = [...layoutEffects, ...effects]
    .map((effect) => effect())
    .filter((cleanup) => typeof cleanup === "function");
  return {
    result,
    cleanup() {
      for (const cleanup of cleanups.reverse()) cleanup();
    },
  };
}

function freePort() {
  return new Promise((resolvePort, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      const port = typeof address === "object" ? address.port : 0;
      probe.close(() => resolvePort(port));
    });
  });
}

test("video response guard accepts a successful video MIME response", async () => {
  const isUsableVideoResponse = await loadResponseGuard();

  assert.equal(
    isUsableVideoResponse(new Response(null, {
      status: 200,
      headers: { "content-type": "video/mp4" },
    })),
    true,
  );
});

test("video response guard rejects an HTML SPA fallback", async () => {
  const isUsableVideoResponse = await loadResponseGuard();

  assert.equal(
    isUsableVideoResponse(new Response(null, {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
    })),
    false,
  );
});

test("video response guard rejects failed or untyped responses", async () => {
  const isUsableVideoResponse = await loadResponseGuard();

  assert.equal(
    isUsableVideoResponse(new Response(null, {
      status: 404,
      headers: { "content-type": "video/mp4" },
    })),
    false,
  );
  assert.equal(isUsableVideoResponse(new Response(null, { status: 200 })), false);
});

test("reduced motion skips the optional video probe", async () => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const previousFetch = Object.getOwnPropertyDescriptor(globalThis, "fetch");
  let fetchCalls = 0;
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      matchMedia: () => ({
        matches: true,
        addEventListener() {},
        removeEventListener() {},
      }),
    },
  });
  Object.defineProperty(globalThis, "fetch", {
    configurable: true,
    value: async () => {
      fetchCalls += 1;
      return new Response(null, {
        status: 200,
        headers: { "content-type": "video/mp4" },
      });
    },
  });

  let rendered;
  try {
    const module = await vite.ssrLoadModule(
      `/src/components/BackgroundVideo.jsx?reduced-motion=${Date.now()}`,
    );
    rendered = renderComponentWithEffects(module.default);
    await Promise.resolve();

    assert.equal(rendered.result, null);
    assert.equal(fetchCalls, 0);
  } finally {
    rendered?.cleanup();
    if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
    else delete globalThis.window;
    if (previousFetch) Object.defineProperty(globalThis, "fetch", previousFetch);
    else delete globalThis.fetch;
  }
});

test("production server exposes optional background media with usable MIME types", async (t) => {
  const port = await freePort();
  const publicVideo = resolve("app/public/bg-space.mp4");
  const publicPoster = resolve("app/public/bg-space.jpg");
  const publicAlternatePoster = resolve("app/public/bg-space.jpeg");
  const createdVideo = !existsSync(publicVideo);
  const createdPoster = !existsSync(publicPoster);
  const createdAlternatePoster = !existsSync(publicAlternatePoster);
  const stateRoot = mkdtempSync(join(tmpdir(), "paperos-background-video-"));
  const previousPort = process.env.PAPER_OS_PORT;
  const previousDataDir = process.env.PAPER_OS_DATA_DIR;

  let serverModule;
  t.after(async () => {
    if (serverModule?.server.listening) {
      await new Promise((resolveClose) => serverModule.server.close(resolveClose));
    }
    if (createdVideo) rmSync(publicVideo, { force: true });
    if (createdPoster) rmSync(publicPoster, { force: true });
    if (createdAlternatePoster) rmSync(publicAlternatePoster, { force: true });
    rmSync(stateRoot, { force: true, recursive: true });
    if (previousPort === undefined) delete process.env.PAPER_OS_PORT;
    else process.env.PAPER_OS_PORT = previousPort;
    if (previousDataDir === undefined) delete process.env.PAPER_OS_DATA_DIR;
    else process.env.PAPER_OS_DATA_DIR = previousDataDir;
  });

  if (createdVideo) {
    writeFileSync(publicVideo, Buffer.from("00000018ftypmp42", "ascii"));
  }
  if (createdPoster) {
    writeFileSync(publicPoster, Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
  }
  if (createdAlternatePoster) {
    writeFileSync(publicAlternatePoster, Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
  }
  process.env.PAPER_OS_PORT = String(port);
  process.env.PAPER_OS_DATA_DIR = join(stateRoot, "data");
  serverModule = await import("../app/server.mjs?background-video=" + Date.now());
  await new Promise((resolveListen, reject) => {
    const listeningServer = serverModule.startServer();
    listeningServer.once("listening", resolveListen);
    listeningServer.once("error", reject);
  });

  const response = await fetch("http://127.0.0.1:" + port + "/bg-space.mp4", { method: "HEAD" });
  const posterResponse = await fetch(
    "http://127.0.0.1:" + port + "/bg-space.jpg",
    { method: "HEAD" },
  );
  const alternatePosterResponse = await fetch(
    "http://127.0.0.1:" + port + "/bg-space.jpeg",
    { method: "HEAD" },
  );
  const isUsableVideoResponse = await loadResponseGuard();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "video/mp4");
  assert.equal(isUsableVideoResponse(response), true);
  assert.equal(posterResponse.status, 200);
  assert.equal(alternatePosterResponse.status, 200);
  assert.deepEqual(
    [
      posterResponse.headers.get("content-type"),
      alternatePosterResponse.headers.get("content-type"),
    ],
    ["image/jpeg", "image/jpeg"],
  );
});

test("video and scrim backgrounds are fixed outside document flow", () => {
  assert.match(
    baseCss,
    /\.bg-video\s*,\s*\.bg-scrim\s*\{[^}]*position:\s*fixed;[^}]*inset:\s*0;[^}]*width:\s*100%;[^}]*height:\s*100%;[^}]*pointer-events:\s*none;[^}]*\}/s,
  );
  assert.match(
    baseCss,
    /\.bg-video\s*\{[^}]*z-index:\s*calc\(var\(--z-bg\)\s*\+\s*1\);[^}]*object-fit:\s*cover;[^}]*opacity:\s*0?\.\d+;[^}]*\}/s,
  );
  assert.match(
    baseCss,
    /\.bg-scrim\s*\{[^}]*z-index:\s*calc\(var\(--z-bg\)\s*\+\s*2\);[^}]*background:\s*(?:linear|radial)-gradient\([^}]+\);[^}]*\}/s,
  );
});

test("visual smoke resets smooth scrolling before collecting viewport metrics", () => {
  const disableSmoothScroll = smokeSource.indexOf(
    'document.documentElement.style.scrollBehavior = "auto"',
  );
  const resetScroll = smokeSource.indexOf("window.scrollTo(0, 0)", disableSmoothScroll);
  const waitForReset = smokeSource.indexOf(
    'waitForExpression(cdp, "window.scrollY === 0", "page scroll reset")',
    resetScroll,
  );
  const collectMetrics = smokeSource.indexOf("const metrics = await evaluate", waitForReset);

  assert.ok(disableSmoothScroll >= 0, "smooth scrolling must be disabled for capture");
  assert.ok(resetScroll > disableSmoothScroll, "scroll reset must follow the style override");
  assert.ok(waitForReset > resetScroll, "capture must wait for scroll reset");
  assert.ok(collectMetrics > waitForReset, "metrics must be collected after scroll reset");
});
