import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  mode: 'analyze',
  build: {
    emptyOutDir: false,
    lib: {
      entry: resolve(import.meta.dirname, 'assets/js/neon-auth-client.js'),
      formats: ['es'],
      fileName: () => 'neon-auth-client.js'
    },
    outDir: resolve(import.meta.dirname, 'assets/dist'),
    rollupOptions: {
      plugins: [visualizer({
        open: true,
        gzipSize: true,
        brotliSize: true,
        filename: resolve(import.meta.dirname, 'dist/stats.html')
      })]
    }
  }
});
