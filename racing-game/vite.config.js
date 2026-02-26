import { defineConfig } from 'vite';

export default defineConfig({
  assetsInclude: ['**/*.glb'], // Tells Vite to treat .glb as an asset URL
});