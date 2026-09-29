import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@cmf/shared': path.resolve(__dirname, '../../packages/shared/src') },
    dedupe: ['react', 'react-dom'],
  },
  server: { port: 5174, proxy: { '/v1': 'http://localhost:3000' } },
  preview: { port: 4174, proxy: { '/v1': 'http://localhost:3000' } },
});
