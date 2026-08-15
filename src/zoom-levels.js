"use strict";

/**
 * Zoom step arithmetic and storage key derivation.
 *
 * Shared verbatim by the popup, the content script and the unit tests, so it must
 * stay free of any `browser.*` or DOM access. It is loaded as a classic script
 * (content scripts are never modules), publishing a `ZoomLevels` global, and also
 * exports itself for CommonJS so `node --test` can require it directly.
 */
var ZoomLevels = (function () {
  // Comparing floats that came back from JSON storage, so nudge every comparison.
  const EPSILON = 1e-6;

  /** The same ladder desktop Firefox walks with Ctrl+ / Ctrl-. */
  const STEPS = [0.5, 0.67, 0.8, 0.9, 1, 1.1, 1.2, 1.33, 1.5, 1.7, 2, 2.4, 3];
  const MIN = STEPS[0];
  const MAX = STEPS[STEPS.length - 1];
  const DEFAULT = 1;

  const KEY_PREFIX = "zoom:";
  const OVERLAY_KEY = "overlayEnabled";

  function clamp(factor) {
    // Deliberately not Number(): Number(null) and Number("") are both 0, which
    // would turn "nothing stored" into 50% instead of 100%.
    const value = typeof factor === "string" ? Number.parseFloat(factor) : factor;
    if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT;
    return Math.min(Math.max(value, MIN), MAX);
  }

  /** Next step above `factor`, or MAX when already at the top. */
  function stepUp(factor) {
    const current = clamp(factor);
    const next = STEPS.find((step) => step > current + EPSILON);
    return next === undefined ? MAX : next;
  }

  /** Next step below `factor`, or MIN when already at the bottom. */
  function stepDown(factor) {
    const current = clamp(factor);
    for (let i = STEPS.length - 1; i >= 0; i--) {
      if (STEPS[i] < current - EPSILON) return STEPS[i];
    }
    return MIN;
  }

  function isDefault(factor) {
    return Math.abs(clamp(factor) - DEFAULT) < EPSILON;
  }

  function toPercent(factor) {
    return Math.round(clamp(factor) * 100);
  }

  /**
   * Storage key for a page's origin, or null for pages we cannot meaningfully
   * remember a setting for (about:, data:, and anything with an opaque origin).
   */
  function storageKeyFor(url) {
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      return null;
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return KEY_PREFIX + parsed.origin;
  }

  return {
    STEPS,
    MIN,
    MAX,
    DEFAULT,
    KEY_PREFIX,
    OVERLAY_KEY,
    clamp,
    stepUp,
    stepDown,
    isDefault,
    toPercent,
    storageKeyFor,
  };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = ZoomLevels;
}
