import { readFileSync } from "node:fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Single source of truth for the shown product version: the root package.json.
const rootPkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf-8"));

// Build the React app directly into app/public so the existing Node server
// (app/server.mjs) and the Windows launcher keep serving static files with no
// new runtime step. Relative base keeps assets working on any local port.
export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(rootPkg.version),
  },
  // Absolute base so hashed assets resolve on deep client routes (/app/account)
  // served via the server's SPA history fallback.
  base: "/",
  server: {
    port: 5173,
    proxy: {
      "/api": "http://127.0.0.1:3719",
    },
  },
  build: {
    outDir: "../app/public",
    emptyOutDir: true,
    chunkSizeWarningLimit: 1200,
    // Ship minified, no source maps: reduces bundle size and avoids handing
    // out readable source for a distributed product. Set PAPER_OS_DEV=1 to
    // re-enable maps locally for debugging.
    minify: "esbuild",
    sourcemap: process.env.PAPER_OS_DEV === "1",
  },
  esbuild: {
    // Drop console/debugger from the shipped web bundle.
    drop: process.env.PAPER_OS_DEV === "1" ? [] : ["debugger"],
  },
});
