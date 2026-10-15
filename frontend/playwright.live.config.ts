import { defineConfig, devices } from "@playwright/test";

const testUrl = process.env.E2E_BASE_URL;
const target = testUrl ? new URL(testUrl) : null;
const loopback = target && ["localhost", "127.0.0.1", "[::1]"].includes(target.hostname);
if (!target || (target.protocol !== "https:" && !(target.protocol === "http:" && loopback))) {
  throw new Error("Set E2E_BASE_URL to an isolated HTTPS test deployment or HTTP loopback server to run live QA.");
}
const localFrontend = process.env.CLOUDDROP_LOCAL_FRONTEND === "true";
process.env.VITE_USE_MOCK_API = "false";
process.env.CLOUDDROP_LIVE_QA = "true";
process.env.CLOUDDROP_API_PROXY_TARGET = target.origin;

export default defineConfig({
  testDir: "./e2e",
  testMatch: ["live-auth.spec.ts", "live-files.spec.ts", "live-flow.spec.ts", "live-qa.spec.ts", "live-password-recovery.spec.ts"],
  outputDir: process.env.CLOUDDROP_QA_OUTPUT ?? "test-results-live",
  workers: 1,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 10_000 },
  reporter: [["line"], ["json", { outputFile: process.env.CLOUDDROP_QA_REPORT ?? "test-results-live/results.json" }]],
  // Production traces can contain bearer tokens and signed storage URLs.
  use: { baseURL: localFrontend ? "http://127.0.0.1:4177" : testUrl, trace: "off", screenshot: "off", video: "off" },
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
