import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// `npm run dev`        -> http://localhost:5173 (camera works on localhost)
// `npm run dev:https`  -> https://<your-LAN-ip>:5173 (needed to test the camera from a phone)
export default defineConfig(async () => {
  const plugins = [react()];
  if (process.env.HTTPS) plugins.push((await import("@vitejs/plugin-basic-ssl")).default());
  return {
    plugins,
    server: {
      host: process.env.HTTPS ? true : "localhost",
      proxy: { "/api": { target: "http://localhost:4000", changeOrigin: false } },
    },
    build: { sourcemap: false },
  };
});
