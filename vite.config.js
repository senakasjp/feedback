import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// https://vite.dev/config/
export default defineConfig({
  plugins: [svelte()],
  optimizeDeps: {
    exclude: ['@napi-rs/canvas'],
  },
  build: {
    rollupOptions: { external: ['@napi-rs/canvas'] },
  },
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toLocaleString('en-NZ', { dateStyle: 'medium', timeStyle: 'short' })),
  },
})
