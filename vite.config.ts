import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  server: {
    host: '127.0.0.1',
    port: 5173,
    watch: {
      ignored: ['**/ref/**', '**/dist/**'],
    },
  },
  // ref/ 目录是参考项目，不应进入依赖扫描
  optimizeDeps: {
    entries: ['index.html'],
  },
  build: {
    target: 'es2020',
    rollupOptions: {
      input: fileURLToPath(new URL('./index.html', import.meta.url)),
    },
  },
});
