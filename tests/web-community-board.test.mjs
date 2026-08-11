import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import React from "../web/node_modules/react/index.js";
import { renderToStaticMarkup } from "../web/node_modules/react-dom/server.node.js";
import { StaticRouter } from "../web/node_modules/react-router-dom/server.mjs";
import { createServer as createViteServer } from "../web/node_modules/vite/dist/node/index.js";

const webRoot = resolve("web");
const source = readFileSync(resolve(webRoot, "src/pages/app/CommunityBoard.jsx"), "utf8");
let vite;
let markup;

test.before(async () => {
  vite = await createViteServer({
    root: webRoot,
    appType: "custom",
    logLevel: "silent",
    resolve: { dedupe: ["react", "react-dom"] },
    server: { middlewareMode: true },
  });
  const [{ default: CommunityBoard }, { AuthProvider }] = await Promise.all([
    vite.ssrLoadModule("/src/pages/app/CommunityBoard.jsx?community-contract=" + Date.now()),
    vite.ssrLoadModule("/src/lib/auth.jsx"),
  ]);
  markup = renderToStaticMarkup(
    React.createElement(
      StaticRouter,
      { location: "/app/community" },
      React.createElement(AuthProvider, null, React.createElement(CommunityBoard)),
    ),
  );
});

test.after(async () => {
  await vite?.close();
});

test("CommunityBoard renders a feed selector and a contribution leaderboard", () => {
  assert.match(markup, /社区/);
  assert.match(markup, />最新</);
  assert.match(markup, />热门</);
  assert.match(markup, /贡献榜/);
  assert.match(markup, /发起话题/);
});

test("CommunityBoard sorts and ranks from real fields only, never fabricated", () => {
  assert.match(source, /const sortedPosts = useMemo/);
  assert.match(source, /const leaderboard = useMemo/);
  assert.match(source, /replies\?\.length/);
  assert.match(source, /createdAt/);
  // Leaderboard tallies real authored posts/replies, not invented scores.
  assert.match(source, /bump\(post\.author, 1\)/);
  assert.doesNotMatch(source, /"Bob"|"Alice"|"Miro"/);
});
