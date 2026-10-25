import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  server: { port: 5197, strictPort: true, host: '127.0.0.1' },
  preview: { port: 4197, strictPort: true, host: '127.0.0.1' },
  build: { target: 'es2022', chunkSizeWarningLimit: 1200 },
  test: { include: ['tests/**/*.test.ts'], environment: 'node', testTimeout: 180000 },
});
