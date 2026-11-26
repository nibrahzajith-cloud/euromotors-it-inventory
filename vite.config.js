import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

const rootPkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))
function resolveBuildCommit() {
  const envCommit = process.env.VERCEL_GIT_COMMIT_SHA || process.env.GIT_COMMIT || ''
  if (envCommit.trim()) return envCommit.trim()
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch {
    return 'unknown'
  }
}
const BUILD_COMMIT = resolveBuildCommit()
const BUILD_TIME = new Date().toISOString()

// https://vite.dev/config/
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(rootPkg.version || '2.0.0'),
    __FRONTEND_COMMIT__: JSON.stringify(BUILD_COMMIT),
    __BUILD_TIME__: JSON.stringify(BUILD_TIME),
    __API_CONTRACT__: JSON.stringify('helpdesk-v1'),
  },
  plugins: [
    react(), 
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024
      },
      devOptions: {
        enabled: true
      },
      manifest: {
        name: 'Euro Motors IT DB',
        short_name: 'EM IT',
        description: 'Euro Motors IT Asset Management',
        theme_color: '#0f172a',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          {
            src: '/logo.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/logo.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/xlsx') || id.includes('node_modules/exceljs')) {
            return 'vendor-excel';
          }
          if (id.includes('node_modules/jspdf') || id.includes('node_modules/pdf-lib') || id.includes('node_modules/html2canvas')) {
            return 'vendor-pdf';
          }
          if (id.includes('node_modules/recharts')) {
            return 'vendor-charts';
          }
          if (id.includes('node_modules/html5-qrcode') || id.includes('node_modules/qrcode.react')) {
            return 'vendor-qr';
          }
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/react-router-dom')) {
            return 'vendor-react';
          }
          if (id.includes('node_modules/lucide-react') || id.includes('node_modules/framer-motion')) {
            return 'vendor-ui';
          }
        }
      }
    }
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        secure: false,
      },
      '/uploads': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        secure: false,
      },
      '/local_uploads': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
