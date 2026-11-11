import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// In development the page and the API share one origin: Vite forwards /api to the backend, so the
// session cookie is first-party and no CORS setup is needed.
const API = process.env.VITE_DEV_API ?? "http://localhost:8000";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": { target: API, changeOrigin: false },
    },
  },
});
