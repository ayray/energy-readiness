import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests",
  fullyParallel: true,
  workers: 4,
  use: {
    baseURL: "http://localhost:4173/energy-readiness/",
    channel: "chrome",
    viewport: { width: 1280, height: 800 },
  },
  webServer: {
    command: "npm run build && npm run preview",
    url: "http://localhost:4173/energy-readiness/",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
