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
 */
var PageZoomOverlay = (function () {
  const HOST_ID = "page-font-size-overlay";
  const DIM_AFTER_MS = 2500;

  const SHADOW_CSS = `
    :host { all: initial; }
    .bar {
      display: flex;
      align-items: stretch;
      font: 600 15px/1 system-ui, sans-serif;
      color: #fff;
      background: rgba(28, 27, 34, 0.92);
      border: 1px solid rgba(255, 255, 255, 0.16);
      border-radius: 999px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
      overflow: hidden;
      -webkit-user-select: none;
      user-select: none;
    }
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
    .hide { font-size: 17px; min-width: 40px; opacity: 0.75; }
  `;

  let host = null;
  let shadow = null;
  let valueButton = null;
  let downButton = null;
  let upButton = null;
  let dimTimer = null;
  let pageZoom = 1;

  function setHostStyle() {
    // Inline and !important so no page stylesheet can move or hide the overlay.
    // `zoom` cancels the page zoom we set on :root, keeping the controls a constant
    // physical size (and their fixed offsets constant) at every zoom level.
    const style = [
      ["all", "initial"],
      ["position", "fixed"],
      ["z-index", "2147483647"],
      ["inset-block-end", "calc(16px + env(safe-area-inset-bottom, 0px))"],
      ["inset-inline-end", "calc(12px + env(safe-area-inset-right, 0px))"],
      ["zoom", String(1 / pageZoom)],
      ["transition", "opacity 200ms ease"],
      ["opacity", "1"],
    ];
    host.style.cssText = "";
    for (const [prop, value] of style) host.style.setProperty(prop, value, "important");
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

  /** @param {{onStep: (direction: number) => void, onReset: () => void, onHide: () => void}} handlers */
  function mount(handlers) {
    if (host || !document.documentElement) return;

    host = document.createElement("div");
    host.id = HOST_ID;
    setHostStyle();
    shadow = host.attachShadow({ mode: "closed" });

    const style = document.createElement("style");
    style.textContent = SHADOW_CSS;

    const bar = document.createElement("div");
    bar.className = "bar";

    downButton = button("step", "−", "Decrease page size", () => handlers.onStep(-1));
    valueButton = button("value", "100%", "Reset page size", () => handlers.onReset());
    upButton = button("step", "+", "Increase page size", () => handlers.onStep(1));
    const hide = button("hide", "×", "Hide on-page controls", () => handlers.onHide());

    bar.append(downButton, valueButton, upButton, hide);
    shadow.append(style, bar);

    // Attached to <html> rather than <body> so page selectors like `body > div`
    // cannot reach the host element.
    document.documentElement.appendChild(host);
    wake();
  }

  function unmount() {
    clearTimeout(dimTimer);
    host?.remove();
    host = shadow = valueButton = downButton = upButton = null;
  }

  function update(factor) {
    if (!host) return;
    valueButton.textContent = `${ZoomLevels.toPercent(factor)}%`;
    downButton.disabled = factor <= ZoomLevels.MIN;
    upButton.disabled = factor >= ZoomLevels.MAX;
    wake();
  }

  /** Tell the overlay what the page is zoomed to, so it can cancel that scale. */
  function setPageZoom(factor) {
    pageZoom = ZoomLevels.clamp(factor);
    if (host) host.style.setProperty("zoom", String(1 / pageZoom), "important");
  }

  function isMounted() {
    return host !== null;
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

  return { mount, unmount, update, setPageZoom, isMounted, getShadowRoot };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = PageZoomOverlay;
}
