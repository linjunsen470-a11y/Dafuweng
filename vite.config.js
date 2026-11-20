import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  resolve: { alias: [{ find: /^three$/, replacement: fileURLToPath(new URL('./node_modules/three/src/Three.js', import.meta.url)) }] },
  build: {
    chunkSizeWarningLimit: 550,
    rolldownOptions: {
      input: { main: 'index.html' },
      output: {
        codeSplitting: {
          groups: [
            { name: 'shader-library', test: /three[/\\]src[/\\]renderers[/\\]shaders[/\\]ShaderChunk/, priority: 30 },
            { name: 'game-rules', test: /src[/\\]game[/\\]/, priority: 10 },
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
