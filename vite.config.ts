import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import {version} from './metadata.json';

export default defineConfig(() => {
  return {
    // App version (source of truth: metadata.json) in client code as __APP_VERSION__.
    define: {
      __APP_VERSION__: JSON.stringify(version),
    },
    // The SPA builds into `dist/public/`, NOT `dist/`. `dist/` also holds the bundled
    // backend (`server.cjs`), and the server serves its static root wholesale — so a
    // shared directory published the whole backend at `GET /server.cjs`. Keeping the
    // two apart means the static root contains only what is meant to be public.
    build: {
      outDir: 'dist/public',
      emptyOutDir: true,
    },
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.tsx'],
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
