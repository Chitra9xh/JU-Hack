import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig({
  plugins: [react(), basicSsl()],
  // host: true exposes the dev server on the LAN: https://<laptop-ip>:6969
  server: { host: true, port: 6969 },
  build: {
    // Only index.html is built; dev.html harnesses are served in dev but never bundled.
    rollupOptions: { input: { main: 'index.html' } },
  },
});
