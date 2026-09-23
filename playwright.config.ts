import { defineConfig, devices } from "@playwright/test";

/**
 * Verifiche in browser reale: Edge via Playwright (`channel: "msedge"`).
 *
 * **Cinque** larghezze in v2, non tre: 375 / 768 / 1024 / 1280 / 1440. Le due nuove
 * sono esattamente le soglie del guscio — a 1024 la bottom nav diventa la sidebar, a
 * 1280 compare la colonna destra — e un cambio di layout che non ha una larghezza di
 * prova sulla soglia e' un cambio di layout non verificato.
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
      name: "desktop-1024",
      use: { ...devices["Desktop Edge"], channel: "msedge", viewport: { width: 1024, height: 900 } },
    },
    {
      name: "desktop-1280",
      use: { ...devices["Desktop Edge"], channel: "msedge", viewport: { width: 1280, height: 900 } },
    },
    {
      name: "desktop-1440",
      use: { ...devices["Desktop Edge"], channel: "msedge", viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: {
    command: "pnpm start --port 3100",
    url: "http://127.0.0.1:3100/home",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
