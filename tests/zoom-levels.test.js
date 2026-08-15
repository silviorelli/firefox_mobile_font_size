"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const ZoomLevels = require("../src/zoom-levels.js");

test("the ladder is sorted, includes 100%, and spans 50%-300%", () => {
  const sorted = [...ZoomLevels.STEPS].sort((a, b) => a - b);
  assert.deepEqual(ZoomLevels.STEPS, sorted);
  assert.ok(ZoomLevels.STEPS.includes(ZoomLevels.DEFAULT));
  assert.equal(ZoomLevels.MIN, 0.5);
  assert.equal(ZoomLevels.MAX, 3);
});

test("stepUp walks to the next rung", () => {
  assert.equal(ZoomLevels.stepUp(1), 1.1);
  assert.equal(ZoomLevels.stepUp(1.1), 1.2);
  assert.equal(ZoomLevels.stepUp(0.5), 0.67);
});

test("stepDown walks to the previous rung", () => {
  assert.equal(ZoomLevels.stepDown(1), 0.9);
  assert.equal(ZoomLevels.stepDown(1.1), 1);
  assert.equal(ZoomLevels.stepDown(3), 2.4);
});

test("stepping saturates at the ends instead of running off", () => {
  assert.equal(ZoomLevels.stepUp(ZoomLevels.MAX), ZoomLevels.MAX);
  assert.equal(ZoomLevels.stepDown(ZoomLevels.MIN), ZoomLevels.MIN);
  assert.equal(ZoomLevels.stepUp(99), ZoomLevels.MAX);
  assert.equal(ZoomLevels.stepDown(-99), ZoomLevels.MIN);
});

test("stepping snaps onto the ladder from a value between rungs", () => {
  assert.equal(ZoomLevels.stepUp(1.25), 1.33);
  assert.equal(ZoomLevels.stepDown(1.25), 1.2);
});

test("float noise from stored values does not make a step stand still", () => {
  // 1.33 read back from JSON must still advance rather than re-selecting itself.
  assert.equal(ZoomLevels.stepUp(1.3300000000000001), 1.5);
  assert.equal(ZoomLevels.stepDown(0.6699999999999999), 0.5);
});

test("clamp rejects junk and out-of-range values", () => {
  assert.equal(ZoomLevels.clamp(undefined), ZoomLevels.DEFAULT);
  assert.equal(ZoomLevels.clamp(null), ZoomLevels.DEFAULT);
  assert.equal(ZoomLevels.clamp("nonsense"), ZoomLevels.DEFAULT);
  assert.equal(ZoomLevels.clamp(NaN), ZoomLevels.DEFAULT);
  assert.equal(ZoomLevels.clamp(Infinity), ZoomLevels.DEFAULT);
  assert.equal(ZoomLevels.clamp(0), ZoomLevels.MIN);
  assert.equal(ZoomLevels.clamp(1000), ZoomLevels.MAX);
  assert.equal(ZoomLevels.clamp("1.5"), 1.5);
});

test("isDefault only accepts 100%", () => {
  assert.equal(ZoomLevels.isDefault(1), true);
  assert.equal(ZoomLevels.isDefault(1.0000000001), true);
  assert.equal(ZoomLevels.isDefault(1.1), false);
});

test("toPercent rounds to whole percent", () => {
  assert.equal(ZoomLevels.toPercent(1), 100);
  assert.equal(ZoomLevels.toPercent(0.67), 67);
  assert.equal(ZoomLevels.toPercent(1.33), 133);
  assert.equal(ZoomLevels.toPercent(3), 300);
});

test("storage keys are per origin, ignoring path, query and fragment", () => {
  const key = ZoomLevels.storageKeyFor("https://example.com/a/b?c=d#e");
  assert.equal(key, "zoom:https://example.com");
  assert.equal(ZoomLevels.storageKeyFor("https://example.com/other"), key);
});

test("storage keys separate scheme, host and port", () => {
  const https = ZoomLevels.storageKeyFor("https://example.com/");
  assert.notEqual(ZoomLevels.storageKeyFor("http://example.com/"), https);
  assert.notEqual(ZoomLevels.storageKeyFor("https://other.example.com/"), https);
  assert.notEqual(ZoomLevels.storageKeyFor("https://example.com:8443/"), https);
});

test("pages we cannot meaningfully zoom have no storage key", () => {
  for (const url of [
    "about:blank",
    "about:config",
    "data:text/html,hi",
    "moz-extension://abc/popup.html",
    "file:///Users/x/index.html",
    "not a url",
    "",
    undefined,
  ]) {
    assert.equal(ZoomLevels.storageKeyFor(url), null, `expected no key for ${url}`);
  }
});
