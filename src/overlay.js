"use strict";

/**
 * The optional on-page zoom controls.
 *
 * Firefox for Android renders an extension popup as a full-screen fragment, so the
 * page is invisible while the popup is open and the user cannot see what a zoom step
 * did until they press Back. This overlay is the only way to get live feedback, so
 * it exists — but it is off by default and toggled from the popup.
 *
 * Everything lives in a closed shadow root so page CSS cannot restyle it and page
 * script cannot read or drive it.
 *
 * Two states: the full bar (− % + ›) and, after ›, a small tab on the right edge
 * that brings the bar back when tapped. Minimizing only lasts for this page, so the
 * controls can never be lost; switching them off for good is done from the popup.
 */
var PageZoomOverlay = (function () {
  const HOST_ID = "page-font-size-overlay";
  const DIM_AFTER_MS = 2500;
  // Gap between the bar and the visible edges, in screen-sized CSS px.
  const INSET_END = 12;
  const INSET_BOTTOM = 16;

  const SHADOW_CSS = `
    :host { all: initial; }
    .bar, .tab {
      display: flex;
      align-items: stretch;
      font: 600 15px/1 system-ui, sans-serif;
      color: #fff;
      background: rgba(28, 27, 34, 0.92);
      border: 1px solid rgba(255, 255, 255, 0.16);
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
      overflow: hidden;
      -webkit-user-select: none;
      user-select: none;
    }
    .bar { border-radius: 999px; }
    .tab {
      border-inline-end: 0;
      border-start-start-radius: 12px;
      border-end-start-radius: 12px;
    }
    [hidden] { display: none; }
    button {
      -webkit-appearance: none;
      appearance: none;
      margin: 0;
      border: 0;
      padding: 0;
      min-width: 48px;
      min-height: 48px;
      font: inherit;
      color: inherit;
      background: transparent;
      cursor: pointer;
      touch-action: manipulation;
    }
    button:active { background: rgba(255, 255, 255, 0.18); }
    button[disabled] { opacity: 0.35; }
    .step { font-size: 22px; }
    .value {
      min-width: 62px;
      font-variant-numeric: tabular-nums;
      border-inline: 1px solid rgba(255, 255, 255, 0.16);
    }
    .minimize { font-size: 20px; min-width: 40px; opacity: 0.75; }
    .tab button { min-width: 22px; font-size: 18px; opacity: 0.85; }
  `;

  let host = null;
  let shadow = null;
  let bar = null;
  let tab = null;
  let valueButton = null;
  let downButton = null;
  let upButton = null;
  let dimTimer = null;
  let placeFrame = 0;
  let minimized = false;
  let pageZoom = 1;

  function setHostStyle() {
    // Inline and !important so no page stylesheet can move or hide the overlay.
    // `zoom` cancels the page zoom we set on :root, keeping the controls a constant
    // physical size (and their fixed offsets constant) at every zoom level.
    //
    // Plain px offsets, deliberately without env(safe-area-inset-bottom): Firefox for
    // Android changes that inset as its dynamic toolbar slides in and out, which made
    // the bar jump ~20px every time the toolbar reappeared. Plain offsets are applied
    // by the compositor, with no script running on scroll.
    const style = [
      ["all", "initial"],
      ["position", "fixed"],
      ["z-index", "2147483647"],
      ["bottom", `${INSET_BOTTOM}px`],
      ["right", `${minimized ? 0 : INSET_END}px`],
      ["zoom", String(1 / pageZoom)],
      ["transform-origin", "100% 100%"],
      ["transition", "opacity 200ms ease"],
      ["opacity", "1"],
    ];
    host.style.cssText = "";
    for (const [prop, value] of style) host.style.setProperty(prop, value, "important");
  }

  /**
   * Keep the controls on screen while the page is pinch-zoomed.
   *
   * `position: fixed` anchors to the layout viewport. Pinch-zoom only moves the
   * visual viewport inside it, so a fixed bar ends up off-screen or magnified. While
   * pinch-zoomed, a transform moves the bar's corner to the visible bottom-right and
   * counter-scales it to its normal physical size. Without pinch-zoom it is left to
   * plain CSS, which the compositor keeps in step with the toolbar.
   */
  function place() {
    placeFrame = 0;
    if (!host) return;
    host.style.setProperty("right", `${minimized ? 0 : INSET_END}px`, "important");
    const vv = window.visualViewport;
    if (!vv || Math.abs(vv.scale - 1) < 0.01) {
      host.style.removeProperty("transform");
      return;
    }
    const s = 1 / vv.scale;
    const endGap = minimized ? 0 : INSET_END;
    const dx = vv.offsetLeft + vv.width - endGap * s - (window.innerWidth - endGap);
    const dy = vv.offsetTop + vv.height - INSET_BOTTOM * s - (window.innerHeight - INSET_BOTTOM);
    host.style.setProperty("transform", `translate(${dx}px, ${dy}px) scale(${s})`, "important");
  }

  function schedulePlace() {
    if (!placeFrame) placeFrame = requestAnimationFrame(place);
  }

  function listenToViewport(add) {
    const method = add ? "addEventListener" : "removeEventListener";
    window.visualViewport?.[method]("resize", schedulePlace);
    window.visualViewport?.[method]("scroll", schedulePlace);
    window[method]("resize", schedulePlace);
  }

  function wake() {
    if (!host) return;
    host.style.setProperty("opacity", "1", "important");
    clearTimeout(dimTimer);
    dimTimer = setTimeout(() => {
      if (host) host.style.setProperty("opacity", "0.45", "important");
    }, DIM_AFTER_MS);
  }

  function button(className, text, label, onClick) {
    const el = document.createElement("button");
    el.className = className;
    el.textContent = text;
    el.setAttribute("aria-label", label);
    el.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      wake();
      onClick();
    });
    return el;
  }

  function setMinimized(value) {
    minimized = value;
    if (!host) return;
    bar.hidden = minimized;
    tab.hidden = !minimized;
    place();
    wake();
  }

  /** @param {{onStep: (direction: number) => void, onReset: () => void}} handlers */
  function mount(handlers) {
    if (host || !document.documentElement) return;

    host = document.createElement("div");
    host.id = HOST_ID;
    setHostStyle();
    shadow = host.attachShadow({ mode: "closed" });

    const style = document.createElement("style");
    style.textContent = SHADOW_CSS;

    bar = document.createElement("div");
    bar.className = "bar";
    downButton = button("step", "−", "Decrease page size", () => handlers.onStep(-1));
    valueButton = button("value", "100%", "Reset page size", () => handlers.onReset());
    upButton = button("step", "+", "Increase page size", () => handlers.onStep(1));
    const minimize = button("minimize", "›", "Minimize on-page controls", () => setMinimized(true));
    bar.append(downButton, valueButton, upButton, minimize);

    tab = document.createElement("div");
    tab.className = "tab";
    tab.append(button("restore", "‹", "Show on-page controls", () => setMinimized(false)));

    bar.hidden = minimized;
    tab.hidden = !minimized;
    shadow.append(style, bar, tab);

    // Attached to <html> rather than <body> so page selectors like `body > div`
    // cannot reach the host element.
    document.documentElement.appendChild(host);
    listenToViewport(true);
    place();
    wake();
  }

  function unmount() {
    clearTimeout(dimTimer);
    cancelAnimationFrame(placeFrame);
    placeFrame = 0;
    listenToViewport(false);
    host?.remove();
    host = shadow = bar = tab = valueButton = downButton = upButton = null;
  }

  function update(factor) {
    if (!host) return;
    valueButton.textContent = `${ZoomLevels.toPercent(factor)}%`;
    downButton.disabled = factor <= ZoomLevels.MIN;
    upButton.disabled = factor >= ZoomLevels.MAX;
    schedulePlace(); // the label width can change, e.g. 90% → 100%
    wake();
  }

  /** Tell the overlay what the page is zoomed to, so it can cancel that scale. */
  function setPageZoom(factor) {
    pageZoom = ZoomLevels.clamp(factor);
    if (!host) return;
    host.style.setProperty("zoom", String(1 / pageZoom), "important");
    place();
  }

  function isMounted() {
    return host !== null;
  }

  function isMinimized() {
    return minimized;
  }

  /**
   * The shadow root, for the end-to-end tests to drive the buttons.
   *
   * Not a hole in the closed root: content scripts run in an isolated world, so
   * page script cannot see `PageZoomOverlay` at all. The closed root is what stops
   * the page reaching the controls via `document.querySelector(...).shadowRoot`.
   */
  function getShadowRoot() {
    return shadow;
  }

  return { mount, unmount, update, setPageZoom, isMounted, isMinimized, getShadowRoot };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = PageZoomOverlay;
}
