import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@cmf/shared': path.resolve(__dirname, '../../packages/shared/src') },
    dedupe: ['react', 'react-dom'],
  },
  test: { environment: 'jsdom', setupFiles: ['./src/test/setup.ts'], globals: true },
});
