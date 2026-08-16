# AMO listing copy

Ready-to-paste values for the submission form at
<https://addons.mozilla.org/developers/addon/submit/>. Kept here so the listing is
versioned with the code and does not get rewritten from scratch at every release.

Everything below is English because AMO listings are, with `en-US` as the default
locale.

## Form values

| Field | Value |
| --- | --- |
| Distribution | **On this site** (listed) |
| Name | `Page Font Size Mobile` |
| Category | **Appearance** (`appearance`) |
| Licence | **MIT** |
| Homepage / Support site | `https://github.com/silviorelli/firefox_mobile_font_size` |
| Privacy policy | Not required — see [Data collection](#data-collection) |
| Source code upload | Not required — see [Source code](#source-code) |

## Summary

Max 250 characters. This one is 229.

```
Per-site page zoom for Firefox for Android — the Ctrl+ / Ctrl- that mobile Firefox never had. Text reflows to fit the screen, so you never scroll sideways. Each site keeps its own level, remembered across navigation and restarts.
```

## Description

```
Firefox on desktop has Ctrl+ and Ctrl- to make a page bigger or smaller. Firefox for Android has never had an equivalent, and the two things that come closest both fall short:

• Settings → Accessibility → Font Size is a single global slider. It applies to every site at once and needs a page reload.
• Pinch-to-zoom magnifies without reflowing, so lines run off the edge and you end up scrolling sideways to read a sentence.

Page Font Size Mobile gives you a proper per-site zoom instead.

WHAT IT DOES

• Zoom any site in or out, in the same steps desktop Firefox uses, from 50% to 300%.
• The page reflows. Text rewraps to the width of your screen, so there is no horizontal scrolling — on a phone this is better than what Ctrl+ does on desktop.
• Every site keeps its own level. Making one site bigger leaves the others alone.
• The level survives navigation and a full browser restart.
• Optional on-page controls. A small floating bar lets you adjust the zoom while watching the page change. It is off by default and can be switched back off from the bar itself.

HOW TO USE IT

Open the ⋮ menu → Extensions → Page Font Size Mobile, then tap − or + . Press Back to return to the page at its new size. Turn on "Show on-page controls" in the same panel if you would rather adjust the page while looking at it.

PRIVACY

Nothing is collected, and nothing leaves your device. Your zoom levels are stored locally, in the browser's own extension storage. The extension makes no network requests of any kind, and contains no remote code, no analytics and no trackers.

OPEN SOURCE

MIT licensed. The full source is at https://github.com/silviorelli/firefox_mobile_font_size — the uploaded package is that source, unmodified and unminified.

A KNOWN LIMIT, STATED HONESTLY

A few sites size elements in viewport units (vw/vh). Those units do not scale along with the zoom, so on such a site a full-width banner can still overflow horizontally at high zoom levels. This is a limitation of CSS zoom itself and cannot be fixed generically for third-party sites.
```

## Data collection

The manifest declares `data_collection_permissions: { "required": ["none"] }`, so the
submission form's data-disclosure step should be answered **"No data collected"**. No
privacy policy is required: the only stored state is the per-origin zoom factor and a
boolean for the overlay, both in `storage.local` on the device.

## Source code

AMO requires a source upload only when the reviewed code is not the code you wrote —
minified, bundled, compiled or transpiled. None of that applies here: the extension is
plain JS, HTML and CSS with **no build step**, and `web-ext build` only zips `src/`.
The uploaded package *is* the source, so answer **no**.

## Notes for reviewers

Paste into the *Notes for reviewers* field. It exists to pre-empt the one thing that
will be questioned — `<all_urls>` — so answer it before it is asked.

```
Scope of the permissions:

• <all_urls> is required because the whole purpose of the extension is to zoom whichever site the user is reading, and that site is not known in advance. It is used for exactly one thing: setting the CSS `zoom` property on the document's root element from a content script.

• "storage" holds the per-origin zoom factor and one boolean for the optional on-page controls. Local only.

There is no network access anywhere in the extension: no fetch, no XHR, no WebSocket, no remote code, no analytics. There is no background script. The manifest declares data_collection_permissions: {"required": ["none"]}.

Why CSS zoom rather than tabs.setZoom():

tabs.setZoom() is not implemented on Firefox for Android. The schema still declares the function, so it appears to exist, but the desktop implementation depends on FullZoom/ZoomManager which are browser/-only and absent from Fenix (https://bugzilla.mozilla.org/show_bug.cgi?id=1817783). The zoom therefore has to be applied as CSS from a content script running at document_start, which is also what makes it reapply automatically after navigation and after a restart without any background page.

Mobile UI:

Firefox for Android exposes exactly one extension row, under ⋮ → Extensions, and renders the action popup as a full-screen fragment. The popup is laid out for that: a viewport meta tag and 72px touch targets. Because the popup covers the page, the user cannot see the effect of a step until they press Back — which is the reason the optional on-page overlay exists. It is off by default.

Build:

No build step, no minification, no bundler. The package is the source as committed at
https://github.com/silviorelli/firefox_mobile_font_size

Testing: `npm test` (unit), `npm run test:e2e` (Playwright), `npm run lint` (web-ext, warnings as errors).
```

## Compatibility

Set from `browser_specific_settings` in the manifest, so AMO picks it up from the
package — nothing to fill in by hand:

- Firefox for Android **142.0+** — the target
- Firefox desktop **140.0+** — not the target, but not excludable either

Both floors come from `data_collection_permissions`, which `addons-linter` now
requires and which needs those versions. `gecko_android` is present, which is what
makes AMO list the add-on for Android at all.

**This add-on cannot be made Android-only.** `gecko_android` adds Android
compatibility; there is no key that removes desktop. The `gecko` key cannot simply be
dropped either — it carries the add-on `id` and `data_collection_permissions`. AMO's
per-version compatibility UI only sets a min/max *version* range per application, and
it locks the Android side precisely when `gecko_android` is used.

So desktop Firefox 140+ will still be able to install it. The name, the summary and
the description are what tell people it is built for the phone; the extension does
work on desktop, it is simply not what it is designed or tested for.

## Screenshots

Not uploaded yet. They can be added to the listing after submission, and are worth
adding: the popup at full screen, a page before and after zooming, and the optional
on-page controls.
