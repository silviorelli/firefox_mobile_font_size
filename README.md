# Page Font Size Mobile

Per-site page zoom for **Firefox for Android** — the `Ctrl +` / `Ctrl -` that mobile
Firefox never had.

Firefox for Android's only built-in text control is a *global* slider
(Settings → Accessibility → Font Size) that applies to every site and needs a page
reload. Pinch-to-zoom magnifies without reflowing, so you end up scrolling sideways
to read a line. This extension gives you a zoom level **per site**, remembered across
navigations and restarts, and it reflows the page so text rewraps to the screen.

## Using it

**⋮ → Extensions → Page Font Size Mobile** opens the controls: `−`, the current
percentage, `+`, and Reset. The zoom applies immediately; press Back to see the page.

Firefox for Android renders extension popups full-screen, so the page is hidden while
you are adjusting it. If you would rather see the size change as you tap, switch on
**Show on-page controls** in the popup — a small floating `− 140% +` bar appears on
the page itself. It is **off by default**, and its `×` button switches it back off.

Zoom runs from 50% to 300% along the same ladder desktop Firefox uses.

## Install for development

```shell
asdf install                 # Node 24 LTS, per .tool-versions
npm install
```

Firefox for Android never runs unsigned add-ons, so there are two ways onto a phone:

```shell
npm run start:android        # adb + USB cable; temporary, gone when Firefox closes
npm run build                # or sign an .xpi and install it from the phone's debug menu
```

The `adb` route is the fast development loop; the signed `.xpi` is a permanent install
and needs no cable. Both are written up, along with the two developer-mode toggles the
`adb` route depends on, in
[documentation/commands_cheatsheet.md](documentation/commands_cheatsheet.md). See
[documentation/architecture.md](documentation/architecture.md) for how it works.

## Requirements

- Firefox for Android **142+** (Firefox **140+** on desktop, where it also works).

## Why it is built the way it is

Three Firefox-for-Android platform limits drove the whole design — the extension menu
row is the *only* UI surface available, `tabs.setZoom()` does not exist on Android,
and the popup hides the page. Each is documented with sources in
[documentation/technical_choices.md](documentation/technical_choices.md).

## Licence

MIT — see [LICENSE](LICENSE).
