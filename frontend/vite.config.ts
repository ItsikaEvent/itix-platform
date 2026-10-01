import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // usePolling : rechargement à chaud fiable dans Docker sous Windows
  server: { host: true, port: 5173, watch: { usePolling: true } },
});
