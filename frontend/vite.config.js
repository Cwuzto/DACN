import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

function getPackageName(id) {
  const normalized = id.replace(/\\/g, '/')
  const match = normalized.match(/\/node_modules\/([^/]+)/)
  if (!match) return null
  if (match[1].startsWith('@')) {
    const scopedMatch = normalized.match(/\/node_modules\/(@[^/]+\/[^/]+)/)
    return scopedMatch ? scopedMatch[1] : match[1]
  }
  return match[1]
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const pkg = getPackageName(id)
          if (!pkg) return

          if (
            pkg === 'react' ||
            pkg === 'react-dom' ||
            pkg === 'react-router' ||
            pkg === 'react-router-dom' ||
            pkg === 'scheduler'
          ) {
            return 'vendor-react'
          }

          if (pkg.startsWith('@tanstack/')) {
            return 'vendor-query'
          }

          if (pkg === '@ant-design/icons' || pkg === '@ant-design/icons-svg') {
            return 'vendor-icons'
          }

          if (
            pkg === 'xlsx' ||
            pkg === 'codepage' ||
            pkg === 'wmf' ||
            pkg === 'word'
          ) {
            return 'vendor-xlsx'
          }
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
})


