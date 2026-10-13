import { defineConfig, devices } from "@playwright/test";

const productionUrl = process.env.E2E_BASE_URL;
if (!productionUrl || new URL(productionUrl).protocol !== "https:") {
  throw new Error("Set E2E_BASE_URL to the HTTPS deployment to run live QA.");
}
const localFrontend = process.env.CLOUDDROP_LOCAL_FRONTEND === "true";
process.env.VITE_USE_MOCK_API = "false";
process.env.CLOUDDROP_LIVE_QA = "true";
process.env.CLOUDDROP_API_PROXY_TARGET = new URL(productionUrl).origin;

export default defineConfig({
  testDir: "./e2e",
  testMatch: ["live-auth.spec.ts", "live-files.spec.ts", "live-flow.spec.ts", "live-qa.spec.ts"],
  outputDir: process.env.CLOUDDROP_QA_OUTPUT ?? "test-results-live",
  workers: 1,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 10_000 },
  reporter: [["line"], ["json", { outputFile: process.env.CLOUDDROP_QA_REPORT ?? "test-results-live/results.json" }]],
  // Production traces can contain bearer tokens and signed storage URLs.
  use: { baseURL: localFrontend ? "http://127.0.0.1:4177" : productionUrl, trace: "off", screenshot: "only-on-failure" },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "mobile-chromium", use: { ...devices["iPhone 13"], browserName: "chromium" } },
    { name: "desktop-webkit", use: { ...devices["Desktop Safari"], viewport: { width: 1440, height: 900 } } },
    { name: "mobile-webkit", use: { ...devices["iPhone 13"], browserName: "webkit" } },
  ],
  ...(localFrontend ? { webServer: {
    command: "VITE_USE_MOCK_API=false VITE_API_BASE_URL=/api/v1 npm run dev -- --host 127.0.0.1 --port 4177",
    url: "http://127.0.0.1:4177/login", reuseExistingServer: false, timeout: 60_000,
  } } : {}),
});
