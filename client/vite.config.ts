import { defineConfig } from 'vite';

export default defineConfig({
  // host: true exposes the dev server on the LAN so a second device (e.g. a
  // phone on the same wifi) can join for real audio testing.
  server: { host: true, port: 5173 },
  preview: { host: true, port: 4173 },
});
