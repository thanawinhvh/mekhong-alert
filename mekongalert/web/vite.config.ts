import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  // allowedHosts: true so the cloudflared tunnel's Host header isn't rejected
  // during LIFF phone testing (see README) — dev-only, not shipped to prod.
  server: { port: 5173, allowedHosts: ["specialties-digital-answered-penny.trycloudflare.com"] },
});
