# T1.4 Public Pages Implementation Plan

> For Claude: REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

Goal: Rebuild Features, Pricing, and Enterprise as truthful, responsive Horizon Atelier public pages.

Architecture: Keep data and claims local to each page, reuse existing public/UI primitives, and add a small scoped CSS layer for alternating narrative bands, plan comparisons, and enterprise security tiers. A shared real Workbench capture is served as a static public asset; all other fragments are explicitly labelled static interface fragments.

Tech Stack: React 18, React Router, Vite, existing Segmented/Table/FAQ/CtaBand/Reveal/Icon components, plain CSS, Node test runner, Edge CDP smoke.

---

### Task 1: Lock the RED page contracts

Files:
- Create: tests/web-public-pages.test.mjs
- Test: tests/web-public-pages.test.mjs

Step 1: Write the failing test.
Assert the current pages are missing the five Features bands, billing
Segmented, FAQ/CtaBand usage, truthful provider/token copy, qualified
Enterprise capabilities, and the real product asset. Also assert forbidden
claims and unreferenced numeric prices are rejected.

Step 2: Run it to verify RED.
Run: node --test tests/web-public-pages.test.mjs
Expected: FAIL on missing required structure and forbidden existing copy.

### Task 2: Add truthful Features composition

Files:
- Modify: web/src/pages/Features.jsx
- Modify: web/src/styles/pages.css
- Add/copy: web/public/assets/feature-workbench.png
- Test: tests/web-public-pages.test.mjs

Step 1: Add five data records with explicit fact/availability labels and one
alternating feature-deep-dive band per record.

Step 2: Use a real Workbench capture for the first band and labelled static
fragments for the remaining product concepts. Link Skills/MCP to /market, team
boundary to /enterprise, and finish with CtaBand to /download.

Step 3: Add mobile-first single-column reflow, desktop alternating grid, stable
image aspect ratio, reduced-motion Reveal fallback, and 44px links.

Step 4: Run node --test tests/web-public-pages.test.mjs and expect the Features
assertions to pass while Pricing/Enterprise remain RED.

### Task 3: Add truthful Pricing interaction and matrix

Files:
- Modify: web/src/pages/Pricing.jsx
- Modify: web/src/styles/pages.css
- Test: tests/web-public-pages.test.mjs

Step 1: Replace hard-coded unsupported amounts/entitlements with a month/year
state, qualified pending prices, and four plan records.

Step 2: Render Segmented, Table, FAQ, and CtaBand; keep model token ownership,
provider boundary, local compilation, and contact flow explicit.

Step 3: Add responsive plan grid, highlighted professional plan, readable
comparison matrix, keyboard/reduced-motion hooks, and no inline style debt.

Step 4: Run the focused test and verify the Pricing assertions pass.

### Task 4: Add Enterprise security boundary and manual contact

Files:
- Modify: web/src/pages/Enterprise.jsx
- Modify: web/src/styles/pages.css
- Test: tests/web-public-pages.test.mjs

Step 1: Render six requested topics with 需评估/合同确认 qualifiers.

Step 2: Render current security foundations and configurable provider
boundaries using only architecture/status-backed facts.

Step 3: Keep the mailto contact and docs/pricing links; remove automatic
sales/deployment guarantees.

Step 4: Run the focused test and verify all page assertions pass.

### Task 5: Add real Edge page smoke

Files:
- Modify: app/home-hero-visual-smoke.mjs or create a T1.4-scoped smoke helper
- Test: tests/web-public-pages.test.mjs

Step 1: Add route iteration for /features, /pricing, /enterprise.

Step 2: Capture 1440x900, 1100x720, 820x800, and 390x844; assert
browserErrors=[], no horizontal overflow, loaded image, billing toggle, FAQ
keyboard disclosure, and reduced-motion static behavior.

Step 3: Run the real Edge smoke and inspect report/screenshot evidence.

### Task 6: Full verification and handoff

Files:
- Modify: docs/STATUS.md, docs/HANDOFF.md, docs/TESTING.md,
  docs/redesign/README.md, docs/redesign/03-web-site-spec.md,
  docs/redesign/08-execution-plan.md, issues/paper-os-redesign.md,
  CHANGELOG.md, task_plan.md, findings.md, progress.md

Step 1: Run focused/full Node tests, Python tests, Web/IDE builds, static
smokes, and strict Edge.

Step 2: Request an independent review and resolve actionable findings.

Step 3: Synchronize current T1.4 facts, evidence hashes, next task, and
remaining roadmap risks. Run conflict-marker, stale-fact, whitespace, and
Markdown checks before reporting completion.
