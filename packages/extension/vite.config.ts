import { defineConfig } from 'vite';
import { resolve } from 'path';
import { copyFileSync, existsSync, mkdirSync } from 'fs';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      input: {
        background: resolve(__dirname, 'src/background/index.ts'),
        'webapp-bridge': resolve(__dirname, 'src/content/webapp-bridge.ts'),
        'shareworks-bridge': resolve(__dirname, 'src/content/shareworks-bridge.ts'),
        popup: resolve(__dirname, 'src/popup/index.html'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: '[name].[ext]',
      },
    },
  },
  plugins: [
    {
      name: 'copy-extension-assets',
      closeBundle() {
        if (!existsSync('dist')) {
          mkdirSync('dist', { recursive: true });
        }
        copyFileSync('manifest.json', 'dist/manifest.json');
        if (existsSync('dist/src/popup/index.html')) {
          copyFileSync('dist/src/popup/index.html', 'dist/popup.html');
        }
      },
    },
  ],
});
