import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    https: false, // Use HTTP for easier testing
    host: true
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets'
  }
})
