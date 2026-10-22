import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser', fullyParallel: true, retries: 0,
  use: { baseURL: 'http://127.0.0.1:4173', browserName: 'chromium', screenshot: 'only-on-failure',
    launchOptions: process.env.BUD_BROWSER_EXECUTABLE ? {
      executablePath: process.env.BUD_BROWSER_EXECUTABLE,
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--no-zygote'],
    } : {},
  },
  webServer: [
    { command: 'npm run dev -- --host 127.0.0.1 --port 4173', url: 'http://127.0.0.1:4173', reuseExistingServer: !process.env.CI },
    { command: 'npm run preview -- --host 127.0.0.1 --port 4175 --strictPort', url: 'http://127.0.0.1:4175', reuseExistingServer: !process.env.CI },
  ],
});
