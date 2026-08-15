"use strict";

const { test, expect } = require("@playwright/test");
const { installBrowserStub } = require("./helpers");

const POPUP = "/src/popup/popup.html";
const KEY = "zoom:https://example.com";

const storedZoom = (page) => page.evaluate((key) => window.__zoomStore[key], KEY);

test.describe("popup", () => {
  test("opens showing the active tab's origin and its stored zoom", async ({ page }) => {
    await installBrowserStub(page, { storage: { [KEY]: 1.5 } });
    await page.goto(POPUP);

    await expect(page.locator("#readout")).toHaveText("150%");
    await expect(page.locator("#site")).toHaveText("example.com");
  });

  test("defaults to 100% for an origin with nothing stored", async ({ page }) => {
    await installBrowserStub(page);
    await page.goto(POPUP);

    await expect(page.locator("#readout")).toHaveText("100%");
    await expect(page.locator("#reset")).toBeDisabled();
  });

  test("+ walks up the ladder and persists each step", async ({ page }) => {
    await installBrowserStub(page);
    await page.goto(POPUP);

    await page.click("#up");
    await expect(page.locator("#readout")).toHaveText("110%");
    await page.click("#up");
    await expect(page.locator("#readout")).toHaveText("120%");

    expect(await storedZoom(page)).toBe(1.2);
  });

  test("- walks down the ladder and persists", async ({ page }) => {
    await installBrowserStub(page, { storage: { [KEY]: 1.2 } });
    await page.goto(POPUP);

    await page.click("#down");
    await expect(page.locator("#readout")).toHaveText("110%");
    expect(await storedZoom(page)).toBe(1.1);
  });

  test("reset returns to 100% and disables itself", async ({ page }) => {
    await installBrowserStub(page, { storage: { [KEY]: 2 } });
    await page.goto(POPUP);

    await page.click("#reset");
    await expect(page.locator("#readout")).toHaveText("100%");
    await expect(page.locator("#reset")).toBeDisabled();
    expect(await storedZoom(page)).toBe(1);
  });

  test("+ is disabled at the top of the ladder", async ({ page }) => {
    await installBrowserStub(page, { storage: { [KEY]: 3 } });
    await page.goto(POPUP);

    await expect(page.locator("#readout")).toHaveText("300%");
    await expect(page.locator("#up")).toBeDisabled();
    await expect(page.locator("#down")).toBeEnabled();
  });

  test("- is disabled at the bottom of the ladder", async ({ page }) => {
    await installBrowserStub(page, { storage: { [KEY]: 0.5 } });
    await page.goto(POPUP);

    await expect(page.locator("#readout")).toHaveText("50%");
    await expect(page.locator("#down")).toBeDisabled();
    await expect(page.locator("#up")).toBeEnabled();
  });

  test("the on-page overlay is off by default and toggling it persists", async ({ page }) => {
    await installBrowserStub(page);
    await page.goto(POPUP);

    const toggle = page.locator("#overlay");
    await expect(toggle).not.toBeChecked();

    await toggle.check();
    await expect
      .poll(() => page.evaluate(() => window.__zoomStore.overlayEnabled))
      .toBe(true);

    await toggle.uncheck();
    await expect
      .poll(() => page.evaluate(() => window.__zoomStore.overlayEnabled))
      .toBe(false);
  });

  test("the overlay toggle reflects the stored setting on open", async ({ page }) => {
    await installBrowserStub(page, { storage: { overlayEnabled: true } });
    await page.goto(POPUP);

    await expect(page.locator("#overlay")).toBeChecked();
  });

  test("explains itself on pages that cannot be zoomed", async ({ page }) => {
    await installBrowserStub(page, { tabUrl: "about:config" });
    await page.goto(POPUP);

    await expect(page.locator("#notice")).toBeVisible();
    await expect(page.locator("#up")).toBeDisabled();
    await expect(page.locator("#down")).toBeDisabled();
    await expect(page.locator("#reset")).toBeDisabled();
  });
});
