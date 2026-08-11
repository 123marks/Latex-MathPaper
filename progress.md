# Progress Log

## Session: 2026-08-11 - T3.3 Web Workbench AI Panel

### Phase 1: Design and RED contracts
- **Status:** complete
- Audited /api/provider, /api/chat, /api/editor/apply-blocks, Workbench ownership, ActionTimeline, and existing transaction tests.
- Wrote the approved T3.3 design and step-by-step implementation plan.
- Added focused contracts for provider/runtime truth, real lifecycle mapping, buffered SSE, file-block parsing, bounded diff, exact baseline Apply, proposal commands, conflict, rollback, and smoke wiring.

### Phase 2: Minimal implementation
- **Status:** complete
- Added web/src/lib/ai-execution.js and AIAssistantPanel.jsx; kept Workbench as the only network/workspace mutation coordinator.
- Added provider and mock-local runtime metadata, provider SSE buffering/error signaling, JSON no-store, preview-before-apply, Reject, 409 refresh, rollback/preview errors, workspace deep links, and post-Apply tree/clean-buffer refresh.
- Converted <=640px Workbench to a file tree → editor → AI vertical workflow without hiding core navigation.

### Phase 3: Browser evidence and handoff
- **Status:** complete
- Strict Edge used a temporary ai-qa Workspace for two real mock-local requests: Reject kept the original 77-byte file; Apply produced 197 bytes and recorded HTTP 200 with written:[paper/main.tex].
- Verified 1440×1200 and 390×844 with overflowX:false; reduced-motion computed none / 0.001ms / 1; inspected ready, applied, and mobile screenshots with no incoherent overlap.
- Final recorded evidence: Node 164/164; Python 25/25; Web 2316 modules; Desktop IDE bundle; static visual 13 keyframes/52 assets; strict Edge exit 0.
- Synchronized STATUS, HANDOFF, TESTING, public-site specification, execution plan, issue tracker, CHANGELOG, design/implementation plans, task_plan, findings, and progress.
- Two read-only audit agents failed with HTTP 429; no external conclusion was accepted. Local scoped searches and direct reads supplied the handoff audit.
- T3.3 is closed. The overall redesign remains Active; T3.6 real Workbench product capture is the next strict task. The workspace remains intentionally dirty and no commit/PR was created.

## Session: 2026-08-10 - T1.5 Login/Register

### Phase 1-3 closeout
- **Status:** complete
- Completed the current-state audit and wrote the T1.5 design plus implementation plan.
- Added focused auth-page/source contracts and a dedicated eight-viewport Edge smoke.
- Corrected the smoke serialized reduced-motion helper and visible offline-label assertion before accepting RED.
- Observed the intended RED at 14/19 pass: five failures mapped exactly to Segmented, neutral AuthAside, password policy/confirmation, and auth CSS.
- Added AuthPanel, neutral AuthAside visual fragments, a pure password-policy helper, page-local Login/Register form wiring, and scoped responsive CSS.
- Preserved the auth API, session, OAuth development flow, route semantics, and server-owned roles.
- Focused GREEN verification passed 19/19 in 4.37s.
- Closed after the real Edge auth smoke, local review, and final documentation gates; only the specification-alignment polish documented in this session required a follow-up verification run.

### Phase 1: Current-state audit and executable design
- **Status:** complete
- Confirmed T1.4 is complete and T1.5 is the next strict atom.
- Loaded the approved T1.5 requirements from the public-site specification and execution plan.
- Started parallel read-only audits of auth implementation and test shape.
- Established the non-negotiable truth boundaries for password policy, OAuth dev endpoints, offline entry, and server-owned roles.
- Completed the exact source audit, minimal composition decision, and TDD plan before implementation.

### Phase 4-5 closeout: browser evidence, review, and handoff
- **Status:** complete
- Auth Edge evidence covers `/login` and `/register` at 1440x900, 1100x720, 820x800, and 390x844, plus keyboard mode switching, invalid/mismatch/valid password states, 44px touch targets, reduced-motion, zero overflow, and `browserErrors=[]`.
- Final recorded evidence: focused auth/source `19/19`; full Node `155/155`; Python `25/25`; Web production build `2312 modules`; Desktop IDE bundle; static visual smoke `13 keyframes / 52 assets`; strict Edge `88.8s`.
- Stable behavior SHA: `81651dc06e68a9874ab414ed8610babe81094e9edb79687a68c55a2707802df4`.
- Point-in-time report SHA: `f0dd5bdf2b5cd71eeb02c895359e7b5953544e9659e75cb8e79fab8608bb7a0e`.
- The external code-reviewer child failed with HTTP `429 Too Many Requests`; no review conclusion was accepted from that service. Local source review found and corrected the approved button-label mismatch and duplicate aside sentence, then the focused suite was rerun.
- T1.5 is closed. The overall redesign remains Active; the next strict atom is T3.3 or T3.6. The workspace remains intentionally dirty and no commit/PR was created.

## Session: 2026-08-07 - T1.4 Public Pages

### Phase 1: Truth audit and executable plan
- **Status:** complete
- Actions taken:
  - Recovered the prior session state and confirmed T1.1-T1.3 remain complete while the overall redesign remains active.
  - Started the next strict atom, T1.4 Features/Pricing/Enterprise, without reopening previously verified surfaces.
  - Recorded the three independent audit-agent HTTP 503 failures and switched to scoped local inspection.
  - Reconciled the public-page claims against PRODUCT, ARCHITECTURE, STATUS, and the approved web-site specification.
  - Established the shipped/partial/roadmap wording boundary for providers, model tokens, AI Apply, collaboration, SSO, RBAC, SLA, and private deployment.
  - Audited the three current page implementations and identified exact unsupported claims, missing approved sections, primitive duplication, and inline-style debt.
  - Confirmed the current numeric prices have no repository source and inventoried the existing Segmented, Table, FAQ, CtaBand, SectionHead, and FeatureCard APIs.
  - Mapped each Enterprise security statement to source/tests and separated implemented safeguards from unverified deployment/signing claims.
  - Reviewed frontend typography/color/space/interaction/motion/responsive guidance and mapped existing CSS primitives plus real browser-capture candidates.
- Closed by the Phase 1 design and implementation-plan records below.

### Phase 1 closeout
- **Status:** complete
- Files created:
  - docs/plans/2026-08-07-t1-4-public-pages-design.md
  - docs/plans/2026-08-07-t1-4-public-pages-implementation.md
- The implementation plan uses page-local data plus existing primitives and requires a RED/GREEN page contract before production edits.

### Phase 2: Test-first page contracts
- **Status:** complete
- Actions taken:
  - Added tests/web-public-pages.test.mjs with five source/SSR/CSS/asset contracts.
  - Observed the intended RED result: 0/5 pass, each failure points at a missing T1.4 requirement.
- Next:
  - Implement Features, Pricing, and Enterprise in small GREEN batches.

### Phase 3: Minimal page implementation
- **Status:** complete
- Actions taken:
  - Copied the current real Edge Workbench capture to web/public/assets/feature-workbench.png.
  - Rebuilt Features as five alternating, truth-labelled product deep dives and a download CtaBand.
  - Rebuilt Pricing with Segmented billing, four qualified plans, shared Table, BYOK disclosure, FAQ, and no unsupported numeric prices.
  - Rebuilt Enterprise with six qualified capability topics, four verified security foundations, a three-layer boundary model, and an explicit manual contact path.
  - Added scoped responsive/reduced-motion CSS without new dependencies or a generic narrative abstraction.
- Verification:
  - Features contract: 2/2 pass.
  - Pricing contract: 1/1 pass.
  - Enterprise contract: 1/1 pass.
  - Complete T1.4 focused suite: 5/5 pass.

### Phase 4: Browser, responsive, and visual verification
- **Status:** complete
- Next action: add a RED source guard and real Edge smoke for all three routes across four viewports.
- First real Edge run reached Features 390x844 and failed correctly: the secondary CTA measured 40px instead of the required 44px, and smooth-scroll left capture at scrollY=77. The next iteration locks both fixes.
- Second real Edge run confirmed all Features touch targets at 44-46px but found the scroll override was applied after scrollIntoView had already started smooth motion; move the override before reveal traversal.
- Third real Edge run passed all 12 route/viewport layout captures and both keyboard actions. Its final interaction assertion read the free plan's fixed period instead of the recommended plan's stateful period; correct the evidence selector.
- Fourth real Edge run passed in 52.7s and wrote twelve screenshots plus dist/visual-qa/public-pages-behavior.json.
- Final report: browserErrors=0, minimum touch target 44px, scrollY=0, zero horizontal/text/out-of-bounds overflow, yearly keyboard state, FAQ keyboard open, and three reduced-motion samples.
- Visual-verdict: 92/100 pass; structured state saved to .omx/state/t1-4-public-pages/ralph-progress.json.

### Phase 4 continuation: interrupted build recovery
- **Status:** complete
- Recovered the persisted T1.4 state after the prior npm run build was interrupted before it could produce valid completion evidence.
- Confirmed the repository remains heavily dirty and preserved all unrelated user work; no reset, cleanup, worktree, dependency change, commit, or process termination was performed.
- The default managed Windows sandbox and built-in patch helper could not start PowerShell (CreateProcessWithLogonW failed: 2), so subsequent scoped reads, patches, and verification commands use the approved PowerShell execution path.
- Confirmed USE_OMX_EXPLORE_CMD is unset; do not retry the previously failed OMX Windows explore wrapper in this session.
- Fresh combined production build passed: Web transformed 2310 modules and Desktop IDE bundled successfully.
- Fresh focused T1.4 suite passed 6/6.
- Fresh Python regression passed 25/25 in 86.23s; the only warning is the known inability to write .pytest_cache.
- Fresh static visual smoke passed with 13 keyframes and 52 built assets.
- Fresh full Node regression passed 147/147 in 64.15s.
- Recovered the browser topology deliberately: the first Web launch exposed an argument-forwarding mistake by starting on 5173, so only that new process was stopped and the web package was relaunched successfully on 5174.
- The first resumed T1.4 Edge run failed after completing capture because every proxied API request returned 500. Vite logs identified the exact boundary failure as ECONNREFUSED to its configured 127.0.0.1:3719 backend.
- Started the existing Paper OS backend and verified the backend root plus proxied /api/content and /api/auth/me all return 200. No production code or browser-error filter was changed.
- The pre-review Edge repeat produced stable evidence SHA 36b7ff867947512fc586ded0a147451fc91086c1cdf8d078c97c9aa62b5faa00 and report SHA 709fe0f799f5d103f61a0a53601537e1c2c6edc6076a2f7088dd7db26eecd99f; both are retained only as intermediate evidence.
- Fresh Home Edge regression passed across all four viewports and retained workflow columns 5/5/2/1 with no horizontal overflow, clipping, or out-of-bounds elements.
- The pre-review strict Edge run passed in 131.8s; it was superseded by the Phase 5 refresh below.
- **Phase 4 status:** complete
- Next: T1.4 handoff is closed; start T1.5 Login/Register as the next strict atom.

### Phase 5: Independent review fixes and handoff synchronization
- **Status:** complete
- Independent review reported one Important and two Minor findings: reduced-motion smoke sampled inner page content rather than the animated `Reveal` wrapper; the three public pages lacked page-level `h1` headings; and an Enterprise header-width selector could not pass through `Reveal`.
- Locked the three findings with focused contracts, observed the intended RED failures, applied the minimal fixes, and returned the focused suite to GREEN at 6/6.
- A second read-only reviewer confirmed all three fixes at source level and reran the focused suite successfully at 6/6 with no remaining actionable finding.
- Post-fix real Edge verification passed all 3 routes x 4 viewports twice under Edg/151.0.4129.72 with identical stable behavior SHA `0bf75be0138cc322228586c76be9390ef182f471c2308d048c1585c062d38f5f`.
- The latest point-in-time report SHA is `173c0fffeb941bc57d6ec3aecd6d4d0838697bc73215814b7c3b2b2cf5ce4133`; older `36b7... / 709fe0...` and `64b3... / a2de...` pairs are intermediate or historical only.
- The post-fix strict Edge gate passed in 112.6s with no horizontal overflow on Home or authenticated Workbench.
- Final post-fix regression evidence remains focused Node 6/6, full Node 147/147, Python 25/25, Web 2310 modules plus Desktop IDE bundle, and static visual smoke 13 keyframes/52 assets.
- Corrected the formal reproduction guide so the dedicated three-page gate uses `npm run public-pages-visual-smoke`, while the separate shared strict gate remains `npm run browser-visual-smoke`; documented the direct Vite 5174 command that actually preserves the requested port.
- Final handoff gates passed: `git diff --check`; smoke syntax; focused Node 6/6; full Node 147/147; Python 25/25; Web 2310 modules plus Desktop IDE build; static visual smoke 13 keyframes/52 assets; and an 11-file Markdown/status/hash audit with zero issues.
- Final claims search found no `¥39`/`¥99` or local-model-inference promise. Collaboration, SSO, RBAC, SLA, deployment, and support terms occur only with route-map, evaluation, or contract qualifiers.
- T1.4 completed at `2026-08-10T09:55:00.8889305Z`. At that checkpoint T1.5 was next and T3.3/T3.6 remained open; current state has T1.5/T3.3 closed and T3.6 next.

## Session: 2026-08-07 T1.3 Public Navigation

### Phase 1: Context, design, and executable plan
- **Status:** complete
- Actions taken:
  - Resumed from the persisted T1.3 plan and revalidated `.impeccable.md`; the settled scope, target users, Horizon Atelier tone, four viewports, and protected 880px menu contract are unchanged.
  - Confirmed the implementation lane remains test-first and minimal: existing `NavLink`, Icon registry, motion tokens, and menu lifecycle will be extended rather than replaced.
  - Audited `SiteHeader`, navigation CSS, SSR contracts, and the Home Edge smoke: route semantics and mobile lifecycle exist; scroll state, the 2px current-route indicator, and the stable download CTA do not.
  - Compared a local modifier, CSS scroll timelines, and a shared controller hook; selected the local modifier because it preserves `NavLink` and the existing menu effects with the smallest testable surface.
  - Wrote the approved design and a step-by-step TDD implementation plan under `docs/plans/`.
  - Confirmed T1.2 is fully closed and T1.3 remaining navigation work is the next strict atom in STATUS/HANDOFF/redesign plans.
  - Loaded the approved design context plus brainstorming, TDD, responsive, interaction, motion, and implementation-planning constraints.
  - Chose direct execution in the current dirty workspace because T1.3 depends on uncommitted T1.1/T1.2 work; no worktree or commit will be created automatically.
  - Attempted the repository-preferred `omx explore` read-only path; its Windows allowlist wrapper could not locate host bash, so exploration moved to native subagents and scoped reads.
  - Re-read the current task plan, stable domain context, and approved T1.3 clauses in the public-site specification and execution plan; confirmed the scope is four navigation-state behaviors rather than a header redesign.
  - Two bounded native explorers for header and test mapping failed upstream with HTTP 502/503 before returning findings; no edits occurred, and the audit moved to exact local file reads without retrying the external service.
- Next:
  - Run Phase 4 build, real Edge navigation/viewport evidence, visual verdict, and regression gates.

### Phase 2: Test-first behavior contracts
- **Status:** complete
- Actions taken:
  - Observed a valid RED for the missing 2px route-current indicator while confirming React Router already emitted one correct aria-current=page.
  - Observed a valid RED showing /register was still primary, then valid RED results for the absent scroll threshold/lifecycle and absent browser-smoke navigation branch.
  - Corrected one test-only quote-escaping syntax error before accepting RED; no production implementation was written against an invalid test.

### Phase 3: Minimal implementation
- **Status:** complete
- Actions taken:
  - Added the 2px ARIA-selected indicator, truthful /download primary CTA, responsive mobile account access, one passive/cleaned-up scroll effect, and transform-based compact glass state.
  - Extended the existing Home Edge smoke with publicNavigation; syntax-check and the focused navigation suite pass 4/4.

### Phase 4: Browser, responsive, and visual verification
- **Status:** complete
- Actions taken:
  - Retained the original 4/4 T1.3 RED->GREEN implementation cycle, then observed three post-review source contracts RED for missing 881px, 390px/exact-focus, and authenticated-CTA smoke coverage; all focused navigation contracts are now GREEN at 7/7.
  - Passed the real Edge Home smoke at all four primary viewports plus the exact 881px desktop boundary. The 881px row has no overflow or overlap and retains 18px gaps; 820/390 menus focus the first link exactly and restore focus after Escape; authenticated state keeps one /download primary CTA; browserErrors is empty.
  - Recomputed the stable behavior digest as 117c18b46d45856afebc9447464d33ab94e4506f5e8f2d56f8f6ec1157d4b398 and the point-in-time report SHA as f82f4686e4b854849d23b37f7d16e362f7f947886e78fdbc131f6d02017f0615.
  - Compared the current 1440/390 navigation against UI-Design/1.png; visual-verdict iteration 2 remains 94/100 and passed because production visuals did not change.
  - Passed Node 141/141, Python 25/25, Web 2308 modules, Desktop IDE bundling, visual smoke at 13 keyframes / 51 assets, and strict Edge in 230.8s; strict Home and Workbench both report horizontal overflow false.

### Phase 5: Review and handoff
- **Status:** complete
- Actions taken:
  - Evaluated the initial independent review's 2 Medium and 1 Low findings rather than applying speculative CSS. The 881px concern was closed by real geometry evidence, while the two test gaps were closed by browser contracts without production test hooks.
  - Received an independent re-review verdict of APPROVED with no new Critical/High/Medium findings.
  - Synchronized current evidence across STATUS, HANDOFF, TESTING, redesign plans/spec, issue, changelog, implementation notes, and session state while preserving T1.1/T1.2 historical snapshots.
  - Recorded two intermediate smoke-fixture failures caused by the Windows patch transport consuming nested selector quotes; both were corrected at the source with template strings, the modified region was scanned for residual escape damage, and the third full Edge run passed all intended browser assertions.
  - Final audit found no trailing whitespace, conflict markers, stale T1.3 current counts/hashes/next-task wording, or diff whitespace errors; the fresh focused suite passed 7/7 and report/state JSON parsed with the expected hashes and verdict.
- Next:
  - Start T1.4 Features/Pricing/Enterprise without reopening T1.1 Hero, T1.2 public sections, or T1.3 navigation state.

## Session: 2026-08-07

### Phase 1: T1.1 evidence closeout
- **Status:** complete
- Actions taken:
  - Closed the independent review's breakpoint finding with the existing 820 -> 1000 -> 820 browser contract.
  - Added a RED/GREEN test for stable behavior hashing.
  - Detected real screenshot/subpixel drift with two live Edge captures, strengthened the test, and completed a second RED/GREEN cycle.
  - Verified the behavior hash remains `61d18c1e1eecc118be5020530ee310530754df389c8b365df61c56d005b0f16c` across repeated captures.
  - Updated the T1.1 evidence documentation.
- Files created/modified:
  - `app/lib/visual-evidence.mjs`
  - `app/home-hero-visual-smoke.mjs`
  - `tests/home-hero-evidence.test.mjs`
  - `docs/HANDOFF.md`, `docs/STATUS.md`, `docs/TESTING.md`
  - `docs/redesign/README.md`, `docs/redesign/08-execution-plan.md`, `CHANGELOG.md`

### Phase 2: T1.2 component contracts
- **Status:** complete
- Actions taken:
  - Read project design context and public-site specifications.
  - Inventoried existing component names, CSS hooks, and Home composition.
  - Selected a semantic, dependency-free component architecture.
  - Confirmed Home currently has only a three-step workflow and lacks comparison, FAQ, and neutral audience sections.
  - Located `tests/web-ui-primitives.test.mjs` and confirmed the existing Table/Card contracts are reusable.
  - Wrote `docs/plans/2026-08-07-t1-2-public-sections-design.md` with alternatives, component APIs, Home composition, responsive behavior, and verification gates.
- Files created/modified:
  - `docs/plans/2026-08-07-t1-2-public-sections-design.md`
  - `task_plan.md`, `findings.md`, `progress.md`

### Phase 3: T1.2 test-first implementation
- **Status:** complete
- Actions taken:
  - Added the public-section contract suite and observed the expected initial `0/7` RED result.
  - Implemented all seven semantic public components; the focused suite advanced to `5/7`.
  - Reworked Home to consume the seven components, a five-node workflow, a neutral comparison table, a truthful FAQ, and a non-endorsement audience wall.
  - Completed public-section CSS responsiveness, reduced-motion behavior, valid `dt -> dd` semantics, and warning-free StaticRouter SSR fixtures; later browser and visual gates are recorded below.
- Files created/modified:
  - `tests/web-public-sections.test.mjs`
  - `web/src/components/public/_utils.js`
  - `web/src/components/public/SectionHead.jsx`
  - `web/src/components/public/StatRow.jsx`
  - `web/src/components/public/WorkflowRibbon.jsx`
  - `web/src/components/public/FeatureCard.jsx`
  - `web/src/components/public/FAQ.jsx`
  - `web/src/components/public/LogoWall.jsx`
  - `web/src/components/public/CtaBand.jsx`
  - `web/src/pages/Home.jsx`

### Phase 5: Review and handoff
- **Status:** complete
- Actions taken:
  - Restored the cross-session state from `task_plan.md`, `findings.md`, and `progress.md`; implementation and verification phases are complete.
  - Confirmed the independent code review has no blocker and retained the deliberate stable-behavior-hash versus raw-artifact-SHA boundary.
  - Synchronized handoff documentation so T1.1 facts are explicitly historical and current passages record T1.2 completion, `134/134`, `2308` modules, `d5080b...`, and T1.3 as next.
  - Completed three bounded independent read-only audits across status/testing, redesign specifications, and issue/changelog/planning artifacts; all confirmed documentation drift rather than implementation blockers.
  - Completed an independent 12-file final documentation review; resolved its plan-state, interim-hash, broken-table, and duplicate-record findings.
  - Recomputed the current Home report SHA-256 and read the stable digest plus four-viewport metrics directly from the JSON; all matched the synchronized documentation.
  - Ran the final gate: focused T1.2/Home/hash tests 15/15, `git diff --check` exit 0, and the 12-file conflict/stale-fact/whitespace/table/required-fact audit clean.
- Files synchronized:
  - `docs/STATUS.md`, `docs/HANDOFF.md`, `docs/TESTING.md`
  - `docs/redesign/README.md`, `docs/redesign/03-web-site-spec.md`, `docs/redesign/08-execution-plan.md`
  - `docs/plans/2026-08-07-t1-2-public-sections-design.md`, `issues/paper-os-redesign.md`, `CHANGELOG.md`
  - `task_plan.md`, `findings.md`, `progress.md`

## Test Results
| Test | Expected | Actual | Status |
|------|----------|--------|--------|
| `node --test tests/home-hero-evidence.test.mjs` (initial) | RED: helper unavailable | 0/1, expected assertion failure | RED |
| Stable-hash jitter extension (initial) | RED: recaptures differ | 0/1, expected hash inequality | RED |
| Focused Hero/hash suite | 10/10 pass | 10/10 pass | PASS |
| Repeated `npm run home-hero-visual-smoke` (T1.1 historical) | Same behavior hash | Same `61d18c...`, raw file/Screenshot SHAs differ | PASS |
| `node --test` (T1.1 historical full regression) | 0 failures | 125/125 pass | PASS |
| `node --check` for hash/smoke modules | exit 0 | exit 0 | PASS |
| `git diff --check` | no whitespace errors | exit 0; existing CRLF warnings only | PASS |
| `node --test tests/web-public-sections.test.mjs` (initial) | RED: seven components absent | 0/7, expected missing-contract failures | RED |
| `node --test tests/web-public-sections.test.mjs` (components) | Home/CSS remain RED | 5/7 pass | RED |
| `node --test tests/web-public-sections.test.mjs` (Home integrated) | CSS alone remains RED | 6/7 pass; Home composition GREEN | RED |
| StatRow semantic order RED/GREEN | `dt` precedes `dd` in each group | Expected RED observed, then focused 1/1 pass | PASS |
| `node --test tests/web-public-sections.test.mjs` (CSS implemented) | 7/7 pass | 7/7 pass; React Router SSR warnings remain to clean | PASS_WITH_WARNINGS |
| `node --test tests/web-public-sections.test.mjs` (StaticRouter fixture) | 7/7 pass, no warnings | 7/7 pass, clean output | PASS |
| T1.2 browser-smoke source guard (initial) | RED: `verifyPublicSections` absent | 0/1, expected missing-function assertion | RED |
| `node --check app/home-hero-visual-smoke.mjs` | exit 0 | exit 0 | PASS |
| Hero/hash/public focused regression | 14/14 pass | 14/14 pass, clean output | PASS |
| Extended Home Edge smoke (first T1.2 run) | Four/five/two/one-column measurement | Failed at 1440: five rendered columns were parsed as one | RED |
| Extended Home Edge smoke (second T1.2 run) | Public sections pass before anchor check | Four captures passed; anchor inherited full-page bottom scroll and reported top -4561px | RED |
| Extended Home Edge smoke (third T1.2 run) | Isolated anchor reaches aligned target | Timed out while smooth top reset and anchor navigation competed | RED |
| Extended Home Edge smoke (fourth T1.2 run) | FAQ opens from real keyboard input | Four viewports, anchor, and reduced-motion passed; simplified CDP key sequence did not activate native summary | RED |
| Extended Home Edge smoke (fifth T1.2 run) | Full T1.1 + T1.2 browser contract | PASS; Edge 151, browserErrors=0, columns 5/5/2/1, keyboard/reduced-motion/full-page evidence recorded | PASS |
| Visual-verdict iteration 1 | score >= 90 | 78, revise: CTA absent and full-page rhythm/contrast need work | RED |
| Visual-verdict iteration 2 reference/hero inspection | Compare current desktop Hero to `UI-Design/2.png` | Category matches; product preview remains smaller/darker, workflow and mobile sections still require inspection | IN_PROGRESS |
| Visual-verdict iteration 2 | score >= 90 | 84, revise: mobile comparison caption stacks per character; workflow/capture evidence need localized fixes | RED |
| T1.2 responsive/accessibility regression contracts (RED) | New contracts fail for missing behavior | 11/14 pass; expected failures: FAQ region, narrow caption width, smoke caption/connector/top-reset evidence | RED |
| T1.2 responsive/accessibility regression contracts (GREEN) | 14/14 pass with clean output | 14/14 pass; FAQ region, comparison rows/caption, workflow metric, and capture-top contracts green | PASS |
| Post-fix Edge smoke (first run) | Four responsive connector states and full-width caption | Failed at 820 only: connector thickness gate expected visible line although the 641-1080 design intentionally hides connectors; caption ratio 0.9975 | RED |
| Post-fix Edge smoke (corrected run) | Full T1.1 + T1.2 browser contract | PASS; 5/5/2/1 columns, 4/4/0/4 visible connectors, caption ratios >= 0.9947, all capture scrollY 0, browserErrors=0 | PASS |
| Visual-verdict iteration 3 | score >= 90 | 92, pass: caption, workflow legibility, CTA, and capture-top evidence meet the visual threshold | PASS |
| `node --test` (T1.2 full regression) | 0 failures | 134/134 pass, clean completion | PASS |
| `python -m pytest -p no:cacheprovider` | 0 failures | 25/25 pass in 58.51s | PASS |
| `npm run build` | Web + Desktop IDE production build | PASS; Web 2308 modules, IDE bundle emitted | PASS |
| `npm run visual-smoke` | Horizon Atelier static contract | PASS; 13 keyframes, 51 built assets | PASS |
| `npm run browser-visual-smoke` | Default strict Edge, explicit exit 0 | PASS on rerun in 263s; Home/Workbench overflow false, strict/pass report refreshed | PASS |
| Independent code review | No blocking findings | PASS with one rejected medium suggestion: raw PNG hashes remain separate from the stable behavior digest by design | PASS |
| Independent visual review | Direct PNG inspection available | INCONCLUSIVE: reviewer image viewer failed; metadata-only 86 was superseded by main-agent in-memory inspection and 92/100 visual-verdict | INCONCLUSIVE |
| Final focused T1.2/Home/hash suite | 0 failures | 15/15 pass in 6.3s | PASS |
| Final 12-file documentation audit | No conflicts, trailing whitespace, stale facts, broken tables, or missing required facts | All issue arrays empty; all required checks true | PASS |
| Final `git diff --check` | No whitespace errors | exit 0; existing LF/CRLF warnings only | PASS |

## Error Log
| Timestamp | Error | Attempt | Resolution |
|-----------|-------|---------|------------|
| 2026-08-07 | Windows sandbox could not launch built-in apply_patch | 1 | Used Codex native patch executable path. |
| 2026-08-07 | Conflict scan matched separator comments | 1 | Scoped and tightened the marker expression. |
| 2026-08-07 | First behavior-hash algorithm still drifted | 1 | Added real-drift regression test and normalized volatile capture details. |
| 2026-08-07 | Referenced a stale/nonexistent UI test filename | 1 | Switched to repository file discovery before the next read. |
| 2026-08-07 | Managed PowerShell and built-in patch helper both hit `CreateProcessWithLogonW failed: 2` | 1 each | Switched to scoped escalated reads and the verified Codex patch executable. |
| 2026-08-07 | The resumed session''s direct patch helper hit the same Windows sandbox launch failure | 1 | Reused the already-verified Codex patch executable; no retry through the failing helper. |
| 2026-08-07 | Complex PowerShell `rg` pattern had an unterminated quote | 1 | Replaced it with two simple single-quoted searches. |
| 2026-08-07 | Windows `rg` call used an unexpanded `web/src/styles/*.css` path | 1 | Switched to `-g '*.css'` directory search syntax. |
| 2026-08-07 | A scoped Codex patch completed after the shell wrapper's short timeout | 1 | Confirmed the exact text and file timestamp before proceeding; use a longer timeout for subsequent patches. |
| 2026-08-07 | Multi-file patch contained a stray hunk marker | 1 | Patch validation rejected all changes; rebuilt the patch with complete independent hunks. |
| 2026-08-07 | A second cross-file patch repeated the stray hunk marker | 2 | Stopped combining the function edit with logs; replaced the function and planning files in separate patches. |
| 2026-08-07 | Built-in image viewer failed through the Windows sandbox helper | 1 | Reused the verified in-memory `System.Drawing` conversion path and kept JPEG output below the shell truncation threshold. |
| 2026-08-07 | `New-Object System.Drawing.Bitmap` rejected a computed full-page width | 1 | Cast dimensions to integers and used the explicit static constructor; the retry produced the overview successfully. |
| 2026-08-07 | First workflow JPEG reached the shell's approximately 40K output limit and could not be decoded | 1 | Reduced crop width and JPEG quality; the second conversion rendered successfully. |
| 2026-08-07 | First 390px upper-page JPEG also exceeded the shell output limit | 1 | Rescaled the crop to 320px and reduced quality; the decoded image retained enough detail for layout review. |
| 2026-08-07 | Bottom-page crop expression was parsed as object-array subtraction | 1 | Precompute the integer height in the corrected crop command. |
| 2026-08-07 | A multi-file planning patch failed because a PowerShell-variable-bearing context line did not match through the wrapper | 1 | Reapplied with stable headings and variable-free context; the intended record was written. |
| 2026-08-07 | The task-plan patch wrapper timed out after the patch process completed | 1 | Read the exact target lines, confirmed both changes were present, and did not retry. |
| 2026-08-07 | First strict browser-smoke wrapper timed out at 244s after writing a strict/pass report | 1 | Confirmed no child process remained, then reran with a 360s budget and obtained explicit exit 0 after 263s. |
| 2026-08-07 | Session-resume reads failed in the managed Windows sandbox | 1 | Used the already-approved scoped elevated read path; the failed attempt was read-only. |
| 2026-08-07 | Default PowerShell decoding displayed UTF-8 Chinese documentation as mojibake | 1 | Switched to explicit UTF-8 reads before preparing any documentation patch. |
| 2026-08-07 | A planning patch used a stale `findings.md` context line | 1 | The patch was atomically rejected; reapplied with stable heading anchors. |
| 2026-08-07 | Four parallel redesign-document searches exceeded the 20-second wrapper budget | 1 | Split the read into smaller batches and increased the timeout; no document was changed by the timeout. |
| 2026-08-07 | Code-reviewer spawn combined full-history inheritance with an explicit role | 1 | Retried with no history fork and a self-contained review brief. |
| 2026-08-07 | Aggregate final audit treated expected `rg` no-match exit 1 as a script failure | 1 | Reran with per-command result capture so zero-match checks remain explicit evidence. |
| 2026-08-07 | Post-closeout inline Node audit lost an interpolated JSON file array through PowerShell quoting | 1 | Replaced interpolation with the previously successful static single-quoted array and reran the final gate. |

| 2026-08-07 | First T1.3 RED test contained duplicated single quotes from the PowerShell patch wrapper | 1 | Fixed the test quoting and reran until it failed only for the missing 2px indicator. |
| 2026-08-07 | First T1.3 smoke extension over-escaped two nested selectors and failed syntax-check | 1 | Reduced only those two escape boundaries; syntax-check and all four focused contracts then passed. |
| 2026-08-07 | First combined T1.3 planning-record patch contained unescaped Markdown code ticks in its JavaScript wrapper | 1 | The wrapper failed before applying any patch; reran with plain-text record lines. |

## 5-Question Reboot Check
| Question | Answer |
|----------|--------|
| Where am I? | T3.3 Web Workbench AI panel is implemented, verified, and synchronized for handoff; the overall redesign remains Active. |
| Where am I going? | T3.6 real Workbench product capture is the next strict task. |
| What's the goal? | Replace the temporary Hero mock with an evidence-backed product screenshot while preserving T3.3 runtime truth and Preview → Apply safety. |
| What have I learned? | See `findings.md`. |
| What have I done? | Closed T3.3 across provider/runtime metadata, real timeline, proposal review/apply, responsive Workbench, tests, strict Edge evidence, and the complete handoff set. |
