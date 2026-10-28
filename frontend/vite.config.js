import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  build: {
    // Chunk graph (vis-network) memang besar, tapi hanya dimuat saat tab Jalur Tamu dibuka
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        // Pisahkan library besar supaya bundle utama ringan dan cache browser lebih awet
        manualChunks: {
          firebase: ['firebase/app', 'firebase/firestore'],
          graph: ['vis-network/standalone'],
        },
      },
    },
  },
  test: {
    environment: 'node',
  },
});
