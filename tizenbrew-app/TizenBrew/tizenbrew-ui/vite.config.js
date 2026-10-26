import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'
import legacy from '@vitejs/plugin-legacy';
import createExternal from 'vite-plugin-external';

// https://vite.dev/config/
export default defineConfig({
  base: '/tizenbrew-ui/dist/',
  plugins: [
    preact(),
    // Legacy build only. The TV opens this page from file://, where the plugin's "modern browser"
    // check never passes, so with modern chunks too BOTH copies of the app ran: every key was handled
    // twice (Back went back two pages) and two clients talked to the service.
    legacy({
      targets: ['chrome 47'],
      renderLegacyChunks: true,
      renderModernChunks: false,
      polyfills: true
    }),
    createExternal({
      externals: {
        'react-native': 'react-native'
      }
    })
  ],
  build: {
    terserOptions: {
      ecma: 5
    },
    target: 'es2015',
    rollupOptions: {
      external: ['react-native'],
    }
  }
})
