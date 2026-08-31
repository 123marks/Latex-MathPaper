import assert from "node:assert/strict";
import test from "node:test";
import { PRICE_PER_1K, estimateCost, aggregateUsage } from "../app/lib/usage.mjs";
import { parseBibTeX } from "../app/lib/bibtex.mjs";
import {
  ANNOTATION_INTENTS,
  ANNOTATION_PRIORITIES,
  ANNOTATION_STATUSES,
  normalizeAnnotationTarget,
} from "../app/lib/annotations.mjs";
import { PLAN_LIMITS, effectivePlan, trimUserThreads } from "../app/lib/plans.mjs";
import { paymentProviderStatus } from "../app/lib/payments.mjs";

test("estimateCost prices known models and falls back to default", () => {
  const gpt = estimateCost("gpt-4o", 1000, 1000);
  assert.equal(gpt, PRICE_PER_1K["gpt-4o"].prompt + PRICE_PER_1K["gpt-4o"].completion);
  const unknown = estimateCost("some-new-model", 2000, 0);
  assert.equal(unknown, 2 * PRICE_PER_1K.default.prompt);
});

test("aggregateUsage windows records and buckets by day/model/workspace/hour", () => {
  const now = new Date();
  const recent = {
    at: now.toISOString(),
    model: "m1",
    workspace: "ws-a",
    totalTokens: 100,
    promptTokens: 60,
    completionTokens: 40,
    costUsd: 0.5,
  };
  const anonymous = { ...recent, workspace: "", totalTokens: 10, promptTokens: 5, completionTokens: 5, costUsd: 0.1 };
  const stale = { ...recent, at: new Date(Date.now() - 40 * 86400000).toISOString() };
  const agg = aggregateUsage([recent, anonymous, stale], 30);
  assert.equal(agg.totalRequests, 2);
  assert.equal(agg.totalTokens, 110);
  assert.equal(agg.hours.length, 24);
  assert.equal(agg.hours.reduce((a, b) => a + b, 0), 110);
  assert.equal(agg.hours[now.getHours()], 110);
  const wsNames = agg.workspaces.map((w) => w.workspace);
  assert.deepEqual(wsNames.sort(), ["ws-a", "未标注"].sort());
});

test("parseBibTeX handles braces, quotes, bare values, and skips @comment", () => {
  const entries = parseBibTeX(`
@comment{nope}
@article{k1, title = {A {B} C}, author = "Q. Wu", year = 1999, journal = {J} }
`);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].key, "k1");
  assert.equal(entries[0].title, "A B C");
  assert.equal(entries[0].author, "Q. Wu");
  assert.equal(entries[0].year, "1999");
  assert.equal(entries[0].venue, "J");
});

test("effectivePlan falls back to free on expiry or unknown plans", () => {
  const now = Date.now();
  assert.equal(effectivePlan(null, now), "free");
  assert.equal(effectivePlan({ plan: "vip" }, now), "free");
  assert.equal(effectivePlan({ plan: "pro", planExpiresAt: new Date(now + 86400000).toISOString() }, now), "pro");
  assert.equal(effectivePlan({ plan: "pro", planExpiresAt: new Date(now - 1000).toISOString() }, now), "free");
  assert.equal(effectivePlan({ plan: "pro" }, now), "free"); // no expiry recorded
  assert.ok(PLAN_LIMITS.pro.chatHistory > PLAN_LIMITS.free.chatHistory);
});

test("trimUserThreads drops only the owner's oldest overflow", () => {
  const threads = [
    { id: "a1", userId: "a" }, { id: "b1", userId: "b" },
    { id: "a2", userId: "a" }, { id: "a3", userId: "a" },
  ];
  const trimmed = trimUserThreads(threads, "a", 2);
  assert.deepEqual(trimmed.map((t) => t.id), ["b1", "a2", "a3"]);
  // Under the limit: untouched (same array contents).
  assert.equal(trimUserThreads(threads, "b", 5).length, 4);
});

test("payment providers report honestly from real credentials", () => {
  const none = paymentProviderStatus({});
  assert.equal(none.find((p) => p.id === "manual").available, true);
  for (const id of ["stripe", "wechat", "alipay"]) {
    assert.equal(none.find((p) => p.id === id).available, false);
  }
  const withStripe = paymentProviderStatus({ STRIPE_SECRET_KEY: "sk_test_x" });
  assert.equal(withStripe.find((p) => p.id === "stripe").available, true);
  assert.match(withStripe.find((p) => p.id === "stripe").note, /尚未实现/);
});

test("normalizeAnnotationTarget vocabulary and sanitisation", () => {
  assert.ok(ANNOTATION_INTENTS.has("edit"));
  assert.ok(ANNOTATION_PRIORITIES.has("normal"));
  assert.ok(ANNOTATION_STATUSES.has("proposed"));
  // editor-range: endLine never precedes startLine.
  const range = normalizeAnnotationTarget({ kind: "editor-range", path: "a.tex", startLine: 9, endLine: 3 });
  assert.equal(range.endLine, 9);
  // traversal and unknown kinds are rejected.
  assert.equal(normalizeAnnotationTarget({ kind: "editor-range", path: "../x.tex", startLine: 1 }), null);
  assert.equal(normalizeAnnotationTarget({ kind: "element", path: "a.tex" }), null);
  // pdf-region: clamped into the page, zero-area rejected.
  const region = normalizeAnnotationTarget({ kind: "pdf-region", path: "a.tex", page: 3, rect: { x: 0.9, y: 0.1, w: 0.5, h: 0.2 } });
  assert.equal(region.rect.w, 0.1);
  assert.equal(normalizeAnnotationTarget({ kind: "pdf-region", path: "a.tex", page: 3, rect: { x: 0.2, y: 0.2, w: 0, h: 0.2 } }), null);
});
