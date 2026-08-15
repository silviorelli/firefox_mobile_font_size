"use strict";

/**
 * Installs a fake `browser` namespace before any page script runs.
 *
 * Only the surface the extension actually touches is faked, and `storage.local.set`
 * really does notify `storage.onChanged` listeners — that round trip is how the
 * popup, the overlay and the content script talk to each other, so stubbing it out
 * would hide the interesting bugs.
 */
async function installBrowserStub(page, options = {}) {
  const { tabUrl = "https://example.com/some/page", storage = {}, originZoom } = options;

  await page.addInitScript(
    ({ tabUrl, storage, originZoom }) => {
      const store = { ...storage };
      if (originZoom !== undefined) {
        store[`zoom:${window.location.origin}`] = originZoom;
      }
      const listeners = [];

      // Exposed so tests can assert what was persisted.
      window.__zoomStore = store;

      window.browser = {
        storage: {
          local: {
            get: async (keys) => {
              const wanted = keys === undefined || keys === null ? Object.keys(store) : [].concat(keys);
              const result = {};
              for (const key of wanted) {
                if (key in store) result[key] = store[key];
              }
              return result;
            },
            set: async (values) => {
              const changes = {};
              for (const [key, newValue] of Object.entries(values)) {
                changes[key] = { oldValue: store[key], newValue };
                store[key] = newValue;
              }
              for (const listener of listeners) listener(changes, "local");
            },
          },
          onChanged: {
            addListener: (listener) => listeners.push(listener),
          },
        },
        tabs: {
          query: async () => [{ id: 1, active: true, url: tabUrl }],
        },
        permissions: {
          contains: async () => true,
        },
      };
    },
    { tabUrl, storage, originZoom },
  );
}

/** Loads the content script bundle in the same order the manifest declares it. */
async function loadContentScripts(page) {
  for (const path of ["src/zoom-levels.js", "src/overlay.js", "src/content.js"]) {
    await page.addScriptTag({ path });
  }
}

const OVERLAY_HOST = "#page-font-size-overlay";

/** Clicks a button inside the overlay's closed shadow root. */
async function clickOverlayButton(page, ariaLabel) {
  await page.evaluate((label) => {
    const button = PageZoomOverlay.getShadowRoot().querySelector(`[aria-label="${label}"]`);
    button.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  }, ariaLabel);
}

function rootZoom(page) {
  return page.evaluate(() => document.documentElement.style.zoom);
}

module.exports = { installBrowserStub, loadContentScripts, clickOverlayButton, rootZoom, OVERLAY_HOST };
