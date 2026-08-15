export default {
  sourceDir: "src",
  build: {
    overwriteDest: true,
  },
  run: {
    // Release Firefox for Android. Nightly is org.mozilla.fenix, Beta is
    // org.mozilla.firefox_beta. Override with --firefox-apk on the CLI.
    firefoxApk: "org.mozilla.firefox",
  },
  ignoreFiles: ["**/*.md"],
};
