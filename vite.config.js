import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// Serve the app from a sub-path by setting VITE_BASE_PATH at build time (e.g.
// /rekyc/ on Amplify). Unset = domain root, which is what local dev uses.
const rawBase = process.env.VITE_BASE_PATH || '/'
const base = `/${rawBase.replace(/^\/+|\/+$/g, '')}/`.replace(/^\/\/$/, '/')

export default defineConfig(({ mode }) => ({
  base,
  plugins: [react()],
  server: {
    port: 5176,
    // Dev-only proxy for the local mock-S3 mirror; never used in a production build.
    proxy: mode === 'development' ? {
      '/mock-s3': 'http://localhost:5090'
    } : undefined,
  },
}))
