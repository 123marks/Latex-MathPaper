# T1.3 Public Navigation Implementation Plan

**Status:** Completed and verified on 2026-08-07. Current evidence is recorded in `docs/STATUS.md` and `dist/visual-qa/home-hero-behavior.json`.

**Post-review hardening:** The initial implementation passed its planned gates, then an independent review identified evidence gaps at 881px, in the 390px opened-menu state, and in the authenticated header branch. Three focused source contracts were observed RED, the Edge smoke was extended without changing production APIs or CSS, and the final browser report proved: no overflow/overlap at 881px, exact first-link focus plus Escape/focus restore at both 820px and 390px, and exactly one authenticated primary CTA at `/download`. The final independent verdict is `APPROVED`.

> **For Codex:** REQUIRED SUB-SKILL: Use `test-driven-development` and `verification-before-completion` to execute this plan task by task.

**Goal:** Complete the public header''s compact scroll state, route-current treatment, and truthful download CTA without regressing the existing responsive menu lifecycle.

**Architecture:** Extend `SiteHeader` with one independent boolean scroll state and keep React Router `NavLink` as the route source of truth. CSS owns state presentation; the existing Home Edge smoke owns end-to-end navigation evidence.

**Tech Stack:** React 18, React Router, CSS tokens, Node test runner, Vite SSR, Edge CDP.

---

### Task 1: Lock the current-route contract

**Files:**
- Create: `tests/web-public-navigation.test.mjs`
- Modify: `web/src/styles/pages.css`

**Step 1: Write the failing test**

Render `SiteHeader` with `StaticRouter location="/pricing"`. Assert exactly one `aria-current="page"`, its href is `/pricing`, and CSS provides a 2px pseudo-element indicator selected from the ARIA state.

**Step 2: Verify RED**

Run: `node --test tests/web-public-navigation.test.mjs`

Expected: FAIL because the existing active rule has no 2px indicator.

**Step 3: Implement minimal CSS**

Add `position: relative` to public links and use `[aria-current="page"]::after` for the indicator. Remove the inline mobile-link style so the same semantic can be styled without `!important`.

**Step 4: Verify GREEN**

Run the same focused test and confirm the route-current case passes.

### Task 2: Make download the stable primary action

**Files:**
- Modify: `tests/web-public-navigation.test.mjs`
- Modify: `web/src/components/SiteHeader.jsx`
- Modify: `web/src/styles/pages.css`

**Step 1: Write the failing test**

Assert the public header has one `btn-primary` link whose href is `/download` and whose label is `下载桌面端`; assert `/register` is present but is not primary.

**Step 2: Verify RED**

Run the focused test. Expected: FAIL because `/register` is currently primary and no `下载桌面端` header action exists.

**Step 3: Implement minimal markup**

Keep account actions secondary, render the download CTA once outside the auth branch, and add account actions to the conditionally mounted mobile nav so responsive CSS can hide the crowded top-row copies at `max-width: 880px`.

**Step 4: Verify GREEN**

Run the focused test and the existing `tests/web-home-hero.test.mjs` contract.

### Task 3: Add the compact scroll state

**Files:**
- Modify: `tests/web-public-navigation.test.mjs`
- Modify: `web/src/components/SiteHeader.jsx`
- Modify: `web/src/styles/pages.css`

**Step 1: Write the failing source/CSS contract**

Require `SCROLL_THRESHOLD = 40`, `window.scrollY > SCROLL_THRESHOLD`, a passive scroll listener, matching listener cleanup, conditional `nav--scrolled`/`glass-frost`, and a `--dur-3` transition.

**Step 2: Verify RED**

Run the focused test. Expected: FAIL because no scroll state exists.

**Step 3: Implement minimal state and styling**

Add an independent effect:

```jsx
useEffect(() => {
  const syncScrolled = () => setScrolled(window.scrollY > SCROLL_THRESHOLD);
  syncScrolled();
  window.addEventListener("scroll", syncScrolled, { passive: true });
  return () => window.removeEventListener("scroll", syncScrolled);
}, []);
```

Use the modifier only for presentation. Transition transform/background/border/shadow; do not animate dimensions or intercept scroll.

**Step 4: Verify GREEN**

Run the focused navigation test and the existing Home/header tests.

### Task 4: Extend real-browser evidence

**Files:**
- Modify: `tests/web-public-navigation.test.mjs`
- Modify: `app/home-hero-visual-smoke.mjs`

**Step 1: Write the failing smoke-source contract**

Require a `verifyPublicNavigation` browser check wired into the report, with 40px/41px threshold checks, `/pricing` current route, download CTA, compact geometry/glass/shadow, reduced-motion transition, and preserved menu lifecycle evidence.

**Step 2: Verify RED**

Run the focused test. Expected: FAIL because the smoke has no T1.3 verifier.

**Step 3: Implement the browser verifier**

Reuse the existing CDP helpers. Do not create a second smoke script. Restore media/scroll state before later checks so evidence ordering cannot contaminate Hero captures.

**Step 4: Verify GREEN locally**

Run the focused test, syntax-check the smoke module, and run `npm run home-hero-visual-smoke`.

### Task 5: Full verification and handoff

**Files:**
- Modify: `task_plan.md`, `findings.md`, `progress.md`
- Synchronize only current T1.3 facts in `docs/STATUS.md`, `docs/HANDOFF.md`, `docs/TESTING.md`, `docs/redesign/README.md`, `docs/redesign/03-web-site-spec.md`, `docs/redesign/08-execution-plan.md`, `issues/paper-os-redesign.md`, and `CHANGELOG.md`.

**Step 1: Run verification**

Run focused navigation/Home/hash tests, full `node --test`, Python tests, Web/IDE build, static visual smoke, Home Edge smoke, and the broader strict browser smoke if the shared navigation change affects its contract.

**Step 2: Inspect visual evidence**

Review 1440x900, 1100x720, 820x800, and 390x844 captures for current-state clarity, compact-state restraint, overlap, clipping, and CTA/menu fit. Run the repository visual verdict workflow for any edit iteration.

**Step 3: Review and audit**

Request an independent navigation-focused code review. Resolve actionable findings, run `git diff --check`, conflict-marker and stale-fact scans, and recompute evidence hashes from the final report.

**Step 4: Record the handoff**

Mark T1.3 complete only with fresh command output and browser evidence. Record remaining T1.4/T1.5 work without reopening completed T1.1/T1.2 scope.

No commit step is included: this workspace intentionally contains uncommitted T1.1/T1.2/user work, and the user did not request a commit.
