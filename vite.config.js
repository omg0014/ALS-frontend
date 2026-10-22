import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// In development the API and live updates run in ../backend on :4000.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:4000',
      '/socket.io': { target: 'http://localhost:4000', ws: true },
    },
  },
})
