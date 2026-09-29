import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  // GitHub Pages serves the site from /<repo>/; set VITE_BASE=/cricket-match-finder/ for that build
  base: process.env.VITE_BASE ?? '/',
  plugins: [react()],
  resolve: {
    alias: {
      '@cmf/shared': path.resolve(__dirname, '../../packages/shared/src'),
      // Demo build only: reuse the API's pure mock provider and rules in the browser
      '@cmf/api-src': path.resolve(__dirname, '../api/src'),
    },
    dedupe: ['react', 'react-dom'],
  },
  server: { port: 5174, proxy: { '/v1': 'http://localhost:3000' } },
  preview: { port: 4174, proxy: { '/v1': 'http://localhost:3000' } },
});
