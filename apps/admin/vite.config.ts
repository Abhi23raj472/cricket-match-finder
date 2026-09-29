import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@cmf/shared': path.resolve(__dirname, '../../packages/shared/src') } },
  server: { port: 5173, proxy: { '/v1': 'http://localhost:3000' } },
});
