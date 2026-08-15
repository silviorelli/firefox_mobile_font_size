"use strict";

const { test, expect } = require("@playwright/test");
const {
  installBrowserStub,
  loadContentScripts,
  clickOverlayButton,
  rootZoom,
  OVERLAY_HOST,
} = require("./helpers");

const FIXTURE = "/e2e/fixtures/page.html";

const overlayLabel = (page) =>
  page.evaluate(() => PageZoomOverlay.getShadowRoot().querySelector(".value").textContent);

const storedZoom = (page) =>
  page.evaluate(() => window.__zoomStore[`zoom:${location.origin}`]);

test.describe("content script", () => {
  test("applies the stored zoom to the document root", async ({ page }) => {
    await installBrowserStub(page, { originZoom: 1.5 });
    await page.goto(FIXTURE);
    await loadContentScripts(page);

    await expect.poll(() => rootZoom(page)).toBe("1.5");
  });

  test("leaves the page alone at 100%", async ({ page }) => {
    await installBrowserStub(page);
    await page.goto(FIXTURE);
    await loadContentScripts(page);

    await expect(page.locator("#heading")).toBeVisible();
    expect(await rootZoom(page)).toBe("");
  });

  test("zoom reflows text instead of magnifying it", async ({ page }) => {
    await page.setViewportSize({ width: 420, height: 720 });
    await installBrowserStub(page, { originZoom: 2 });
    await page.goto(FIXTURE);
    await loadContentScripts(page);
    await expect.poll(() => rootZoom(page)).toBe("2");

    // The paragraph is twice as tall but no wider than the viewport: that is the
    // reflow that makes CSS zoom usable on a phone, unlike transform: scale().
    const { width, scrollWidth, clientWidth } = await page.evaluate(() => ({
      width: document.getElementById("paragraph").getBoundingClientRect().width,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(width).toBeLessThanOrEqual(420);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
  });

  test("picks up a zoom change made elsewhere, such as from the popup", async ({ page }) => {
    await installBrowserStub(page);
    await page.goto(FIXTURE);
    await loadContentScripts(page);

    await page.evaluate(() => browser.storage.local.set({ [`zoom:${location.origin}`]: 1.2 }));
    await expect.poll(() => rootZoom(page)).toBe("1.2");
  });

  test("re-applies the zoom when the page rewrites the root style attribute", async ({ page }) => {
    await installBrowserStub(page, { originZoom: 1.5 });
    await page.goto(FIXTURE);
    await loadContentScripts(page);
    await expect.poll(() => rootZoom(page)).toBe("1.5");

    await page.evaluate(() => document.documentElement.setAttribute("style", "color: red"));
    await expect.poll(() => rootZoom(page)).toBe("1.5");
  });

  test("does not show the on-page overlay unless it is switched on", async ({ page }) => {
    await installBrowserStub(page, { originZoom: 1.5 });
    await page.goto(FIXTURE);
    await loadContentScripts(page);
    await expect.poll(() => rootZoom(page)).toBe("1.5");

    await expect(page.locator(OVERLAY_HOST)).toHaveCount(0);
  });

  test("keeps the overlay out of reach of page script and page CSS", async ({ page }) => {
    await installBrowserStub(page, { storage: { overlayEnabled: true } });
    await page.goto(FIXTURE);
    await loadContentScripts(page);
    await expect(page.locator(OVERLAY_HOST)).toHaveCount(1);

    // Closed shadow root: the page sees the host element but nothing inside it.
    const exposed = await page.evaluate(
      (selector) => document.querySelector(selector).shadowRoot,
      OVERLAY_HOST,
    );
    expect(exposed).toBeNull();
  });

  test("counteracts the page zoom so the overlay stays a constant size", async ({ page }) => {
    await installBrowserStub(page, { originZoom: 2, storage: { overlayEnabled: true } });
    await page.goto(FIXTURE);
    await loadContentScripts(page);
    await expect.poll(() => rootZoom(page)).toBe("2");

    const hostZoom = await page.evaluate(
      (selector) => document.querySelector(selector).style.zoom,
      OVERLAY_HOST,
    );
    expect(Number(hostZoom)).toBeCloseTo(0.5, 5);
  });

  test("the overlay steps, resets and persists the zoom", async ({ page }) => {
    await installBrowserStub(page, { originZoom: 1.5, storage: { overlayEnabled: true } });
    await page.goto(FIXTURE);
    await loadContentScripts(page);
    await expect.poll(() => overlayLabel(page)).toBe("150%");

    await clickOverlayButton(page, "Increase page size");
    await expect.poll(() => rootZoom(page)).toBe("1.7");
    await expect.poll(() => overlayLabel(page)).toBe("170%");
    await expect.poll(() => storedZoom(page)).toBe(1.7);

    await clickOverlayButton(page, "Decrease page size");
    await expect.poll(() => rootZoom(page)).toBe("1.5");

    await clickOverlayButton(page, "Reset page size");
    await expect.poll(() => rootZoom(page)).toBe("");
    await expect.poll(() => storedZoom(page)).toBe(1);
  });

  test("the overlay's hide button switches the overlay off everywhere", async ({ page }) => {
    await installBrowserStub(page, { storage: { overlayEnabled: true } });
    await page.goto(FIXTURE);
    await loadContentScripts(page);
    await expect(page.locator(OVERLAY_HOST)).toHaveCount(1);

    await clickOverlayButton(page, "Hide on-page controls");

    await expect(page.locator(OVERLAY_HOST)).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => window.__zoomStore.overlayEnabled)).toBe(false);
  });

  test("switching the overlay on from the popup makes it appear without a reload", async ({ page }) => {
    await installBrowserStub(page);
    await page.goto(FIXTURE);
    await loadContentScripts(page);
    await expect(page.locator(OVERLAY_HOST)).toHaveCount(0);

    await page.evaluate(() => browser.storage.local.set({ overlayEnabled: true }));
    await expect(page.locator(OVERLAY_HOST)).toHaveCount(1);
  });
});
