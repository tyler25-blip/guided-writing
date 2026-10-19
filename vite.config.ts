import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// /api goes to the small judge server (server/index.ts), which holds the API key.
export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/api': 'http://localhost:8787' } },
})
