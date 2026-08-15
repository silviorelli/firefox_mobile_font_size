# Commands cheatsheet

## Setup

```shell
asdf install          # Node 24 LTS, from .tool-versions
npm install
npx playwright install firefox
```

`asdf reshim nodejs` after any global npm install, or the binary will not be on PATH.

## Everyday

| Command | What it does |
| --- | --- |
| `npm test` | Unit tests (`node:test`), no browser needed. |
| `npm run test:e2e` | Playwright suite in real Firefox. Starts `tools/serve.mjs` itself. |
| `npm run lint` | `web-ext lint`, warnings treated as errors. Android-aware. |
| `npm run start:desktop` | Runs the extension in desktop Firefox with DevTools. |
| `npm run start:android` | Runs it on a connected Android device. |
| `npm run build` | Zips to `web-ext-artifacts/`. |
| `npm run icons` | Regenerates `src/icons/*.png` from `tools/make-icons.mjs`. |

Useful variants:

```shell
npx playwright test --headed --project=firefox      # watch it run
npx playwright test e2e/content.spec.js -g overlay  # one file, one pattern
node --test --watch "tests/**/*.test.js"            # unit tests on save
```

## Running on a real Android device

One-time, on the machine:

```shell
brew install --cask android-platform-tools   # provides adb
```

One-time, on the phone:

1. Enable **Developer options**, then **USB debugging**.
2. In Firefox: **Settings → Remote debugging via USB**.
3. Plug in over USB and approve the debugging prompt.

```shell
adb devices                    # should list the device as "device", not "unauthorized"
npm run start:android
```

Pick the APK to match the Firefox you have installed:

| Channel | Package |
| --- | --- |
| Release | `org.mozilla.firefox` (the default in `web-ext-config.mjs`) |
| Beta | `org.mozilla.firefox_beta` |
| Nightly | `org.mozilla.fenix` |

```shell
npx web-ext run -t firefox-android --adb-device <id> --firefox-apk org.mozilla.fenix
```

Notes that cost time if you do not know them:

- **At least one tab must be open** or the extension will not load.
- The add-on installs into the **main profile**, temporarily, and is gone when you
  close Firefox. Temporary installation bypasses signing, so this works on Release.
- If you unplug mid-run, clear leftovers with `--adb-remove-old-artifacts`.

### Debugging on device

```shell
adb logcat | grep page-font-size          # manifest and load errors
```

Desktop `about:debugging` → the device in the left column → **Connect** → approve on
the phone → **Processes → Main Process → Inspect**.

The popup's DOM is **not** inspectable on Firefox for Android
([bug 1637616](https://bugzil.la/1637616)). Open `popup/popup.html` as a normal tab to
inspect it instead.

## Manual verification checklist

The Playwright suite cannot install the extension or test Android behaviour, so run
through this on a device after any change to the manifest, the overlay or the
content script:

1. ⋮ → **Extensions** → **Page Font Size** opens the popup full-screen.
2. Tapping `+` repeatedly keeps the popup open and steps the percentage up.
3. Back → the page has reflowed at the new size, with **no horizontal scrolling**.
4. Navigate within the site, then fully restart Firefox → the zoom is still applied.
5. A different site is unaffected, and has its own independent level.
6. Enable **Show on-page controls** → the floating bar appears, stays the same
   physical size at every zoom level, and adjusts the page live.
7. The bar's `×` switches it off, and it stays off on other tabs and after a restart.
8. On `about:config`, the popup explains that the page cannot be zoomed rather than
   offering dead buttons.

## Publishing

`web-ext sign` needs AMO API credentials. Keep them in `.env` (already gitignored)
and never inline them into a command:

```shell
set -a && source .env && set +a
npx web-ext sign --source-dir=src --channel=listed \
  --api-key="$AMO_JWT_ISSUER" --api-secret="$AMO_JWT_SECRET"
```

A first listed submission also needs `--amo-metadata=./amo-metadata.json` with at
least `summary`, `categories` and `version.license`.
