import { defineConfig, devices } from "@playwright/test";

// Local HTTP fixtures exercise the real frontend transport without touching
// production accounts, S3, or the backend database.
export default defineConfig({
  testDir: "./e2e",
  testMatch: "downloads.spec.ts",
  outputDir: "test-results-downloads",
  workers: 1,
  retries: 0,
  use: {
    baseURL: "http://127.0.0.1:4176", trace: "retain-on-failure",
    // Only the fixture server uses a locally generated, disposable certificate.
    ignoreHTTPSErrors: true,
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "mobile-chromium", use: { ...devices["iPhone 13"], browserName: "chromium" } },
    { name: "mobile-webkit", use: { ...devices["iPhone 13"] } },
  ],
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 4176",
    url: "http://127.0.0.1:4176/login",
    env: { VITE_USE_MOCK_API: "false", VITE_API_BASE_URL: "/api/v1" },
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
