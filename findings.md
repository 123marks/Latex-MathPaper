# Findings & Decisions

## T3.3 Trust Gap and Scope Boundary
- Before T3.3, the Web Workbench could stream chat and the server could preview/apply file blocks, but the UI did not identify the configured provider separately from the runtime that produced the answer.
- The existing inline panel did not render a real lifecycle plan, parse BEGIN_FILE into a reviewable proposal, or expose an exact Preview → Reject/Apply transaction. Static Hero and desktop timeline demonstrations were therefore not acceptable evidence.
- T3.3 stayed inside the Web Workbench AI path, chat metadata, apply-blocks integration, responsive CSS, focused tests, and evidence harness. It did not add dependencies, alter auth/compile/static tabs, promise local model inference, or redesign T1.1–T1.5.

## T3.3 Architecture and Product Decisions
- web/src/lib/ai-execution.js is the pure contract layer: provider normalization, lifecycle plan mapping, buffered SSE parsing, BEGIN_FILE parsing, exact apply request construction, and bounded replacement diff.
- AIAssistantPanel.jsx is presentational. Workbench.jsx remains the coordinator for workspace, editor, API calls, proposal state, Apply/Reject, conflict refresh, rollback/error handling, and tree/clean-buffer refresh.
- Configured provider and response runtime are separate facts. Configured means only that /api/provider reports usable configuration; it never means online. Runtime is established per response by /api/chat metadata.
- mock-local is a deterministic fallback, visibly labelled with its reason, and cannot inherit the configured model name. Provider metadata/error bodies never expose keys or upstream credentials.
- A proposal becomes actionable only after apply-blocks preview returns authoritative path/mtime stamps. Apply reuses the exact assistant text and baseline; Reject performs no write; 409 keeps the proposal but disables stale Apply; rollback reports that no partial write survived.
- At <=640px the Workbench is a vertical file tree → editor → AI workflow. The file tree remains visible because hiding it would remove a core navigation capability.

## T3.3 Failures That Must Not Be Rediscovered
- CDP waitForExpression must return Boolean, not a DOM node; otherwise the protocol can fail with Object reference chain is too long.
- Reduced-motion evidence must read the real ::before computed style. The accepted values are animation-name none, duration 0.001ms, iteration count 1.
- If ?workspace=ai-qa still opens sample-contest, inspect the emitted app/public bundle before changing transaction code. The observed root cause was a stale production bundle missing URLSearchParams workspace deep-link logic.
- The 390px root overflow came from .ide-left retaining 220px 1fr. The accepted fix is the current single-column narrow layout, not hiding the file tree.
- Two final read-only audit agents failed with HTTP 429. No agent conclusion was accepted; the documentation consistency audit proceeded locally.

## T3.3 Verification and Closeout
- Fresh code evidence: Node 164/164, Python 25/25, Web 2316 modules, Desktop IDE bundle, static visual 13 keyframes/52 assets, strict Edge exit 0.
- Browser evidence uses a temporary ai-qa Workspace and two mock-local requests. Reject leaves the file unchanged; Apply changes paper/main.tex from 77 to 197 bytes and records HTTP 200 with written:[paper/main.tex].
- Desktop 1440×1200 and mobile 390×844 both report overflowX:false. The report is schema 2 / verdict pass / strict true and has no accepted browser-error or reduced-motion failure.
- Point-in-time screenshot hashes: ready 69e4b2dcbb605b31c96e1b549807755b195ca17627f1fc82c3266b3f3e9ec3aa; applied f1cde38b737ce9b931842a5c6f113708d84d10b6c9d7ef832df7bfa105e36192; mobile 6c322b746266f42213dd88d85892ae58a79f8f39d67b7f79f0bcef55ddafd850.
- T3.3 is closed. The next strict task is T3.6 real Workbench product capture. T3.6 must consume the verified runtime/proposal state and must not replace it with static steps or configured-provider assumptions.

## T1.5 Start Boundary
- T1.1-T1.4 are verified and closed; T1.5 Login/Register is the next strict atom.
- The approved structure already exists in redesign documentation: shared split auth layout, neutral AuthAside copy, floating code/PDF product fragments, Login/Register Segmented navigation, real dev OAuth endpoints, offline local-project entry, and a local-first account boundary.
- Registration policy must match the server and account API exactly: at least 10 characters and at least two character classes.
- The current role selector is explicitly misleading because the server assigns the first account owner and later accounts member; T1.5 removes the selector instead of creating client-side role semantics.
- Offline entry must point to an existing truthful desktop/download/workbench path. It must not claim browser-local folder access unless the current implementation actually provides it.
- No dependency, new auth API, production SSO claim, sync promise, or T1.1-T1.4 redesign is in scope.

## T1.5 Current Implementation Audit
- `Login.jsx` currently owns the only SSO flow and uses ordinary links for the Login/Register switch; `Register.jsx` has no SSO path, offline entry, or mode control.
- Neither auth page currently renders the approved `Segmented` login/register control, the local-project/offline entry, or the floating code/PDF visual fragments.
- `AuthAside.jsx` still says `Editorial LaTeX · Team First`, uses mathematical-modeling and team-oriented copy, and has no neutral Workspace/Packs/traceability visual narrative.
- Client `passwordHint` mirrors the server's minimum length and two-character-class rule but does not mirror the server's 256-character maximum. The UI needs one shared validator so Login/Register messaging cannot drift.
- The server's OAuth start route is a dev/demo endpoint that returns a same-origin callback URL; public copy must label it as a development flow and never imply production provider readiness.
- The existing `.auth` layout is two-column above the current mobile breakpoint and hides `.auth-aside` below it. The form/card and SSO controls need 44px touch sizing and narrow-screen overflow coverage.
- The existing `.role-pick` rules are dead CSS; no role selector is rendered by Register, so the T1.5 contract should guard against its return and avoid deleting unrelated legacy styles until tests are green.


## T1.5 RED/GREEN Decisions
- The focused RED stabilized at 14/19 pass and five expected production gaps after the auth smoke fixture itself was corrected.
- AuthPanel owns only the right-column form chrome and mode/OAuth/offline controls; each route owns the outer auth grid so AuthAside remains its real sibling.
- Login and Register keep their existing useAuth calls, redirect target, and development OAuth start/callback behavior.
- Registration sends the original server payload only; confirmPassword is client-only and is removed before the API call.
- The shared helper now covers the server boundaries at 10 and 256 characters plus two character classes. Focused SSR/source verification is GREEN at 19/19.

## T1.5 Review and Closeout
- The approved spec review found two small, actionable mismatches: the primary auth labels were still generic (`登录` / `创建账号`) and AuthAside repeated the headline in the first paragraph. The implementation now uses `登录并继续` / `免费开始`, and the paragraph begins with the product explanation instead of repeating the headline.
- The focused contract now locks the approved primary labels and keeps the heading/paragraph hierarchy testable without asserting CSS implementation details.
- The external code-reviewer child exhausted its retry limit with HTTP `429 Too Many Requests`; this is recorded as an evidence limitation, not an approval. The local review covered AuthPanel, AuthAside, Login, Register, password-policy, auth CSS, source contracts, and browser smoke wiring.
- Final evidence remains: focused auth/source `19/19`; full Node `155/155`; Python `25/25`; Web `2312 modules`; Desktop IDE bundle; static visual `13 keyframes / 52 assets`; auth Edge 8 viewports; strict Edge `88.8s`; stable behavior SHA `81651dc06e68a9874ab414ed8610babe81094e9edb79687a68c55a2707802df4`; report SHA `f0dd5bdf2b5cd71eeb02c895359e7b5953544e9659e75cb8e79fab8608bb7a0e`.
- T1.5 is closed. Do not reopen it without a failing regression, a user visual finding, or a new requirement. The redesign stays Active and the next strict task is T3.3 or T3.6.

## T1.4 Start Boundary
- T1.1 Hero, T1.2 public sections, and T1.3 public navigation are verified handoff baselines and must not be reopened without a failing regression.
- The overall redesign is not complete. The next strict atom is T1.4: Features, Pricing, and Enterprise.
- Current Features relies on repeated equal-card grids and includes collaboration/security claims that exceed the verified product boundary.
- Current Pricing lacks the required monthly/yearly Segmented control and FAQ, incorrectly implies local AI inference/no server cost, and needs auditable BYOK/token language.
- Current Enterprise presents SSO, RBAC, SLA, private deployment, and provider-data boundaries too categorically; shipped safeguards must be separated from roadmap or contract-dependent capabilities.
- Three bounded read-only audit agents failed before producing findings because the upstream agent service returned HTTP 503. Local inspection is the active recovery path; do not repeat the same failed delegation immediately.

## T1.4 Product-Truth Contract
- Local-first means Workspace files, document compilation, and local-tool output remain authoritative on the user's machine. It does not mean every model inference is local.
- Model access is user-configured through an OpenAI-compatible provider. Provider requests can leave the machine according to that provider's boundary, and a subscription must not imply bundled model tokens.
- The current provider failure path can fall back to deterministic mock-local output; UI and public copy must never present that fallback as a real model result.
- Current reviewable AI behavior is the compatibility Preview -> Apply path with path safety, mtime conflict detection, and rollback. Durable hunk review, stable Resource versions, crash recovery, and transaction undo remain roadmap.
- Current team/community/admin APIs are partial surfaces, not production-grade real-time collaboration, cloud sync, or multi-agent orchestration.
- Enterprise SSO, RBAC, SLA, dedicated support, and private/internal-network deployment are roadmap or contract-confirmation topics. T1.4 may explain the architecture boundary and provide a human contact link, but must not label these capabilities as shipped.
- Implemented security facts suitable for careful public copy include Workspace-relative path safety, explicit Apply, conflict detection, local compilation, account/provider-key protection described by the architecture, and release-signature primitives only where STATUS confirms the implementation state.
- The approved T1.4 structure is fixed: five alternating Features deep dives, Pricing with Segmented/Table/FAQ/BYOK disclosure, and Enterprise with six qualified capability areas plus a truthful security architecture block.

## T1.4 Pre-Implementation Page Audit (Historical)
- Before T1.4, Features rendered four repeated three-card grids instead of five alternating narrative sections and overclaimed simultaneous multi-user editing, visual merge conflict handling, and sensitive-change audit history.
- Before T1.4, Pricing hard-coded CNY 39 and CNY 99 without a repository source. It also sold cloud sync, team collaboration, shared skill libraries, usage dashboards, private deployment, SSO, audit/SLA, and dedicated support as current entitlements.
- Before T1.4, Pricing hand-built the comparison table and checkmarks, omitted the approved monthly/yearly Segmented control and FAQ, and contained the explicitly forbidden claim that AI inference ran on the user's machine.
- Before T1.4, Enterprise presented all six requested capability headings as shipped and said compilation plus AI inference happened on employee machines with no third-party path. That contradicted the configurable-provider architecture.
- The Enterprise mailto link is an acceptable explicit human contact path if the copy says architecture/scope must be confirmed; it must not imply an implemented sales workflow or guaranteed deployment plan.
- T1.4 should replace repeated card-wall composition with editorial bands and compact product-grounded fragments, reuse existing public/UI primitives, and move page styling out of JSX into scoped classes.

## T1.4 Reuse and Commercial Boundary
- Repository-wide source/document search found CNY 39 and CNY 99 only in Pricing.jsx; there is no product, release, configuration, test, or commercial source authorizing those numbers.
- The Pricing information architecture can retain four plan categories, but public amounts and unshipped entitlements must be labelled pending publication or requiring scope confirmation. A monthly/yearly control may demonstrate the approved billing-period interaction without manufacturing a discount total.
- Existing Segmented is a controlled/uncontrolled radiogroup with arrow/Home/End selection behavior and a sliding indicator driven by CSS variables. Pricing should use it directly.
- Existing Table supplies native caption, column headers, empty state, and responsive data-label cells. Pricing should pass declarative columns/rows and add only contextual classes.
- Existing FAQ uses native details/summary, a labelled region, and the shared icon registry. Existing CtaBand and SectionHead already enforce required text contracts and should anchor page endings/section hierarchy.

## T1.4 Verifiable Security Language
- Implemented: account provider secrets are encrypted at rest with AES-256-GCM; the master key can be operator-supplied or locally generated. Key rotation/migration/backup recovery is not yet automated.
- Implemented: public release manifests are signed with Ed25519 and tamper verification is tested. This does not replace Authenticode/notarization, and the launcher does not yet prove a complete signed update chain.
- Implemented/covered: Workspace-relative path containment includes traversal, absolute-path, root-deletion, and junction/symlink escape tests.
- Implemented/covered: local desktop bootstrap is loopback-bound and one-time; authentication and sensitive endpoints include rate-limit behavior. The broader desktop trust model and CSP still require hardening.
- Partial: AI provider keys are protected, but provider requests follow the configured provider boundary. Copy may say an enterprise can point to a compatible internal endpoint after evaluation, not that all data stays inside the network by default.
- Enterprise page information architecture should label these as Current security foundation, Configurable provider boundary, and Deployment capabilities to confirm, so six requested commercial topics remain findable without becoming false availability claims.

## T1.4 Visual and Responsive Reuse
- pages.css already provides the Horizon Atelier editorial typography, 12-column feature grid, public FAQ focus treatment, and responsive public-section foundations.
- components.css already provides Segmented sliding-indicator motion with reduced-motion removal and Table container-query reflow below 560px. T1.4 should scope page-specific layout only and preserve these behaviors.
- Current real-browser evidence includes browser-app.png plus two desktop-workspace captures. These are candidates for truthful Features product fragments after visual inspection; they must be labelled as actual interface captures and must not be used to imply unverified collaboration or AI execution state.
- The approved responsive evidence remains 1440x900, 1100x720, 820x800, and 390x844. Alternating Features bands should collapse to one column by content need; pricing cards should become two then one columns; the shared Table handles the narrow matrix.

## T1.4 Initial Browser and Visual Evidence (2026-08-07 Historical Snapshot)
- The dedicated real Edge smoke covers Features, Pricing, and Enterprise at 1440x900, 1100x720, 820x800, and 390x844, producing twelve route/viewport screenshots plus a structured report.
- Final browser evidence has browserErrors=0, minimum touch target 44px, maximum capture scrollY=0, and zero horizontal overflow, out-of-bounds elements, or detected text overflow.
- Pricing keyboard evidence records ArrowRight selecting 年付, the recommended plan updating to 年付 · 金额待发布, and Enter opening the first FAQ while focus remains on its summary.
- Three reduced-motion samples collapse the inspected transition/animation durations to the accepted static threshold.
- Visual-verdict is 92/100 pass against UI-Design/3.png for Features and UI-Design/1.png as the shared brand reference. The main difference is a less screenshot-dominant Features first viewport, consistent with the approved five-band narrative.
- Historical stable behavior SHA-256 was 64b3c817aff5c2a7f07e05464eb89eeac52dd06b7e882d14532147508a453ee6; the historical report file SHA-256 was a2de122da08de0f42d7d6b8715369c524c692080e0072b81486d796109ea06c5. These are not the current T1.4 closeout values.

## T1.4 Final Verification Refresh
- The interrupted production build was rerun successfully: Web transformed 2310 modules and the Desktop IDE bundled.
- Fresh regressions pass at focused T1.4 6/6, full Node 147/147, and Python 25/25; static visual smoke reports 13 keyframes and 52 built assets.
- The browser environment requires both Vite on 5174 and the existing backend on 3719 because Vite proxies /api to that backend. Starting only Vite reproduces API 500 with an explicit ECONNREFUSED boundary; no browser-error suppression is valid.
- Fresh T1.4 Edge evidence passes all 12 route/viewport captures with browserErrors=[], 44px minimum touch target, scrollY=0, and zero horizontal/text/out-of-bounds overflow.
- The pre-review repeat produced stable evidence SHA-256 36b7ff867947512fc586ded0a147451fc91086c1cdf8d078c97c9aa62b5faa00 and report SHA-256 709fe0f799f5d103f61a0a53601537e1c2c6edc6076a2f7088dd7db26eecd99f. These are intermediate evidence, not current closeout values.
- Independent review found one Important and two Minor issues. RED/GREEN contracts now prove reduced-motion sampling targets the real Pricing/Enterprise `Reveal` wrappers, each public page has one page-level `h1` while `SectionHead` defaults to `h2`, and the Enterprise header-width selector passes through `Reveal`.
- A second read-only review found no remaining actionable issue and reran the focused contract at 6/6.
- Two consecutive post-fix runs under Edg/151.0.4129.72 produced the same current stable behavior SHA-256, 0bf75be0138cc322228586c76be9390ef182f471c2308d048c1585c062d38f5f. The current point-in-time report SHA-256 is 173c0fffeb941bc57d6ec3aecd6d4d0838697bc73215814b7c3b2b2cf5ce4133.
- The earlier 64b3c8.../a2de12... pair is a historical snapshot and 36b7.../709fe0... is pre-review intermediate evidence. Stable behavior and report-file hashes remain deliberately separate evidence classes.
- The shared Home Edge regression passed after T1.4, and the post-fix strict isolated Edge gate passed in 112.6s with no horizontal overflow on Home or Workbench.

## T1.4 Final Handoff Audit
- The final same-implementation browser artifact parses and independently recomputes to stable behavior SHA-256 `0bf75be0138cc322228586c76be9390ef182f471c2308d048c1585c062d38f5f` and report-file SHA-256 `173c0fffeb941bc57d6ec3aecd6d4d0838697bc73215814b7c3b2b2cf5ce4133`.
- Fresh closeout verification passes at focused Node 6/6, full Node 147/147, Python 25/25, Web 2310 modules plus Desktop IDE bundle, and static visual smoke 13 keyframes/52 assets.
- `git diff --check`, public-pages smoke syntax, and the 11-file Markdown/status audit pass with zero conflict markers, trailing whitespace, table mismatches, stale T1.4-next statements, or hash drift.
- The reproduction contract is two distinct browser gates: `npm run public-pages-visual-smoke` owns Features/Pricing/Enterprise at 3 routes x 4 viewports and requires Vite 5174 plus backend 3719; `npm run browser-visual-smoke` is the separate shared strict Edge gate.
- At the T1.4 closeout checkpoint, T1.5 was the next strict atom and T3.3/T3.6 remained open. Current state supersedes that snapshot: T1.5 and T3.3 are closed; T3.6 is next.

## T1.3 Stable Inputs
- Scope is the remaining public-navigation contract only: scroll shrink, route-aware current item, and truthful primary download CTA.
- Preserve the existing 880px desktop/mobile mutual-exclusion breakpoint, mobile-menu ARIA, Enter/Escape/first-focus/focus-restore lifecycle, and 820->1000->820 unmount behavior.
- Horizon Atelier context is already complete in `.impeccable.md`: serious editorial public chrome, restrained amber, cool-ink/jade semantic support, 44px touch targets, expo/quint motion, and full reduced-motion fallback.
- Do not reopen T1.1 Hero geometry or T1.2 public sections. No new dependency, worktree, schema renderer, or global navigation abstraction is justified.
- Required target contexts remain 1440x900, 1100x720, 820x800, and 390x844 on Windows Edge; desktop fine pointer, tablet/touch hybrid, mobile touch, and keyboard use all matter.
- Approved public-header structure remains left brand, seven central routes (`/`, features, pricing, enterprise, market, community, download), and right account/actions. T1.3 adds `aria-current="page"` plus a 2px amber indicator, makes `/download` the truthful primary CTA, and keeps any onboarding/account action secondary.
- Public navigation stays desktop-only above 880px and menu-only at or below 880px. Scroll shrink must be a restrained state change, not a second breakpoint or a new navigation layout.

## T1.3 Current Implementation Audit
- `SiteHeader` already maps all seven public routes through React Router `NavLink`; its active link receives both `.active` and `aria-current="page"`, so T1.3 needs a semantic regression contract and CSS treatment rather than duplicate location matching.
- The menu trigger already uses the shared Icon registry. The existing two effects own first-link focus, Escape close/focus restore, and `matchMedia("(max-width: 880px)")` cleanup; the scroll effect must remain independent so these lifecycles stay unchanged.
- `.nav-inner` currently always carries `glass-frost`, has fixed `10px 12px 10px 18px` padding, and has no scroll state. `.nav-links a.active` currently uses an amber fill but no 2px indicator.
- The unauthenticated action group still presents `/register` as the primary `免费开始`; the authenticated group has no download action. T1.3 must make `/download` / `下载桌面端` the stable primary action in both auth states while keeping account/workbench actions secondary.
- The 880px rule hides `.nav-links`, while the 640px rule tightens the existing header and menu trigger. These are protected, content-driven breakpoints and no additional navigation breakpoint is needed.
- The approved spec calls for a single stable download emphasis, not another navigation layout: `/download` must be the only primary button, while login/register or workbench/logout remain visually secondary. This preserves the 880px boundary and avoids competing primary actions.
- The scroll implementation should expose one boolean modifier from `scrollY > 40`, attach one passive listener, initialize synchronously inside the effect, and remove exactly the same callback on cleanup. CSS owns the compact geometry and shadow; no RAF loop, scroll interception, or router duplication is warranted.

## T1.3 Implemented Contract
- The four focused contracts were observed RED for the intended missing behavior, then GREEN at 4/4: current-route indicator, download-primary CTA/responsive account access, passive compact-state lifecycle, and Edge-smoke report wiring.
- SiteHeader now keeps /download outside the auth branch as the only primary action. At <=880px, top-row account actions hide and equivalent login/register or Workbench/logout controls remain inside the existing conditionally mounted mobile nav.
- The compact state uses a conditional glass-frost class plus nav--scrolled; visual contraction is a small transform, so no height/padding/top/width animation or scroll interception was introduced.
- The existing Home smoke now measures /pricing at 40px and 41px, current-route semantics, CTA truth, contraction, glass/shadow, overflow, and reduced-motion transition duration in one publicNavigation report branch.
- Fresh Edge evidence records rest state at exactly 40px and compact state at 41px: 58px -> 57.13px, transparent -> rgba(20,20,23,.7), no shadow -> the established chrome shadow, and transform matrix scale .985 / translateY -2px.
- The reduced-motion compact state remains semantically active while transition duration collapses to 1e-06s. /pricing is the only current route, its indicator is 2px, the primary CTA is /download, and browserErrors is empty.
- Independent review found no production defect but identified three evidence gaps: the exact 881px desktop edge, a 390px opened-menu/Escape path with exact first-link focus, and the authenticated CTA branch. Three focused source contracts were observed RED together, then GREEN at 7/7 after extending the real Edge smoke; no production component API, dependency, CSS breakpoint, or navigation item changed.
- Final Edge evidence records 881px with no page/container overflow, no brand/nav or nav/actions overlap, and 18px gaps on both sides of the route group. At both 820px and 390px the opened menu focuses the first Product link exactly, fits the viewport, closes on Escape, and restores focus. An auth bootstrap that only intercepts /api/auth/me proves the authenticated header still has one primary /download CTA and a secondary Workbench action.
- Visual-verdict iteration 2 remains 94/100 and passed because production visuals did not change. The 1440 and 1100 hierarchy remains legible, the 881px row is measured rather than assumed, and the 390 top row cleanly separates brand, download, and the 44px menu.
- The independent re-review is APPROVED with no new Critical/High/Medium findings. Current handoff facts are Node 141/141, Python 25/25, Web 2308 modules, strict Edge 230.8s, stable behavior SHA 117c18b..., and report SHA f82f4686.... Historical T1.1/T1.2 counts and hashes remain labelled snapshots.

## Requirements
- T1.2 must add `SectionHead`, `StatRow`, `WorkflowRibbon`, `FeatureCard`, `FAQ`, `LogoWall`, and `CtaBand`.
- Home must actually use them to compose workflow, capability, comparison/trust, and CTA sections.
- Preserve the Horizon Atelier public-site tone: editorial, serious, local-first, and truth-driven.
- No fabricated compile times, evidence counts, institutions, customer endorsements, provider locality, or shipped roadmap features.
- Responsive evidence must cover 1440x900, 1100x720, 820x800, and 390x844; reduced motion and keyboard use remain gates.

## Research Findings
- `.impeccable.md` supplies complete user, use-case, brand, color, typography, motion, and anti-slop context.
- Existing public pages repeat `.section-head`; Home contains local workflow, capability cards, and `.cta-band` markup, but no comparison table.
- Current Home has capability cards, a three-step workflow, and a CTA, but no comparison section, FAQ, LogoWall, or reusable StatRow. T1.2 therefore requires real composition work, not wrapper-only extraction.
- The T1.2 workflow specification requires five nodes; the current `STEPS` array has only three.
- Existing `Reveal` already centralizes reduced-motion behavior, and `Icon` exposes every semantic needed by the planned Home sections.
- Existing UI `Table` supplies native caption/headers and responsive cell labels, so Home's comparison section can reuse it directly.
- Existing `.card`, `.feature-grid`, `.feature`, `.lane-grid`, `.lane`, `.tbl`, and `.cta-band` styles provide a migration base; T1.2 should rename/extend only where the new semantics require it.
- All seven T1.2 components now exist under `web/src/components/public/` and render independently in SSR tests.
- Home now imports and composes all seven components, expands the workflow to five ordered nodes, and adds comparison, neutral audience, FAQ, and CTA sections without naming unverifiable customers.
- The focused suite's remaining contracts are intentionally concentrated in Home integration and public-section CSS; rerun it after the Home patch before deciding whether the integration assertion or implementation is at fault.
- Fresh focused verification after the Home patch is `6/7`; Home composition is GREEN and the only failing contract is the intentionally missing public-section CSS.
- Because each `FeatureCard` now sits inside a `Reveal`, `.feature-slot` is the twelve-column grid item and must own the span while `.feature` fills its wrapper. Leaving the span only on `.feature` would silently flatten the intended bento layout.
- The new workflow DOM is a five-node ordered track, so its 1080px two-column and 640px vertical reflow must target `.workflow-ribbon__track`; old `.lane-grid` rules are not sufficient.
- Repository-wide JSX search finds no remaining `.lane-grid`/`.lane*` consumer, so that dead Home workflow CSS can be deleted. `.feature-grid/.feature` remain shared by About and Features and must be preserved while adding `.feature-slot` support for Home.
- About and Features place `.feature` directly in the twelve-column grid, while Home places `.feature` inside `.feature-slot`; responsive span rules must therefore target both direct cards and Home wrappers without changing the older pages' DOM.
- `StatRow` initially emitted each definition as `dd` before `dt`. Element counts alone missed this invalid term/definition ordering, so the contract now requires `dt` followed by `dd`; CSS may control visual order without reversing document semantics.
- The existing `marchAnts` keyframe changes SVG `stroke-dashoffset` only, while `WorkflowRibbon` connectors are HTML spans. The ribbon therefore needs its own background-position keyframe plus an explicit reduced-motion stop; reusing `marchAnts` would be a no-op.
- The focused suite reached 7/7 after CSS implementation, but its Home fixture used `MemoryRouter` and emitted SSR-only `useLayoutEffect` warnings. The installed router exposes official `StaticRouter` via `react-router-dom/server.mjs`, which is the correct warning-free fixture for static markup.
- The existing Home smoke already owns the four required viewports, Edge CDP, browser-error capture, anchor/menu/reduced-motion checks, screenshots, and stable evidence hashing. T1.2 should extend that report with one public-section verifier rather than create a parallel browser script.
- `tests/web-home-hero.test.mjs` still binds the Hero stat to the old `<b>4</b>内置 Pack` adjacency. After the valid `dt -> dd` migration, it must assert the labelled definition-list group instead of forcing invalid markup.
- The smoke source guard observed the expected RED before `verifyPublicSections` existed, then the combined Hero/hash/public suite reached 14/14 after wiring the function into the report.
- Full-page screenshot artifacts are stored below a `fullPage.screenshot` key so the existing canonicalizer retains only their stable path while raw bytes/SHA remain in the report.
- The first real T1.2 Edge run correctly failed its new workflow-column gate, but Vite served the five-column rule. Root cause was nested JavaScript escaping: `/\s+/` inside the outer browser-expression template became `/s+/`; the harness must emit `/\\s+/` to the browser.
- Full-page capture intentionally scrolls through every section to trigger `Reveal`; this leaves the last capture at the document bottom. The pre-existing anchor verifier must clear any hash and restore the top baseline before clicking, otherwise test order contaminates its geometry result.
- Clearing the hash alone was insufficient because the page's smooth-scroll policy allowed the top reset and anchor navigation to overlap. The geometry check now temporarily forces root `scroll-behavior:auto`, waits for a zero-scroll baseline, clicks, records diagnostic geometry, and restores the prior inline value.
- CDP's simplified `keyDown/keyUp` pair did not activate native `<summary>` in headless Edge even with focus retained. The browser-equivalent Enter sequence is `rawKeyDown -> char -> keyUp` on a foreground page; using `.click()` would not prove keyboard behavior.
- The fifth real Edge run was an intermediate pass with behavior hash `4994b744ca9890fb00eceb966d2f77441e04af1b08d01c79310e30b8ea149dc0`, zero browser errors, no clipping/out-of-bounds/overflow, workflow columns `5/5/2/1`, FAQ touch heights above 44px, keyboard open/close, and static reduced-motion connector/glow. That hash was superseded after the caption/connector/capture-top corrections; the accepted final digest is `d5080b...` below.
- Visual references are available locally as `UI-Design/1.png` (Home) and `UI-Design/2.png` (workflow), so visual-verdict can use repository evidence rather than an invented target.
- Visual-verdict iteration 1 scored 78/100: direction matched, but the product mock was visually weaker than the reference, the five-node ribbon was low-contrast, section rhythm was uneven, and the final CTA was absent from the full-page capture.
- A bottom crop confirms the CTA's reserved section space is present but its Reveal content is not painted in the capture. `Reveal` uses `whileInView` with a negative viewport margin, so numeric page stepping is insufficient evidence; capture must visit actual section elements and wait for the CTA wrapper's computed opacity.
- The shared UI `Table` already owns native caption/header semantics and a 560px container-query card reflow; Home should add contextual spacing/emphasis only, not duplicate its responsive implementation.
- `docs/redesign/03-web-site-spec.md` requires a five-node workflow ribbon and four neutral evidence categories.
- `LogoWall` is explicitly a neutral audience/trust placeholder and must not name real institutions without evidence.
- T1.2 may use existing `Reveal`, `Icon`, UI primitives, motion tokens, and public CSS; no dependency is needed.
- The T1.2 Phase 5 documentation audit found several then-current passages still described T1.1 as the latest boundary: `125/125`, the old `61d18c...` behavior hash, and T1.2-as-next wording. Those facts now remain only in explicitly historical T1.1 evidence. At that historical closeout the baseline was Node `134/134`, Python `25/25`, Web `2308` modules, behavior hash `d5080b...`, and T1.3 had not started; current T1.3 facts are recorded in the section above.
- The public-site specification must match the delivered contracts: `StatRow` accepts truthful strings rather than implying CountUp by default; the workflow connector state is `4/4/0/4` at 1440/1100/820/390 because the established 820px two-column layout intentionally hides connectors; the neutral comparison uses the five implemented dimensions rather than unverified competitive claims.
- A fresh Phase 5 read of `home-hero-behavior.json` recomputed report SHA `7de8da...` and read `evidenceSha256=d5080b...` directly from the artifact. It also reconfirmed `browserErrors=[]`, workflow columns `5/5/2/1`, visible connectors `4/4/0/4`, caption ratios `0.9984/0.9982/0.9975/0.9947`, CTA opacity >= 0.992, and zero horizontal overflow/clipping/out-of-bounds.
- The final T1.2-era 12-file documentation gate returned no conflict markers, trailing whitespace, stale T1.2-next wording, pending-sync markers, broken Markdown tables, or unlabelled intermediate hash. At that historical checkpoint it confirmed T3.3/T3.6 open; the current T3.3 closeout above supersedes that state.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Component folder is `web/src/components/public/` | Clear ownership boundary between public compositions, motifs, and low-level UI primitives. |
| Direct component imports | Avoids adding another barrel and keeps bundle dependencies explicit. |
| FAQ uses native disclosure | Native keyboard and expanded-state behavior with minimal code. |
| Workflow is an ordered list with decorative connectors | Preserves sequence semantically while allowing responsive reflow. |
| Feature cards support a `wide` modifier only | Meets the asymmetric bento requirement without arbitrary layout props. |
| Stat values accept strings | Prevents forcing count-up or invented numeric data. |
| Reuse the existing UI `Table` for comparison | It already provides correct table semantics and avoids a second table abstraction. |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| Home report file SHA changed after every run | Added report-level `evidenceSha256` over canonical normalized behavior. |
| Screenshot animations and subpixel transforms still changed the first stable hash | Raw screenshot hashes remain in the report but are excluded from behavior-hash input; numeric fields normalize to 0.1px. |
| Attempted to read nonexistent `tests/web-ui-components.test.mjs` | Locate the actual UI primitive test with `rg --files tests`; do not retry the stale filename. |
| `New-Object System.Drawing.Bitmap($w,$h)` rejected a rounded width during full-page scaling | Cast both dimensions to integers and use `[System.Drawing.Bitmap]::new($w, $h)`; the corrected conversion succeeded. |
| Inline height subtraction inside a `New-Object Rectangle(...)` argument was parsed as an object-array operation | Precompute the integer crop height before constructing the rectangle. |
| PowerShell default text decoding displayed the UTF-8 Chinese handoff documents as mojibake | Use `Get-Content -Encoding utf8` or `rg`; the source files themselves remain valid UTF-8. |

## Resources
- `.impeccable.md`
- `docs/redesign/03-web-site-spec.md`
- `docs/redesign/08-execution-plan.md`
- `web/src/pages/Home.jsx`
- `web/src/styles/pages.css`
- `web/src/components/ui/`

## Visual/Browser Findings
- Second-round reference inspection confirms the current Home matches the intended dark editorial/product category, but its desktop Hero product preview remains materially smaller and darker than `UI-Design/2.png`. The reference makes the five-step document workflow the dominant first-viewport story, while the implementation intentionally presents it as a later reusable section; the next verdict must therefore judge workflow legibility and page rhythm rather than require a literal hero clone.
- The managed image viewer still fails with `CreateProcessWithLogonW failed: 2`. In-memory `System.Drawing` JPEG conversion is viable when the base64 payload stays below the shell output truncation limit; quality/scale must be chosen so the payload remains under roughly 40,000 characters.
- The current 1440 full-page capture now includes the final CTA and has a coherent capabilities -> workflow -> comparison -> audience -> FAQ -> CTA sequence. The remaining visual weakness is concentrated in the middle: the five workflow nodes and comparison table read darker and smaller than the surrounding editorial headings, so their information hierarchy needs a close crop before the second verdict.
- The 1440 workflow close-up confirms the ordered content is intact, but the relationship between nodes is expressed mostly by very thin separators and small metadata. Compared with the reference's visible amber path, sequence direction and evidence-band contrast remain too quiet; any next visual edit should strengthen those existing cues without changing the five-node structure.
- The 390px upper-page crop is structurally polished: the Hero headline/actions/product preview do not overlap, and the six capabilities retain an intentional 1+2+1+2 rhythm rather than collapsing into a generic equal-card wall. The remaining mobile concern is the same hierarchy issue as desktop: supporting copy and metadata are small and subdued, so workflow/FAQ close crops must confirm readability.
- The 390px workflow crop shows a clear single-column five-step sequence and intact evidence list, but the comparison table's descriptive heading collapses into one Chinese character per line. This is not geometric clipping, so the browser smoke passes, but it is still an unacceptable mobile reading experience and must be fixed before a 90+ verdict.
- The responsive design pass is anchored to `.impeccable.md`: serious document workers, Horizon Atelier editorial tone, and contrast that does not rely on amber alone. The minimal correction is a full-width narrow-container table caption, stronger existing workflow connectors/index/evidence boundaries using the established charcoal/off-white/cool-ink/jade roles, and a top reset before full-page capture; no new cards, dependencies, or visual language are justified.
- Root cause of the mobile caption defect is in the shared Table container query: `.tbl` becomes `display: block` below 560px, but `caption` is not explicitly made a full-width block, so Edge shrink-wraps it into a narrow column. Root cause of the mid-page fixed-nav artifact is capture order: the smoke restores scroll behavior at the CTA position and immediately takes a clipped full-page screenshot without returning to `scrollY = 0`.
- Home's neutral comparison contains five repository-backed dimensions: project location, compile location, AI write control, Evidence semantics, and extension boundaries. The FAQ wrapper is currently a labelled plain `div`; adding `role="region"` is the smallest landmark improvement because the reusable component does not own a visible heading to reference.
- The first post-fix Edge smoke failed only at 820px because the new thickness gate ignored the established responsive pattern: connectors are hidden from 641-1080px, visible horizontally above 1080px, and re-enabled vertically at 640px and below. The correct runtime contract is 4/4/0/4 visible connectors at 1440/1100/820/390, with thickness >= 1.9px only where visible; the 820 caption ratio already measured 0.9975.
- The corrected Edge run passes end to end with workflow columns 5/5/2/1, visible connectors 4/4/0/4, 2px thickness wherever visible, caption-width ratios 0.9984/0.9982/0.9975/0.9947, `fullPageScrollY=0` at all four viewports, zero clipping/out-of-bounds/overflow, and zero browser errors. The new stable behavior hash is `d5080b1f2451bf3725d6a497a6973ae2a32553a902841694acbf501e0db9840d`; the point-in-time report file SHA is `7de8da881c40173453e355df642d32d2f4c214158ee3726ecd5a07fc0924f7ca`.
- Third-round close crops confirm the browser metrics correspond to real visual improvement: the 390px comparison caption is a normal full-width horizontal heading, the vertical workflow connector reads continuously between all five nodes, and desktop card/index/evidence boundaries are clearer without introducing heavy framing or an equal-card marketing wall.
- The bottom 390px crop confirms the capture-top fix removes the mid-page fixed-navigation artifact; FAQ, CTA, and footer now form one uninterrupted page sequence. Visual-verdict iteration 3 scores 92/100 and passes: the smaller/darker Hero preview and quieter later-page workflow remain deliberate non-blocking differences from the reference.
- The independent visual reviewer could not open local PNGs because its viewer hit the same Windows sandbox fault, so its conservative 86/100 is an evidence-access limitation rather than a contradictory image judgment. Main-agent in-memory review of the flagged states shows 820px as a readable numbered 2+2+1 workflow with a full-width final node; connectors are intentionally absent at 641-1080 per the accepted responsive contract. At 1100x720 the product preview begins within the first viewport with 102px visible, above the existing T1.1 90px gate, and the complete inspectable mock immediately follows; neither warrants reopening T1.1 geometry inside T1.2.
- The combined production build passes with 2308 Web modules and a successful Desktop IDE bundle. Static visual smoke passes with 13 keyframes and 51 built assets. The strict Edge gate required a 360-second wrapper budget in this environment, then completed explicitly at 263 seconds with exit 0, Home/Workbench horizontal overflow false, and a refreshed strict/pass Horizon report.
- Independent code review found no blocker in the FAQ landmark, narrow-table CSS, workflow breakpoint checks, or capture reset. Its one medium comment proposed hashing raw PNG SHA values inside `evidenceSha256`; this is rejected because T1.1 deliberately defines that field as a stable behavior digest and regression-tests exclusion of frame-specific screenshot bytes/hash. Integrity remains covered separately by each PNG artifact SHA and the point-in-time report-file SHA; T1.2 handoff text must keep that dual-hash boundary explicit.
- Historical T1.1 screenshots at 820x800 and 390x844 showed no visible overlap or clipping before T1.2 began; they are not the current T1.2 evidence set.
- Historical T1.1 Edge captures passed with `browserErrors=[]` and stable behavior hash `61d18c1e1eecc118be5020530ee310530754df389c8b365df61c56d005b0f16c`; the current T1.2 digest is `d5080b1f2451bf3725d6a497a6973ae2a32553a902841694acbf501e0db9840d`.
- Raw PNG hashes vary because the animated background is captured at a different frame; they remain point-in-time integrity evidence, not the stable behavior identifier.
- Superseded pre-implementation note: T1.2 browser evidence had not yet been captured at planning time, so T1.1 screenshots could not prove the new sections. T1.2 now has its own completed four-viewport evidence set.
