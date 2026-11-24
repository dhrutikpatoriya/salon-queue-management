import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const backendOrigin = loadEnv(mode, '.', 'SALON_DEV_').SALON_DEV_BACKEND_ORIGIN || 'http://localhost:5001';

  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: backendOrigin,
          changeOrigin: true
        },
        '/socket.io': {
          target: backendOrigin,
          ws: true
        }
      }
    }
  };
});
