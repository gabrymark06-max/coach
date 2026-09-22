import { defineConfig, devices } from "@playwright/test";

/**
 * Verifiche in browser reale: Edge via Playwright (`channel: "msedge"`).
 * Tre larghezze, come da §7 del design system: 375 / 768 / 1440.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  timeout: 60_000,
  use: {
    baseURL: "http://127.0.0.1:3100",
    channel: "msedge",
    trace: "off",
  },
  projects: [
    {
      name: "telefono-375",
      use: { ...devices["Desktop Edge"], channel: "msedge", viewport: { width: 375, height: 812 }, isMobile: false },
    },
    {
      name: "tablet-768",
      use: { ...devices["Desktop Edge"], channel: "msedge", viewport: { width: 768, height: 1024 } },
    },
    {
      name: "desktop-1440",
      use: { ...devices["Desktop Edge"], channel: "msedge", viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: {
    command: "pnpm start --port 3100",
    url: "http://127.0.0.1:3100/allenamento",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
