import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  root: path.resolve(__dirname, "app"),
  server: {
    port: 3001,
    strictPort: true
  },
  css: {
    postcss: path.resolve(__dirname, "app/postcss.config.js"),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "app"),
      "@shared": path.resolve(__dirname, "shared"),
    },
  },
  build: {
    outDir: path.resolve(__dirname, "dist/alt"),
    emptyOutDir: true,
  },
}); 