import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const backendProxy = {
  '/api': {
    target: 'http://127.0.0.1:5000',
    changeOrigin: true,
  },
  '/uploads': {
    target: 'http://127.0.0.1:5000',
    changeOrigin: true,
  },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: backendProxy,
  },
  preview: {
    proxy: backendProxy,
  },
})
