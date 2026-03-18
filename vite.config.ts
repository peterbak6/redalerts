import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
// CF_PAGES is set automatically by Cloudflare Pages; use root base there.
export default defineConfig({
  base: process.env.CF_PAGES ? "/" : "/redalerts/",
  plugins: [react()],
});
