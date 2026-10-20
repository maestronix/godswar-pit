import { defineConfig } from 'vitest/config';

// `base: './'` keeps the build working both on a domain root and under a
// repository sub-path (https://user.github.io/godswar-pit/).
export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    assetsInlineLimit: 4096,
    chunkSizeWarningLimit: 400,
  },
  server: {
    port: 5173,
    open: false,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
