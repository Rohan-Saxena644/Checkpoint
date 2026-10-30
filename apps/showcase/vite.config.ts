import { defineConfig } from "vite";
import path from "node:path";
export default defineConfig({
  root: path.resolve("apps/showcase"),
  build: { outDir: "dist", emptyOutDir: true },
  resolve: {
    alias: { "@checkpoint/core": path.resolve("packages/core/src/index.ts") },
  },
  server: { host: "127.0.0.1" },
});
