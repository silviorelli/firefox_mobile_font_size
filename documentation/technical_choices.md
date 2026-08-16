# Technical choices

Every decision below was forced by a platform limit rather than chosen from
preference. Sources are linked so the reasoning can be rechecked when Firefox for
Android changes.

## 1. The extension menu row is the only UI surface — there is no toolbar button

**We asked for buttons in the browser menu. Firefox for Android allows exactly one
row**, under ⋮ → Extensions, and that row is our `action`. Everything else is closed:

- **No toolbar pinning.** Browser-compat data carries an Android-specific note on
  `action.onUserSettingsChanged`: *"Never fires as there is no toolbar to pin
  extensions in Firefox for Android."* `action.getUserSettings().isOnToolbar` is
  unsupported on Android. Firefox 148's refreshed toolbar exposes a **closed enum** of
  shortcuts (`NEW_TAB, SHARE, BOOKMARK, TRANSLATE, HOMEPAGE, BACK, SUMMARIZE, NONE`)
  with no extension option.
- **No menu API.** [`browser.menus`](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/menus)
  is `version_added: false` for *every* member on Android, including the `tools_menu`
  and `action` context types. There is no way to add entries to the main app menu.
- **No keyboard shortcuts.** The `commands` namespace is entirely absent on Android,
  so there is no mobile equivalent of binding `Ctrl +`.
- `page_action` lands in the same Extensions list with no advantage, and is de-facto
  legacy; `sidebar_action` is unsupported on Android.

**Consequence:** one `action` with a `default_popup`. We chose a popup over a
bare `onClicked` handler because `onClicked` gives one step per menu round-trip
(menu → Extensions → tap), while the popup stays open across taps — nothing in
`WebExtensionActionPopupFragment` dismisses it on interaction — so `+` `+` `+` works.

**Consequence:** the popup must look like a mobile page, not a desktop panel. On
Firefox for Android it is a full-screen navigation destination, and AMO reviewers
check mobile usability explicitly. Hence the viewport meta tag and 72px steppers.

## 2. CSS `zoom`, not `tabs.setZoom()`

`tabs.setZoom()` is the obvious tool and **it does not work on Firefox for Android.**
`mobile/shared/components/extensions/ext-tabs.js` implements no zoom methods; the
desktop implementation depends on `FullZoom`/`ZoomManager`, which are `browser/`-only
and absent from Fenix. [Bug 1817783](https://bugzilla.mozilla.org/show_bug.cgi?id=1817783)
is NEW/P3, unassigned, with no activity since 2025-02-24.

A trap worth recording: the schema still *declares* the zoom functions, so
`typeof browser.tabs.setZoom === "function"` is true on Android — the call fails at
runtime instead. Feature detection would have to be `try { await
browser.tabs.getZoom() } catch {}`. We avoid the question entirely by not using it.

So the zoom is applied as CSS from the content script:

```js
document.documentElement.style.zoom = "1.4";
```

| Candidate | Verdict |
| --- | --- |
| **`zoom` on `:root`** | **Chosen.** Firefox 126+ on desktop and Android. Affects layout, so text reflows to the viewport — on a phone this is better than desktop `Ctrl +`, because you never scroll sideways. |
| `-moz-text-size-adjust` / `text-size-adjust` | **Cannot scale text at all.** Gecko accepts only `auto \| none` — there is no `<percentage>` form. It merely toggles the font-inflation heuristic, which is off by default (`font.size.inflation.minTwips: 0`). Browser-compat data is misleading here; the Gecko property definition is authoritative. |
| `html { font-size: N% }` | Only moves `rem`/`em`-derived sizes. Silently does nothing on the many sites that set body copy in `px`. |
| `transform: scale()` | No reflow, so it forces horizontal scrolling — the exact problem pinch-zoom already has. Also creates a containing block that breaks every `position: fixed` header, nav and modal. |
| Per-element computed `font-size × factor` | True text-only zoom, but fragile: it pins used px values (breaking `em` cascades), fights author `!important`, misses shadow DOM, and needs a full-DOM pass per mutation batch. Out of scope; revisit only if text-only zoom is actually wanted. |

**Known limitation of CSS `zoom`:** `vw`/`vh` units do not scale with it — they
resolve against the initial containing block, which sits outside the zoomed `<html>`.
A `width: 100vw` hero can therefore overflow horizontally at high zoom. This is not
fixable generically for third-party sites.

SVG scales incorrectly with `zoom` before Firefox 131, which set the original version
floor — since superseded by the higher floor in §4.

## 3. Manifest V3, no background page

Extension Workshop still recommends MV2 for Android targets, but that page is dated
2023-11-12 and the gaps it cites do not apply here: we have no background service
worker (Firefox does not support `background.service_worker` at all — event pages
only), and no runtime host-permission prompting. MV3 `action` has worked on Android
since Firefox 109.

MV2 remains a safe fallback: Mozilla has committed to supporting it "for the
foreseeable future" with at least 12 months' notice.

Host permissions are declared in the manifest and, since **Firefox 127**, granted at
install time for MV3 rather than requiring the user to opt in. They can still be
revoked, and a revoked host permission means the content script never runs — so the
popup checks `permissions.contains()` and explains that, rather than looking broken.

## 4. Version floors are set by `data_collection_permissions`, not by the zoom

`browser_specific_settings.gecko.data_collection_permissions` is now required by
`addons-linter` for new extensions. We declare `{"required": ["none"]}` because the
extension collects nothing — everything stays in `storage.local` on the device.

That key needs Firefox **140** on desktop and **142** on Android, which is what
`strict_min_version` reflects. Both are above the 131 that CSS `zoom` needed for
correct SVG scaling, so the zoom requirement no longer binds. `web-ext lint` enforces
this pairing (`KEY_FIREFOX_ANDROID_UNSUPPORTED_BY_MIN_VERSION`) and catches it if the
floors are ever lowered.

`browser_specific_settings.gecko_android` must be present at all, empty object or
not: without it AMO assumes the extension is desktop-only and will not list it for
Android.

## 5. "Android only" is not expressible — the name carries it instead

The extension targets Firefox for Android and nothing else, but **that cannot be
declared.** `gecko_android` *adds* Android compatibility and there is no inverse key
that removes desktop. Dropping `gecko` is not an option either: it holds the add-on
`id` and `data_collection_permissions`. AMO's per-version compatibility screen only
sets a min/max version range per application, and it locks the Android side exactly
when `gecko_android` is in use.

Desktop Firefox 140+ can therefore still install it, and it will work — full-page CSS
`zoom` is not Android-specific. What is Android-specific is everything the design was
bent around: the single Extensions menu row, the full-screen popup, and reflow
mattering more than magnification. The product name (`Page Font Size Mobile`), the
summary and the description are the only honest signal available.

Consequently the icon set is 48 and 96 only. The 16 and 32 sizes are desktop toolbar
sizes; 16 was never referenced by the manifest at all and was shipping as dead weight.

## 6. Playwright cannot load a Firefox extension — what we test instead

AGENTS.md mandates Playwright for end-to-end tests. **Playwright cannot install a
WebExtension in Firefox**: its docs state extensions "only work in Chromium when
launched with a persistent context", and
[microsoft/playwright#7297](https://github.com/microsoft/playwright/issues/7297) is
closed as `P3-collecting-feedback`. The structural reason is that Playwright drives
Firefox over its own patched Juggler protocol rather than WebDriver BiDi, so the
standardised `webExtension.install` command is unreachable. This is flagged here per
AGENTS.md's "flag uncertainty explicitly" rule.

What the suite does instead, still against **real Firefox**:

- **`e2e/popup.spec.js`** loads `popup.html` over HTTP with `browser.*` stubbed by
  `page.addInitScript()`, and drives the real UI.
- **`e2e/content.spec.js`** loads a fixture page, injects the real content scripts in
  manifest order, and asserts the real effects: `:root` zoom, text reflow without
  horizontal overflow, the repaint guard, the closed shadow root, inverse-zoom
  compensation, and every overlay interaction.

The stub's `storage.local.set` genuinely notifies `storage.onChanged` listeners,
because that round trip *is* the wiring between popup, overlay and content script —
stubbing it out would hide the interesting bugs.

**What this cannot cover:** installation, the manifest being honoured, the Extensions
menu row, `document_start` timing, and every Android-specific behaviour. Those are
verified by hand with `web-ext run -t firefox-android`; the checklist is in
[commands_cheatsheet.md](commands_cheatsheet.md).

`playwright-webextext` would keep the literal Playwright API for extension loading,
but it is an unmaintained 0.0.x package (~31 stars, last published around two years
ago) — not a dependency worth taking to satisfy the letter of a rule. A
`selenium-webdriver` smoke test using `installAddon()` is the one option that would
genuinely install the extension in desktop Firefox, and is the natural next step if
install-level coverage becomes worth a second browser-automation dependency.

## 7. Zero runtime dependencies

Plain JS, HTML and CSS with no build step: `web-ext build` only zips. Per AGENTS.md's
dependency policy, the only dev dependencies are `web-ext` (required to lint, run and
sign) and `@playwright/test` (mandated for E2E).

Everything else uses the standard library:

- **Unit tests**: `node:test` + `node:assert`, with a small hand-rolled `browser`
  mock. `sinon-chrome` ships schemas from Chrome 53 and is stale; `@webext-core/fake-browser`
  is good but unnecessary given the popup DOM is already tested in real Firefox.
- **Test server**: `node:http` in `tools/serve.mjs` rather than `http-server`.
- **Icons**: `node:zlib` in `tools/make-icons.mjs` writes the PNGs directly from
  stroke geometry, so there is no image toolchain and the icon is reviewable as code.
