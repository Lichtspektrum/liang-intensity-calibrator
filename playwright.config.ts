import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:5173/liang-intensity-calibrator/",
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "npm run build:pages && npm run preview:pages",
      env: {
        VITE_API_BASE_URL: "http://127.0.0.1:8787",
      },
      url: "http://127.0.0.1:5173/liang-intensity-calibrator/",
      reuseExistingServer: false,
    },
    {
      command: "npm run test:api",
      url: "http://127.0.0.1:8787/__test/health",
      reuseExistingServer: false,
    },
  ],
  projects: [
    {
      name: "desktop-chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1000 },
      },
    },
    {
      name: "mobile-chromium",
      use: {
        ...devices["iPhone 13"],
        browserName: "chromium",
      },
    },
  ],
});
