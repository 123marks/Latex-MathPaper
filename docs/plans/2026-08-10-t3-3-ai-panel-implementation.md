# T3.3 Web Workbench AI Panel Implementation Plan

Date: 2026-08-10
Status: Complete (2026-08-11)

## Scope Guard

Touch only the Web Workbench AI path, chat runtime metadata, focused tests, styles, and handoff documents. Do not refactor static tabs, staged modeling data, compiler flows, authentication, or the completed public/auth redesign tasks.

## Step 1: Lock Pure Contracts

Create tests/web-workbench-ai.test.mjs before production files.

Required RED cases:

- normalizeProviderState distinguishes configured user/shared/none without saying online.
- buildExecutionPlan maps requesting, preview-ready, applying, and applied lifecycle facts to real statuses.
- parseFileBlocks returns multiple safe display blocks and ignores incomplete markers.
- buildApplyRequest carries the exact preview path/mtime stamps.
- buildReplacementDiff reports only calculated line replacement data and bounds long output.

Run: node --test tests/web-workbench-ai.test.mjs

Expected first result: module-not-found or missing-export RED for the new helper/component contract.

## Step 2: Implement Pure Helpers

Create web/src/lib/ai-execution.js with no React or browser dependency. Keep the data structures small and explicit. Rerun the focused test until helper cases are green.

## Step 3: Lock the Panel Contract

Add SSR/source assertions for:

- real provider configuration chip;
- visible mock-local runtime;
- ActionTimeline rendering supplied plan state;
- proposal file metadata and Apply/Reject commands;
- conflict and rollback copy;
- no static fake steps inside AIAssistantPanel.

Run the same focused test and observe the component-specific RED before implementation.

## Step 4: Implement the Panel

Create web/src/components/workbench/AIAssistantPanel.jsx. It is presentational and receives all mutations as callbacks. Add the smallest required pages.css rules for the provider chip, timeline, proposal preview, diff, errors, and narrow layouts.

## Step 5: Emit Runtime Metadata

Extend /api/chat so the provider path emits provider metadata before the first delta and the fallback path emits mock-local metadata before the first delta. Add a focused server/source contract. Do not expose credentials or weaken the existing fallback.

## Step 6: Connect Workbench

Replace the inline chat panel with AIAssistantPanel and connect:

- GET /api/provider on mount;
- robust buffered SSE parsing;
- lifecycle-derived buildExecutionPlan calls;
- apply-blocks preview after a complete file proposal;
- exact baseline Apply and explicit Reject;
- 409 conflict refresh-preview flow;
- rollback/network error states;
- tree and clean-buffer refresh after success.

## Step 7: Regression and Browser Evidence

Run in order:

1. node --test tests/web-workbench-ai.test.mjs tests/editor-apply-transaction.test.mjs tests/web-motifs.test.mjs
2. node --test
3. python -m pytest -p no:cacheprovider
4. npm run build
5. npm run visual-smoke
6. focused Workbench browser smoke at desktop and mobile widths
7. npm run browser-visual-smoke when the focused evidence is green
8. git diff --check

## Step 8: Handoff

Synchronize docs/STATUS.md, docs/HANDOFF.md, docs/TESTING.md, redesign execution/spec files, issue tracker, CHANGELOG.md, task_plan.md, findings.md, and progress.md. Mark T3.3 complete only after browser evidence and all required regressions pass. T3.6 becomes the next strict task after that closeout.

## Completion Record

All eight steps are complete. The final implementation keeps Workbench as lifecycle owner, AIAssistantPanel as a presentational surface, ai-execution.js as the pure contract layer, and app/server.mjs as the authoritative runtime/write boundary.

Fresh closeout evidence: node --test 164/164; Python 25/25; Web build 2316 modules plus Desktop IDE bundle; visual smoke 13 keyframes/52 assets; strict Edge pass with ai-qa Reject/no-write and Apply/write traces at 1440×1200 and 390×844. The report is dist/visual-qa/horizon-behavior.json; screenshot hashes are recorded in STATUS, TESTING, and the report.

The next strict task is T3.6. It may consume the verified Workbench state for a real product screenshot, but must not replace provider/runtime truth, Preview → Apply, conflict/rollback semantics, or the mobile vertical workflow with static demonstration data.
