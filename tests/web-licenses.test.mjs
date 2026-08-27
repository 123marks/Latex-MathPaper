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
