"use strict";

const { defineConfig, devices } = require("@playwright/test");

const PORT = 4173;
const BASE_URL = `http://127.0.0.1:${PORT}`;

/**
 * Playwright cannot install a WebExtension in Firefox (it drives Firefox over its
 * own Juggler protocol, not WebDriver BiDi, so `webExtension.install` is out of
 * reach — see microsoft/playwright#7297). These tests therefore exercise the popup
 * and the content script as ordinary pages in a real Firefox, with `browser.*`
 * stubbed. See documentation/technical_choices.md.
 */
module.exports = defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  projects: [{ name: "firefox", use: { ...devices["Desktop Firefox"] } }],
  webServer: {
    command: `node tools/serve.mjs ${PORT}`,
    url: `${BASE_URL}/src/manifest.json`,
    reuseExistingServer: !process.env.CI,
  },
});
