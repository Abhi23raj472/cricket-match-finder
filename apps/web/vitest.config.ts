import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@cmf/shared': path.resolve(__dirname, '../../packages/shared/src'),
      // Demo build only: reuse the API's pure mock provider and rules in the browser
      '@cmf/api-src': path.resolve(__dirname, '../api/src'),
    },
    dedupe: ['react', 'react-dom'],
  },
  test: { environment: 'jsdom', setupFiles: ['./src/test/setup.ts'], globals: true },
});
