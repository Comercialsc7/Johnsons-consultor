import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import { VitePWA } from "vite-plugin-pwa"

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: false,
      includeAssets: ["baseapp.xlsx", "scj_logo.svg", "pwa-192.png", "pwa-512.png"],
      manifest: {
        name: "Consultor SC Johnson",
        short_name: "Consultor",
        description: "Condições comerciais por produto, embalagem e prazo.",
        lang: "pt-BR",
        theme_color: "#DF2626",
        background_color: "#F3F0EB",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "pwa-192.png", sizes: "192x192", type: "image/png" },
          {
            src: "pwa-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,xlsx,ico,webmanifest}"],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: "index.html",
        cleanupOutdatedCaches: true,
      },
    }),
  ],
})
