import { defineConfig, devices } from "@playwright/test";

/**
 * E2E smoke spec lives at tests/e2e/smoke.spec.ts (docs/13 §6).
 * Run against a dev/preview server: PLAYWRIGHT_BASE_URL=http://localhost:3000
 */
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
