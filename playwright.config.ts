import { defineConfig, devices } from '@playwright/test'

// End-to-end tests against the production build, at phone size.
//   npm run e2e
export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  fullyParallel: true,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: 'http://localhost:4173/wizard-spellbook/', trace: 'retain-on-failure' },
  projects: [
    // Android / Chrome engine: runs on every deploy.
    { name: 'phone', use: { ...devices['Pixel 7'] } },
    // iPhone / Safari engine (WebKit): runs in .github/workflows/safari.yml.
    { name: 'iphone', use: { ...devices['iPhone 13'] } },
  ],
  webServer: {
    command: 'npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173/wizard-spellbook/',
    reuseExistingServer: !process.env.CI,
  },
})
