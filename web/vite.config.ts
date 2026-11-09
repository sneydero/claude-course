import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// La UI cuelga de /app/ para no chocar con el comodín /:code del backend.
// changeOrigin: el backend construye shortUrl con el Host de la petición.
const backend = { target: 'http://localhost:3000', changeOrigin: true };

export default defineConfig({
  base: '/app/',
  plugins: [react()],
  test: { environment: 'jsdom', setupFiles: ['./src/test/setup.ts'], globals: false },
  server: {
    port: 5173,
    proxy: { '/api': backend, '/auth': backend, '/health': backend },
  },
});
