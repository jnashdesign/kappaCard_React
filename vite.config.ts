import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Keep crawler files out of the SPA navigation fallback
      workbox: {
        navigateFallbackDenylist: [/^\/robots\.txt$/, /^\/sitemap\.xml$/],
      },
      includeAssets: [
        'favicon.svg',
        'apple-touch-icon.png',
        'og-image.png',
        'openGraph.png',
        'robots.txt',
        'sitemap.xml',
      ],
      manifest: {
        name: 'Kappa Card',
        short_name: 'Kappa Card',
        description:
          'Make lasting connections in less than 30 seconds. Share complete contact info with a single scan — branded Kappa Card, QR, and live profile.',
        theme_color: '#6d0e0f',
        background_color: '#f3ebe0',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: 'pwa-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
    }),
  ],
});
