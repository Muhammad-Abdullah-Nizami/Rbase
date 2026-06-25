import { defineConfig } from 'vite';

export default defineConfig({
  // host: true exposes the dev server on your LAN IP so you can test
  // across two devices (e.g. laptop + phone) on the same network.
  server: { host: true, port: 5173 },
});
