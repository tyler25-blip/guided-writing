import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// /api goes to the small judge server (server/index.ts), which holds the API key.
// PAGES=1 builds the public GitHub Pages site (served under /guided-writing/, no server: the AI runs in the browser).
export default defineConfig({
  base: process.env.PAGES ? '/guided-writing/' : '/',
  plugins: [react()],
  server: { proxy: { '/api': 'http://localhost:8787' } },
})
