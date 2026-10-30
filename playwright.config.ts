import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  globalSetup: "./tests/setup.ts",
  timeout: 180000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://localhost:4173",
    headless: true,
    viewport: { width: 1440, height: 1050 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  reporter: [["list"], ["html", { open: "never" }]],
});
