import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  webServer: {
    command: 'pnpm build && pnpm preview',
    port: 4173,
  },
  testDir: 'e2e',
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
})
