import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/*.png'],
      manifest: {
        name: '키키쌤의 마법빗자루',
        short_name: '마법빗자루',
        description: '교사용 업무 관리 앱',
        theme_color: '#f7cfe0',
        background_color: '#fef4f8',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192-v3.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512-v3.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-512-v3.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}']
      }
    })
  ]
})
