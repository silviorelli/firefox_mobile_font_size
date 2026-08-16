import { execFileSync } from "node:child_process";

// web-ext refuses to pick a device even when exactly one is attached, so
// `web-ext run -t firefox-android` fails with "Select an android device using
// --android-device=<name>". Resolve the serial here so `npm run start:android`
// works unattended. Set ADB_DEVICE to override, which is what you need when more
// than one device is attached.
function detectAdbDevice() {
  if (process.env.ADB_DEVICE) return process.env.ADB_DEVICE;

  // Only the `run` command talks to a device; don't spawn adb during lint/build.
  if (!process.argv.includes("run")) return undefined;

  let output;
  try {
    output = execFileSync("adb", ["devices"], { encoding: "utf8" });
  } catch {
    return undefined; // adb missing or not on PATH — let web-ext report it.
  }

  // Skip the "List of devices attached" header, keep only fully-booted devices:
  // "unauthorized" (trust prompt not accepted) and "offline" cannot be used.
  const ready = output
    .split("\n")
    .slice(1)
    .map((line) => line.trim().split(/\s+/))
    .filter(([serial, state]) => serial && state === "device")
    .map(([serial]) => serial);

  return ready.length === 1 ? ready[0] : undefined;
}

const adbDevice = detectAdbDevice();

export default {
  sourceDir: "src",
  build: {
    overwriteDest: true,
  },
  run: {
    // Release Firefox for Android. Nightly is org.mozilla.fenix, Beta is
    // org.mozilla.firefox_beta. Override with --firefox-apk on the CLI.
    firefoxApk: "org.mozilla.firefox",
    // web-ext type-checks every key it finds, on every command, and rejects an
    // undefined one — so omit it entirely rather than setting it empty.
    ...(adbDevice ? { adbDevice } : {}),
  },
  ignoreFiles: ["**/*.md"],
};
