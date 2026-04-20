import path from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      // En dev on proxifie l'API backend pour éviter CORS.
      // On utilise 127.0.0.1 (IPv4 explicite) plutôt que `localhost` —
      // sur macOS `localhost` résout en IPv6 (::1) en premier, et
      // uvicorn --reload ne binde que IPv4 par défaut.
      '/api': 'http://127.0.0.1:8000',
      '/health': 'http://127.0.0.1:8000',
      '/preview': 'http://127.0.0.1:8000',
    },
  },
})
