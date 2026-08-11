import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    chunkSizeWarningLimit: 550,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'three-engine', test: /node_modules[\\/]three[\\/]/, priority: 20 },
            { name: 'celebration', test: /node_modules[\\/]canvas-confetti[\\/]/, priority: 20 }
          ]
        }
      }
    }
  },
  server: {
    port: 5173,
    open: false
  }
});
