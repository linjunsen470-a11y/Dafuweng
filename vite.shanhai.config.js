import { defineConfig } from 'vite';
export default defineConfig({
  publicDir: false,
  build: {
    outDir: 'dist-shanhai',
    emptyOutDir: true,
    chunkSizeWarningLimit: 800,
    rolldownOptions: { input: 'shanhai.html' }
  }
});
