import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const pages = ['index', 'counter', 'dashboard', 'settings', 'privacy', '404', '500'];

export default defineConfig({
  base: process.env.KIRANA_BASE || '/kirana-vaani/',
  server: { host: '127.0.0.1', port: 8000, strictPort: true },
  build: {
    rolldownOptions: {
      input: Object.fromEntries(pages.map((page) => [
        page, fileURLToPath(new URL(`./${page}.html`, import.meta.url)),
      ])),
    },
  },
});
