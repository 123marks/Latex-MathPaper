# Task Plan: Paper OS T3.3 Real AI Timeline

## Goal
Complete the Web Workbench AI panel with truthful provider state, real execution-plan data, explicit preview-before-apply editing, and preserved conflict/rollback semantics. Keep the verified T1.1-T1.5 baseline closed.

## Current Phase
Phase 3: T3.3 verified closeout complete; hand off to T3.6

## Phases

### T3.3 Phase 0: Preserve the verified baseline
- [x] Confirm T0.2-T0.6 and T1.1-T1.5 are complete and documented.
- [x] Confirm /api/provider, /api/chat, /api/editor/apply-blocks, and ActionTimeline existing contracts before editing.
- [x] Preserve the dirty main worktree; do not reset, clean, commit, merge, push, or add dependencies automatically.
- **Status:** complete

### T3.3 Phase 1: Design and test-first contracts
- [x] Write the T3.3 design record and implementation plan.
- [x] Add focused RED contracts for provider truthfulness, execution-plan mapping, preview/apply baseline, and 409/rollback UI states.
- **Status:** complete

### T3.3 Phase 2: Minimal implementation
- [x] Add pure AI execution helpers and a focused assistant panel.
- [x] Connect Workbench SSE metadata, real timeline, file-block preview, and explicit Apply.
- [x] Preserve server-side path, conflict, and rollback protections.
- **Status:** complete

### T3.3 Phase 3: Verification and handoff
- [x] Run focused/full Node tests and Web build.
- [x] Run browser smoke at desktop/mobile widths with no browser errors or horizontal overflow.
- [x] Synchronize STATUS/HANDOFF/TESTING/redesign/issues/changelog and working-memory files.
- **Status:** complete

## Completed Prior Baseline: T1.5 Login and Register

### Phase 0: Preserve the verified baseline
- [x] Confirm T1.1-T1.4 are complete and T1.5 is the next strict atom.
- [x] Preserve the dirty main worktree; do not reset, clean, commit, merge, push, or add dependencies automatically.
- **Status:** complete

### Phase 1: Audit and approved design
- [x] Reconcile Login, Register, AuthAside, auth API, password policy, UI primitives, and responsive CSS.
- [x] Compare the smallest viable composition approaches against the approved specification.
- [x] Write the T1.5 design record and step-by-step TDD implementation plan.
- **Status:** complete

### Phase 2: Test-first contracts
- [x] Add one focused RED contract at a time for mode switching, truthful auth copy, offline entry, password policy, OAuth endpoints, and role-selector removal.
- [x] Add browser-smoke source contracts before the real browser harness.
- **Status:** complete

### Phase 3: Minimal implementation
- [x] Implement the shared auth composition and AuthAside visual narrative through existing primitives.
- [x] Align client validation with the server contract and preserve real auth flows.
- [x] Refactor only after GREEN.
- **Status:** complete

### Phase 4: Browser, responsive, and visual verification
- [x] Verify Login/Register at 1440x900, 1100x720, 820x800, and 390x844.
- [x] Verify keyboard, focus, validation, OAuth/offline links, reduced motion, touch targets, overflow, and browser errors.
- [x] Run focused/full regressions, production builds, static smoke, strict Edge, and visual review.
- **Status:** complete

### Phase 5: Independent review and handoff
- [x] Resolve actionable code/documentation review findings through RED/GREEN.
- [x] Synchronize STATUS/HANDOFF/TESTING/redesign/issues/changelog and working-memory files.
- [x] Run final diff, stale-state, Markdown, JSON, and report-hash gates.
- **Status:** complete

## Settled Product Boundary
- Reuse the existing auth routes and backend; do not invent account, sync, collaboration, or production SSO capabilities.
- Password policy is at least 10 characters and at least two character classes, exactly aligned with the server and account API tests.
- OAuth buttons target the existing development endpoints and must not imply production provider readiness.
- Offline opening means a truthful desktop/local-project path, not browser filesystem access that does not exist.
- Registration must not expose a role selector; server ownership rules remain authoritative.
- T1.1-T1.4 reopen only for a demonstrated regression.

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| The first parallel read orchestration contained malformed JavaScript object syntax | 1 | Split the lookup into explicit scoped commands. |
| A piped repo-wide file lookup exceeded the 10-second Windows wrapper timeout | 1 | Used narrow rg glob matching with a larger bounded timeout. |
| Managed Windows shell and direct patch helpers could not launch through the default sandbox | 1 | Reused the verified scoped elevated shell and Codex apply-patch channel. |
| The first shared-shell patch payload contained literal backticks that terminated its JavaScript wrapper | 1 | Re-expressed the same production strings without backticks and applied the patch once through the UTF-8-safe channel. |
| CDP waitForExpression returned a DOM node and exceeded the object reference-chain limit | 1 | Coerced the expression result to Boolean at the helper boundary. |
| The first reduced-motion smoke asserted the wrong serialized CSS value | 1 | Read real computed ::before styles and normalized none / 0.001ms / 1. |
| The first AI Apply trace targeted sample-contest instead of ai-qa | 1 | Confirmed the source deep-link logic, rebuilt the stale app/public production bundle, and verified URLSearchParams workspace selection in the emitted asset. |
| The 390px Workbench still used a 220px 1fr root grid | 1 | Switched the narrow layout to a single-column file tree → editor → AI workflow and reran overflow evidence. |
| Two final read-only audit agents exhausted retries with HTTP 429 | 1 | Accepted no agent conclusion; completed the document audit locally with scoped rg and direct file reads. |
| The default apply_patch helper failed with CreateProcessWithLogonW failed: 2 | 1 | Used the previously verified codex.exe --codex-run-as-apply-patch UTF-8 argument channel. |

## Notes
- The repository is heavily dirty and currently on main.
- The T3.3 design and execution source is docs/plans/2026-08-10-t3-3-ai-panel-design.md plus docs/plans/2026-08-10-t3-3-ai-panel-implementation.md.
- T3.3 is closed at a verified, documented handoff boundary; do not reopen it without a failing contract, user visual finding, or new requirement.
- The next strict task is T3.6 real Workbench product capture. Preserve provider/runtime truth, exact preview baseline, explicit Apply, conflict/rollback semantics, and the 390px vertical workflow.
