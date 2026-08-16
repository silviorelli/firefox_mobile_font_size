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

## Getting it onto a phone

There are two routes and they do different jobs. Both exist because **Firefox for
Android will not run an unsigned add-on**: `xpinstall.signatures.required` cannot be
turned off on Release or Beta builds, so copying the folder across is never an option.

| | `adb` route | Signed `.xpi` route |
| --- | --- | --- |
| For | The **development loop** — edit, reload, repeat. | **Real use**, and testing that it installs like a real add-on. |
| Needs `adb` and a cable | Yes | No — any way of moving a file to the phone works |
| Needs AMO credentials | No | Yes, signing happens on Mozilla's servers |
| Signing | Bypassed — installs **temporarily** over the debug socket | Required |
| Survives closing Firefox | **No**, the add-on disappears | Yes, it is a permanent install |
| Turnaround per change | Seconds | A version bump plus a round trip to AMO |

So: `adb` while building, signed `.xpi` to confirm the real install path and to put it
on a phone you would rather not tether.

### Route 1 — `adb`, temporary install

**Two separate developer modes have to be on, in two different places.** Turning on
one does not turn on the other, and `adb devices` will show nothing until both are.

In **Android's** settings:

1. **Settings → About phone** → tap **Build number** seven times, until it confirms
   you are a developer.
2. **Settings → System → Developer options** → enable **USB debugging**.

In **Firefox's own** settings:

3. **Settings → Advanced → Remote debugging via USB** → on. (This one is a normal
   setting; it does not need the hidden debug menu from route 2.)

Then plug in over USB, unlock the screen, and approve the *Allow USB debugging?*
prompt — tick **Always allow from this computer**.

On the machine:

```shell
brew install --cask android-platform-tools   # provides adb, one time
adb devices                                  # must say "device", not "unauthorized"
npm run start:android
```

`unauthorized` means the trust prompt was never shown or never accepted: unlock the
screen and replug, and if it still does not appear, use **Developer options → Revoke
USB debugging authorizations** and replug.

**Device selection.** `web-ext` will not pick a device on its own even when exactly
one is attached — it fails with `UsageError: Select an android device using
--android-device=<name>`. `web-ext-config.mjs` resolves the serial from `adb devices`
so `npm run start:android` needs no arguments. With several devices attached it
cannot guess, so name the one you want:

```shell
ADB_DEVICE=5B220DLCR000P0 npm run start:android   # or --adb-device=<id> on the CLI
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

- **Unlock the phone and keep it awake**, with Firefox in the foreground and **at
  least one tab open**. `web-ext` restarts Firefox itself, then waits for a browsing
  context; a locked or sleeping screen never gives it one, so it hangs and Node
  eventually bails out with `exit code 13` (*unsettled top-level await*) — which says
  nothing about the real cause.
- The add-on installs into the **main profile**, temporarily, and is gone when you
  close Firefox. Temporary installation bypasses signing, so this works on Release.
- If you unplug mid-run, clear leftovers with `--adb-remove-old-artifacts`.

When a run hangs, these three tell you which layer is at fault:

```shell
adb shell dumpsys window | grep -E 'mAwake|mDreamingLockscreen'   # asleep or locked?
adb shell pidof org.mozilla.firefox                               # Firefox running?
adb shell cat /proc/net/unix | grep firefox                       # RDP socket present?
```

A missing `@org.mozilla.firefox/firefox-debugger-socket` is the one that really means
**Remote debugging via USB** is off.

### Route 2 — signed `.xpi`, permanent install, no cable

Here only **Firefox's** hidden debug menu matters. Android Developer options, USB
debugging and `adb` are all irrelevant — nothing is plugged in.

1. Sign the build (see [Signing](#signing)) → a `.xpi` lands in `web-ext-artifacts/`.
2. Get that file onto the phone — cloud drive, email, download link, anything.
3. On the phone: **Settings → About Firefox** → tap the Firefox logo **five times** in
   quick succession → *Debug menu enabled*.
4. Back out to **Settings → Install Extension from File** → pick the `.xpi` → **Add**.

This route requires the add-on to declare an explicit ID, which we already do
(`browser_specific_settings.gecko.id`, `page-font-size@relli.it`) —
self-distributed extensions cannot use an AMO-generated one.

The same hidden menu also offers **Custom Add-on Collection**, an older workaround
that pulls add-ons from an AMO collection. We do not need it: it only serves *listed*
add-ons and it silently uninstalls anything outside the collection.

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

## Releasing

The listing text lives in [amo-listing.md](amo-listing.md) — summary, description,
category, licence and the reviewer notes, ready to paste into the submission form.

1. Bump `version` in **both** `src/manifest.json` and `package.json`. The manifest is
   the one that counts; `package.json` is kept in step so the two cannot drift. AMO
   refuses a version it has already seen, so this is not optional.
2. `npm test && npm run lint && npm run test:e2e` — all three green.
3. `npm run start:android` on an unlocked phone, then walk the manual checklist above.
   Nothing else covers the Android behaviour.
4. `rm -rf web-ext-artifacts` then `npm run build`, so the directory holds exactly one
   zip and the wrong version cannot be uploaded by accident.
5. Check what is actually in it:

   ```shell
   unzip -l web-ext-artifacts/page_font_size-<version>.zip
   ```

   Expect `manifest.json` at the right version, the three content scripts, `popup/`
   and `icons/` — and nothing else. No `node_modules`, no `.env`, no tests.
6. Upload at <https://addons.mozilla.org/developers/addon/submit/>, or sign from the
   CLI as below.
7. Tag the release: `git tag -a v<version> -m "..." && git push origin v<version>`.

Two answers the form asks for that are easy to get wrong, both settled in
[amo-listing.md](amo-listing.md): **no** privacy policy is needed (the manifest
declares it collects nothing), and **no** source upload is needed (there is no build
step, so the package already is the source).

## Signing

`web-ext sign` uploads to Mozilla and returns a signed `.xpi`. It needs AMO API
credentials — keep them in `.env` (already gitignored) and never inline them into a
command:

```shell
set -a && source .env && set +a
```

**Unlisted** — self-distribution. No public listing, no review queue for a normal
add-on like this one, and the result is the `.xpi` that route 2 above installs:

```shell
npx web-ext sign --source-dir=src --channel=unlisted \
  --api-key="$AMO_JWT_ISSUER" --api-secret="$AMO_JWT_SECRET"
```

**Listed** — published on addons.mozilla.org, subject to review:

```shell
npx web-ext sign --source-dir=src --channel=listed \
  --api-key="$AMO_JWT_ISSUER" --api-secret="$AMO_JWT_SECRET"
```

A first listed submission also needs `--amo-metadata=./amo-metadata.json` with at
least `summary`, `categories` and `version.license`.

AMO refuses a version it has already signed, so **bump `version` in
`src/manifest.json`** before every signing run — including re-signs during testing.
