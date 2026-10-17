import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    __SMART_READER_GOATCOUNTER_ENABLED__: 'true',
  },
});
