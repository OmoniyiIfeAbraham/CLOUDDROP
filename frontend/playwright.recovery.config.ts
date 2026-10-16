import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: ["password-recovery.spec.ts", "auth-verification-recovery.spec.ts"],
  outputDir: "test-results-recovery",
  workers: 1, retries: 0, timeout: 60_000,
  use: { baseURL: "http://127.0.0.1:4178", trace: "off", screenshot: "off", video: "off" },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "mobile-chromium", use: { ...devices["iPhone 13"], browserName: "chromium" } },
    { name: "desktop-webkit", use: { ...devices["Desktop Safari"], viewport: { width: 1440, height: 900 } } },
    { name: "mobile-webkit", use: { ...devices["iPhone 13"] } },
  ],
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 4178",
    url: "http://127.0.0.1:4178/login", reuseExistingServer: false,
    env: { VITE_USE_MOCK_API: "false", VITE_API_BASE_URL: "/api/v1" },
    timeout: 60_000,
  },
});
