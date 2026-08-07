import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    // Only unit tests. e2e/ is Playwright's and must not be picked up here:
    // Playwright's `test()` and Vitest's `test()` are different runtimes.
    include: ['src/**/*.test.ts'],
  },
});
