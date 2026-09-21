// Bundle apps/desktop/src/ide.jsx → app/ide/ide.js so the Node server
// can serve it. IMPORTANT: output to app/ide/ (NOT app/public/ide/) —
// Vite's web build uses emptyOutDir: true on app/public/ and would wipe
// the IDE files every time the web build runs. The server routes /ide/
// from the dedicated app/ide/ directory instead.

import { build } from "esbuild";
import { mkdirSync, copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const entry = join(root, "apps", "desktop", "src", "ide.jsx");
const outDir = join(root, "app", "ide");
const htmlSrc = join(root, "apps", "desktop", "src", "ide.html");
const cssSrc = join(root, "apps", "desktop", "src", "assets", "ide.css");
const outCss = join(outDir, "ide.css");

mkdirSync(outDir, { recursive: true });

await build({
  entryPoints: [entry],
  bundle: true,
  format: "esm",
  platform: "browser",
  target: ["es2022"],
  outfile: join(outDir, "ide.js"),
  jsx: "automatic",
  loader: {
    ".js": "jsx",
    ".jsx": "jsx",
    ".css": "css",
    ".ttf": "file",
    ".woff": "file",
    ".woff2": "file",
    ".svg": "file",
    ".png": "file",
  },
  alias: {
    "react": join(root, "web", "node_modules", "react"),
    "react-dom": join(root, "web", "node_modules", "react-dom"),
    "react-dom/client": join(root, "web", "node_modules", "react-dom", "client.js"),
    "@monaco-editor/react": join(root, "web", "node_modules", "@monaco-editor", "react"),
    "monaco-editor": join(root, "web", "node_modules", "monaco-editor"),
    "katex": join(root, "web", "node_modules", "katex"),
    "pdfjs-dist": join(root, "web", "node_modules", "pdfjs-dist"),
  },
  // Minify by default (pass --dev to keep it readable); ship without source
  // maps unless explicitly developing, so the distributed IDE bundle is not
  // trivially reversible.
  minify: !process.argv.includes("--dev"),
  sourcemap: process.argv.includes("--dev") || process.env.PAPER_OS_DEV === "1",
  logLevel: "info",
});

// esbuild emits monaco (+ imported) CSS next to ide.js. Keep it, then append
// our chrome styles so copyFileSync does not wipe editor.main.css.
const monacoCss = existsSync(outCss) ? readFileSync(outCss, "utf8") : "";
const chromeCss = existsSync(cssSrc) ? readFileSync(cssSrc, "utf8") : "";
writeFileSync(outCss, `${monacoCss}\n\n/* ── Paper OS chrome ── */\n${chromeCss}\n`);

if (existsSync(htmlSrc)) copyFileSync(htmlSrc, join(outDir, "index.html"));

const pdfBuild = join(root, "web", "node_modules", "pdfjs-dist", "build");
for (const name of ["pdf.mjs", "pdf.worker.min.mjs"]) {
  const src = join(pdfBuild, name);
  if (existsSync(src)) copyFileSync(src, join(outDir, name));
}

console.log(`IDE bundled → ${outDir}/ide.js`);
