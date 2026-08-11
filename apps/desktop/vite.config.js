import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Tauri loads the bundled web/ via file://, so base must be "./".
// Output goes to apps/desktop/dist so Tauri can load it directly.
export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    target: "es2020",
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
