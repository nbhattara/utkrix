import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [react()],
    server: {
      port: Number(env.VITE_DEV_PORT) || 5175,
      strictPort: true,
      allowedHosts: ['.localhost', '.lvh.me', '.nip.io'],
      proxy: {
        "/api": {
          target: env.API_PROXY_TARGET || "http://localhost:5000",
          changeOrigin: true,
        },
        "/uploads": {
          target: env.API_PROXY_TARGET || "http://localhost:5000",
          changeOrigin: true,
        },
      },
    },
  };
});
