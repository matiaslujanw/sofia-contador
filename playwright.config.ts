import { defineConfig, devices } from "@playwright/test";

const port = 3107;
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  workers: 2,
  use: { ...devices["Desktop Chrome"], baseURL, trace: "retain-on-failure" },
  webServer: {
    command: `npm run dev -- --port ${port}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    env: {
      SOFIA_DEMO_MODE: "1",
      NEXT_PUBLIC_SUPABASE_URL: "",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "",
      SOFIA_SITE_URL: baseURL,
    },
    timeout: 60_000,
  },
});
