import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  define: {
    'process.env.NODE_ENV': JSON.stringify('production')
  },
  build: {
    emptyOutDir: false,
    lib: {
      entry: resolve(import.meta.dirname, 'assets/js/neon-auth-client.js'),
      formats: ['es'],
      fileName: 'neon-auth-client.[hash]'
    },
    outDir: resolve(import.meta.dirname, 'assets/dist')
  }
});
