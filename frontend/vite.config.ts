import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // In development, forward /api calls to the backend (in Docker, nginx does this instead)
    proxy: { '/api': 'http://localhost:3000' },
  },
});
