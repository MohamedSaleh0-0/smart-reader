import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  root: process.cwd(),
  base: './',
  plugins: [react()],
  define: {
    __SMART_READER_GOATCOUNTER_ENABLED__: 'false',
  },
  build: {
    outDir: resolve(process.cwd(), '../.smart-reader-portable-stage'),
    emptyOutDir: true,
    assetsInlineLimit: 100_000_000,
    chunkSizeWarningLimit: 700,
    rolldownOptions: {
      output: { codeSplitting: false },
    },
  },
});
