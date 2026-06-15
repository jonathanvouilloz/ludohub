import { sveltekit } from '@sveltejs/kit/vite'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
  ssr: {
    // bits-ui expose des .svelte bruts : forcer Vite à les compiler au lieu
    // de les externaliser (sinon Node lève ERR_UNKNOWN_FILE_EXTENSION ".svelte" en SSR).
    noExternal: ['bits-ui'],
  },
  test: {
    include: ['src/**/*.{test,spec}.{js,ts}'],
    environment: 'node',
  },
})
