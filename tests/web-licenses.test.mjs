import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const read = (p) => readFileSync(resolve("web", p), "utf8");
const adminSource = read("src/pages/admin/AdminLicenses.jsx");
const accountSource = read("src/pages/app/Account.jsx");
const appSource = read("src/App.jsx");
const layoutSource = read("src/pages/admin/AdminLayout.jsx");
const css = read("src/styles/pages.css");

test("admin licenses page issues and tracks codes via the real API", () => {
  assert.match(adminSource, /\/api\/admin\/licenses/);
  assert.match(adminSource, /签发激活码/);
  assert.match(adminSource, /license-codes/);
  assert.match(adminSource, /redeemedByName/);
  // Honesty: no fake payment-gateway integration is claimed.
  assert.match(adminSource, /不伪造支付网关对接/);
  assert.match(css, /\.license-codes \{/);
});

test("account page shows the plan and redeems codes", () => {
  assert.match(accountSource, /\/api\/account\/redeem/);
  assert.match(accountSource, /计划与许可/);
  assert.match(accountSource, /planExpiresAt/);
  assert.match(accountSource, /兑换激活码/);
});

test("licenses page is routed and in the admin nav", () => {
  assert.match(appSource, /path="\/admin\/licenses" element=\{<AdminLicenses \/>\}/);
  assert.match(layoutSource, /to: "\/admin\/licenses"/);
});

test("published plan numbers match the enforced limits", () => {
  const pricingSource = read("src/pages/Pricing.jsx");
  const apiKeysSource = read("src/pages/app/ApiKeys.jsx");
  const plansSource = readFileSync(resolve("app/lib/plans.mjs"), "utf8");
  // Single source of truth in lib/plans; pages publish the same numbers.
  assert.match(plansSource, /free: \{ providerProfiles: 3, chatHistory: 200 \}/);
  assert.match(plansSource, /pro: \{ providerProfiles: 10, chatHistory: 1000 \}/);
  assert.match(pricingSource, /3 个 Provider 档案/);
  assert.match(pricingSource, /10 个 Provider 档案/);
  assert.match(pricingSource, /200 条/);
  assert.match(pricingSource, /1000 条/);
  // ApiKeys shows the live limit from the API, not a hardcoded copy.
  assert.match(apiKeysSource, /provider\?\.profileLimit/);
});

test("admin licenses page reports payment channels honestly", () => {
  assert.match(adminSource, /\/api\/admin\/payments/);
  assert.match(adminSource, /收款通道/);
  assert.match(adminSource, /可用 ≠ 已实现结算/);
});
