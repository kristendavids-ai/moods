import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "/moods/",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/apple-touch-icon.png", "icons/favicon.svg"],
      manifest: {
        name: "MOODS",
        short_name: "MOODS",
        description: "A moodboard and wishlist for clothes.",
        theme_color: "#F4F3EF",
        background_color: "#F4F3EF",
        display: "standalone",
        orientation: "portrait",
        start_url: "/moods/",
        scope: "/moods/",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2,json}"],
        navigateFallback: "/moods/index.html",
      },
    }),
  ],
});
