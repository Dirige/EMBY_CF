import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  retries: 0,
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    viewport: { width: 1100, height: 740 },
    reducedMotion: 'reduce',
    launchOptions: { args: ['--disable-gpu', '--no-zygote', '--single-process', '--renderer-process-limit=1'] },
    screenshot: 'only-on-failure', trace: 'off',
  },
  webServer: {
    command: 'npm run preview',
    url: 'http://127.0.0.1:4274/__preview/health',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
