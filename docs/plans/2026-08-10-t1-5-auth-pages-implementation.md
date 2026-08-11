# T1.5 Login/Register Implementation Plan

> **For Codex:** Execute this plan task-by-task with test-first RED/GREEN checkpoints.

**Goal:** Implement the approved Login/Register auth-page contract without changing backend semantics.

**Architecture:** Reuse the existing AuthProvider/API and split `.auth` layout. Add a shared AuthPanel for common controls and a pure password-policy helper; keep page-specific payload state in Login/Register.

**Tech Stack:** React 18, React Router, existing UI Segmented/Icon primitives, Vite, Node test runner, real Edge CDP smoke.

---

### Task 1: Lock current auth contracts with focused RED tests

**Files:**
- Create: `tests/web-auth-pages.test.mjs`
- Modify: `tests/browser-visual-smoke.test.mjs`

**Steps:**
1. Assert Login/Register expose the shared Segmented mode control, neutral AuthAside terms, offline/download entry, OAuth provider labels, and no role selector.
2. Assert the password helper contract includes minimum, maximum, and character-class rules.
3. Assert a dedicated auth smoke file is syntactically wired into browser-smoke contracts.
4. Run `node --test tests/web-auth-pages.test.mjs` and confirm the expected RED result against the current pages.

### Task 2: Add the real-browser auth smoke contract

**Files:**
- Create: `app/auth-visual-smoke.mjs`

**Steps:**
1. Reuse the existing CDP/browser helper pattern and capture both routes at four viewports.
2. Check 390px horizontal overflow, 44px touch targets, mode switching, keyboard selection, offline link, validation feedback, and browser errors.
3. Add reduced-motion checks for transition/animation settling.
4. Run the smoke against the current pages and record the expected RED failures.

### Task 3: Implement shared auth chrome

**Files:**
- Create: `web/src/components/AuthPanel.jsx`
- Modify: `web/src/components/AuthAside.jsx`
- Modify: `web/src/styles/pages.css`

**Steps:**
1. Add controlled Segmented mode navigation and preserve redirect state.
2. Move shared logo/header/error/submit/OAuth/offline/boundary markup into AuthPanel.
3. Rewrite AuthAside copy and add decorative code/PDF/trace fragments.
4. Add scoped responsive, focus, touch, and reduced-motion styles; remove only auth-specific inline styles.

### Task 4: Align page-specific forms

**Files:**
- Create: `web/src/lib/password-policy.js`
- Modify: `web/src/pages/Login.jsx`
- Modify: `web/src/pages/Register.jsx`

**Steps:**
1. Move password feedback into the shared helper and add the 256-character maximum.
2. Render Login and Register through AuthPanel while preserving their real `useAuth` calls and redirect behavior.
3. Remove duplicate SSO/header/switch markup and keep the role selector absent.
4. Run the focused suite GREEN.

### Task 5: Verify and hand off

**Files:**
- Modify: `docs/STATUS.md`, `docs/TESTING.md`, `docs/HANDOFF.md`
- Modify: `docs/redesign/03-web-site-spec.md`, `docs/redesign/08-execution-plan.md`
- Modify: `issues/paper-os-redesign.md`, `CHANGELOG.md`, `task_plan.md`, `findings.md`, `progress.md`

**Steps:**
1. Run focused/full tests, builds, static smoke, auth smoke, strict Edge, and report hash checks.
2. Request independent review and resolve actionable findings through RED/GREEN.
3. Synchronize current/next/historical documentation and record exact evidence.
4. Run `git diff --check`, syntax, JSON, stale-claim, whitespace, and Markdown audits.

