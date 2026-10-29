import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Frontend-only SPA. No proxy, no API routes.
export default defineConfig({
  plugins: [react()],
});
