"use strict";

/**
 * Applies the stored per-origin zoom factor to this document and keeps it in sync.
 *
 * Runs at document_start so the page is laid out at the right size from the first
 * paint. Being a declarative content script, it re-runs on every navigation and
 * after a browser restart, which is why the extension needs no background page and
 * no tabs.onUpdated plumbing.
 *
 * `tabs.setZoom()` would be the obvious tool here, but it is not implemented on
 * Firefox for Android (bug 1817783), so we set the CSS `zoom` property instead.
 * Unlike `transform: scale()` it reflows the page, which is what makes it usable on
 * a phone: text rewraps to the screen instead of forcing horizontal scrolling.
 */
(function () {
  const storageKey = ZoomLevels.storageKeyFor(location.href);
  if (!storageKey) return;

  let factor = ZoomLevels.DEFAULT;
  let overlayEnabled = false;

  function paintZoom() {
    const root = document.documentElement;
    if (!root) return false;

    const wanted = ZoomLevels.isDefault(factor) ? "" : String(factor);
    if (root.style.zoom !== wanted) {
      if (wanted) root.style.setProperty("zoom", wanted);
      else root.style.removeProperty("zoom");
    }
    PageZoomOverlay.setPageZoom(factor);
    return true;
  }

  function syncOverlay() {
    if (!overlayEnabled) {
      PageZoomOverlay.unmount();
      return;
    }
    PageZoomOverlay.mount({
      onStep: (direction) => {
        apply(direction > 0 ? ZoomLevels.stepUp(factor) : ZoomLevels.stepDown(factor));
      },
      onReset: () => apply(ZoomLevels.DEFAULT),
      onHide: () => browser.storage.local.set({ [ZoomLevels.OVERLAY_KEY]: false }),
    });
    PageZoomOverlay.update(factor);
  }

  /** Paint immediately for a responsive overlay, then persist. */
  function apply(next) {
    factor = ZoomLevels.clamp(next);
    paintZoom();
    PageZoomOverlay.update(factor);
    browser.storage.local.set({ [storageKey]: factor });
  }

  /** Run `fn` once `document.documentElement` exists — it may not at document_start. */
  function whenRootExists(fn) {
    if (document.documentElement) {
      fn();
      return;
    }
    const observer = new MutationObserver(() => {
      if (!document.documentElement) return;
      observer.disconnect();
      fn();
    });
    observer.observe(document, { childList: true, subtree: true });
  }

  /**
   * Some sites rewrite the whole style attribute of <html>, which would drop our
   * zoom. Repaint when that happens. paintZoom() is a no-op when the value already
   * matches, so this cannot loop on its own writes.
   */
  function guardAgainstStyleRewrites() {
    new MutationObserver(paintZoom).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["style"],
    });
  }

  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;

    if (storageKey in changes) {
      factor = ZoomLevels.clamp(changes[storageKey].newValue ?? ZoomLevels.DEFAULT);
      paintZoom();
      PageZoomOverlay.update(factor);
    }
    if (ZoomLevels.OVERLAY_KEY in changes) {
      overlayEnabled = changes[ZoomLevels.OVERLAY_KEY].newValue === true;
      syncOverlay();
    }
  });

  browser.storage.local.get([storageKey, ZoomLevels.OVERLAY_KEY]).then((stored) => {
    factor = ZoomLevels.clamp(stored[storageKey] ?? ZoomLevels.DEFAULT);
    overlayEnabled = stored[ZoomLevels.OVERLAY_KEY] === true;

    whenRootExists(() => {
      paintZoom();
      guardAgainstStyleRewrites();
    });

    // Defer the overlay until there is a body, so it never lands mid-parse.
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", syncOverlay, { once: true });
    } else {
      syncOverlay();
    }
  });
})();
