"use strict";

/**
 * The popup reached from ⋮ → Extensions → Page Font Size Mobile.
 *
 * It never messages the tab directly: it writes to storage.local and the content
 * script reacts to storage.onChanged. That keeps one code path for every way the
 * zoom can change (popup, on-page overlay, another tab on the same origin), and it
 * means the setting is already applied by the time the user presses Back.
 */
(function () {
  const els = {
    site: document.getElementById("site"),
    readout: document.getElementById("readout"),
    down: document.getElementById("down"),
    up: document.getElementById("up"),
    reset: document.getElementById("reset"),
    notice: document.getElementById("notice"),
    overlay: document.getElementById("overlay"),
    done: document.getElementById("done"),
  };

  let storageKey = null;
  let factor = ZoomLevels.DEFAULT;

  function render() {
    els.readout.textContent = `${ZoomLevels.toPercent(factor)}%`;
    els.down.disabled = !storageKey || factor <= ZoomLevels.MIN;
    els.up.disabled = !storageKey || factor >= ZoomLevels.MAX;
    els.reset.disabled = !storageKey || ZoomLevels.isDefault(factor);
  }

  function showNotice(message) {
    els.notice.textContent = message;
    els.notice.hidden = false;
  }

  function apply(next) {
    factor = ZoomLevels.clamp(next);
    render();
    browser.storage.local.set({ [storageKey]: factor });
  }

  async function warnIfHostPermissionMissing(origin) {
    // Host permissions are granted at install on Firefox 127+, but the user can
    // revoke them, and a revoked permission means the content script never runs.
    try {
      const granted = await browser.permissions.contains({ origins: [`${origin}/*`] });
      if (!granted) {
        showNotice("Firefox is blocking this extension on this site. Allow it under Settings → Add-ons to zoom here.");
      }
    } catch {
      // permissions.contains is unavailable — nothing useful to tell the user.
    }
  }

  async function init() {
    els.down.addEventListener("click", () => apply(ZoomLevels.stepDown(factor)));
    els.up.addEventListener("click", () => apply(ZoomLevels.stepUp(factor)));
    els.reset.addEventListener("click", () => apply(ZoomLevels.DEFAULT));
    els.done.addEventListener("click", () => window.close());
    els.overlay.addEventListener("change", () => {
      browser.storage.local.set({ [ZoomLevels.OVERLAY_KEY]: els.overlay.checked });
    });

    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    storageKey = ZoomLevels.storageKeyFor(tab?.url ?? "");

    if (!storageKey) {
      els.site.textContent = "No page to zoom";
      showNotice("Page zoom only works on web pages, not on Firefox's own screens.");
      render();
      return;
    }

    const origin = storageKey.slice(ZoomLevels.KEY_PREFIX.length);
    els.site.textContent = new URL(origin).host;

    const stored = await browser.storage.local.get([storageKey, ZoomLevels.OVERLAY_KEY]);
    factor = ZoomLevels.clamp(stored[storageKey] ?? ZoomLevels.DEFAULT);
    els.overlay.checked = stored[ZoomLevels.OVERLAY_KEY] === true;
    render();

    warnIfHostPermissionMissing(origin);
  }

  init();
})();
