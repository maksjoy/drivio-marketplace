const { defineConfig, devices } = require('@playwright/test');

// CI shards upload one blob each. PW_BLOB_NAME keeps those zips from colliding
// when the report job flattens the artifacts.
const ciReporters = [
  ['blob', { fileName: process.env.PW_BLOB_NAME || 'report.zip' }],
  ['line'],
];

module.exports = defineConfig({
  testDir: './tests/e2e',
  timeout: 60000,
  expect: { timeout: 12000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? ciReporters : 'line',
  use: {
    baseURL: 'http://127.0.0.1:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: 'npm start',
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
  projects: [
    {
      name: 'desktop-chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
      },
    },
    // Firefox stays in the matrix, but only for @key scenarios (home, listing, login).
    {
      name: 'desktop-firefox',
      grep: /@key/,
      use: { ...devices['Desktop Firefox'] },
    },
    // Not selected by CI. Local `npm run test:e2e` can still run the full desktop WebKit project.
    {
      name: 'desktop-webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'iphone-webkit',
      grep: /@key/,
      use: { ...devices['iPhone 14'] },
    },
    {
      name: 'iphone-small-webkit',
      grep: /@key/,
      use: {
        browserName: 'webkit',
        viewport: { width: 375, height: 667 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 2,
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
      },
    },
    { name: 'android-pixel-chromium', use: { ...devices['Pixel 5'] } },
    {
      name: 'android-small-chromium',
      use: {
        browserName: 'chromium',
        viewport: { width: 360, height: 800 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 3,
        userAgent: 'Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Mobile Safari/537.36',
      },
    },
  ],
});
