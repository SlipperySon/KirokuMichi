import { defineConfig, devices } from '@playwright/test'

const browserChannel = process.env.PLAYWRIGHT_CHANNEL === 'bundled'
  ? undefined
  : process.env.PLAYWRIGHT_CHANNEL || 'chrome'

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'tools/qa/out/playwright-report' }]],
  outputDir: 'tools/qa/out/test-results',
  use: {
    baseURL: 'http://127.0.0.1:5177',
    ...(browserChannel ? { channel: browserChannel } : {}),
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'npm run start',
      url: 'http://127.0.0.1:3001/api/health',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 5177',
      url: 'http://127.0.0.1:5177',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
  projects: [
    {
      name: 'desktop-chrome',
      use: { viewport: { width: 1280, height: 900 } },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],
})
