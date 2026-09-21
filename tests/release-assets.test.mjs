import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  describeReleaseAsset,
  fallbackReleaseNotes,
  platformLabel,
} from "../web/src/lib/release-assets.js";

const downloadSource = readFileSync(new URL("../web/src/pages/Download.jsx", import.meta.url), "utf8");

test("only available artifacts become download links", () => {
  const ready = describeReleaseAsset({
    os: "windows",
    available: true,
    url: "/api/download/windows",
    minimum: "Windows 10",
  });
  assert.equal(ready.ready, true);
  assert.equal(ready.action, "download");
  assert.equal(ready.href, "/api/download/windows");
  assert.match(ready.buttonLabel, /下载 Windows 版/);
  assert.equal(ready.statusLabel, "已打包");
  assert.equal(ready.hint, "Windows 10");
});

test("missing artifacts stay not-ready and never point at a download URL", () => {
  const missing = describeReleaseAsset({ os: "macos", available: false, url: "/api/download/macos" });
  assert.equal(missing.ready, false);
  assert.equal(missing.action, "unavailable");
  assert.equal(missing.href, "");
  assert.equal(missing.buttonLabel, "尚未打包");
  assert.equal(missing.statusLabel, "产物未就绪");
  assert.match(missing.hint, /ASSET_NOT_READY/);
  assert.equal(describeReleaseAsset({ os: "linux" }).ready, false);
  assert.equal(describeReleaseAsset({ os: "windows", available: true, url: "" }).href, "/api/download/windows");
});

test("platform labels stay explicit", () => {
  assert.equal(platformLabel("windows"), "Windows");
  assert.equal(platformLabel("macos"), "macOS");
  assert.equal(platformLabel("linux"), "Linux");
  assert.match(fallbackReleaseNotes(), /available/);
});

test("Download page uses the helper and does not treat GitHub as a download", () => {
  assert.match(downloadSource, /describeReleaseAsset/);
  assert.match(downloadSource, /fallbackReleaseNotes/);
  assert.match(downloadSource, /data-testid="download-unavailable"/);
  assert.doesNotMatch(downloadSource, /前往发布页/);
  assert.doesNotMatch(downloadSource, /github\.com\/.*\/releases/);
});
