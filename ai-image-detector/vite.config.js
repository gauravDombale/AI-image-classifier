import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  build: {
    target: 'esnext',
    // Vite 8 (Rolldown) requires manualChunks as a function
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('@tensorflow/tfjs-core') || id.includes('@tensorflow/tfjs-backend-webgl') || id.includes('@tensorflow/tfjs-backend-cpu')) {
            return 'tfjs-core';
          }
          if (id.includes('@tensorflow/tfjs') || id.includes('@tensorflow-models')) {
            return 'tfjs';
          }
          if (id.includes('framer-motion')) {
            return 'framer';
          }
          if (id.includes('@sentry')) {
            return 'sentry';
          }
        },
      },
    },
  },
  optimizeDeps: {
    include: ['@tensorflow/tfjs', '@tensorflow-models/mobilenet'],
  },
});
