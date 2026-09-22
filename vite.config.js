import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  server: {
    port: 5176,
    // Dev-only proxy for the local mock-S3 mirror; never used in a production build.
    proxy: mode === 'development' ? {
      '/mock-s3': 'http://localhost:5090'
    } : undefined,
  },
}))
