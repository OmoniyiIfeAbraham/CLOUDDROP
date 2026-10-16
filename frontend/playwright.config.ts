import { defineConfig, devices } from "@playwright/test";

// Set E2E_BASE_URL to test a deployed site instead of starting a local dev server.
const deployedUrl = process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: "./e2e",
  testIgnore: ["**/downloads.spec.ts", "**/password-recovery.spec.ts", "**/auth-verification-recovery.spec.ts"],
  retries: 0,
  use: {
    baseURL: deployedUrl ?? "http://127.0.0.1:4173",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "mobile-chromium", use: { ...devices["iPhone 13"], browserName: "chromium" } },
  ],
  ...(deployedUrl ? {} : {
    webServer: {
      command: "npm run dev -- --host 127.0.0.1 --port 4173",
      url: "http://127.0.0.1:4173/login",
      env: { VITE_USE_MOCK_API: "true" },
      reuseExistingServer: false,
      timeout: 60_000,
    },
  }),
});
