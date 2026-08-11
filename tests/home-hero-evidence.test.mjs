import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import test from "node:test";

test("Home Hero evidence hash ignores capture time but tracks behavior", async () => {
  let stableEvidenceSha256;
  try {
    ({ stableEvidenceSha256 } = await import(
      pathToFileURL("app/lib/visual-evidence.mjs").href
    ));
  } catch (error) {
    assert.fail(`stable evidence hashing is unavailable: ${error.code || error.message}`);
  }

  const report = {
    generatedAt: "2026-08-07T08:00:00.000Z",
    browserErrors: [],
    mobileMenu: { expanded: false, mobileNavMounted: false },
    viewports: [{
      width: 390,
      horizontalOverflow: false,
      mock: { top: 666.0404 },
      screenshot: { path: "home-hero-390x844.png", bytes: 308599, sha256: "a".repeat(64) },
    }],
  };
  const recaptured = {
    ...report,
    generatedAt: "2026-08-07T09:00:00.000Z",
    viewports: [{
      width: 390,
      horizontalOverflow: false,
      mock: { top: 666.0426 },
      screenshot: { path: "home-hero-390x844.png", bytes: 309683, sha256: "b".repeat(64) },
    }],
  };
  const regressed = {
    ...recaptured,
    viewports: [{ ...recaptured.viewports[0], horizontalOverflow: true }],
  };

  const expected = stableEvidenceSha256(report);
  assert.match(expected, /^[a-f0-9]{64}$/);
  assert.equal(stableEvidenceSha256(recaptured), expected);
  assert.notEqual(stableEvidenceSha256(regressed), expected);
});
