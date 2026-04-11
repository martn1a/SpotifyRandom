import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import basicSsl from '@vitejs/plugin-basic-ssl'

export default defineConfig({
  plugins: [react(), tailwindcss(), basicSsl()],
  base: '/SpotifyRandom/',
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    https: true,
  },
  test: {
    globals: true,
    environment: 'node',
  },
})
