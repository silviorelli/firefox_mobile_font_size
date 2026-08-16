# Architecture

## The shape of it

There is no background page. Everything is a content script plus a popup, wired
together through `storage.local`.

```
  ⋮ → Extensions → Page Font Size Mobile
            │
            ▼
  ┌─────────────────────┐
  │ popup/popup.js      │  reads the active tab's origin
  │  −  [140%]  +       │  writes storage.local
  │  [ ] on-page ctrls  │
  └─────────────────────┘
            │
            │  storage.local.set
            ▼
  ┌─────────────────────────────────┐
  │ storage.local                   │
  │   "zoom:https://example.com": 1.4│
  │   "overlayEnabled": false        │
  └─────────────────────────────────┘
            │
            │  storage.onChanged
            ▼
  ┌───────────────────────────────────────────┐
  │ content.js   (document_start, <all_urls>) │
  │   documentElement.style.zoom = 1.4        │
  │   mounts overlay.js when enabled          │
  └───────────────────────────────────────────┘
            ▲
            │  storage.local.set
  ┌─────────────────────┐
  │ overlay.js          │  optional, off by default
  │  − 140% + ×         │  closed shadow root
  └─────────────────────┘
```

**Storage is the only channel.** The popup never messages the tab. Every way the zoom
can change — popup, on-page overlay, another tab already open on the same origin —
goes through `storage.local.set`, and every consumer reacts to `storage.onChanged`.
One code path, and the setting is already applied by the time the user presses Back
out of the full-screen popup.

**No background page, by design.** The content script is *declarative* and runs at
`document_start`, so Firefox re-runs it on every navigation and after a restart. That
covers reapplication for free — no `tabs.onUpdated` listener, no event page, nothing
to keep alive.

## Files

| File | Responsibility |
| --- | --- |
| `src/zoom-levels.js` | The zoom ladder, step/clamp arithmetic, and origin→storage-key derivation. Pure: no `browser.*`, no DOM. Shared verbatim by the popup, the content script and the unit tests. |
| `src/content.js` | Reads the stored factor, sets `zoom` on `<html>`, keeps it in sync, mounts/unmounts the overlay. |
| `src/overlay.js` | The optional on-page `− % + ×` bar, inside a closed shadow root. |
| `src/popup/` | The UI behind the Extensions menu row. |
| `tools/make-icons.mjs` | Renders `src/icons/*.png` from stroke geometry, so the icon is reviewable in a diff. |
| `tools/serve.mjs` | Static server for the Playwright suite (`node:http` only). |

`zoom-levels.js` and `overlay.js` are classic scripts that publish a global and also
`module.exports` themselves — content scripts are never ES modules, but the unit tests
need to `require()` the same file the browser loads.

## How the zoom is applied

```js
document.documentElement.style.zoom = "1.4";
```

CSS `zoom` (Firefox 126+) rather than `tabs.setZoom()`, which is unimplemented on
Android, and rather than `transform: scale()`, which does not reflow. Reasoning and
sources: [technical_choices.md](technical_choices.md).

Two details that are easy to lose:

- **Repaint guard.** Some sites rewrite the whole `style` attribute of `<html>`,
  which would drop the zoom. A `MutationObserver` on that attribute repaints. It
  cannot loop, because `paintZoom()` writes only when the current value differs.
- **`documentElement` may not exist yet.** At `document_start` the root element is
  normally present, but `whenRootExists()` falls back to a `MutationObserver` rather
  than assuming it.

## The overlay

It exists because of a platform constraint, not as a preference: Firefox for Android
renders an extension popup as a **full-screen fragment**, so the page is invisible
while you are adjusting it and you cannot see what a step did until you press Back.
The overlay is the only way to get live feedback. It is off by default.

- Lives in a **closed** shadow root attached to a host on `<html>` (not `<body>`, so
  page selectors like `body > div` cannot reach it). Page CSS cannot restyle it and
  page script cannot traverse into it.
- The host's inline styles are all `!important`, so no page stylesheet can hide or
  move it.
- **Inverse zoom.** Because the page zoom is set on `:root`, everything inside it —
  including the overlay — scales. The host sets `zoom: 1 / pageZoom` to cancel that,
  keeping the controls a constant physical size and their fixed offsets constant at
  every zoom level.
- `PageZoomOverlay.getShadowRoot()` exists for the end-to-end tests. It is not a hole
  in the closed root: content scripts run in an isolated world, so page script cannot
  see `PageZoomOverlay` at all.

## State

| Key | Value |
| --- | --- |
| `zoom:<origin>` | Number, 0.5–3. One key per origin; scheme, host and port all distinguish origins. |
| `overlayEnabled` | Boolean, global across sites. |

Pages without a meaningful origin (`about:`, `data:`, `moz-extension:`, `file:`) get
no key: `storageKeyFor()` returns `null`, the content script returns early, and the
popup says so instead of offering dead buttons.
