import { defineConfig, devices } from '@playwright/test'

// End-to-end tests run against the built app: `npm run build` first.
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  retries: 0,
  // A phone-sized viewport in Chromium (the iPhone profile would need WebKit installed).
  use: { baseURL: 'http://localhost:4183/', ...devices['iPhone 13'], defaultBrowserType: 'chromium', browserName: 'chromium' },
  webServer: { command: 'npx vite preview --port 4183 --strictPort', url: 'http://localhost:4183/', reuseExistingServer: true },
})
