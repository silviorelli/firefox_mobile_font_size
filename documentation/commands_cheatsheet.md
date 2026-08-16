# Commands cheatsheet

## Setup

```shell
asdf install                      # Node 24 LTS, from .tool-versions
npm install
npx playwright install firefox
```

`asdf reshim nodejs` after any global npm install, or the binary is not on PATH.

## Everyday

| Command | What it does |
| --- | --- |
| `npm test` | Unit tests (`node:test`), no browser. |
| `npm run test:e2e` | Playwright in real Firefox. Starts its own server. |
| `npm run lint` | `web-ext lint`, warnings as errors, Android-aware. |
| `npm run start:desktop` | Desktop Firefox + DevTools. |
| `npm run start:android` | Connected Android device. |
| `npm run build` | Zips to `web-ext-artifacts/`. |
| `npm run icons` | Regenerates `src/icons/*.png`. |

```shell
npx playwright test --headed --project=firefox      # watch it run
npx playwright test e2e/content.spec.js -g overlay  # one file, one pattern
node --test --watch "tests/**/*.test.js"            # unit tests on save
```

## On a phone

Firefox for Android never runs an unsigned add-on, so there are two routes:

| | `adb` | Signed `.xpi` |
| --- | --- | --- |
| For | dev loop, seconds per change | real use, and testing the real install |
| Needs | cable, USB debugging | AMO credentials, no cable |
| Install | temporary, gone when Firefox closes | permanent |

### `adb` route

Two developer modes, in two different places, **both** required:

1. Android **Settings → About phone** → tap **Build number** ×7.
2. Android **Settings → System → Developer options** → **USB debugging**.
3. Firefox **Settings → Advanced → Remote debugging via USB**.

Then plug in, unlock, accept *Allow USB debugging?* → **Always allow**.

```shell
brew install --cask android-platform-tools   # one time
adb devices                                  # want "device", not "unauthorized"
npm run start:android
ADB_DEVICE=<id> npm run start:android        # only when several are attached
```

| Channel | `--firefox-apk` |
| --- | --- |
| Release | `org.mozilla.firefox` (default in `web-ext-config.mjs`) |
| Beta | `org.mozilla.firefox_beta` |
| Nightly | `org.mozilla.fenix` |

Gotchas:

- **Unlocked, awake, at least one tab open**, or the run hangs and Node exits
  `code 13` (*unsettled top-level await*) — an error that points nowhere near the cause.
- `unauthorized` → unlock and replug; still nothing → **Developer options → Revoke USB
  debugging authorizations**.
- Unplugged mid-run leaves artifacts: `--adb-remove-old-artifacts`.

```shell
adb shell dumpsys window | grep -E 'mAwake|mDreamingLockscreen'  # locked or asleep?
adb shell pidof org.mozilla.firefox                              # running?
adb shell cat /proc/net/unix | grep firefox                      # socket = debugging on
adb logcat | grep page-font-size                                 # manifest/load errors
```

### Signed `.xpi` route

1. Sign it (below) → `.xpi` in `web-ext-artifacts/`.
2. Move the file to the phone, any way at all.
3. Phone: **Settings → About Firefox** → tap the logo ×5 → *Debug menu enabled*.
4. **Settings → Install Extension from File** → pick it → **Add**.

Requires an explicit `browser_specific_settings.gecko.id`, already declared.

### Inspecting

Desktop `about:debugging` → device → **Connect** → **Processes → Main Process →
Inspect**. The popup DOM is *not* inspectable ([bug 1637616](https://bugzil.la/1637616));
open `popup/popup.html` as a normal tab instead.

## Manual checks

Playwright cannot install the extension, so after any change to the manifest, the
overlay or the content script:

1. ⋮ → Extensions → popup opens full-screen.
2. Repeated `+` → popup stays open, percentage steps up.
3. Back → page reflowed, **no horizontal scrolling**.
4. Navigate, then fully restart Firefox → zoom persists.
5. Other sites unaffected, each with its own level.
6. Overlay on → constant physical size at every zoom, adjusts live.
7. Overlay `×` → off on other tabs and after a restart.
8. `about:config` → popup explains, rather than offering dead buttons.

## Releasing

Listing text to paste into the form: [amo-listing.md](amo-listing.md).

```shell
# 1. bump version in BOTH src/manifest.json and package.json — AMO rejects a reused one
npm test && npm run lint && npm run test:e2e
npm run start:android                        # then walk the manual checks
rm -rf web-ext-artifacts && npm run build
unzip -l web-ext-artifacts/page_font_size_mobile-<version>.zip   # 11 files, nothing else
git tag -a v<version> -m "..." && git push origin v<version>
```

Upload at <https://addons.mozilla.org/developers/addon/submit/>. Neither a privacy
policy nor a source upload is required — both settled in [amo-listing.md](amo-listing.md).

## Signing

Credentials live in `.env` (gitignored) and are never inlined into a command:

```shell
set -a && source .env && set +a
npx web-ext sign --source-dir=src --channel=unlisted \
  --api-key="$AMO_JWT_ISSUER" --api-secret="$AMO_JWT_SECRET"
```

`--channel=listed` publishes to AMO instead; a first listed submission from the CLI
also needs `--amo-metadata=./amo-metadata.json`. Bump the manifest version before
every run, re-signs included.
